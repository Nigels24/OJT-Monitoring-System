import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  HOURS_PUNCH_SELECT,
  hasApprovedSession,
  totalApprovedHours,
} from '../common/attendance-hours';
import {
  MS_PER_DAY,
  manilaToday,
  parseMonth,
  startOfUtcDay,
} from '../common/dates';
import { renderDtrPdf } from '../common/dtr-pdf';
import {
  DTR_DAY_SELECT,
  DTR_STUDENT_SELECT,
  buildDtrData,
  dtrDisplayName,
  dtrFileName,
} from './dtr-data';
import {
  EVALUATION_INCLUDE,
  withSectionTotals,
} from '../supervisor/supervisor.service';
import { MAX_SCORE } from '../common/evaluation-scoring';
import {
  evaluationPdfFilename,
  renderEvaluationPdf,
} from '../common/evaluation-pdf';
import {
  CASCADE_TRANSACTION_OPTIONS,
  deleteStudentCascade,
  deleteSupervisorCascade,
} from '../common/cascade-delete';
import { deleteFile, downloadFile } from '../common/storage';
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  documentFileName,
  fileExtension,
  safeFileName,
} from '../common/document-types';
import { DocumentType } from '../../generated/prisma/client';
import { establishmentLabel } from '../common/establishment-identity';
import { deriveFromCourse } from '../common/courses';
import {
  RESEND_ACCOUNT_SELECT,
  buildPersonName,
  isEmailClash,
  reissuePassword,
} from '../common/accounts';

/** Fields the coordinator can set on a student through an edit. */
/**
 * On the nullable fields, `null` and `undefined` mean different things:
 * `null` = the coordinator emptied the box, clear the column; `undefined` =
 * the field wasn't in the request at all, leave the column alone. The DTO's
 * `EmptyToNull` transform is what produces that split. `status` is NOT NULL,
 * so it stays undefined-only.
 *
 * No `yearLevel` or `requiredHours`: both are derived from `course`
 * (`deriveFromCourse`), never accepted from a request.
 */
interface StudentDetails {
  name?: string;
  firstName?: string | null;
  lastName?: string | null;
  middleInitial?: string | null;
  school?: string | null;
  contactNumber?: string | null;
  address?: string | null;
  course?: string | null;
  establishmentId?: string | null;
  startDate?: string | null;
  status?: 'ACTIVE' | 'PENDING' | 'COMPLETED' | 'INACTIVE';
}

/**
 * One supervisor as the coordinator's list shows it. Explicit `select` on the
 * User relation, never `user: true` — that would return the password hash.
 */
const SUPERVISOR_ROW_SELECT = {
  id: true,
  userId: true,
  establishmentId: true,
  position: true,
  user: {
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      createdAt: true,
    },
  },
  establishment: { select: { id: true, name: true, branch: true } },
} as const;

/**
 * Most DTRs one ZIP request will render. Each is a one-page PDF of a few KB,
 * rendered sequentially, so 300 is roughly a few MB of buffers and some
 * seconds of CPU — comfortably inside a small host's memory and a proxy's
 * request timeout. Past it, narrow the filters.
 */
export const DTR_ZIP_LIMIT = 300;

/** The `establishmentId` filter value for students with no establishment — the client's own sentinel. */
export const NO_ESTABLISHMENT = '__none__';

/** `GET /coordinator/attendance/dtr-zip`'s filters; each absent = no filter. */
export interface DtrZipFilters {
  establishmentId?: string;
  course?: string;
  yearLevel?: string;
  status?: 'ACTIVE' | 'PENDING' | 'COMPLETED' | 'INACTIVE';
}

/**
 * ZIP entry names, unique within the archive: "<Last>, <First> - DTR YYYY-MM.pdf",
 * with " (<student ID>)" added for every student whose name is shared
 * (compared case-insensitively), and a counter as the last resort should two
 * still collide once `safeFileName` has stripped their IDs.
 */
function dtrZipEntryNames(
  students: readonly ({ id: string; studentIdNumber: string } & Parameters<
    typeof dtrDisplayName
  >[0])[],
  month: string,
): Map<string, string> {
  const nameCount = new Map<string, number>();
  for (const s of students) {
    const key = dtrDisplayName(s).toLowerCase();
    nameCount.set(key, (nameCount.get(key) ?? 0) + 1);
  }
  const used = new Set<string>();
  const names = new Map<string, string>();
  for (const s of students) {
    const display = dtrDisplayName(s);
    const shared = (nameCount.get(display.toLowerCase()) ?? 0) > 1;
    const base = shared ? `${display} (${s.studentIdNumber})` : display;
    let name = safeFileName(`${base} - DTR ${month}.pdf`);
    for (let n = 2; used.has(name.toLowerCase()); n++) {
      name = safeFileName(`${base} (${n}) - DTR ${month}.pdf`);
    }
    used.add(name.toLowerCase());
    names.set(s.id, name);
  }
  return names;
}

@Injectable()
export class CoordinatorService {
  private readonly logger = new Logger(CoordinatorService.name);

  constructor(private prisma: PrismaService) {}

  async listStudents() {
    const students = await this.prisma.client.student.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            name: true,
            createdAt: true,
          },
        },
        establishment: { select: { id: true, name: true, branch: true } },
        attendances: {
          // Only APPROVED punches can form a counted session.
          select: {
            punches: {
              where: { status: 'APPROVED' },
              select: HOURS_PUNCH_SELECT,
            },
          },
        },
        _count: {
          select: {
            documents: true,
            attendances: true,
            evaluations: true,
          },
        },
      },
      orderBy: { user: { createdAt: 'desc' } },
    });

    // `attendances` is only fetched to total the hours; drop it from the
    // response so the list payload stays small.
    return students.map(({ attendances, ...student }) => ({
      ...student,
      completedHours: totalApprovedHours(attendances),
    }));
  }

  async listSupervisors() {
    const supervisors = await this.prisma.client.supervisor.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            name: true,
            createdAt: true,
          },
        },
        establishment: { select: { id: true, name: true, branch: true } },
        // What deleting this supervisor would take with it (evaluations) and
        // what it would merely un-attribute (punches they approved — kept, so
        // students' hours survive). The confirmation dialog states both.
        _count: {
          select: {
            evaluations: true,
            punchDecisions: { where: { status: 'APPROVED' } },
          },
        },
      },
      orderBy: { user: { createdAt: 'desc' } },
    });

    // Renamed on the way out: the relation counts every decision, but the
    // filter above makes this one approvals only, and the key should say so.
    return supervisors.map(({ _count, ...supervisor }) => ({
      ...supervisor,
      _count: {
        evaluations: _count.evaluations,
        approvedPunches: _count.punchDecisions,
      },
    }));
  }

  /**
   * Aggregates for the coordinator's dashboard.
   *
   * Every figure here is derived from real rows. The page previously rendered
   * module-level mock constants; anything that still has no data source (the
   * unbuilt messaging and documents modules) is absent from this response
   * rather than reported as zero, so the UI can't imply a feature works.
   */
  async getDashboard() {
    const weeksBack = 6;
    const trendStart = startOfWeek(weeksBack - 1);
    // Manila's calendar day, not the server's UTC day — they differ between
    // 00:00 and 07:59 Manila, and `Attendance.date` is written against Manila.
    const todayStart = manilaToday();
    const todayEnd = new Date(todayStart.getTime() + MS_PER_DAY);

    // allSettled, not all: this is the first page after a coordinator logs in,
    // and one rejected query used to throw a raw 500 that blanked the whole
    // screen. Each section now degrades to an empty default, the reason is
    // logged, and `failedSections` tells the client what to offer a retry for.
    const settled = await Promise.allSettled([
      this.prisma.client.student.findMany({ select: { status: true } }),
      this.prisma.client.establishment.count(),
      this.prisma.client.establishment.count({ where: { status: 'ACTIVE' } }),
      this.prisma.client.attendance.findMany({
        where: { punches: { some: { status: 'APPROVED' } } },
        select: {
          punches: {
            where: { status: 'APPROVED' },
            select: HOURS_PUNCH_SELECT,
          },
        },
      }),
      // Punches, not days: each is its own decision a supervisor owes.
      this.prisma.client.attendancePunch.count({
        where: { status: 'PENDING' },
      }),
      // Distinct students who logged anything for today, not raw record count —
      // the unique constraint makes these equal today, but the intent is
      // "how many students turned up".
      this.prisma.client.attendance.findMany({
        where: { date: { gte: todayStart, lt: todayEnd } },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
      this.prisma.client.evaluation.aggregate({
        _avg: { totalRating: true },
      }),
      this.prisma.client.evaluation.count(),
      this.prisma.client.establishment.findMany({
        select: {
          id: true,
          name: true,
          branch: true,
          _count: { select: { students: true } },
        },
        orderBy: { students: { _count: 'desc' } },
        take: 5,
      }),
      this.prisma.client.student.findMany({
        include: {
          user: { select: { name: true, createdAt: true } },
          establishment: { select: { name: true, branch: true } },
          attendances: {
            select: {
              punches: {
                where: { status: 'APPROVED' },
                select: HOURS_PUNCH_SELECT,
              },
            },
          },
        },
        orderBy: { user: { createdAt: 'desc' } },
        take: 5,
      }),
      // Punches by status, bucketed by the day they belong to.
      this.prisma.client.attendancePunch.findMany({
        where: { attendance: { date: { gte: trendStart } } },
        select: { status: true, attendance: { select: { date: true } } },
      }),
      // The denominator the average is meaningful against: the currently
      // published sheet's item count. Not a constant any more — the sheet is a
      // versioned template the coordinator owns.
      this.prisma.client.evaluationTemplateItem.count({
        where: { section: { template: { status: 'PUBLISHED' } } },
      }),
    ] as const);

    const failedSections = new Set<string>();
    const fail = (section: string, reason: unknown) => {
      failedSections.add(section);
      this.logger.error(
        `Coordinator dashboard section "${section}" failed: ` +
          (reason instanceof Error ? reason.message : String(reason)),
      );
    };

    const [
      students,
      establishmentCount,
      activeEstablishments,
      approvedAttendance,
      pendingCount,
      presentToday,
      evaluationAgg,
      evaluationCount,
      topEstablishments,
      recentStudents,
      trendRows,
      publishedItemCount,
    ] = [
      settledOr(settled[0], [], 'stats', fail),
      settledOr(settled[1], 0, 'stats', fail),
      settledOr(settled[2], 0, 'stats', fail),
      settledOr(settled[3], [], 'stats', fail),
      settledOr(settled[4], 0, 'stats', fail),
      settledOr(settled[5], [], 'stats', fail),
      settledOr(settled[6], { _avg: { totalRating: null } }, 'stats', fail),
      settledOr(settled[7], 0, 'stats', fail),
      settledOr(settled[8], [], 'topEstablishments', fail),
      settledOr(settled[9], [], 'recentStudents', fail),
      settledOr(settled[10], [], 'attendanceTrend', fail),
      settledOr(settled[11], 0, 'stats', fail),
    ] as const;

    // Every single query failing is not a degraded page, it is an outage —
    // report it rather than rendering a dashboard of confident zeroes.
    if (settled.every((result) => result.status === 'rejected')) {
      throw new ServiceUnavailableException(
        'The dashboard is temporarily unavailable. Please try again.',
      );
    }

    // The official sheet's TOTAL RATING, averaged across evaluations — a raw
    // score, not a percentage. `averageLevel` is gone with the old rubric's
    // performance bands; the form has no such label.
    //
    // The denominator is the *currently published* sheet's maximum. Evaluations
    // written on earlier versions were scored out of their own maximum, which
    // may differ, so this average is only strictly meaningful against the
    // published number while every sheet shares a version. null when nothing is
    // published, the same null-not-zero rule the average itself follows.
    const averageRating = evaluationAgg._avg?.totalRating ?? null;
    const maxTotalRating =
      publishedItemCount > 0 ? publishedItemCount * MAX_SCORE : null;

    return {
      /** Sections whose data could not be loaded; the client offers a retry. */
      failedSections: [...failedSections],
      stats: {
        totalStudents: students.length,
        activeStudents: students.filter((s) => s.status === 'ACTIVE').length,
        completedStudents: students.filter((s) => s.status === 'COMPLETED')
          .length,
        partnerEstablishments: establishmentCount,
        activeEstablishments,
        presentToday: presentToday.length,
        pendingApprovals: pendingCount,
        totalHoursLogged: totalApprovedHours(approvedAttendance),
        // null rather than 0 when nothing has been evaluated — a real average
        // of zero and "no data yet" are different things.
        averageRating:
          averageRating == null ? null : Math.round(averageRating * 10) / 10,
        maxTotalRating,
        totalEvaluations: evaluationCount,
      },
      // The prototype charted present/late/absent. Those states do not exist —
      // punches are PENDING/APPROVED/DECLINED — so the real statuses are
      // charted (one count per punch) instead of inventing the other three.
      attendanceTrend: buildWeeklyTrend(
        trendRows.map((p) => ({ date: p.attendance.date, status: p.status })),
        weeksBack,
      ),
      topEstablishments: topEstablishments.map((e) => ({
        id: e.id,
        name: e.name,
        branch: e.branch,
        studentCount: e._count.students,
      })),
      recentStudents: recentStudents.map(
        ({ attendances, user, establishment, ...student }) => ({
          id: student.id,
          studentIdNumber: student.studentIdNumber,
          name: user.name,
          course: student.course,
          establishment: establishment
            ? establishmentLabel(establishment)
            : null,
          startDate: student.startDate,
          requiredHours: student.requiredHours,
          completedHours: totalApprovedHours(attendances),
          status: student.status,
        }),
      ),
    };
  }

  /**
   * Attendance percentage per student, across every establishment.
   *
   * Read-only oversight, deliberately unscoped like getDashboard() and
   * listEvaluations() — the coordinator's remit is the whole programme.
   *
   * "Attendance percentage" exists nowhere else in this codebase (every other
   * view reports completedHours/requiredHours), so it is defined here:
   * present days — days with at least one session whose In and Out punches
   * are both APPROVED — over calendar days elapsed since the student started.
   * Calendar days, not school days — the schema has no school-calendar concept,
   * so students with different start dates or weekend-heavy periods are only
   * roughly comparable.
   */
  /**
   * Cross-establishment attendance, one row per student.
   *
   * `month` (`YYYY-MM`, validated by the DTO) is the only server-side filter,
   * because it changes the figures; establishment, course, year level and
   * status filter client-side over these rows. Definitions — identical with
   * and without a month, only the window differs:
   *
   * - **window**: all-time = [startDate, today]; with a month =
   *   [max(month start, startDate), min(month end, today)] — Manila's today.
   * - **presentDays**: days in the window with at least one approved session
   *   (In and Out both APPROVED — `hasApprovedSession`).
   * - **approvedHours**: hours of those sessions (`totalApprovedHours`).
   * - **totalDays**: calendar days in the window, inclusive; `0` when the
   *   window is empty (start date after the month, a future month) or the
   *   student has no startDate.
   * - **attendancePercentage**: round(presentDays / totalDays × 100), or
   *   `null` when totalDays is 0 — never a division by zero, never a fake 0%.
   *
   * A student with no startDate has no lower bound for presentDays/hours
   * (the count stays honest about what was logged) but no totalDays, so the
   * percentage is null either way. Every student is returned, zeros included.
   */
  async getAttendanceOversight(month?: string) {
    // Manila's calendar day — see getDashboard.
    const today = manilaToday();
    const range = month ? parseMonth(month) : null;
    if (month && !range) {
      // The DTO already rejects this; kept so the service is safe on its own.
      throw new BadRequestException('month must be YYYY-MM');
    }

    // Upper bound of every window: today, or the month's last day if earlier.
    const windowEnd = range && range.end < today ? range.end : today;

    // Two flat queries, no N+1: the per-student lower bound (startDate) is a
    // correlated bound Prisma can't express in a filtered count, so rows are
    // bucketed here. Explicit selects only.
    const [students, approvedRows] = await Promise.all([
      this.prisma.client.student.findMany({
        select: {
          id: true,
          studentIdNumber: true,
          course: true,
          yearLevel: true,
          status: true,
          startDate: true,
          establishmentId: true,
          user: { select: { name: true } },
          establishment: { select: { name: true, branch: true } },
        },
        orderBy: { user: { createdAt: 'desc' } },
      }),
      this.prisma.client.attendance.findMany({
        where: {
          date: {
            ...(range ? { gte: range.start } : {}),
            lt: new Date(windowEnd.getTime() + MS_PER_DAY),
          },
          punches: { some: { status: 'APPROVED' } },
        },
        select: {
          studentId: true,
          date: true,
          punches: {
            where: { status: 'APPROVED' },
            select: HOURS_PUNCH_SELECT,
          },
        },
      }),
    ]);

    // Only days with a whole approved session are present days, and only
    // their sessions carry approved hours — so nothing else is kept.
    const sessionDaysByStudent = new Map<
      string,
      { date: Date; punches: (typeof approvedRows)[number]['punches'] }[]
    >();
    for (const row of approvedRows) {
      if (!hasApprovedSession(row.punches)) continue;
      const days = sessionDaysByStudent.get(row.studentId) ?? [];
      days.push({ date: row.date, punches: row.punches });
      sessionDaysByStudent.set(row.studentId, days);
    }

    return students.map((student) => {
      const startDay = student.startDate
        ? startOfUtcDay(student.startDate)
        : null;
      // The window's lower bound. With no startDate: the month's start (or
      // none at all-time) for counting what was logged.
      let windowStart: Date | null = range?.start ?? null;
      if (startDay && (!windowStart || startDay > windowStart)) {
        windowStart = startDay;
      }

      const inWindow = (sessionDaysByStudent.get(student.id) ?? []).filter(
        (day) =>
          (!windowStart || day.date >= windowStart) && day.date <= windowEnd,
      );

      const totalDays =
        startDay && windowStart && windowStart <= windowEnd
          ? Math.floor(
              (windowEnd.getTime() - windowStart.getTime()) / MS_PER_DAY,
            ) + 1
          : 0;
      const presentDays = inWindow.length;

      return {
        id: student.id,
        studentIdNumber: student.studentIdNumber,
        name: student.user.name,
        course: student.course,
        yearLevel: student.yearLevel,
        status: student.status,
        establishmentId: student.establishmentId,
        establishmentName: student.establishment
          ? establishmentLabel(student.establishment)
          : null,
        presentDays,
        totalDays,
        approvedHours: totalApprovedHours(inWindow),
        // null, not 0, when there is no window to measure against — the same
        // "no data vs zero" distinction as the dashboard's averageRating.
        attendancePercentage:
          totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : null,
      };
    });
  }

  /**
   * One student's Daily Time Record for a month, as PDF bytes plus the
   * download name. 404 for an unknown student; the month is validated by the
   * DTO (and again here).
   *
   * One bounded query for the month's days (`date` in [1st, 1st of next
   * month), the Manila calendar every `Attendance.date` is stored in), with
   * only APPROVED punches selected — PENDING and DECLINED can't print because
   * they are never fetched. Each day is placed by its own `date`, never by a
   * punch's UTC timestamp, so a 07:30 Manila punch (23:30 UTC the day before)
   * lands on the right row. The total is `totalApprovedHours` over the same
   * days: complete approved sessions only.
   */
  async getStudentDtr(studentId: string, month: string) {
    const range = parseMonth(month);
    if (!range) {
      throw new BadRequestException('month must be YYYY-MM');
    }

    const student = await this.prisma.client.student.findUnique({
      where: { id: studentId },
      select: DTR_STUDENT_SELECT,
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const days = await this.prisma.client.attendance.findMany({
      where: { studentId, date: { gte: range.start, lt: range.next } },
      select: DTR_DAY_SELECT,
    });

    const body = await renderDtrPdf(buildDtrData(student, range, days));
    // "Dela Cruz, Juan - DTR 2026-10.pdf": surname first, as the DTR is filed.
    // Accents are kept; attachmentDisposition adds the RFC 5987 form.
    return { filename: dtrFileName(student, month), body };
  }

  /**
   * Every matching student's DTR for one month, as ZIP entries — built whole
   * before the controller writes a header, like the documents ZIP, so a
   * failure is a clean error and never a truncated archive.
   *
   * Who is in it: students matching the filters (the attendance page's own
   * semantics — exact match on establishment id, course, year level and
   * status; `establishmentId: NO_ESTABLISHMENT` = students with none) **and**
   * with at least one APPROVED punch on a day of that month. Nobody else gets
   * a blank DTR. Zero → 404; more than `DTR_ZIP_LIMIT` → 400 before anything
   * is rendered.
   *
   * Two queries whatever the student count: the matching students (the
   * approved-punch condition is a relation filter on the same query), then
   * all their days of the month with APPROVED punches only. The month window
   * is `Attendance.date` in [1st, 1st of next month) — the Manila calendar,
   * exactly as the single DTR. Each PDF comes from the same `buildDtrData`
   * and renderer as the single route, rendered one at a time.
   */
  async getDtrZip(month: string, filters: DtrZipFilters) {
    const range = parseMonth(month);
    if (!range) {
      throw new BadRequestException('month must be YYYY-MM');
    }
    const monthDays = { gte: range.start, lt: range.next };

    const students = await this.prisma.client.student.findMany({
      where: {
        ...(filters.establishmentId === NO_ESTABLISHMENT
          ? { establishmentId: null }
          : filters.establishmentId
            ? { establishmentId: filters.establishmentId }
            : {}),
        ...(filters.course ? { course: filters.course } : {}),
        ...(filters.yearLevel ? { yearLevel: filters.yearLevel } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        attendances: {
          some: { date: monthDays, punches: { some: { status: 'APPROVED' } } },
        },
      },
      select: { id: true, studentIdNumber: true, ...DTR_STUDENT_SELECT },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    if (students.length === 0) {
      throw new NotFoundException(
        'No approved attendance for that month with these filters',
      );
    }
    if (students.length > DTR_ZIP_LIMIT) {
      throw new BadRequestException(
        `${students.length} students match — a ZIP holds at most ${DTR_ZIP_LIMIT} DTRs. Narrow the filters (establishment, course, year level or status).`,
      );
    }

    const days = await this.prisma.client.attendance.findMany({
      where: {
        studentId: { in: students.map((s) => s.id) },
        date: monthDays,
      },
      select: { studentId: true, ...DTR_DAY_SELECT },
    });
    const daysByStudent = new Map<string, typeof days>();
    for (const day of days) {
      const list = daysByStudent.get(day.studentId) ?? [];
      list.push(day);
      daysByStudent.set(day.studentId, list);
    }

    const names = dtrZipEntryNames(students, month);
    // Sequential: one PDF in memory being drawn at a time (finished ones are
    // small buffers), and no burst of CPU on a small host.
    const entries: { name: string; buffer: Buffer }[] = [];
    for (const student of students) {
      const buffer = await renderDtrPdf(
        buildDtrData(student, range, daysByStudent.get(student.id) ?? []),
      );
      entries.push({ name: names.get(student.id)!, buffer });
    }

    return { filename: `DTR ${month}.zip`, entries };
  }

  /**
   * Every evaluation across every establishment — read-only oversight.
   *
   * Unlike the supervisor's list this is deliberately not scoped: the
   * coordinator's remit is the whole OJT programme.
   */
  async listEvaluations() {
    const evaluations = await this.prisma.client.evaluation.findMany({
      include: EVALUATION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    // Coordinators never edit or delete an evaluation — it belongs to the
    // supervisor who wrote it — so the row says so explicitly rather than
    // leaving the client to assume.
    return evaluations.map((evaluation) => ({
      ...withSectionTotals(evaluation),
      canModify: false,
    }));
  }

  /**
   * One evaluation as a printable PDF, for the coordinator to forward.
   *
   * The service fetches and the renderer draws — `common/evaluation-pdf.ts`
   * never touches the database. `EVALUATION_INCLUDE` joins the template the
   * sheet was *signed* on, so the file prints that version's items, wording and
   * maximum whatever has been published since.
   */
  async getEvaluationPdf(evaluationId: string) {
    const evaluation = await this.prisma.client.evaluation.findUnique({
      where: { id: evaluationId },
      include: EVALUATION_INCLUDE,
    });
    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }

    const sheet = withSectionTotals(evaluation);
    return {
      filename: evaluationPdfFilename(sheet),
      body: await renderEvaluationPdf(sheet),
    };
  }

  async updateStudent(studentId: string, data: StudentDetails) {
    const student = await this.prisma.client.student.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // The course decides the year level and required hours, so they move only
    // when the course does. Unchanged or absent leaves all three alone, which
    // is what lets a student saved before the current list (another course,
    // 1st/3rd year, hand-typed hours) keep those values until the course is
    // deliberately changed. A change must name an offered course; clearing it
    // (null) is not one, because the hours would have nothing to follow.
    const courseChanged =
      data.course !== undefined && data.course !== student.course;
    let derived: { yearLevel: string; requiredHours: number } | null = null;
    if (courseChanged) {
      derived = deriveFromCourse(data.course);
      if (!derived) {
        throw new BadRequestException(
          data.course == null
            ? 'Course is required'
            : `"${data.course}" is not an offered course`,
        );
      }
    }

    // Name lives on User, everything else on Student.
    const fullName = buildFullName(data, null);
    if (fullName) {
      await this.prisma.client.user.update({
        where: { id: student.userId },
        data: { name: fullName },
      });
    }

    return this.prisma.client.student.update({
      where: { id: studentId },
      data: { ...studentProfileData(data), ...derived },
      include: {
        user: { select: { id: true, email: true, name: true } },
        establishment: { select: { id: true, name: true, branch: true } },
      },
    });
  }

  /**
   * Edits a supervisor's name, email and position. Not the establishment (a
   * supervisor is created inside one and stays there) and never the username,
   * which is how they sign in and was generated once.
   *
   * The name is stored only as `User.name`, so the parts are required
   * together: sending any of them rebuilds the whole name from what was sent,
   * exactly as create composed it. Sending none leaves the name alone.
   *
   * One nested write, so User and Supervisor change together or not at all.
   */
  async updateSupervisor(
    supervisorId: string,
    data: {
      firstName?: string;
      middleInitial?: string | null;
      lastName?: string;
      email?: string;
      position?: string | null;
    },
  ) {
    const supervisor = await this.prisma.client.supervisor.findUnique({
      where: { id: supervisorId },
      select: { id: true, userId: true },
    });
    if (!supervisor) {
      throw new NotFoundException('Supervisor not found');
    }

    const touchesName =
      data.firstName !== undefined ||
      data.middleInitial !== undefined ||
      data.lastName !== undefined;
    const firstName = data.firstName?.trim();
    const lastName = data.lastName?.trim();
    if (touchesName && (!firstName || !lastName)) {
      throw new BadRequestException(
        'firstName and lastName are required when changing the name',
      );
    }

    if (data.email !== undefined) {
      const clash = await this.prisma.client.user.findUnique({
        where: { email: data.email },
        select: { id: true },
      });
      if (clash && clash.id !== supervisor.userId) {
        throw new ConflictException('Email already in use');
      }
    }

    try {
      return await this.prisma.client.supervisor.update({
        where: { id: supervisorId },
        data: {
          position: data.position,
          user: {
            update: {
              email: data.email,
              name: touchesName
                ? buildPersonName({
                    firstName,
                    middleInitial: data.middleInitial,
                    lastName,
                  })
                : undefined,
            },
          },
        },
        select: SUPERVISOR_ROW_SELECT,
      });
    } catch (err) {
      // Claimed by someone else between the check above and this write.
      if (isEmailClash(err)) {
        throw new ConflictException('Email already in use');
      }
      throw err;
    }
  }

  /**
   * "Resend login" for a student or supervisor: a new generated password,
   * shown once in the response, and a forced change at next sign-in.
   *
   * This is the recovery path for a forgotten password. It replaced the old
   * reset, where the coordinator typed the new password: generating it keeps
   * the coordinator from choosing (and so knowing) a password the user keeps,
   * since the flag makes the user replace it on first use. It stops at
   * COORDINATOR accounts, which only the CLI can reset.
   *
   * The username is never regenerated. An account from before usernames
   * existed (`username: null`) keeps signing in with its email, which the
   * response includes for that case.
   */
  async resendStudentCredentials(studentId: string) {
    const student = await this.prisma.client.student.findUnique({
      where: { id: studentId },
      select: { id: true, user: { select: RESEND_ACCOUNT_SELECT } },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return {
      id: student.id,
      ...(await reissuePassword(this.prisma.client, student.user)),
    };
  }

  async resendSupervisorCredentials(supervisorId: string) {
    const supervisor = await this.prisma.client.supervisor.findUnique({
      where: { id: supervisorId },
      select: { id: true, user: { select: RESEND_ACCOUNT_SELECT } },
    });
    if (!supervisor) {
      throw new NotFoundException('Supervisor not found');
    }
    return {
      id: supervisor.id,
      ...(await reissuePassword(this.prisma.client, supervisor.user)),
    };
  }

  /**
   * The documents checklist: one row per student — including students who
   * have submitted nothing — with one cell per requirement type, either
   * `null` (not submitted) or the submitted file's summary.
   *
   * Starts from Student, not Document, precisely so the empty rows exist. No
   * signed URLs are minted here: viewing and downloading go through
   * `GET /coordinator/documents/:id/download`, so the list costs one query
   * instead of one Supabase round trip per file (CLAUDE.md §8 item 13).
   */
  async getDocuments() {
    const students = await this.prisma.client.student.findMany({
      select: {
        id: true,
        studentIdNumber: true,
        user: { select: { name: true } },
        establishment: { select: { id: true, name: true, branch: true } },
        documents: {
          select: {
            id: true,
            type: true,
            originalFileName: true,
            fileUrl: true,
            uploadedAt: true,
          },
        },
      },
      orderBy: { user: { name: 'asc' } },
    });

    return students.map((student) => {
      const documents = Object.fromEntries(
        DOCUMENT_TYPES.map((type) => [type, null]),
      ) as Record<
        DocumentType,
        { id: string; uploadedAt: Date; fileName: string } | null
      >;
      for (const doc of student.documents) {
        documents[doc.type] = {
          id: doc.id,
          uploadedAt: doc.uploadedAt,
          fileName: documentFileName(doc),
        };
      }

      return {
        id: student.id,
        name: student.user.name,
        studentIdNumber: student.studentIdNumber,
        establishment: student.establishment,
        submittedCount: student.documents.length,
        documents,
      };
    });
  }

  /** One document's bytes and the name to download it under. */
  async getDocumentFile(documentId: string) {
    const document = await this.prisma.client.document.findUnique({
      where: { id: documentId },
      select: { type: true, originalFileName: true, fileUrl: true },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const file = await this.fetchStoredFile(document.fileUrl);
    return { filename: documentFileName(document), ...file };
  }

  /**
   * The files to put in one student's ZIP, already fetched, with their entry
   * names. `ids` empty means every document that student has.
   *
   * Every requested id must belong to `studentId`: the route names one
   * student, and an id from another student's checklist would otherwise slip
   * that student's file into this one's archive under this one's name.
   */
  async getStudentDocumentsZip(studentId: string, ids: string[]) {
    const student = await this.prisma.client.student.findUnique({
      where: { id: studentId },
      select: { user: { select: { name: true } } },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const documents = await this.prisma.client.document.findMany({
      where: {
        studentId,
        ...(ids.length > 0 ? { id: { in: ids } } : {}),
      },
      select: { id: true, type: true, fileUrl: true },
    });

    if (ids.length > 0) {
      const found = new Set(documents.map((d) => d.id));
      const missing = ids.filter((id) => !found.has(id));
      if (missing.length > 0) {
        throw new BadRequestException(
          `These documents do not belong to this student: ${missing.join(', ')}`,
        );
      }
    }
    if (documents.length === 0) {
      throw new NotFoundException(
        'This student has not submitted any documents',
      );
    }

    const studentName = safeFileName(student.user.name);
    // Checklist order, so the archive lists them the way the table does.
    documents.sort(
      (a, b) => DOCUMENT_TYPES.indexOf(a.type) - DOCUMENT_TYPES.indexOf(b.type),
    );

    // Sequential: at most six files, and it keeps the memory peak and the
    // load on Storage predictable. Every file is fetched before the response
    // starts, so a storage failure is a clean error, not a truncated ZIP.
    const entries: { name: string; buffer: Buffer }[] = [];
    for (const doc of documents) {
      const { buffer } = await this.fetchStoredFile(doc.fileUrl);
      entries.push({
        // Unique per archive: one document per type per student.
        name: `${DOCUMENT_TYPE_LABEL[doc.type]} - ${studentName}${fileExtension(doc.fileUrl)}`,
        buffer,
      });
    }

    return { filename: `${studentName} - OJT Documents.zip`, entries };
  }

  /** A missing object is the likeliest failure — say so, rather than a bare 500. */
  private async fetchStoredFile(path: string) {
    try {
      return await downloadFile(path);
    } catch (err) {
      this.logger.error(
        `Could not fetch storage object "${path}": ` +
          (err instanceof Error ? err.message : String(err)),
      );
      throw new ServiceUnavailableException(
        'The file could not be retrieved from storage',
      );
    }
  }

  /**
   * Deletes a student outright, along with every row that references them.
   *
   * This used to refuse the delete whenever attendance, evaluations or
   * documents existed, and told the coordinator to set the student INACTIVE
   * instead. It is now a real cascade: the ordering lives in
   * `deleteStudentCascade` and runs inside one transaction, so a failure
   * part-way through rolls everything back rather than orphaning rows.
   */
  async removeStudent(studentId: string) {
    const student = await this.prisma.client.student.findUnique({
      where: { id: studentId },
      select: { userId: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const orphanedFiles = await this.prisma.client.$transaction(
      (tx) => deleteStudentCascade(tx, studentId, student.userId),
      CASCADE_TRANSACTION_OPTIONS,
    );
    await this.deleteStudentFiles(studentId, orphanedFiles);

    return { id: studentId, deleted: true };
  }

  /**
   * Deletes several students who have finished their OJT.
   *
   * Validation is all-or-nothing: every id must exist and be COMPLETED, or the
   * whole request is a 400 naming the offenders and nothing is deleted. Past
   * that, each student is the same `deleteStudentCascade` the single delete
   * runs, in **its own** transaction — so one failure rolls back only that
   * student and is reported in `failed`, rather than undoing the rest.
   * Sequential, not `Promise.all`: each transaction is a pooled connection,
   * and a hundred of them at once would exhaust the pool.
   */
  async bulkRemoveStudents(rawIds: string[]) {
    const ids = [...new Set(rawIds)];
    const students = await this.prisma.client.student.findMany({
      where: { id: { in: ids } },
      select: { id: true, userId: true, status: true },
    });
    const byId = new Map(students.map((s) => [s.id, s]));

    const offenders = ids.flatMap((id) => {
      const student = byId.get(id);
      if (!student) return [{ id, reason: 'Student not found' }];
      if (student.status !== 'COMPLETED') {
        return [{ id, reason: `Status is ${student.status}, not COMPLETED` }];
      }
      return [];
    });
    if (offenders.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message:
          'Only students who completed OJT can be bulk deleted. Nothing was deleted. ' +
          offenders.map((o) => `${o.id}: ${o.reason}`).join('; '),
        offenders,
      });
    }

    const deleted: string[] = [];
    const failed: { id: string; reason: string }[] = [];
    for (const id of ids) {
      const { userId } = byId.get(id)!;
      try {
        const orphanedFiles = await this.prisma.client.$transaction(
          async (tx) => {
            // Re-checked inside the transaction: the status could have been
            // edited between the validation above and this student's turn.
            const current = await tx.student.findUnique({
              where: { id },
              select: { status: true },
            });
            if (current?.status !== 'COMPLETED') {
              throw new Error('No longer COMPLETED');
            }
            return deleteStudentCascade(tx, id, userId);
          },
          CASCADE_TRANSACTION_OPTIONS,
        );
        deleted.push(id);
        await this.deleteStudentFiles(id, orphanedFiles);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.error(`Bulk delete of student ${id} failed: ${reason}`);
        failed.push({ id, reason });
      }
    }

    return { deleted, failed };
  }

  /**
   * Supabase Storage is not part of the transaction, so a deleted student's
   * objects go only after the commit. A leftover file is recoverable; a
   * half-deleted database is not — so a storage failure is logged and the
   * delete still reports success. Never throws.
   */
  private async deleteStudentFiles(studentId: string, paths: string[]) {
    await Promise.all(
      paths.map(async (path) => {
        try {
          await deleteFile(path);
        } catch (err) {
          this.logger.error(
            `Student ${studentId} was deleted but its storage object ${path} was not: ` +
              (err instanceof Error ? err.message : String(err)),
          );
        }
      }),
    );
  }

  /**
   * Deletes a supervisor and their login.
   *
   * Their evaluations go with them, but attendance they actioned stays and
   * merely loses its approver — a student's approved hours must survive their
   * supervisor leaving. See `deleteSupervisorCascade`.
   */
  async removeSupervisor(supervisorId: string) {
    const supervisor = await this.prisma.client.supervisor.findUnique({
      where: { id: supervisorId },
      select: { userId: true },
    });
    if (!supervisor) {
      throw new NotFoundException('Supervisor not found');
    }

    await this.prisma.client.$transaction(
      (tx) => deleteSupervisorCascade(tx, supervisorId, supervisor.userId),
      CASCADE_TRANSACTION_OPTIONS,
    );

    return { id: supervisorId, deleted: true };
  }
}

const MS_PER_WEEK = 7 * MS_PER_DAY;

/** Monday 00:00 UTC, `weeksAgo` weeks back from the current week. */
function startOfWeek(weeksAgo = 0): Date {
  const now = new Date();
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  const monday = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysSinceMonday,
  );
  return new Date(monday - weeksAgo * MS_PER_WEEK);
}

/**
 * Buckets attendance into the last `weeks` Monday-started weeks.
 *
 * Weeks with no activity still appear, so the chart shows a real gap rather
 * than silently compressing the timeline.
 */
function buildWeeklyTrend(
  rows: { date: Date; status: string }[],
  weeks: number,
) {
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const start = startOfWeek(weeks - 1 - i);
    return {
      start,
      label: start.toISOString().slice(5, 10), // MM-DD
      approved: 0,
      pending: 0,
      declined: 0,
    };
  });

  for (const row of rows) {
    const index = buckets.findLastIndex((b) => row.date >= b.start);
    if (index === -1) continue;
    const bucket = buckets[index];
    if (row.status === 'APPROVED') bucket.approved += 1;
    else if (row.status === 'PENDING') bucket.pending += 1;
    else if (row.status === 'DECLINED') bucket.declined += 1;
  }

  return buckets.map(({ start, ...rest }) => rest);
}

/** Maps the flat DTO onto Student columns, skipping anything not supplied. */
/**
 * Passes the three-way state of a date field through to Prisma intact:
 * absent -> `undefined` (leave the column alone), explicitly cleared ->
 * `null`, otherwise the parsed `Date`. The old `value ? new Date(value) :
 * undefined` collapsed "cleared" into "unchanged", so a date could never be
 * removed once set.
 */
function toNullableDate(value?: string | null): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

/**
 * The edit's profile fields. `school` is deliberately excluded — the school
 * is permanent (`SCHOOL_NAME`), never client-editable. The supervisor's create
 * (`SupervisorService.createStudent`) sets it explicitly; `updateStudent`
 * never touches the column at all, so any
 * `school` value in the request body is silently ignored rather than
 * rejected (`StudentDetailsDto` still declares the field so a client that
 * sends it isn't 400'd by `forbidNonWhitelisted`).
 */
function studentProfileData(data: StudentDetails) {
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    middleInitial: data.middleInitial,
    contactNumber: data.contactNumber,
    address: data.address,
    course: data.course,
    establishmentId: data.establishmentId,
    startDate: toNullableDate(data.startDate),
    status: data.status,
  };
}

/**
 * User.name is the single display name the rest of the app reads, but the
 * coordinator's form collects first/middle/last separately. Compose it, falling
 * back to an explicit `name` when the parts are absent.
 */
function buildFullName(
  data: StudentDetails,
  fallback: string | null = '',
): string | null {
  const parts = [data.firstName, data.middleInitial, data.lastName]
    .map((part) => part?.trim())
    .filter(Boolean);

  if (parts.length > 0) return parts.join(' ');
  if (data.name?.trim()) return data.name.trim();
  return fallback;
}

/**
 * Reads one `Promise.allSettled` slot, falling back to an empty default and
 * reporting the failure instead of taking the whole response down with it.
 *
 * Typed against the tuple `allSettled` returns, so each call keeps the exact
 * type of its own query — no casts.
 */
function settledOr<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
  section: string,
  onFail: (section: string, reason: unknown) => void,
): T {
  if (result.status === 'fulfilled') return result.value;
  onFail(section, result.reason);
  return fallback;
}

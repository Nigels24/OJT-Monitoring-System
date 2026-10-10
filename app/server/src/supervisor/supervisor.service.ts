import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  DAY_SELECT,
  HOURS_PUNCH_SELECT,
  PUNCH_LABEL,
  lastApprovedDay,
  PUNCH_SELECT,
  summarizeDay,
  totalApprovedHours,
} from '../common/attendance-hours';
import {
  SheetTemplate,
  buildSections,
  sheetDefinition,
  templateMaxTotalRating,
  totalRating,
} from '../common/evaluation-scoring';
import { establishmentLabel } from '../common/establishment-identity';
import { CASCADE_TRANSACTION_OPTIONS } from '../common/cascade-delete';
import { deriveFromCourse } from '../common/courses';
import { SCHOOL_NAME } from '../common/school';
import {
  RESEND_ACCOUNT_SELECT,
  assertEmailAvailable,
  buildPersonName,
  isEmailClash,
  isUniqueClashOn,
  deliverCredentials,
  issueNewAccount,
  reissuePassword,
} from '../common/accounts';
import { EvaluationTemplateService } from '../evaluation-template/evaluation-template.service';

type AttendanceStatus = 'PENDING' | 'APPROVED' | 'DECLINED';

/** What a supervisor sends to create a student — see CreateStudentDto. */
interface NewStudentInput {
  studentIdNumber: string;
  firstName: string;
  middleInitial?: string;
  lastName: string;
  email: string;
  course: string;
  contactNumber?: string;
  address?: string;
  startDate?: string;
}

/**
 * A created student as the roster shows one (`GET /supervisor/students`'s row,
 * plus the name parts and username). Explicit `select` on User — never the
 * password hash.
 */
const NEW_STUDENT_SELECT = {
  id: true,
  studentIdNumber: true,
  firstName: true,
  middleInitial: true,
  lastName: true,
  course: true,
  yearLevel: true,
  requiredHours: true,
  contactNumber: true,
  address: true,
  startDate: true,
  status: true,
  establishmentId: true,
  user: {
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      credentialsSentAt: true,
      credentialsEmailError: true,
    },
  },
} as const;

/**
 * Deliberately the same words whoever holds the ID: it must not reveal which
 * student or establishment has it.
 */
const STUDENT_ID_TAKEN = 'This student ID is already registered';

@Injectable()
export class SupervisorService {
  private readonly logger = new Logger(SupervisorService.name);

  constructor(
    private prisma: PrismaService,
    private templates: EvaluationTemplateService,
    private mail: MailService,
  ) {}

  private async getSupervisorByUserId(userId: string) {
    const supervisor = await this.prisma.client.supervisor.findUnique({
      where: { userId },
    });
    if (!supervisor) {
      throw new NotFoundException('Supervisor profile not found');
    }
    return supervisor;
  }

  async getDashboard(userId: string) {
    const supervisor = await this.prisma.client.supervisor.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        establishment: {
          select: { id: true, name: true, branch: true, industryType: true },
        },
      },
    });
    if (!supervisor) {
      throw new NotFoundException('Supervisor profile not found');
    }

    // allSettled, not all: the evaluation page reads this endpoint too, so one
    // rejected query used to take down more than the dashboard. Each half
    // degrades to empty, the reason is logged, and `failedSections` tells the
    // client what to offer a retry for.
    const settled = await Promise.allSettled([
      this.prisma.client.student.findMany({
        where: { establishmentId: supervisor.establishmentId },
        select: { id: true, status: true, requiredHours: true },
      }),
      this.prisma.client.attendance.findMany({
        where: { student: { establishmentId: supervisor.establishmentId } },
        select: {
          student: { select: { status: true } },
          punches: { select: { ...HOURS_PUNCH_SELECT, decidedAt: true } },
        },
      }),
    ] as const);

    const failedSections = new Set<string>();
    const fail = (section: string, reason: unknown) => {
      failedSections.add(section);
      this.logger.error(
        `Supervisor dashboard section "${section}" failed: ` +
          (reason instanceof Error ? reason.message : String(reason)),
      );
    };

    const students = settledOr(settled[0], [], 'students', fail);
    const attendances = settledOr(settled[1], [], 'attendance', fail);

    if (settled.every((result) => result.status === 'rejected')) {
      throw new ServiceUnavailableException(
        'The dashboard is temporarily unavailable. Please try again.',
      );
    }

    const weekStart = startOfWeek();
    // Counted in punches, not days — each is its own decision. A finished
    // batch should not keep showing up as work to do, but its approved hours
    // still count toward the establishment's running total.
    const allPunches = attendances.flatMap((a) => a.punches);
    const activePunches = attendances
      .filter((a) => a.student.status !== 'COMPLETED')
      .flatMap((a) => a.punches);

    return {
      /** Sections whose data could not be loaded; the client offers a retry. */
      failedSections: [...failedSections],
      supervisor: {
        id: supervisor.id,
        name: supervisor.user.name,
        email: supervisor.user.email,
        position: supervisor.position,
      },
      establishment: supervisor.establishment,
      stats: {
        totalStudents: students.length,
        activeStudents: students.filter((s) => s.status === 'ACTIVE').length,
        completedStudents: students.filter((s) => s.status === 'COMPLETED')
          .length,
        pendingApprovals: activePunches.filter((p) => p.status === 'PENDING')
          .length,
        // By when the decision was made — the old per-day version used the
        // row's createdAt. Punches migrated from the per-day model have a null
        // decidedAt (never recorded) and so never count as "this week".
        approvedThisWeek: allPunches.filter(
          (p) =>
            p.status === 'APPROVED' && p.decidedAt && p.decidedAt >= weekStart,
        ).length,
        declinedCount: activePunches.filter((p) => p.status === 'DECLINED')
          .length,
        // Hours this establishment has signed off across all its students:
        // sessions with both punches approved.
        totalApprovedHours: totalApprovedHours(attendances),
      },
    };
  }

  /**
   * Attendance days for every student at this supervisor's establishment, each
   * with its punches nested, so In and Out are read side by side.
   *
   * `status` narrows to days with at least one punch in that status — so
   * `PENDING` is the queue of days still owing a decision. Omitting it returns
   * all of them.
   */
  async getAttendance(
    userId: string,
    status?: AttendanceStatus,
    includeCompleted = false,
  ) {
    const supervisor = await this.getSupervisorByUserId(userId);

    const days = await this.prisma.client.attendance.findMany({
      where: {
        student: {
          establishmentId: supervisor.establishmentId,
          // Students marked COMPLETED are a finished OJT batch. Their logs stay
          // in the database — nothing is deleted — but they drop out of the
          // working queue so the next intake starts with a clean board.
          ...(includeCompleted ? {} : { status: { not: 'COMPLETED' } }),
        },
        ...(status ? { punches: { some: { status } } } : {}),
      },
      select: {
        ...DAY_SELECT,
        student: {
          select: {
            id: true,
            studentIdNumber: true,
            course: true,
            requiredHours: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    return days.map(({ punches, ...day }) => ({
      ...day,
      ...summarizeDay(punches),
    }));
  }

  /**
   * Students assigned to this supervisor's establishment — the roster and the
   * evaluation picker.
   *
   * Each row adds `completedHours` (the approved hours) and `lastApprovedDay`
   * (the date the evaluation's Training Date Ended will take, or `null`), so
   * the picker can show the gate and both derived dates without a request per
   * student. One `findMany`: Prisma loads the nested attendances and punches
   * with one query per relation level for the whole establishment, so the
   * query count doesn't grow with the number of students.
   */
  async getStudents(userId: string) {
    const supervisor = await this.getSupervisorByUserId(userId);

    const students = await this.prisma.client.student.findMany({
      where: { establishmentId: supervisor.establishmentId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            // The credentials email's last outcome, for the roster's badge.
            credentialsSentAt: true,
            credentialsEmailError: true,
          },
        },
        // Only APPROVED punches can ever form a counted session, so the rest
        // are not fetched.
        attendances: {
          select: {
            date: true,
            punches: {
              where: { status: 'APPROVED' },
              select: HOURS_PUNCH_SELECT,
            },
          },
        },
      },
      orderBy: { user: { name: 'asc' } },
    });

    return students.map(({ attendances, ...student }) => ({
      ...student,
      completedHours: totalApprovedHours(attendances),
      lastApprovedDay: lastApprovedDay(attendances),
    }));
  }

  /**
   * Creates a student account at the caller's own establishment.
   *
   * Ownership: `establishmentId` comes ONLY from the caller's supervisor row,
   * found through the JWT's `userId` — the DTO has no such field, so a body
   * naming another establishment is a 400 before it gets here.
   *
   * User and Student are written in one transaction (sequential awaits — an
   * interactive transaction is one connection, CLAUDE.md §8 item 19), so a
   * failure leaves no login without a profile. A lost username race rolls it
   * back and `issueNewAccount` retries the whole thing. The plaintext password
   * exists only in the returned `credentials`.
   *
   * A taken student ID is a 409 with a fixed message that names no student or
   * establishment; a taken email is the usual 409. Both are pre-checked for a
   * clean message and caught again as P2002 for the race.
   */
  async createStudent(userId: string, data: NewStudentInput) {
    const supervisor = await this.getSupervisorByUserId(userId);

    // The DTO restricts `course` to the offered list; this is the service's
    // guarantee that no student exists without the year level and hours their
    // course implies.
    const derived = deriveFromCourse(data.course);
    if (!derived) {
      throw new BadRequestException(
        `"${data.course}" is not an offered course`,
      );
    }

    // Trimmed: the username is built from the names, and a stray space would
    // let the same student ID in twice.
    const firstName = data.firstName.trim();
    const lastName = data.lastName.trim();
    const studentIdNumber = data.studentIdNumber.trim();
    if (!firstName || !lastName || !studentIdNumber) {
      throw new BadRequestException(
        'studentIdNumber, firstName and lastName are required',
      );
    }

    await assertEmailAvailable(this.prisma.client, data.email);
    const idTaken = await this.prisma.client.student.findUnique({
      where: { studentIdNumber },
      select: { id: true },
    });
    if (idTaken) {
      throw new ConflictException(STUDENT_ID_TAKEN);
    }

    const { result, credentials } = await issueNewAccount(
      this.prisma.client,
      firstName,
      lastName,
      (username, passwordHash) =>
        this.prisma.client.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: data.email,
              username,
              password: passwordHash,
              mustChangePassword: true,
              name: buildPersonName({
                firstName,
                middleInitial: data.middleInitial,
                lastName,
              }),
              role: 'STUDENT',
            },
            select: { id: true },
          });
          return tx.student.create({
            data: {
              userId: user.id,
              studentIdNumber,
              firstName,
              middleInitial: data.middleInitial?.trim() || null,
              lastName,
              contactNumber: data.contactNumber,
              address: data.address,
              course: data.course,
              yearLevel: derived.yearLevel,
              requiredHours: derived.requiredHours,
              // Date-only: "2026-10-12" parses as UTC midnight of that day,
              // the convention every date-only column follows (§4 dates.ts).
              startDate: data.startDate ? new Date(data.startDate) : null,
              school: SCHOOL_NAME,
              // Always the caller's — never from the request.
              establishmentId: supervisor.establishmentId,
              status: 'ACTIVE',
            },
            select: NEW_STUDENT_SELECT,
          });
        }, CASCADE_TRANSACTION_OPTIONS),
    ).catch((err: unknown) => {
      if (isUniqueClashOn(err, 'studentIdNumber')) {
        throw new ConflictException(STUDENT_ID_TAKEN);
      }
      if (isEmailClash(err)) {
        throw new ConflictException('Email already in use');
      }
      throw err;
    });

    // After the commit — issueNewAccount resolves only once the transaction
    // has — and never able to undo it.
    const outcome = await deliverCredentials(
      this.prisma.client,
      this.mail,
      {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: 'STUDENT',
      },
      credentials,
    );
    // Nothing approved yet; the field keeps the roster's row shape.
    return { ...result, completedHours: 0, credentials, ...outcome };
  }

  /**
   * "Resend login" for one of the caller's own students: a new generated
   * password, a forced change at next sign-in, `{ id, name, email,
   * credentials }` — the same code and shape as the coordinator's.
   *
   * A student at another establishment is a 404, not a 403, so this route
   * can't be used to discover which student ids exist elsewhere.
   */
  async resendStudentCredentials(userId: string, studentId: string) {
    const supervisor = await this.getSupervisorByUserId(userId);
    const student = await this.prisma.client.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        establishmentId: true,
        user: { select: RESEND_ACCOUNT_SELECT },
      },
    });
    if (!student || student.establishmentId !== supervisor.establishmentId) {
      throw new NotFoundException('Student not found');
    }
    return {
      id: student.id,
      ...(await reissuePassword(this.prisma.client, this.mail, student.user)),
    };
  }

  /**
   * Marks a student's OJT finished, or puts them back in the active queue.
   *
   * This is the non-destructive answer to "clear the board for the next batch":
   * a COMPLETED student disappears from the approval queue and dashboard
   * counts, but every attendance record they built up is preserved for the
   * coordinator's reports and for any later dispute over hours worked.
   */
  async setStudentStatus(
    userId: string,
    studentId: string,
    status: 'ACTIVE' | 'COMPLETED',
  ) {
    const supervisor = await this.getSupervisorByUserId(userId);

    const student = await this.prisma.client.student.findUnique({
      where: { id: studentId },
    });
    // Another establishment's student is the same 404 as an unknown id, so
    // this route can't be used to discover which student ids exist elsewhere.
    if (!student || student.establishmentId !== supervisor.establishmentId) {
      throw new NotFoundException('Student not found');
    }

    return this.prisma.client.student.update({
      where: { id: studentId },
      data: { status },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  /** Approves one PENDING punch. Decisions are final: anything else is a 409. */
  async approvePunch(userId: string, punchId: string) {
    return this.decidePunch(userId, punchId, {
      status: 'APPROVED',
      declineReason: null,
    });
  }

  /** Declines one PENDING punch, with the reason the student will see. */
  async declinePunch(userId: string, punchId: string, reason: string) {
    return this.decidePunch(userId, punchId, {
      status: 'DECLINED',
      declineReason: reason,
    });
  }

  private async decidePunch(
    userId: string,
    punchId: string,
    decision: {
      status: 'APPROVED' | 'DECLINED';
      declineReason: string | null;
    },
  ) {
    const supervisor = await this.getSupervisorByUserId(userId);
    const punch = await this.verifyPunchBelongsToSupervisor(
      punchId,
      supervisor.establishmentId,
    );
    const studentId = punch.attendance.student.id;
    const approving = decision.status === 'APPROVED';

    // One transaction, sequential awaits only (CLAUDE.md §8 item 19): the
    // decision, the hours check and the auto-COMPLETED write commit together
    // or not at all.
    return this.prisma.client.$transaction(async (tx) => {
      // Approvals of one student's punches run one at a time. Without this,
      // two concurrent approvals (the In and the Out of the same session, say)
      // each see only their own write under READ COMMITTED: neither sees the
      // session complete, so neither notices the crossing and the student is
      // never completed. The lock is on the student row, taken before any
      // punch row, and a decline never takes it — declines can't complete.
      const before = approving ? await lockAndReadHours(tx, studentId) : null;

      // `status: 'PENDING'` in the filter is the finality rule and a
      // compare-and-set at once: a punch already decided — or decided by
      // someone else a moment ago — matches nothing and is left untouched.
      const { count } = await tx.attendancePunch.updateMany({
        where: { id: punchId, status: 'PENDING' },
        data: {
          ...decision,
          decidedById: supervisor.id,
          decidedAt: new Date(),
        },
      });
      if (count === 0) {
        // Re-read: the status fetched above may predate a decision made by
        // someone else in between. Nothing was written, so the rollback the
        // throw causes is a no-op.
        const current = await tx.attendancePunch.findUnique({
          where: { id: punchId },
          select: { status: true },
        });
        throw new ConflictException(
          `This ${PUNCH_LABEL[punch.kind]} punch has already been ${
            current?.status === 'DECLINED' ? 'declined' : 'approved'
          }. Decisions are final.`,
        );
      }

      let completedStudent: {
        name: string;
        approvedHours: number;
        requiredHours: number;
      } | null = null;

      if (before) {
        const after = totalApprovedHours(await approvedDays(tx, studentId));
        // Only the approval that crosses the line completes anyone: a student
        // already at or past it who was set back to ACTIVE by hand stays
        // ACTIVE. A requirement of 0 is "not set", never "already met".
        const crossed =
          before.requiredHours > 0 &&
          before.approvedHours < before.requiredHours &&
          after >= before.requiredHours;
        if (crossed) {
          // Compare-and-set on ACTIVE: never from INACTIVE or PENDING, and a
          // status changed by hand meanwhile is left alone.
          const { count: flipped } = await tx.student.updateMany({
            where: { id: studentId, status: 'ACTIVE' },
            data: { status: 'COMPLETED' },
          });
          if (flipped === 1) {
            completedStudent = {
              name: before.name,
              approvedHours: after,
              requiredHours: before.requiredHours,
            };
          }
        }
      }

      const decided = await tx.attendancePunch.findUniqueOrThrow({
        where: { id: punchId },
        select: { ...PUNCH_SELECT, attendanceId: true },
      });
      return {
        ...decided,
        studentCompleted: completedStudent !== null,
        completedStudent,
      };
    }, CASCADE_TRANSACTION_OPTIONS);
  }

  /**
   * Ownership check, walked punch -> day -> student -> establishment. The
   * punch id comes from the URL; it implies nothing about whose it is.
   */
  private async verifyPunchBelongsToSupervisor(
    punchId: string,
    establishmentId: string,
  ) {
    const punch = await this.prisma.client.attendancePunch.findUnique({
      where: { id: punchId },
      select: {
        kind: true,
        status: true,
        attendance: {
          select: { student: { select: { id: true, establishmentId: true } } },
        },
      },
    });
    if (!punch) {
      throw new NotFoundException('Punch not found');
    }
    if (punch.attendance.student.establishmentId !== establishmentId) {
      throw new ForbiddenException(
        'This punch belongs to a different establishment',
      );
    }
    return punch;
  }

  /**
   * Writes one official evaluation sheet.
   *
   * Repeatable by design — there is no uniqueness constraint on
   * (studentId, supervisorId), because a student is evaluated more than once
   * over a placement.
   */
  /**
   * A new evaluation — only for a student whose OJT is COMPLETED.
   *
   * Order: ownership first (403 for a student outside this establishment, as
   * before), then the COMPLETED gate (409, naming the approved hours against
   * the requirement so the supervisor sees how far off it is). The gate is
   * create-only: an existing evaluation of a student who is no longer
   * COMPLETED stays editable and deletable.
   *
   * Training Date Started / Ended are derived here and snapshotted onto the
   * row, never read from the request (the DTO has no such fields): the
   * student's `startDate`, and the last day with an approved session
   * (`lastApprovedDay`). Either is `null` when there is nothing to derive it
   * from — never today's date.
   */
  async createEvaluation(userId: string, data: EvaluationInput) {
    const supervisor = await this.getSupervisorWithHeaderFields(userId);
    const student = await this.verifyStudentUnderSupervisor(
      data.studentId,
      supervisor.establishmentId,
    );
    const training = await this.completedTraining(data.studentId);

    // A new sheet is always written on the currently published version, and
    // keeps that version for good.
    const template = await this.templates.getPublishedTemplate();
    const scores = this.templates.validateScores(template, data.scores);

    const created = await this.prisma.client.evaluation.create({
      data: {
        studentId: data.studentId,
        supervisorId: supervisor.id,
        templateId: template.id,
        scores: { create: scores },
        // Both derived here, never read from the request — otherwise a caller
        // could submit low scores alongside a full total.
        totalRating: totalRating(toScoreMap(scores)),
        // Frozen with the sheet: a later version with more or fewer items must
        // not change what this one was scored out of.
        maxTotalRating: templateMaxTotalRating(template),
        ...this.headerFields(supervisor, student),
        trainingStartedAt: training.startedAt,
        trainingEndedAt: training.endedAt,
        comments: data.comments,
        recommendations: data.recommendations,
      },
      include: EVALUATION_INCLUDE,
    });

    // Same shape as the list endpoints, so a freshly created evaluation can be
    // rendered without a refetch.
    return { ...withSectionTotals(created), canModify: true };
  }

  /**
   * Edits an evaluation this supervisor wrote, recomputing the total.
   *
   * Authorship (`supervisorId`) is the only guard, and it is sufficient: the
   * student's current placement is irrelevant to a sheet you already signed.
   * Requiring the student to still be at your establishment locked the author
   * out of their own sheet the moment the student moved.
   */
  async updateEvaluation(
    userId: string,
    evaluationId: string,
    data: Omit<EvaluationInput, 'studentId'>,
  ) {
    const supervisor = await this.getSupervisorByUserId(userId);
    const existing = await this.verifyEvaluationBelongsToSupervisor(
      evaluationId,
      supervisor.id,
    );

    // The version this sheet was signed on, never the currently published one:
    // an old evaluation keeps its own item set, wording and maximum, so an edit
    // validates against that and nothing else.
    const template = await this.templates.getTemplateById(existing.templateId);
    const scores = this.templates.validateScores(template, data.scores);

    const updated = await this.prisma.client.$transaction(async (tx) => {
      // Sequential inside the transaction, never Promise.all — an interactive
      // transaction is one connection.
      await tx.evaluationScore.deleteMany({ where: { evaluationId } });
      await tx.evaluationScore.createMany({
        data: scores.map((score) => ({ evaluationId, ...score })),
      });
      return tx.evaluation.update({
        where: { id: evaluationId },
        data: {
          totalRating: totalRating(toScoreMap(scores)),
          // `maxTotalRating` is deliberately not rewritten: it was frozen with
          // a template version that is immutable, so it cannot have moved.
          //
          // No header field is touched. The training dates,
          // `trainingEmployedAt`, `evaluatorName` and `evaluatorPosition` are
          // all write-time snapshots and are deliberately NOT recomputed here:
          // re-deriving them from the student's *current* record would let
          // later attendance or a reassignment rewrite a signed sheet. The
          // dates are not accepted from the request either (DTO).
          comments: data.comments,
          recommendations: data.recommendations,
        },
        include: EVALUATION_INCLUDE,
      });
    }, CASCADE_TRANSACTION_OPTIONS);

    return { ...withSectionTotals(updated), canModify: true };
  }

  /** Hard-deletes an evaluation this supervisor wrote, and its scores. */
  async removeEvaluation(userId: string, evaluationId: string) {
    const supervisor = await this.getSupervisorByUserId(userId);
    await this.verifyEvaluationBelongsToSupervisor(evaluationId, supervisor.id);

    // The schema has no onDelete: Cascade, so the score rows go first or the
    // foreign key aborts the delete.
    await this.prisma.client.$transaction(async (tx) => {
      await tx.evaluationScore.deleteMany({ where: { evaluationId } });
      await tx.evaluation.delete({ where: { id: evaluationId } });
    }, CASCADE_TRANSACTION_OPTIONS);

    return { id: evaluationId, deleted: true };
  }

  /**
   * The form's header fields other than the training dates.
   *
   * `trainingEmployedAt`, `evaluatorName` and `evaluatorPosition` are
   * snapshotted from the current rows rather than joined on read, so renaming
   * or deleting a supervisor later cannot rewrite a sheet that was already
   * signed off.
   */
  private headerFields(
    supervisor: { position: string | null; user: { name: string } },
    student: { establishment: { name: string; branch: string | null } | null },
  ) {
    return {
      // With the branch: "Jollibee (Pagadian)" is the place, and a sheet must
      // say which one. Written on create only, so existing sheets keep the
      // snapshot they were signed with.
      trainingEmployedAt: student.establishment
        ? establishmentLabel(student.establishment)
        : null,
      evaluatorName: supervisor.user.name,
      evaluatorPosition: supervisor.position,
    };
  }

  /**
   * The COMPLETED gate and the derived training dates, for a student already
   * known to be at this supervisor's establishment.
   *
   * One query: the student with only their APPROVED punches (nothing else can
   * form a counted session), from which the shared rules in
   * `common/attendance-hours.ts` give both the approved hours and the last
   * approved day — the same definitions every dashboard uses.
   */
  private async completedTraining(studentId: string) {
    const student = await this.prisma.client.student.findUniqueOrThrow({
      where: { id: studentId },
      select: {
        status: true,
        startDate: true,
        requiredHours: true,
        attendances: {
          select: {
            date: true,
            punches: {
              where: { status: 'APPROVED' },
              select: HOURS_PUNCH_SELECT,
            },
          },
        },
      },
    });

    if (student.status !== 'COMPLETED') {
      const approved = totalApprovedHours(student.attendances);
      throw new ConflictException(
        `This student has not completed OJT yet (${approved} / ${student.requiredHours} hrs)`,
      );
    }

    return {
      startedAt: student.startDate,
      endedAt: lastApprovedDay(student.attendances),
    };
  }

  /** The supervisor plus the two columns the sheet's header snapshots. */
  private async getSupervisorWithHeaderFields(userId: string) {
    const supervisor = await this.prisma.client.supervisor.findUnique({
      where: { userId },
      select: {
        id: true,
        establishmentId: true,
        position: true,
        user: { select: { name: true } },
      },
    });
    if (!supervisor) {
      throw new NotFoundException('Supervisor profile not found');
    }
    return supervisor;
  }

  private async verifyStudentUnderSupervisor(
    studentId: string,
    establishmentId: string,
  ) {
    const student = await this.prisma.client.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        establishmentId: true,
        establishment: { select: { name: true, branch: true } },
      },
    });
    if (!student || student.establishmentId !== establishmentId) {
      throw new ForbiddenException(
        'This student is not under your establishment',
      );
    }
    return student;
  }

  /**
   * Guards edit and delete. Never trust the id in the path to imply ownership —
   * without this, any supervisor could rewrite another's sheet by guessing a
   * cuid.
   */
  private async verifyEvaluationBelongsToSupervisor(
    evaluationId: string,
    supervisorId: string,
  ) {
    const evaluation = await this.prisma.client.evaluation.findUnique({
      where: { id: evaluationId },
      select: {
        id: true,
        studentId: true,
        supervisorId: true,
        templateId: true,
      },
    });
    if (!evaluation) {
      throw new NotFoundException('Evaluation not found');
    }
    if (evaluation.supervisorId !== supervisorId) {
      throw new ForbiddenException(
        'This evaluation was written by a different supervisor',
      );
    }
    return evaluation;
  }

  /**
   * The blank official sheet — sections, items, printed letters and wording.
   *
   * Served rather than duplicated in the client, so the form's text has exactly
   * one source: the PUBLISHED template the coordinator maintains. 409 when the
   * school has not published one yet.
   */
  async getEvaluationSheet(userId: string) {
    const supervisor = await this.getSupervisorWithHeaderFields(userId);
    const template = await this.templates.getPublishedTemplate();
    const establishment = await this.prisma.client.establishment.findUnique({
      where: { id: supervisor.establishmentId },
      select: { name: true, branch: true },
    });

    return {
      ...sheetDefinition(template),
      // The header/footer blanks as they will be filled in for this
      // supervisor. Served here rather than read off the dashboard so the form
      // depends on one endpoint, not two.
      evaluator: {
        name: supervisor.user.name,
        position: supervisor.position,
      },
      employedAt: establishment ? establishmentLabel(establishment) : null,
    };
  }

  /**
   * Sheets this supervisor wrote, plus sheets for students currently placed
   * with them.
   *
   * The union matters: filtering on the student's *current* establishment
   * alone made a supervisor's own sheet vanish the moment the student was
   * unassigned or moved (which the establishment cascade does routinely, since
   * it nulls `establishmentId` rather than deleting students). Authorship is
   * permanent; placement is not.
   */
  async getEvaluations(userId: string) {
    const supervisor = await this.getSupervisorByUserId(userId);

    const evaluations = await this.prisma.client.evaluation.findMany({
      where: {
        OR: [
          { supervisorId: supervisor.id },
          { student: { establishmentId: supervisor.establishmentId } },
        ],
      },
      include: EVALUATION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    // Authorship travels with the row. The client used to derive this by
    // comparing against /supervisor/dashboard's supervisor.id, so a slow or
    // failing dashboard silently hid edit and delete on the supervisor's own
    // sheets with no explanation.
    return evaluations.map((evaluation) => ({
      ...withSectionTotals(evaluation),
      canModify: evaluation.supervisorId === supervisor.id,
    }));
  }
}

/** What both create and update accept, before the server derives the rest. */
export type EvaluationInput = {
  studentId: string;
  /**
   * Item key -> score, keyed by the template's own items.
   *
   * Deliberately a nested object rather than the nineteen top-level fields it
   * used to be: the sheet is data now, and a DTO cannot whitelist keys it does
   * not know while `forbidNonWhitelisted` is on. The real check is
   * `EvaluationTemplateService.validateScores`, against the template version
   * this evaluation belongs to.
   */
  scores: Record<string, unknown>;
  /** `null` = explicitly cleared; `undefined` = not supplied, leave unchanged. */
  comments?: string | null;
  recommendations?: string | null;
};

/**
 * Shared shape so supervisor and coordinator lists render identically.
 *
 * The template is joined in, not looked up against the published version: a
 * signed sheet renders with the wording, item set and order it was signed with,
 * whatever the school has published since.
 */
export const EVALUATION_INCLUDE = {
  template: {
    select: {
      id: true,
      version: true,
      title: true,
      sections: {
        orderBy: { order: 'asc' },
        select: {
          key: true,
          label: true,
          order: true,
          items: {
            orderBy: { order: 'asc' },
            select: { key: true, label: true, order: true },
          },
        },
      },
    },
  },
  scores: { select: { itemKey: true, score: true } },
  student: {
    select: {
      id: true,
      studentIdNumber: true,
      course: true,
      school: true,
      user: { select: { name: true, email: true } },
      establishment: { select: { id: true, name: true, branch: true } },
    },
  },
  supervisor: {
    select: {
      id: true,
      position: true,
      user: { select: { name: true } },
    },
  },
} as const;

/** An evaluation read with `EVALUATION_INCLUDE`. */
type EvaluationWithSheet = {
  template: SheetTemplate;
  scores: { itemKey: string; score: number }[];
};

/**
 * Rebuilds the printed sheet: each section with its numeral, letters, maximum
 * and total, each item with its wording and score.
 *
 * Recomputed on read rather than stored — numerals, letters and section totals
 * are presentation derived from the template's order and the score rows, unlike
 * `totalRating` and `maxTotalRating`, which are part of the record and are left
 * exactly as they were signed.
 *
 * The raw `template` and `scores` relations are dropped from the result: the
 * client renders from `sections`, and shipping both would be the same data
 * twice.
 */
export function withSectionTotals<T extends EvaluationWithSheet>(
  evaluation: T,
) {
  const { template, scores, ...rest } = evaluation;
  const sections = buildSections(template, toScoreMap(scores));
  return {
    ...rest,
    templateVersion: template.version,
    templateTitle: template.title,
    sections,
  };
}

/** Score rows as the map the scoring helpers take. */
function toScoreMap(
  scores: ReadonlyArray<{ itemKey: string; score: number }>,
): Map<string, number> {
  return new Map(scores.map((score) => [score.itemKey, score.score]));
}

/** Monday 00:00 UTC of the current week. */
function startOfWeek(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (day + 6) % 7;
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysSinceMonday,
    ),
  );
}

/** See the identical helper in coordinator.service.ts. */
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

type Tx = Prisma.TransactionClient;

/**
 * A student's days with only their APPROVED punches — nothing else can form a
 * counted session — for `totalApprovedHours`. Same query shape as
 * `completedTraining`.
 */
function approvedDays(tx: Tx, studentId: string) {
  return tx.attendance.findMany({
    where: { studentId },
    select: {
      punches: { where: { status: 'APPROVED' }, select: HOURS_PUNCH_SELECT },
    },
  });
}

/**
 * Locks the student row for the rest of the transaction (`FOR UPDATE` — Prisma
 * has no API for it; the table is unmapped, so its name is the model's), then
 * reads what the auto-COMPLETED check needs before the approval is written.
 * A concurrent approval of the same student's punches waits here until this
 * transaction commits, and then reads hours that include this one's punch.
 */
async function lockAndReadHours(tx: Tx, studentId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Student" WHERE "id" = ${studentId} FOR UPDATE`;
  const student = await tx.student.findUniqueOrThrow({
    where: { id: studentId },
    select: { requiredHours: true, user: { select: { name: true } } },
  });
  return {
    name: student.user.name,
    requiredHours: student.requiredHours,
    approvedHours: totalApprovedHours(await approvedDays(tx, studentId)),
  };
}

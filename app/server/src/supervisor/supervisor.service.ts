import {
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DAY_SELECT,
  HOURS_PUNCH_SELECT,
  PUNCH_LABEL,
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
import { CASCADE_TRANSACTION_OPTIONS } from '../common/cascade-delete';
import { EvaluationTemplateService } from '../evaluation-template/evaluation-template.service';

type AttendanceStatus = 'PENDING' | 'APPROVED' | 'DECLINED';

@Injectable()
export class SupervisorService {
  private readonly logger = new Logger(SupervisorService.name);

  constructor(
    private prisma: PrismaService,
    private templates: EvaluationTemplateService,
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
          select: { id: true, name: true, industryType: true },
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

  /** Students assigned to this supervisor's establishment. */
  async getStudents(userId: string) {
    const supervisor = await this.getSupervisorByUserId(userId);

    const students = await this.prisma.client.student.findMany({
      where: { establishmentId: supervisor.establishmentId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        // Only APPROVED punches can ever form a counted session, so the rest
        // are not fetched.
        attendances: {
          select: {
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
    }));
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
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (student.establishmentId !== supervisor.establishmentId) {
      throw new ForbiddenException(
        'This student is not under your establishment',
      );
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

    // `status: 'PENDING'` in the filter is the finality rule and a
    // compare-and-set at once: a punch already decided — or decided by
    // someone else a moment ago — matches nothing and is left untouched.
    const { count } = await this.prisma.client.attendancePunch.updateMany({
      where: { id: punchId, status: 'PENDING' },
      data: {
        ...decision,
        decidedById: supervisor.id,
        decidedAt: new Date(),
      },
    });
    if (count === 0) {
      // Re-read: the status fetched above may predate a decision made by
      // someone else in between.
      const current = await this.prisma.client.attendancePunch.findUnique({
        where: { id: punchId },
        select: { status: true },
      });
      throw new ConflictException(
        `This ${PUNCH_LABEL[punch.kind]} punch has already been ${
          current?.status === 'DECLINED' ? 'declined' : 'approved'
        }. Decisions are final.`,
      );
    }

    return this.prisma.client.attendancePunch.findUniqueOrThrow({
      where: { id: punchId },
      select: { ...PUNCH_SELECT, attendanceId: true },
    });
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
          select: { student: { select: { establishmentId: true } } },
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
  async createEvaluation(userId: string, data: EvaluationInput) {
    const supervisor = await this.getSupervisorWithHeaderFields(userId);
    const student = await this.verifyStudentUnderSupervisor(
      data.studentId,
      supervisor.establishmentId,
    );

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
        ...this.headerFields(data, supervisor, student),
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
          // Only the two editable header dates below. `trainingEmployedAt`,
          // `evaluatorName` and `evaluatorPosition` are write-time snapshots
          // and are deliberately NOT recomputed here: re-deriving them from the
          // student's *current* placement would blank the establishment on a
          // sheet whose student has since been unassigned, which is the same
          // placement-governs-the-sheet coupling this change removes.
          ...trainingDates(data),
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
   * The form's header fields.
   *
   * `trainingEmployedAt`, `evaluatorName` and `evaluatorPosition` are
   * snapshotted from the current rows rather than joined on read, so renaming
   * or deleting a supervisor later cannot rewrite a sheet that was already
   * signed off.
   */
  private headerFields(
    data: Omit<EvaluationInput, 'studentId'>,
    supervisor: { position: string | null; user: { name: string } },
    student: { establishment: { name: string } | null },
  ) {
    return {
      ...trainingDates(data),
      trainingEmployedAt: student.establishment?.name ?? null,
      evaluatorName: supervisor.user.name,
      evaluatorPosition: supervisor.position,
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
        establishment: { select: { name: true } },
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
      select: { name: true },
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
      employedAt: establishment?.name ?? null,
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

/**
 * The sheet's two editable header dates. Absent or emptied becomes `null` — on
 * an edit the client always sends the whole sheet, so a missing date here means
 * the supervisor cleared it.
 */
function trainingDates(data: {
  trainingStartedAt?: string;
  trainingEndedAt?: string;
}) {
  return {
    trainingStartedAt: data.trainingStartedAt
      ? new Date(data.trainingStartedAt)
      : null,
    trainingEndedAt: data.trainingEndedAt
      ? new Date(data.trainingEndedAt)
      : null,
  };
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
  trainingStartedAt?: string;
  trainingEndedAt?: string;
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
      establishment: { select: { id: true, name: true } },
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

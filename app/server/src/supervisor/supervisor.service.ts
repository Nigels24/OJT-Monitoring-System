import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hoursForAttendance, totalHours } from '../common/attendance-hours';
import {
  ItemScores,
  pickItemScores,
  scoreBreakdown,
  sheetDefinition,
  totalRating,
} from '../common/evaluation-scoring';

type AttendanceStatus = 'PENDING' | 'APPROVED' | 'DECLINED';

@Injectable()
export class SupervisorService {
  constructor(private prisma: PrismaService) {}

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

    const [students, attendances] = await Promise.all([
      this.prisma.client.student.findMany({
        where: { establishmentId: supervisor.establishmentId },
        select: { id: true, status: true, requiredHours: true },
      }),
      this.prisma.client.attendance.findMany({
        where: { student: { establishmentId: supervisor.establishmentId } },
        select: {
          status: true,
          timeInAM: true,
          timeOutAM: true,
          timeInPM: true,
          timeOutPM: true,
          createdAt: true,
          student: { select: { status: true } },
        },
      }),
    ]);

    const approved = attendances.filter((a) => a.status === 'APPROVED');
    const weekStart = startOfWeek();
    // A finished batch should not keep showing up as work to do, but its
    // approved hours still count toward the establishment's running total.
    const activeQueue = attendances.filter(
      (a) => a.student.status !== 'COMPLETED',
    );

    return {
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
        pendingApprovals: activeQueue.filter((a) => a.status === 'PENDING')
          .length,
        approvedThisWeek: approved.filter((a) => a.createdAt >= weekStart)
          .length,
        declinedCount: activeQueue.filter((a) => a.status === 'DECLINED')
          .length,
        // Hours this establishment has signed off across all its students.
        totalApprovedHours: totalHours(approved),
      },
    };
  }

  /**
   * Attendance for every student at this supervisor's establishment.
   *
   * `status` narrows the list; omitting it returns all of them. (This method
   * was previously called getPendingAttendance but never filtered, so the
   * approval screen showed already-actioned rows with no way to tell.)
   */
  async getAttendance(
    userId: string,
    status?: AttendanceStatus,
    includeCompleted = false,
  ) {
    const supervisor = await this.getSupervisorByUserId(userId);

    const records = await this.prisma.client.attendance.findMany({
      where: {
        student: {
          establishmentId: supervisor.establishmentId,
          // Students marked COMPLETED are a finished OJT batch. Their logs stay
          // in the database — nothing is deleted — but they drop out of the
          // working queue so the next intake starts with a clean board.
          ...(includeCompleted ? {} : { status: { not: 'COMPLETED' } }),
        },
        ...(status ? { status } : {}),
      },
      include: {
        student: {
          select: {
            id: true,
            studentIdNumber: true,
            course: true,
            requiredHours: true,
            user: { select: { name: true, email: true } },
          },
        },
        approvedBy: {
          select: { id: true, user: { select: { name: true } } },
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    return records.map((record) => ({
      ...record,
      hours: Math.round(hoursForAttendance(record) * 100) / 100,
    }));
  }

  /** Students assigned to this supervisor's establishment. */
  async getStudents(userId: string) {
    const supervisor = await this.getSupervisorByUserId(userId);

    const students = await this.prisma.client.student.findMany({
      where: { establishmentId: supervisor.establishmentId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        attendances: {
          where: { status: 'APPROVED' },
          select: {
            timeInAM: true,
            timeOutAM: true,
            timeInPM: true,
            timeOutPM: true,
          },
        },
      },
      orderBy: { user: { name: 'asc' } },
    });

    return students.map(({ attendances, ...student }) => ({
      ...student,
      completedHours: totalHours(attendances),
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

  async approveAttendance(userId: string, attendanceId: string) {
    const supervisor = await this.getSupervisorByUserId(userId);
    await this.verifyAttendanceBelongsToSupervisor(
      attendanceId,
      supervisor.establishmentId,
    );

    return this.prisma.client.attendance.update({
      where: { id: attendanceId },
      data: {
        status: 'APPROVED',
        approvedById: supervisor.id,
        // Clear any earlier decline reason so an approved record does not
        // still carry the explanation for why it was once rejected.
        declineReason: null,
      },
    });
  }

  async declineAttendance(
    userId: string,
    attendanceId: string,
    reason: string,
  ) {
    const supervisor = await this.getSupervisorByUserId(userId);
    await this.verifyAttendanceBelongsToSupervisor(
      attendanceId,
      supervisor.establishmentId,
    );

    return this.prisma.client.attendance.update({
      where: { id: attendanceId },
      data: {
        status: 'DECLINED',
        approvedById: supervisor.id,
        declineReason: reason,
      },
    });
  }

  private async verifyAttendanceBelongsToSupervisor(
    attendanceId: string,
    establishmentId: string,
  ) {
    const attendance = await this.prisma.client.attendance.findUnique({
      where: { id: attendanceId },
      include: { student: true },
    });
    if (!attendance) {
      throw new NotFoundException('Attendance record not found');
    }
    if (attendance.student.establishmentId !== establishmentId) {
      throw new ForbiddenException(
        'This attendance record belongs to a different establishment',
      );
    }
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

    const scores = pickItemScores(data);

    const created = await this.prisma.client.evaluation.create({
      data: {
        studentId: data.studentId,
        supervisorId: supervisor.id,
        ...scores,
        // Derived here, never read from the request — otherwise a caller could
        // submit nineteen low scores alongside a 95.
        totalRating: totalRating(scores),
        ...this.headerFields(data, supervisor, student),
        comments: data.comments,
        recommendations: data.recommendations,
      },
      include: EVALUATION_INCLUDE,
    });

    // Same shape as the list endpoints, so a freshly created evaluation can be
    // rendered without a refetch.
    return withSectionTotals(created);
  }

  /**
   * Edits an evaluation this supervisor wrote, recomputing the total.
   *
   * Ownership is `supervisorId`, not the establishment: `getEvaluations`
   * deliberately shows everything written at the establishment, but a
   * supervisor may only rewrite their own sheet.
   */
  async updateEvaluation(
    userId: string,
    evaluationId: string,
    data: Omit<EvaluationInput, 'studentId'>,
  ) {
    const supervisor = await this.getSupervisorWithHeaderFields(userId);
    const existing = await this.verifyEvaluationBelongsToSupervisor(
      evaluationId,
      supervisor.id,
    );
    const student = await this.verifyStudentUnderSupervisor(
      existing.studentId,
      supervisor.establishmentId,
    );

    const scores = pickItemScores(data);

    const updated = await this.prisma.client.evaluation.update({
      where: { id: evaluationId },
      data: {
        ...scores,
        totalRating: totalRating(scores),
        ...this.headerFields(data, supervisor, student),
        comments: data.comments,
        recommendations: data.recommendations,
      },
      include: EVALUATION_INCLUDE,
    });

    return withSectionTotals(updated);
  }

  /** Hard-deletes an evaluation this supervisor wrote. */
  async removeEvaluation(userId: string, evaluationId: string) {
    const supervisor = await this.getSupervisorByUserId(userId);
    await this.verifyEvaluationBelongsToSupervisor(evaluationId, supervisor.id);

    await this.prisma.client.evaluation.delete({ where: { id: evaluationId } });

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
      trainingStartedAt: data.trainingStartedAt
        ? new Date(data.trainingStartedAt)
        : null,
      trainingEndedAt: data.trainingEndedAt
        ? new Date(data.trainingEndedAt)
        : null,
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
      select: { id: true, studentId: true, supervisorId: true },
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
   * one source (src/common/evaluation-scoring.ts).
   */
  getEvaluationSheet() {
    return sheetDefinition();
  }

  /** Evaluations written for students at this supervisor's establishment. */
  async getEvaluations(userId: string) {
    const supervisor = await this.getSupervisorByUserId(userId);

    const evaluations = await this.prisma.client.evaluation.findMany({
      where: { student: { establishmentId: supervisor.establishmentId } },
      include: EVALUATION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return evaluations.map(withSectionTotals);
  }
}

/** What both create and update accept, before the server derives the rest. */
export type EvaluationInput = ItemScores & {
  studentId: string;
  trainingStartedAt?: string;
  trainingEndedAt?: string;
  /** `null` = explicitly cleared; `undefined` = not supplied, leave unchanged. */
  comments?: string | null;
  recommendations?: string | null;
};

/** Shared shape so supervisor and coordinator lists render identically. */
export const EVALUATION_INCLUDE = {
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

/**
 * Attaches the per-section totals. Recomputed on read rather than stored — they
 * are a presentation detail derived from the nineteen items, unlike
 * `totalRating`, which is part of the record.
 */
export function withSectionTotals<T extends ItemScores>(evaluation: T) {
  const { sections, maxTotalRating } = scoreBreakdown(
    pickItemScores(evaluation),
  );
  return { ...evaluation, sections, maxTotalRating };
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

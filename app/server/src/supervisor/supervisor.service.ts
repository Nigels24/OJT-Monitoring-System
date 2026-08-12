import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hoursForAttendance, totalHours } from '../common/attendance-hours';
import {
  CRITERIA,
  CriteriaScores,
  categoryBreakdown,
  overallRating,
  performanceLevel,
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

  async createEvaluation(
    userId: string,
    data: CriteriaScores & {
      studentId: string;
      periodStart?: string;
      periodEnd?: string;
      comments?: string;
      recommendations?: string;
    },
  ) {
    const supervisor = await this.getSupervisorByUserId(userId);

    const student = await this.prisma.client.student.findUnique({
      where: { id: data.studentId },
    });
    if (!student || student.establishmentId !== supervisor.establishmentId) {
      throw new ForbiddenException(
        'This student is not under your establishment',
      );
    }

    const scores = pickCriteria(data);
    // Derived here, never read from the request — otherwise a caller could
    // submit nine low scores alongside an "Excellent" overall.
    const rating = overallRating(scores);

    const created = await this.prisma.client.evaluation.create({
      data: {
        studentId: data.studentId,
        supervisorId: supervisor.id,
        ...scores,
        overallRating: rating,
        performanceLevel: performanceLevel(rating),
        periodStart: data.periodStart ? new Date(data.periodStart) : null,
        periodEnd: data.periodEnd ? new Date(data.periodEnd) : null,
        comments: data.comments,
        recommendations: data.recommendations,
      },
      include: EVALUATION_INCLUDE,
    });

    // Same shape as the list endpoints, so a freshly created evaluation can be
    // rendered without a refetch.
    return withBreakdown(created);
  }

  /** Evaluations written for students at this supervisor's establishment. */
  async getEvaluations(userId: string) {
    const supervisor = await this.getSupervisorByUserId(userId);

    const evaluations = await this.prisma.client.evaluation.findMany({
      where: { student: { establishmentId: supervisor.establishmentId } },
      include: EVALUATION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return evaluations.map(withBreakdown);
  }
}

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

/** Narrows a request body down to just the nine scored criteria. */
export function pickCriteria(source: Record<string, unknown>): CriteriaScores {
  return Object.fromEntries(
    CRITERIA.map((key) => [key, Number(source[key])]),
  ) as CriteriaScores;
}

/**
 * Attaches the per-category averages. Recomputed on read rather than stored —
 * it is a presentation detail derived from the criteria, unlike overallRating
 * which is part of the record.
 */
export function withBreakdown<T extends CriteriaScores>(evaluation: T) {
  return {
    ...evaluation,
    categories: categoryBreakdown(pickCriteria(evaluation)),
  };
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

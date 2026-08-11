import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hoursForAttendance, totalHours } from '../common/attendance-hours';

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
        },
      }),
    ]);

    const approved = attendances.filter((a) => a.status === 'APPROVED');
    const weekStart = startOfWeek();

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
        pendingApprovals: attendances.filter((a) => a.status === 'PENDING')
          .length,
        approvedThisWeek: approved.filter((a) => a.createdAt >= weekStart)
          .length,
        declinedCount: attendances.filter((a) => a.status === 'DECLINED')
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
  async getAttendance(userId: string, status?: AttendanceStatus) {
    const supervisor = await this.getSupervisorByUserId(userId);

    const records = await this.prisma.client.attendance.findMany({
      where: {
        student: { establishmentId: supervisor.establishmentId },
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
    data: { studentId: string; score?: number; feedback?: string },
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

    return this.prisma.client.evaluation.create({
      data: {
        studentId: data.studentId,
        supervisorId: supervisor.id,
        score: data.score,
        feedback: data.feedback,
      },
    });
  }
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

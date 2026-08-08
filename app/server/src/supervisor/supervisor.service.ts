import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  async getPendingAttendance(userId: string) {
    const supervisor = await this.getSupervisorByUserId(userId);

    return this.prisma.client.attendance.findMany({
      where: {
        student: { establishmentId: supervisor.establishmentId },
      },
      include: {
        student: { include: { user: true } },
      },
      orderBy: { date: 'desc' },
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
      data: { status: 'APPROVED', approvedById: supervisor.id },
    });
  }

  async declineAttendance(userId: string, attendanceId: string) {
    const supervisor = await this.getSupervisorByUserId(userId);
    await this.verifyAttendanceBelongsToSupervisor(
      attendanceId,
      supervisor.establishmentId,
    );

    return this.prisma.client.attendance.update({
      where: { id: attendanceId },
      data: { status: 'DECLINED', approvedById: supervisor.id },
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

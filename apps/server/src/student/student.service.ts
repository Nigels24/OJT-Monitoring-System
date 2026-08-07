import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StudentService {
  constructor(private prisma: PrismaService) {}

  private async getStudentByUserId(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });
    if (!student) {
      throw new NotFoundException('Student profile not found');
    }
    return student;
  }

  async getDashboard(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: {
        user: true,
        establishment: true,
        attendances: {
          orderBy: { date: 'desc' },
          take: 5,
        },
      },
    });
    if (!student) {
      throw new NotFoundException('Student profile not found');
    }
    return student;
  }

  async submitAttendance(
    userId: string,
    data: {
      date: string;
      timeInAM?: string;
      timeOutAM?: string;
      timeInPM?: string;
      timeOutPM?: string;
      remarks?: string;
    },
  ) {
    const student = await this.getStudentByUserId(userId);

    return this.prisma.attendance.create({
      data: {
        studentId: student.id,
        date: new Date(data.date),
        timeInAM: data.timeInAM ? new Date(data.timeInAM) : null,
        timeOutAM: data.timeOutAM ? new Date(data.timeOutAM) : null,
        timeInPM: data.timeInPM ? new Date(data.timeInPM) : null,
        timeOutPM: data.timeOutPM ? new Date(data.timeOutPM) : null,
        remarks: data.remarks,
        status: 'PENDING',
      },
    });
  }

  async getAttendanceHistory(userId: string) {
    const student = await this.getStudentByUserId(userId);

    return this.prisma.attendance.findMany({
      where: { studentId: student.id },
      orderBy: { date: 'desc' },
    });
  }
}

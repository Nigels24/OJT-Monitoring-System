import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hoursForAttendance, totalHours } from '../common/attendance-hours';

interface SubmitAttendanceInput {
  date: string;
  timeInAM?: string;
  timeOutAM?: string;
  timeInPM?: string;
  timeOutPM?: string;
  remarks?: string;
}

@Injectable()
export class StudentService {
  constructor(private prisma: PrismaService) {}

  private async getStudentByUserId(userId: string) {
    const student = await this.prisma.client.student.findUnique({
      where: { userId },
    });
    if (!student) {
      throw new NotFoundException('Student profile not found');
    }
    return student;
  }

  async getDashboard(userId: string) {
    const student = await this.prisma.client.student.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        establishment: {
          select: {
            id: true,
            name: true,
            industryType: true,
            coordinatorFirstName: true,
            coordinatorLastName: true,
            coordinatorContact: true,
            coordinatorEmail: true,
          },
        },
        attendances: { orderBy: { date: 'desc' } },
        _count: { select: { documents: true, credentials: true } },
      },
    });
    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    const { attendances, ...profile } = student;
    const approved = attendances.filter((a) => a.status === 'APPROVED');

    return {
      ...profile,
      stats: {
        // Only approved attendance counts toward the requirement, which is
        // why this can be lower than the sum of everything submitted.
        completedHours: totalHours(approved),
        pendingHours: totalHours(
          attendances.filter((a) => a.status === 'PENDING'),
        ),
        requiredHours: student.requiredHours,
        remainingHours: Math.max(
          0,
          Math.round((student.requiredHours - totalHours(approved)) * 100) /
            100,
        ),
        totalLogs: attendances.length,
        approvedCount: approved.length,
        pendingCount: attendances.filter((a) => a.status === 'PENDING').length,
        declinedCount: attendances.filter((a) => a.status === 'DECLINED')
          .length,
      },
      recentAttendance: attendances.slice(0, 5).map(withHours),
    };
  }

  async submitAttendance(userId: string, data: SubmitAttendanceInput) {
    const student = await this.getStudentByUserId(userId);

    const date = startOfUtcDay(data.date);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('date is not a valid date');
    }

    const times = {
      timeInAM: parseTime(data.timeInAM),
      timeOutAM: parseTime(data.timeOutAM),
      timeInPM: parseTime(data.timeInPM),
      timeOutPM: parseTime(data.timeOutPM),
    };

    // A log with no complete session is meaningless — it would contribute zero
    // hours and just sit in the supervisor's approval queue.
    const hasAmSession = !!times.timeInAM && !!times.timeOutAM;
    const hasPmSession = !!times.timeInPM && !!times.timeOutPM;
    if (!hasAmSession && !hasPmSession) {
      throw new BadRequestException(
        'Provide a complete AM or PM session (both a time in and a time out)',
      );
    }

    if (hoursForAttendance(times) <= 0) {
      throw new BadRequestException('Time out must be later than time in');
    }

    const existing = await this.prisma.client.attendance.findUnique({
      where: { studentId_date: { studentId: student.id, date } },
    });
    if (existing) {
      throw new ConflictException(
        'You have already submitted attendance for this date',
      );
    }

    const created = await this.prisma.client.attendance.create({
      data: {
        studentId: student.id,
        date,
        ...times,
        remarks: data.remarks,
        status: 'PENDING',
      },
    });

    return withHours(created);
  }

  async getAttendanceHistory(userId: string) {
    const student = await this.getStudentByUserId(userId);

    const attendances = await this.prisma.client.attendance.findMany({
      where: { studentId: student.id },
      orderBy: { date: 'desc' },
    });

    return attendances.map(withHours);
  }
}

/** Adds the derived hours so the client never recomputes them. */
function withHours<T extends Parameters<typeof hoursForAttendance>[0]>(
  record: T,
) {
  return {
    ...record,
    hours: Math.round(hoursForAttendance(record) * 100) / 100,
  };
}

/**
 * Normalises a submitted date to UTC midnight.
 *
 * The `@@unique([studentId, date])` constraint compares the full timestamp, so
 * without this two submissions for the same calendar day at different clock
 * times would both be accepted and the day would be counted twice.
 */
function startOfUtcDay(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return parsed;
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    ),
  );
}

function parseTime(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`"${value}" is not a valid time`);
  }
  return parsed;
}

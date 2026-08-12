import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { totalHours } from '../common/attendance-hours';
import {
  EVALUATION_INCLUDE,
  withBreakdown,
} from '../supervisor/supervisor.service';
import { performanceLevel } from '../common/evaluation-scoring';

/** Fields the coordinator can set on a student, shared by create and update. */
interface StudentDetails {
  name?: string;
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  age?: number;
  dateOfBirth?: string;
  school?: string;
  contactNumber?: string;
  address?: string;
  course?: string;
  yearLevel?: string;
  establishmentId?: string;
  requiredHours?: number;
  status?: 'ACTIVE' | 'PENDING' | 'COMPLETED' | 'INACTIVE';
}

@Injectable()
export class CoordinatorService {
  constructor(private prisma: PrismaService) {}

  /** Rejects an email or username already claimed by another account. */
  private async assertCredentialsAvailable(email: string, username: string) {
    const clash = await this.prisma.client.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    });
    if (!clash) return;
    throw new ConflictException(
      clash.email === email ? 'Email already in use' : 'Username already taken',
    );
  }

  async createSupervisor(data: {
    email: string;
    username: string;
    password: string;
    name: string;
    establishmentId: string;
    position?: string;
  }) {
    await this.assertCredentialsAvailable(data.email, data.username);

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.client.user.create({
      data: {
        email: data.email,
        username: data.username,
        password: hashedPassword,
        name: data.name,
        role: 'SUPERVISOR',
        supervisorProfile: {
          create: {
            establishmentId: data.establishmentId,
            position: data.position,
          },
        },
      },
      include: { supervisorProfile: true },
    });

    const { password, ...result } = user;
    return result;
  }

  async createStudent(
    data: StudentDetails & {
      email: string;
      username: string;
      password: string;
      studentIdNumber: string;
    },
  ) {
    await this.assertCredentialsAvailable(data.email, data.username);

    const idTaken = await this.prisma.client.student.findUnique({
      where: { studentIdNumber: data.studentIdNumber },
    });
    if (idTaken) {
      throw new ConflictException(
        `Student ID ${data.studentIdNumber} is already assigned to another student`,
      );
    }

    const fullName = buildFullName(data);
    if (!fullName) {
      throw new BadRequestException(
        'Provide either firstName and lastName, or name',
      );
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    // User and Student are separate rows. Without a transaction a failure on
    // the second write would leave a login with no profile, which every
    // /student/* endpoint then rejects with "Student profile not found".
    const user = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: data.email,
          username: data.username,
          password: hashedPassword,
          name: fullName,
          role: 'STUDENT',
        },
      });

      await tx.student.create({
        data: {
          userId: created.id,
          studentIdNumber: data.studentIdNumber,
          ...studentProfileData(data),
        },
      });

      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        include: { studentProfile: true },
      });
    });

    const { password, ...result } = user;
    return result;
  }

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
        establishment: { select: { id: true, name: true } },
        attendances: {
          where: { status: 'APPROVED' },
          select: {
            timeInAM: true,
            timeOutAM: true,
            timeInPM: true,
            timeOutPM: true,
          },
        },
        _count: { select: { credentials: true, documents: true } },
      },
      orderBy: { user: { createdAt: 'desc' } },
    });

    // `attendances` is only fetched to total the hours; drop it from the
    // response so the list payload stays small.
    return students.map(({ attendances, ...student }) => ({
      ...student,
      completedHours: totalHours(attendances),
    }));
  }

  async listSupervisors() {
    return this.prisma.client.supervisor.findMany({
      include: { user: true, establishment: true },
    });
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
    const todayStart = startOfUtcDay(new Date());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

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
    ] = await Promise.all([
      this.prisma.client.student.findMany({ select: { status: true } }),
      this.prisma.client.establishment.count(),
      this.prisma.client.establishment.count({ where: { status: 'ACTIVE' } }),
      this.prisma.client.attendance.findMany({
        where: { status: 'APPROVED' },
        select: {
          timeInAM: true,
          timeOutAM: true,
          timeInPM: true,
          timeOutPM: true,
        },
      }),
      this.prisma.client.attendance.count({ where: { status: 'PENDING' } }),
      // Distinct students who logged anything for today, not raw record count —
      // the unique constraint makes these equal today, but the intent is
      // "how many students turned up".
      this.prisma.client.attendance.findMany({
        where: { date: { gte: todayStart, lt: todayEnd } },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
      this.prisma.client.evaluation.aggregate({
        _avg: { overallRating: true },
      }),
      this.prisma.client.evaluation.count(),
      this.prisma.client.establishment.findMany({
        select: { id: true, name: true, _count: { select: { students: true } } },
        orderBy: { students: { _count: 'desc' } },
        take: 5,
      }),
      this.prisma.client.student.findMany({
        include: {
          user: { select: { name: true, createdAt: true } },
          establishment: { select: { name: true } },
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
        orderBy: { user: { createdAt: 'desc' } },
        take: 5,
      }),
      this.prisma.client.attendance.findMany({
        where: { date: { gte: trendStart } },
        select: { date: true, status: true },
      }),
    ]);

    const averageRating = evaluationAgg._avg.overallRating;

    return {
      stats: {
        totalStudents: students.length,
        activeStudents: students.filter((s) => s.status === 'ACTIVE').length,
        completedStudents: students.filter((s) => s.status === 'COMPLETED')
          .length,
        partnerEstablishments: establishmentCount,
        activeEstablishments,
        presentToday: presentToday.length,
        pendingApprovals: pendingCount,
        totalHoursLogged: totalHours(approvedAttendance),
        // null rather than 0 when nothing has been evaluated — a real average
        // of zero and "no data yet" are different things.
        averageRating:
          averageRating == null ? null : Math.round(averageRating * 10) / 10,
        averageLevel:
          averageRating == null ? null : performanceLevel(averageRating),
        totalEvaluations: evaluationCount,
      },
      // The prototype charted present/late/absent. Those states do not exist —
      // attendance is PENDING/APPROVED/DECLINED — so the real statuses are
      // charted instead of inventing the other three.
      attendanceTrend: buildWeeklyTrend(trendRows, weeksBack),
      topEstablishments: topEstablishments.map((e) => ({
        id: e.id,
        name: e.name,
        studentCount: e._count.students,
      })),
      recentStudents: recentStudents.map(
        ({ attendances, user, establishment, ...student }) => ({
          id: student.id,
          studentIdNumber: student.studentIdNumber,
          name: user.name,
          course: student.course,
          establishment: establishment?.name ?? null,
          startDate: student.startDate,
          requiredHours: student.requiredHours,
          completedHours: totalHours(attendances),
          status: student.status,
        }),
      ),
    };
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

    return evaluations.map(withBreakdown);
  }

  async updateStudent(studentId: string, data: StudentDetails) {
    const student = await this.prisma.client.student.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
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
      data: studentProfileData(data),
      include: {
        user: { select: { id: true, email: true, name: true } },
        establishment: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Issues a new password for a student or supervisor.
   *
   * This is the recovery path: there is no email infrastructure, so a user who
   * forgets their password asks the coordinator, who sets a new one and passes
   * it on — the same way the account was issued in the first place.
   *
   * Deliberately does NOT require the old password: the whole point is that it
   * is unknown. That means a coordinator can set any student's or supervisor's
   * password and sign in as them; that authority is inherent to a system where
   * the coordinator issues every credential, and it stops at COORDINATOR
   * accounts, which only the CLI can reset.
   */
  async resetStudentPassword(studentId: string, password: string) {
    const student = await this.prisma.client.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { id: true, name: true, username: true } } },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    await this.prisma.client.user.update({
      where: { id: student.userId },
      data: { password: await bcrypt.hash(password, 10) },
    });

    return {
      id: student.id,
      name: student.user.name,
      username: student.user.username,
      passwordReset: true,
    };
  }

  async resetSupervisorPassword(supervisorId: string, password: string) {
    const supervisor = await this.prisma.client.supervisor.findUnique({
      where: { id: supervisorId },
      include: { user: { select: { id: true, name: true, username: true } } },
    });
    if (!supervisor) {
      throw new NotFoundException('Supervisor not found');
    }

    await this.prisma.client.user.update({
      where: { id: supervisor.userId },
      data: { password: await bcrypt.hash(password, 10) },
    });

    return {
      id: supervisor.id,
      name: supervisor.user.name,
      username: supervisor.user.username,
      passwordReset: true,
    };
  }

  async removeStudent(studentId: string) {
    const student = await this.prisma.client.student.findUnique({
      where: { id: studentId },
      include: {
        _count: {
          select: { attendances: true, evaluations: true, documents: true },
        },
      },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const { attendances, evaluations, documents } = student._count;
    if (attendances > 0 || evaluations > 0 || documents > 0) {
      throw new ConflictException(
        `Cannot delete this student: ${attendances} attendance record(s), ` +
          `${evaluations} evaluation(s) and ${documents} document(s) reference them. ` +
          'Set the student to INACTIVE instead.',
      );
    }

    // Student and User are separate rows; removing only the profile would
    // strand a login with no profile.
    await this.prisma.client.credential.deleteMany({
      where: { studentId },
    });
    await this.prisma.client.student.delete({ where: { id: studentId } });
    await this.prisma.client.user.delete({ where: { id: student.userId } });

    return { id: studentId, deleted: true };
  }
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

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
function studentProfileData(data: StudentDetails) {
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    middleInitial: data.middleInitial,
    age: data.age,
    dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
    school: data.school,
    contactNumber: data.contactNumber,
    address: data.address,
    course: data.course,
    yearLevel: data.yearLevel,
    establishmentId: data.establishmentId,
    requiredHours: data.requiredHours,
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


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


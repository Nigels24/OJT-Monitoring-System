import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { totalHours } from '../common/attendance-hours';

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

  async createSupervisor(data: {
    email: string;
    password: string;
    name: string;
    establishmentId: string;
    position?: string;
  }) {
    const existing = await this.prisma.client.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.client.user.create({
      data: {
        email: data.email,
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
      password?: string;
      studentIdNumber: string;
    },
  ) {
    const existing = await this.prisma.client.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

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

    // The coordinator's form has no password field, matching the prototype, so
    // one is generated and returned once for the coordinator to hand over.
    // An explicitly supplied password still wins.
    const plainPassword = data.password ?? generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // User and Student are separate rows. Without a transaction a failure on
    // the second write would leave a login with no profile, which every
    // /student/* endpoint then rejects with "Student profile not found".
    const user = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: data.email,
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
    return {
      ...result,
      // Only present when the server generated it — there is no way to read it
      // back later, so the UI must surface it immediately.
      temporaryPassword: data.password ? undefined : plainPassword,
    };
  }

  async listStudents() {
    const students = await this.prisma.client.student.findMany({
      include: {
        user: { select: { id: true, email: true, name: true, createdAt: true } },
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

/** Readable one-off password; the coordinator passes it to the student. */
function generateTemporaryPassword(): string {
  return `ojt-${randomBytes(4).toString('hex')}`;
}

import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

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
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
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

  async createStudent(data: {
    email: string;
    password: string;
    name: string;
    studentIdNumber: string;
    course?: string;
    establishmentId?: string;
    requiredHours?: number;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: 'STUDENT',
        studentProfile: {
          create: {
            studentIdNumber: data.studentIdNumber,
            course: data.course,
            establishmentId: data.establishmentId,
            requiredHours: data.requiredHours ?? 0,
          },
        },
      },
      include: { studentProfile: true },
    });

    const { password, ...result } = user;
    return result;
  }

  async listStudents() {
    return this.prisma.student.findMany({
      include: { user: true, establishment: true },
    });
  }

  async listSupervisors() {
    return this.prisma.supervisor.findMany({
      include: { user: true, establishment: true },
    });
  }
}

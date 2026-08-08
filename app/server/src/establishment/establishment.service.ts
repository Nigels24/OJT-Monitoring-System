import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface EstablishmentInput {
  name: string;
  industryType?: string;
  streetAddress?: string;
  region?: string;
  barangay?: string;
  city?: string;
  province?: string;
  zipCode?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  coordinatorFirstName?: string;
  coordinatorLastName?: string;
  coordinatorMiddleInitial?: string;
  coordinatorAge?: number;
  coordinatorGender?: string;
  coordinatorPosition?: string;
  coordinatorAddress?: string;
  coordinatorContact?: string;
  coordinatorEmail?: string;
}

@Injectable()
export class EstablishmentService {
  constructor(private prisma: PrismaService) {}

  async create(data: EstablishmentInput) {
    return this.prisma.client.establishment.create({
      data: {
        ...data,
        coordinatorAge:
          data.coordinatorAge != null ? Number(data.coordinatorAge) : undefined,
      },
    });
  }

  async findAll() {
    return this.prisma.client.establishment.findMany({
      include: {
        _count: {
          select: { students: true, supervisors: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const establishment = await this.prisma.client.establishment.findUnique({
      where: { id },
      include: { students: true, supervisors: true },
    });
    if (!establishment) {
      throw new NotFoundException('Establishment not found');
    }
    return establishment;
  }

  async update(id: string, data: Partial<EstablishmentInput>) {
    await this.findOne(id);
    return this.prisma.client.establishment.update({
      where: { id },
      data: {
        ...data,
        coordinatorAge:
          data.coordinatorAge != null ? Number(data.coordinatorAge) : undefined,
      },
    });
  }

  async remove(id: string) {
    const establishment = await this.prisma.client.establishment.findUnique({
      where: { id },
      include: {
        _count: {
          select: { students: true, supervisors: true },
        },
      },
    });

    if (!establishment) {
      throw new NotFoundException('Establishment not found');
    }

    if (
      establishment._count.students > 0 ||
      establishment._count.supervisors > 0
    ) {
      throw new Error(
        `Cannot delete establishment with ${establishment._count.students} student(s) and ${establishment._count.supervisors} supervisor(s). Please reassign or remove these records first.`,
      );
    }

    return this.prisma.client.establishment.delete({ where: { id } });
  }
}

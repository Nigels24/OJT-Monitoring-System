import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EstablishmentService {
  constructor(private prisma: PrismaService) {}

  async create(data: { name: string; address?: string }) {
    return this.prisma.establishment.create({ data });
  }

  async findAll() {
    return this.prisma.establishment.findMany({
      include: {
        _count: {
          select: { students: true, supervisors: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const establishment = await this.prisma.establishment.findUnique({
      where: { id },
      include: { students: true, supervisors: true },
    });
    if (!establishment) {
      throw new NotFoundException('Establishment not found');
    }
    return establishment;
  }

  async update(id: string, data: { name?: string; address?: string }) {
    await this.findOne(id);
    return this.prisma.establishment.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.establishment.delete({ where: { id } });
  }
}

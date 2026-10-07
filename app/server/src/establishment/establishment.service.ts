import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CASCADE_TRANSACTION_OPTIONS,
  deleteSupervisorCascade,
} from '../common/cascade-delete';

interface EstablishmentInput {
  name: string;
  industryType?: string;
  streetAddress?: string;
  region?: string;
  barangay?: string;
  city?: string;
  province?: string;
  zipCode?: string;
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

/** Only an edit may change status — creation always yields ACTIVE. */
type EstablishmentUpdate = Partial<EstablishmentInput> & {
  status?: 'ACTIVE' | 'INACTIVE';
};

@Injectable()
export class EstablishmentService {
  constructor(private prisma: PrismaService) {}

  async create(data: EstablishmentInput) {
    return this.prisma.client.establishment.create({
      data: {
        ...data,
        // Every new establishment starts ACTIVE; the DTO has no status field.
        status: 'ACTIVE',
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

  async update(id: string, data: EstablishmentUpdate) {
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

  /**
   * Deletes an establishment and its supervisors, in one transaction.
   *
   * This used to refuse the delete whenever any student or supervisor
   * referenced the establishment. Now:
   *
   * - supervisors are deleted through the same sequence the coordinator's own
   *   delete uses (`deleteSupervisorCascade`), so punches they approved keep
   *   their hours and only lose their decider;
   * - students are **not** deleted. Removing a placement doesn't remove the
   *   trainee, so `establishmentId` is nulled and they can be reassigned —
   *   which is what that column being nullable is for.
   */
  async remove(id: string) {
    const establishment = await this.prisma.client.establishment.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!establishment) {
      throw new NotFoundException('Establishment not found');
    }

    await this.prisma.client.$transaction(async (tx) => {
      // Read inside the transaction: a supervisor created between an outside
      // lookup and this delete would be left pointing at a dead row.
      const supervisors = await tx.supervisor.findMany({
        where: { establishmentId: id },
        select: { id: true, userId: true },
      });

      // Sequential on purpose — each cascade is an ordered chain of writes,
      // and they share the one transaction.
      for (const supervisor of supervisors) {
        await deleteSupervisorCascade(tx, supervisor.id, supervisor.userId);
      }

      await tx.student.updateMany({
        where: { establishmentId: id },
        data: { establishmentId: null },
      });

      await tx.establishment.delete({ where: { id } });
    }, CASCADE_TRANSACTION_OPTIONS);

    return { id, deleted: true };
  }
}

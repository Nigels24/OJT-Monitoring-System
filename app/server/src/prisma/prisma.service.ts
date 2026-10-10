import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';

/**
 * Student columns that are retired but deliberately left in the schema, so no
 * migration was needed to stop using them. Omitted globally rather than per
 * query: many endpoints return whole Student rows (`include` returns every
 * scalar), and one omission here keeps all of them — and any query added
 * later — from serving the stale values. It also removes the fields from the
 * generated types, so code that tries to read one no longer compiles.
 *
 * Drop this entry together with the columns, in a later cleanup migration.
 */
const RETIRED_STUDENT_COLUMNS = {
  age: true,
  dateOfBirth: true,
  gender: true,
  endDate: true,
} as const;

/**
 * The establishment's old "Establishment Coordinator" contact person — the
 * same person as its supervisor, who is now a real account. Retired the same
 * way as the Student columns above: kept in the schema, omitted from every
 * read, absent from the generated types. Drop together with the columns.
 */
const RETIRED_ESTABLISHMENT_COLUMNS = {
  coordinatorFirstName: true,
  coordinatorLastName: true,
  coordinatorMiddleInitial: true,
  coordinatorAge: true,
  coordinatorGender: true,
  coordinatorPosition: true,
  coordinatorAddress: true,
  coordinatorContact: true,
  coordinatorEmail: true,
} as const;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client = new PrismaClient({
    omit: {
      student: RETIRED_STUDENT_COLUMNS,
      establishment: RETIRED_ESTABLISHMENT_COLUMNS,
    },
  });

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}

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

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client = new PrismaClient({
    omit: { student: RETIRED_STUDENT_COLUMNS },
  });

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}

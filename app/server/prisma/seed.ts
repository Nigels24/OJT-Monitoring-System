import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Bootstraps the single account the system cannot create for itself.
 *
 * The coordinator is the root of the account tree: they create every student
 * and supervisor through the app, and those accounts get their username and
 * password issued by hand at that point. So this seed deliberately creates
 * *only* the coordinator — no sample students, supervisors or establishments.
 * (The prototype's login page advertises three demo logins; those are a mock-up
 * device, not a description of how accounts really come to exist.)
 *
 * Safe to re-run: if the coordinator already exists this is a no-op. It never
 * overwrites an existing password, and never deletes anything.
 */
const COORDINATOR = {
  email: process.env.SEED_COORDINATOR_EMAIL ?? 'coordinator@wphi.edu',
  username: process.env.SEED_COORDINATOR_USERNAME ?? 'coordinator',
  name: process.env.SEED_COORDINATOR_NAME ?? 'Admin Coordinator',
  password: process.env.SEED_COORDINATOR_PASSWORD ?? 'admin123',
};

async function main() {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email: COORDINATOR.email }, { username: COORDINATOR.username }],
    },
  });

  if (existing) {
    console.log(
      `Coordinator "${existing.username ?? existing.email}" already exists — nothing to do.`,
    );
    return;
  }

  const user = await prisma.user.create({
    data: {
      email: COORDINATOR.email,
      username: COORDINATOR.username,
      password: await bcrypt.hash(COORDINATOR.password, 10),
      name: COORDINATOR.name,
      role: 'COORDINATOR',
      coordinatorProfile: { create: {} },
    },
  });

  console.log('Created the bootstrap coordinator:');
  console.log(`  username  ${user.username}`);
  console.log(`  email     ${user.email}`);
  console.log(`  password  ${COORDINATOR.password}`);
  console.log(
    '\nSign in as this account to create the establishments, supervisors and students.',
  );
  if (!process.env.SEED_COORDINATOR_PASSWORD) {
    console.log(
      'This is the default password — change it, or set SEED_COORDINATOR_PASSWORD before seeding.',
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

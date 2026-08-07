import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const coordinator = await prisma.user.create({
    data: {
      email: 'coordinator@wphi.edu',
      password: hashedPassword,
      name: 'Admin Coordinator',
      role: 'COORDINATOR',
      coordinatorProfile: {
        create: {},
      },
    },
  });

  console.log('Seeded coordinator:', coordinator.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

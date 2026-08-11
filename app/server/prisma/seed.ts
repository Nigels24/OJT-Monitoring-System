import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Demo accounts, one per role, so all three sides of the app can be signed
// into after a fresh checkout. Mirrors the accounts advertised on the
// prototype's login page.
//
// Re-running the seed is safe: existing rows are matched by email and only
// have their password reset back to the documented value. Nothing is deleted,
// so accounts created by hand through the coordinator UI are left alone.
const DEMO = {
  coordinator: {
    email: 'coordinator@wphi.edu',
    username: 'coordinator',
    password: 'admin123',
  },
  supervisor: {
    email: 'hr@techsolutions.com',
    username: 'hr.techsolutions',
    password: 'hr123456',
  },
  student: {
    email: 'student@wphi.edu',
    username: 'student',
    password: 'student123',
  },
};

const ESTABLISHMENT_NAME = 'Tech Solutions Inc.';
// Deliberately not '2024-001' — that range is what the coordinator UI hands
// out, so a demo-prefixed id cannot collide with real test data.
const DEMO_STUDENT_ID_NUMBER = 'DEMO-0001';

async function main() {
  // Profiles are upserted separately from their User rather than with a nested
  // `create`. A nested create only runs when the User row is absent, so a run
  // that died between the two writes, or a hand-deleted profile row, would
  // leave an account that logs in fine but 404s on every role endpoint — and
  // re-seeding would report success without repairing it.
  const coordinatorPassword = await bcrypt.hash(DEMO.coordinator.password, 10);
  const coordinator = await prisma.user.upsert({
    where: { email: DEMO.coordinator.email },
    update: {
      password: coordinatorPassword,
      username: DEMO.coordinator.username,
    },
    create: {
      email: DEMO.coordinator.email,
      username: DEMO.coordinator.username,
      password: coordinatorPassword,
      name: 'Admin Coordinator',
      role: 'COORDINATOR',
    },
  });

  await prisma.coordinator.upsert({
    where: { userId: coordinator.id },
    update: {},
    create: { userId: coordinator.id },
  });

  const establishment =
    (await prisma.establishment.findFirst({
      where: { name: ESTABLISHMENT_NAME },
    })) ??
    (await prisma.establishment.create({
      data: {
        name: ESTABLISHMENT_NAME,
        industryType: 'Information Technology',
        streetAddress: '12 Rizal Street',
        region: 'Region VI (Western Visayas)',
        province: 'Iloilo',
        city: 'Iloilo City',
        barangay: 'San Francisco',
        zipCode: '5000',
        status: 'ACTIVE',
        coordinatorFirstName: 'Maria',
        coordinatorLastName: 'Santos',
        coordinatorPosition: 'HR Manager',
        coordinatorContact: '09171234567',
        coordinatorEmail: DEMO.supervisor.email,
      },
    }));

  const supervisorPassword = await bcrypt.hash(DEMO.supervisor.password, 10);
  const supervisor = await prisma.user.upsert({
    where: { email: DEMO.supervisor.email },
    update: {
      password: supervisorPassword,
      username: DEMO.supervisor.username,
    },
    create: {
      email: DEMO.supervisor.email,
      username: DEMO.supervisor.username,
      password: supervisorPassword,
      name: 'Maria Santos',
      role: 'SUPERVISOR',
    },
  });

  await prisma.supervisor.upsert({
    where: { userId: supervisor.id },
    update: { establishmentId: establishment.id, position: 'HR Manager' },
    create: {
      userId: supervisor.id,
      establishmentId: establishment.id,
      position: 'HR Manager',
    },
  });

  const studentPassword = await bcrypt.hash(DEMO.student.password, 10);
  const student = await prisma.user.upsert({
    where: { email: DEMO.student.email },
    update: { password: studentPassword, username: DEMO.student.username },
    create: {
      email: DEMO.student.email,
      username: DEMO.student.username,
      password: studentPassword,
      name: 'Juan Dela Cruz',
      role: 'STUDENT',
    },
  });

  // studentIdNumber is unique table-wide, so a profile may need creating while
  // that id is already held by an unrelated student. Fail with an actionable
  // message instead of a raw P2002.
  const existingProfile = await prisma.student.findUnique({
    where: { userId: student.id },
  });
  const idNumberOwner = await prisma.student.findUnique({
    where: { studentIdNumber: DEMO_STUDENT_ID_NUMBER },
  });

  if (!existingProfile && idNumberOwner) {
    throw new Error(
      `Student id number ${DEMO_STUDENT_ID_NUMBER} is already taken by another account. ` +
        'Change DEMO_STUDENT_ID_NUMBER in prisma/seed.ts and re-run.',
    );
  }

  await prisma.student.upsert({
    where: { userId: student.id },
    update: {
      course: 'BSIT',
      establishmentId: establishment.id,
      requiredHours: 500,
      status: 'ACTIVE',
    },
    create: {
      userId: student.id,
      studentIdNumber: DEMO_STUDENT_ID_NUMBER,
      course: 'BSIT',
      establishmentId: establishment.id,
      requiredHours: 500,
      startDate: new Date('2026-03-01'),
      status: 'ACTIVE',
    },
  });

  console.log('Seeded demo accounts (sign in with the username or the email):');
  console.log(
    `  COORDINATOR  ${coordinator.username} (${coordinator.email}) / ${DEMO.coordinator.password}`,
  );
  console.log(
    `  SUPERVISOR   ${supervisor.username} (${supervisor.email}) / ${DEMO.supervisor.password}`,
  );
  console.log(
    `  STUDENT      ${student.username} (${student.email}) / ${DEMO.student.password}`,
  );
  console.log(`  Establishment: ${establishment.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

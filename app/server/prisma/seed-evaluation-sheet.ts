import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { DEFAULT_SHEET } from '../src/common/evaluation-scoring';
import { CASCADE_TRANSACTION_OPTIONS } from '../src/common/cascade-delete';

/**
 * Restores what a table wipe takes away from a database whose migrations are
 * already recorded: the published evaluation sheet (version 1) and the
 * coordinator's `Coordinator` profile row.
 *
 * Version 1 was created only by migration
 * `20260914142544_evaluation_sheet_template`, step 2. `_prisma_migrations`
 * still lists that migration as applied, so `migrate deploy` will never run it
 * again — and it could not be re-run by hand anyway (it creates tables and
 * drops columns). This script writes the same rows that step wrote: the same
 * readable ids, keys, labels and order, with the wording taken from
 * `DEFAULT_SHEET`, which is kept in code for exactly this purpose.
 *
 * `npm run seed` cannot restore the profile row: it sees the coordinator User
 * and stops. Without the row the coordinator is missing from every student's
 * and supervisor's messaging contacts (`MessagesService.getAllCoordinators`).
 *
 * Touches only EvaluationTemplate, EvaluationTemplateSection,
 * EvaluationTemplateItem and Coordinator. Never creates or changes a User.
 * Safe to re-run: a second run finds both already present and writes nothing.
 *
 *   npm run seed:evaluation-sheet
 */

const TEMPLATE_ID = 'evaltpl_v1';

// Widened from DEFAULT_SHEET's `as const` tuples: `.map` over a union of tuple
// types types its callback parameter as `any`.
type SeedItem = { key: string; label: string };
const SECTIONS: readonly (SeedItem & { items: readonly SeedItem[] })[] =
  DEFAULT_SHEET.sections;

/** The subset of PrismaClient this script uses — lets a test pass a fake. */
type Db = Pick<PrismaClient, '$transaction' | 'user' | 'coordinator'>;

type SheetResult =
  | { outcome: 'already-published'; version: number; id: string }
  | {
      outcome: 'blocked';
      rows: { id: string; version: number; status: string }[];
    }
  | { outcome: 'created'; sections: number; items: number };

type CoordinatorResult =
  | { outcome: 'no-coordinator-user' }
  | {
      outcome: 'done';
      created: string[]; // identifiers of the coordinators given a row
      present: string[]; // identifiers that already had one
    };

export async function restoreEvaluationSheet(db: Db): Promise<SheetResult> {
  // One transaction, every statement sequential (CLAUDE.md §8 item 19). The
  // checks run inside it so they and the writes see the same state; the
  // unique `version` and the fixed ids make a concurrent second run fail on
  // insert and roll back rather than write a duplicate.
  return db.$transaction(async (tx) => {
    const published = await tx.evaluationTemplate.findFirst({
      where: { status: 'PUBLISHED' },
      select: { id: true, version: true },
    });
    if (published) {
      return { outcome: 'already-published' as const, ...published };
    }

    // Any other row (a stray draft, an archived version) means someone has
    // been here since the wipe. Version 1 or the id may be taken, and which
    // sheet should be live is a person's call, not this script's.
    const existing = await tx.evaluationTemplate.findMany({
      select: { id: true, version: true, status: true },
      orderBy: { version: 'asc' },
    });
    if (existing.length > 0) {
      return { outcome: 'blocked' as const, rows: existing };
    }

    await tx.evaluationTemplate.create({
      data: {
        id: TEMPLATE_ID,
        version: 1,
        status: 'PUBLISHED',
        title: DEFAULT_SHEET.title,
        publishedAt: new Date(),
      },
      select: { id: true },
    });

    await tx.evaluationTemplateSection.createMany({
      data: SECTIONS.map((section, index) => ({
        id: `evaltplsec_v1_${section.key}`,
        templateId: TEMPLATE_ID,
        key: section.key,
        label: section.label,
        order: index + 1,
      })),
    });

    let items = 0;
    for (const section of SECTIONS) {
      const created = await tx.evaluationTemplateItem.createMany({
        data: section.items.map((item, index) => ({
          id: `evaltplitem_v1_${item.key}`,
          sectionId: `evaltplsec_v1_${section.key}`,
          key: item.key,
          label: item.label,
          order: index + 1,
        })),
      });
      items += created.count;
    }

    return {
      outcome: 'created' as const,
      sections: SECTIONS.length,
      items,
    };
  }, CASCADE_TRANSACTION_OPTIONS);
}

export async function restoreCoordinatorProfiles(
  db: Db,
): Promise<CoordinatorResult> {
  // Explicit select: a bare User read would also ask for mustChangePassword /
  // credentialsSentAt / credentialsEmailError, and on a database where
  // migration 20261010090000_user_credential_flags is not applied yet those
  // columns don't exist and the query fails.
  const coordinators = await db.user.findMany({
    where: { role: 'COORDINATOR' },
    select: {
      id: true,
      username: true,
      email: true,
      coordinatorProfile: { select: { id: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (coordinators.length === 0) {
    return { outcome: 'no-coordinator-user' };
  }

  const created: string[] = [];
  const present: string[] = [];
  for (const user of coordinators) {
    const label = user.username ?? user.email;
    if (user.coordinatorProfile) {
      present.push(label);
      continue;
    }
    // `Coordinator` is { id @default(cuid()), userId @unique } — userId is the
    // only field to supply. The unique index turns a concurrent run into a
    // P2002 instead of a second row.
    await db.coordinator.create({
      data: { userId: user.id },
      select: { id: true },
    });
    created.push(label);
  }

  return { outcome: 'done', created, present };
}

/** Prints the summary; returns false if anything needs a person's attention. */
export function report(sheet: SheetResult, coord: CoordinatorResult): boolean {
  let ok = true;

  console.log('Evaluation sheet:');
  if (sheet.outcome === 'already-published') {
    console.log(
      `  already published (version ${sheet.version}, id ${sheet.id}) — skipped, nothing written.`,
    );
  } else if (sheet.outcome === 'blocked') {
    ok = false;
    console.log(
      '  ABORTED, nothing written: no sheet is published, but these template rows exist:',
    );
    for (const row of sheet.rows) {
      console.log(
        `    id ${row.id}  version ${row.version}  status ${row.status}`,
      );
    }
    console.log(
      '  Publish or discard that draft from Coordinator → Evaluations, or remove the rows by hand, then run this again.',
    );
  } else {
    console.log(
      `  created and published version 1 (${TEMPLATE_ID}): ${sheet.sections} sections, ${sheet.items} items.`,
    );
  }

  console.log('Coordinator profile:');
  if (coord.outcome === 'no-coordinator-user') {
    ok = false;
    console.log(
      '  WARNING: no User with role COORDINATOR exists — nothing written. Run `npm run seed` first (it creates the User and its profile together).',
    );
  } else {
    for (const label of coord.created) {
      console.log(`  created the Coordinator row for "${label}".`);
    }
    for (const label of coord.present) {
      console.log(`  "${label}" already has a Coordinator row — skipped.`);
    }
  }

  return ok;
}

async function main() {
  // Same setup as seed.ts. No global `omit` is needed: PrismaService omits
  // retired Student and Establishment columns, and this script reads neither.
  const prisma = new PrismaClient();
  try {
    // Two independent parts: a stray draft blocking the sheet is no reason to
    // leave the coordinator out of everyone's contacts, and vice versa.
    const sheet = await restoreEvaluationSheet(prisma);
    const coord = await restoreCoordinatorProfiles(prisma);
    if (!report(sheet, coord)) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

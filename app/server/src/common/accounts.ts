import { Prisma } from '../../generated/prisma/client';

/**
 * The Prisma half of generated credentials — the callbacks
 * `createWithGeneratedUsername` (common/credentials.ts) is given. Kept apart so
 * credentials.ts stays free of database types.
 */

/** Anything with `user.findMany` — the client itself or a transaction. */
type UserReader = {
  user: {
    findMany(args: {
      where: { username: { startsWith: string; mode: 'insensitive' } };
      select: { username: true };
    }): Promise<{ username: string | null }[]>;
  };
};

/**
 * Every existing username beginning with `base`, case-insensitively — one
 * query, enough for `nextFreeUsername` to pick the next free suffix.
 */
export async function findTakenUsernames(
  db: UserReader,
  base: string,
): Promise<string[]> {
  const rows = await db.user.findMany({
    where: { username: { startsWith: base, mode: 'insensitive' } },
    select: { username: true },
  });
  return rows.flatMap((row) => (row.username ? [row.username] : []));
}

/**
 * True when an insert lost a race for a username: P2002 (unique constraint)
 * on `User.username`. A P2002 on email or student ID is a different problem
 * and must not be retried, so the constraint's target is checked too.
 */
export function isUsernameClash(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code !== 'P2002') return false;
  return JSON.stringify(err.meta?.target ?? '').includes('username');
}

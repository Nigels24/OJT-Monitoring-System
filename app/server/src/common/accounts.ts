import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type { MailService } from '../mail/mail.service';
import {
  createWithGeneratedUsername,
  generatePassword,
  usernameBase,
} from './credentials';

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

/**
 * True for a P2002 on `field` — e.g. `studentIdNumber` claimed between a
 * pre-check and the insert. Matches the constraint's target, so a clash on
 * some other unique column is not mistaken for this one.
 */
export function isUniqueClashOn(err: unknown, field: string): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code !== 'P2002') return false;
  return JSON.stringify(err.meta?.target ?? '').includes(field);
}

/** True for a P2002 on `User.email` — an email claimed between check and insert. */
export function isEmailClash(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code !== 'P2002') return false;
  return JSON.stringify(err.meta?.target ?? '').includes('email');
}

/**
 * User.name is the one display name the rest of the app reads; the forms
 * collect first / middle initial / last separately. Joined with single
 * spaces, blanks dropped. Shared by every create and the supervisor edit so a
 * name is composed the same way wherever it is written.
 */
export function buildPersonName(parts: {
  firstName?: string | null;
  middleInitial?: string | null;
  lastName?: string | null;
}): string {
  return [parts.firstName, parts.middleInitial, parts.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
}

/**
 * Creates a login with a generated username and temporary password.
 *
 * `create` receives the chosen username and the password *hash*; the
 * plaintext never reaches Prisma, so no Prisma error (which can echo its
 * arguments) can carry it. It leaves here only inside `credentials`, which
 * the caller returns as the one response that ever shows it.
 *
 * `create` may run more than once: a lost username race rolls its
 * transaction back and the pick-and-create is retried, so everything it
 * writes belongs inside that one transaction.
 */
export async function issueNewAccount<T>(
  db: UserReader,
  firstName: string,
  lastName: string,
  create: (username: string, passwordHash: string) => Promise<T>,
): Promise<{
  result: T;
  credentials: { username: string; tempPassword: string };
}> {
  const tempPassword = generatePassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const { result, username } = await createWithGeneratedUsername(
    usernameBase(firstName, lastName),
    (base) => findTakenUsernames(db, base),
    async (username) => ({
      result: await create(username, passwordHash),
      username,
    }),
    isUsernameClash,
  );
  return { result, credentials: { username, tempPassword } };
}

/** Anything with `user.findUnique` by email — the client itself or a transaction. */
type EmailReader = {
  user: {
    findUnique(args: {
      where: { email: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
};

/** Rejects (409) an email already claimed by another account. */
export async function assertEmailAvailable(
  db: EmailReader,
  email: string,
): Promise<void> {
  const clash = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (clash) {
    throw new ConflictException('Email already in use');
  }
}

/**
 * The login fields "Resend login" needs — never `password`. Select these on the
 * User relation and pass the result to `reissuePassword`.
 */
export const RESEND_ACCOUNT_SELECT = {
  id: true,
  name: true,
  email: true,
  username: true,
  role: true,
} as const;

/** Where an issued login's delivery stands — added to every create/resend response. */
export interface EmailOutcome {
  emailSent: boolean;
  /** Present when not sent: the short, safe reason. */
  emailError?: string;
  /** The inbox it actually went to (MAIL_REDIRECT_TO when set). */
  emailedTo?: string;
}

/** Anything that can write the two status columns — the client, not a transaction. */
type StatusWriter = {
  user: {
    update(args: {
      where: { id: string };
      data: {
        credentialsSentAt?: Date | null;
        credentialsEmailError: string | null;
      };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
};

const NO_EMAIL = 'No email address on file';
const logger = new Logger('Credentials');

/**
 * Emails a freshly issued login and records how it went — the one place any
 * flow sends credentials.
 *
 * **Call it only after the account's write has committed**, never inside a
 * transaction: an email can't be unsent, so it must describe a password that
 * really is stored, and its failure must never roll the account back. It
 * never throws: the account exists either way, and the response still
 * carries `credentials` for the one-time dialog.
 *
 * On success `credentialsSentAt = now` and the error is cleared; on failure
 * the short, safe reason is stored in `credentialsEmailError` (and
 * `credentialsSentAt` keeps the last success, if any). Log mode records
 * neither — nothing was delivered, and nothing failed.
 */
export async function deliverCredentials(
  db: StatusWriter,
  mail: MailService,
  account: {
    id: string;
    name: string;
    email: string | null;
    role: 'STUDENT' | 'SUPERVISOR';
  },
  credentials: { username: string | null; tempPassword: string },
): Promise<EmailOutcome> {
  const to = account.email?.trim();
  const result = to
    ? await mail.sendCredentials({
        to,
        name: account.name,
        role: account.role,
        username: credentials.username,
        tempPassword: credentials.tempPassword,
      })
    : { sent: false as const, error: NO_EMAIL };

  if (!result.sent && 'logOnly' in result && result.logOnly) {
    return { emailSent: false, emailError: result.error };
  }

  try {
    await db.user.update({
      where: { id: account.id },
      data: result.sent
        ? { credentialsSentAt: new Date(), credentialsEmailError: null }
        : { credentialsEmailError: result.error },
      select: { id: true },
    });
  } catch (err: unknown) {
    // The email (or its failure) already happened; a status write that fails
    // must not turn the request into an error. No credentials in this line.
    logger.error(
      `Could not record email status for user ${account.id}: ${
        err instanceof Error ? err.name : 'unknown error'
      }`,
    );
  }

  return result.sent
    ? { emailSent: true, emailedTo: result.deliveredTo }
    : { emailSent: false, emailError: result.error };
}

/** Anything with `user.update` — the client itself or a transaction. */
type UserWriter = {
  user: {
    update(args: {
      where: { id: string };
      data: { password: string; mustChangePassword: true };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
};

/**
 * "Resend login": a new generated password for an existing account, hashed
 * before Prisma sees it, with a forced change at next sign-in. The plaintext
 * leaves only in `credentials`. The username is never regenerated — `null`
 * for an account from before usernames, which signs in with its email.
 *
 * The caller has already decided the account may be reset (the coordinator
 * for anyone, a supervisor only for their own establishment's students).
 *
 * **Order: save, then send.** The new hash is written (and committed — `db` is
 * the client, not a transaction) before the email goes out, so what was
 * emailed always matches what is stored. The consequence: a failed send has
 * already invalidated the old password, which is why the response still
 * carries `credentials` for the one-time dialog.
 */
export async function reissuePassword(
  db: UserWriter & StatusWriter,
  mail: MailService,
  user: {
    id: string;
    name: string;
    email: string;
    username: string | null;
    role: string;
  },
) {
  const tempPassword = generatePassword();
  await db.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(tempPassword, 10),
      mustChangePassword: true,
    },
    select: { id: true },
  });
  const credentials = { username: user.username, tempPassword };
  const outcome = await deliverCredentials(
    db,
    mail,
    {
      id: user.id,
      name: user.name,
      email: user.email,
      // Resend stops short of COORDINATOR accounts (the callers look up
      // students and supervisors only), so this is one of the two.
      role: user.role === 'SUPERVISOR' ? 'SUPERVISOR' : 'STUDENT',
    },
    credentials,
  );
  return {
    name: user.name,
    email: user.email,
    credentials,
    ...outcome,
  };
}

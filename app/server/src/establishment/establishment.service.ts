import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CASCADE_TRANSACTION_OPTIONS,
  deleteSupervisorCascade,
} from '../common/cascade-delete';
import {
  assertEmailAvailable,
  buildPersonName,
  isUniqueClashOn,
  issueNewAccount,
} from '../common/accounts';
import {
  duplicateEstablishmentMessage,
  establishmentKeys,
} from '../common/establishment-identity';

const ALREADY_HAS_SUPERVISOR = 'This establishment already has a supervisor';

/**
 * The User half of a new supervisor. Takes the password *hash*; the plaintext
 * stays in `issueNewAccount` and the response. `mustChangePassword` makes the
 * supervisor replace the generated password at first sign-in.
 */
function supervisorUserData(
  supervisor: NewSupervisorInput,
  username: string,
  passwordHash: string,
) {
  return {
    email: supervisor.email,
    username,
    password: passwordHash,
    mustChangePassword: true,
    name: buildPersonName(supervisor),
    role: 'SUPERVISOR' as const,
  };
}

/**
 * The supervisor created with (or added to) an establishment. No username or
 * password: both are generated, and the password is returned exactly once.
 */
interface NewSupervisorInput {
  firstName: string;
  middleInitial?: string;
  lastName: string;
  email: string;
  position?: string;
}

/**
 * The establishment's own columns. The old `coordinator*` contact columns
 * (name, age, gender, position, address, contact, email) are deliberately
 * absent: that contact person is the supervisor, now a real account. The
 * columns stay in the schema, unread and unwritten.
 */
interface EstablishmentFields {
  name: string;
  /** Trimmed by the DTO; `null` = no branch (on an update: clear it). */
  branch?: string | null;
  industryType?: string;
  streetAddress?: string;
  region?: string;
  barangay?: string;
  city?: string;
  province?: string;
  zipCode?: string;
}

/** Only an edit may change status — creation always yields ACTIVE. */
type EstablishmentUpdate = Partial<EstablishmentFields> & {
  status?: 'ACTIVE' | 'INACTIVE';
};

/**
 * The establishment's own columns, named one by one. Every read and write in
 * this service selects exactly these (plus explicitly selected relations) —
 * never `include`, which returns every scalar of whatever it touches. The
 * retired `coordinator*` columns are absent (and globally omitted anyway).
 */
const ESTABLISHMENT_FIELDS = {
  id: true,
  name: true,
  branch: true,
  industryType: true,
  streetAddress: true,
  region: true,
  barangay: true,
  city: true,
  province: true,
  zipCode: true,
  status: true,
  createdAt: true,
} as const;

/**
 * An assigned student as the coordinator's view dialog lists one — and
 * nothing more. Name from User via an explicit select (no password hash, no
 * email); no contact number, address, dates or ids beyond the row's own.
 */
const ASSIGNED_STUDENT_SELECT = {
  id: true,
  studentIdNumber: true,
  course: true,
  yearLevel: true,
  status: true,
  user: { select: { name: true } },
} as const;

/**
 * The supervisor as the establishment list shows it. Explicit `select` on the
 * User relation — `user: true` would return the password hash.
 */
const SUPERVISOR_SUMMARY_SELECT = {
  id: true,
  position: true,
  user: { select: { name: true, email: true } },
} as const;

type SupervisorSummaryRow = {
  id: string;
  position: string | null;
  user: { name: string; email: string };
};

/** Flattened to `{ id, name, email, position }` for the client. */
function toSupervisorSummary(row: SupervisorSummaryRow) {
  return {
    id: row.id,
    name: row.user.name,
    email: row.user.email,
    position: row.position,
  };
}

/** The client itself or an interactive transaction — both can run this read. */
type EstablishmentReader = Pick<Prisma.TransactionClient, 'establishment'>;

/**
 * 409 when another establishment already has these keys. `excludeId` is the
 * row being edited, which may of course keep its own name. The unique index
 * is what actually guarantees it; this read is what gives the common case a
 * message that says what to do.
 */
async function assertNameAvailable(
  db: EstablishmentReader,
  keys: { nameKey: string; branchKey: string },
  display: { name: string; branch?: string | null },
  excludeId?: string,
) {
  const clash = await db.establishment.findFirst({
    where: { ...keys, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (clash) {
    throw new ConflictException(
      duplicateEstablishmentMessage(display.name, display.branch),
    );
  }
}

/**
 * A P2002 on the (nameKey, branchKey) index — two requests that both passed
 * the read above at once — becomes the same 409. Anything else is rethrown.
 */
function rethrowNameClash(
  err: unknown,
  display: { name: string; branch?: string | null },
): never {
  if (isUniqueClashOn(err, 'nameKey')) {
    throw new ConflictException(
      duplicateEstablishmentMessage(display.name, display.branch),
    );
  }
  throw err;
}

@Injectable()
export class EstablishmentService {
  constructor(private prisma: PrismaService) {}

  /**
   * Creates an establishment, and its supervisor when one is given.
   *
   * With a supervisor, the Establishment, User and Supervisor rows are written
   * in ONE transaction: a failure on any of them (or a lost username race,
   * which is retried) leaves none behind — no establishment half-created with
   * a login that has no profile. The writes inside are sequential awaits; an
   * interactive transaction is one connection and concurrent queries on it
   * come back wrong (CLAUDE.md §8 item 19).
   *
   * The response is the establishment row as before, plus `supervisor` and the
   * one-time `credentials` when a supervisor was created.
   */
  async create(
    data: EstablishmentFields & { supervisor?: NewSupervisorInput },
  ) {
    const { supervisor, ...fields } = data;
    const keys = establishmentKeys(fields.name, fields.branch);
    // Every new establishment starts ACTIVE; the DTO has no status field.
    const establishmentData = {
      ...fields,
      ...keys,
      status: 'ACTIVE' as const,
    };

    // Before anything else — in particular before a password is generated
    // and hashed for a supervisor who would never be created.
    await assertNameAvailable(this.prisma.client, keys, fields);

    if (!supervisor) {
      return this.prisma.client.establishment
        .create({ data: establishmentData, select: ESTABLISHMENT_FIELDS })
        .catch((err: unknown) => rethrowNameClash(err, fields));
    }

    await assertEmailAvailable(this.prisma.client, supervisor.email);

    const { result, credentials } = await issueNewAccount(
      this.prisma.client,
      supervisor.firstName,
      supervisor.lastName,
      (username, passwordHash) =>
        this.prisma.client.$transaction(async (tx) => {
          // Again inside the transaction, right before the insert. A 409
          // here — or the index's P2002 on the insert itself — aborts the
          // transaction, so no User or Supervisor row is left behind.
          await assertNameAvailable(tx, keys, fields);
          const establishment = await tx.establishment.create({
            data: establishmentData,
            select: ESTABLISHMENT_FIELDS,
          });
          const created = await tx.supervisor.create({
            data: {
              position: supervisor.position,
              establishment: { connect: { id: establishment.id } },
              user: {
                create: supervisorUserData(supervisor, username, passwordHash),
              },
            },
            select: SUPERVISOR_SUMMARY_SELECT,
          });
          return { establishment, supervisor: created };
        }, CASCADE_TRANSACTION_OPTIONS),
      // isUsernameClash retries only a `username` P2002, so a `nameKey` one
      // leaves the retry loop untouched and is mapped here.
    ).catch((err: unknown) => rethrowNameClash(err, fields));

    return {
      ...result.establishment,
      supervisor: toSupervisorSummary(result.supervisor),
      credentials,
    };
  }

  /**
   * Adds a supervisor to an existing establishment. Same body and same
   * one-time `credentials` as the nested create. 404 for an unknown
   * establishment.
   *
   * **One supervisor per establishment** (409 "This establishment already
   * has a supervisor"), at three levels:
   *
   * 1. the establishment lookup also reads its supervisor, so the common case
   *    is refused before an account is generated or an email checked;
   * 2. the same check again **inside the transaction** that creates the
   *    supervisor, right before the insert;
   * 3. the database's unique index on `Supervisor.establishmentId`, for two
   *    requests that both pass (2) at once: the loser's insert fails with
   *    P2002 on `establishmentId`, mapped to the same 409.
   *
   * That P2002 is told apart from the username one by its target:
   * `isUsernameClash` (inside `issueNewAccount`) retries only a clash on
   * `username`, so an `establishmentId` clash propagates out of the retry
   * loop untouched and is caught below. Replacing a supervisor means deleting
   * the old one first (their evaluations go with them, as before).
   */
  async addSupervisor(establishmentId: string, supervisor: NewSupervisorInput) {
    const establishment = await this.prisma.client.establishment.findUnique({
      where: { id: establishmentId },
      select: { id: true, supervisor: { select: { id: true } } },
    });
    if (!establishment) {
      throw new NotFoundException('Establishment not found');
    }
    if (establishment.supervisor) {
      throw new ConflictException(ALREADY_HAS_SUPERVISOR);
    }

    await assertEmailAvailable(this.prisma.client, supervisor.email);

    const { result, credentials } = await issueNewAccount(
      this.prisma.client,
      supervisor.firstName,
      supervisor.lastName,
      (username, passwordHash) =>
        this.prisma.client.$transaction(async (tx) => {
          // Sequential, never Promise.all, inside the transaction.
          const existing = await tx.supervisor.findUnique({
            where: { establishmentId },
            select: { id: true },
          });
          if (existing) {
            throw new ConflictException(ALREADY_HAS_SUPERVISOR);
          }
          return tx.supervisor.create({
            data: {
              position: supervisor.position,
              establishment: { connect: { id: establishmentId } },
              user: {
                create: supervisorUserData(supervisor, username, passwordHash),
              },
            },
            select: SUPERVISOR_SUMMARY_SELECT,
          });
        }, CASCADE_TRANSACTION_OPTIONS),
    ).catch((err: unknown) => {
      // A concurrent add that won the unique index. Any other error —
      // including the in-transaction 409 above — passes through unchanged.
      if (isUniqueClashOn(err, 'establishmentId')) {
        throw new ConflictException(ALREADY_HAS_SUPERVISOR);
      }
      throw err;
    });

    return {
      ...toSupervisorSummary(result),
      establishmentId,
      credentials,
    };
  }

  /**
   * Every establishment, with its one supervisor `{ id, name, email,
   * position }` or `null`, and `_count: { students }`. (`_count.supervisors`
   * went with the 1:1 relation — Prisma only counts list relations, and
   * `supervisor !== null` says the same thing.)
   */
  async findAll() {
    const establishments = await this.prisma.client.establishment.findMany({
      select: {
        ...ESTABLISHMENT_FIELDS,
        _count: { select: { students: true } },
        supervisor: { select: SUPERVISOR_SUMMARY_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });

    return establishments.map(({ supervisor, ...establishment }) => ({
      ...establishment,
      supervisor: supervisor ? toSupervisorSummary(supervisor) : null,
    }));
  }

  /**
   * One establishment: its own columns, `_count`, the supervisor summary (the
   * list row's shape), and — for the COORDINATOR only — `students`, each
   * reduced to `{ id, name, studentIdNumber, course, yearLevel, status }`.
   *
   * This used to `include: { students: true }` for any signed-in role, i.e.
   * every column of every student placed there (contact number, address, …):
   * a student could read classmates' details by id. Reads stay open to every
   * role, as the rest of this controller's reads are; the student list is
   * what is restricted, because only the coordinator's view dialog needs it.
   * For anyone else the key is absent, not an empty array, so it can't be
   * mistaken for "no students".
   */
  async findOne(id: string, role: string) {
    const establishment = await this.prisma.client.establishment.findUnique({
      where: { id },
      select: {
        ...ESTABLISHMENT_FIELDS,
        _count: { select: { students: true } },
        supervisor: { select: SUPERVISOR_SUMMARY_SELECT },
      },
    });
    if (!establishment) {
      throw new NotFoundException('Establishment not found');
    }

    const { supervisor, ...rest } = establishment;
    const detail = {
      ...rest,
      supervisor: supervisor ? toSupervisorSummary(supervisor) : null,
    };
    // Everyone else: no `students` key at all, and no query for them.
    if (role !== 'COORDINATOR') return detail;

    // A second query rather than a conditional nested select, which would
    // lose its types; Prisma loads a relation with its own query anyway.
    const students = await this.prisma.client.student.findMany({
      where: { establishmentId: id },
      select: ASSIGNED_STUDENT_SELECT,
      orderBy: { user: { name: 'asc' } },
    });
    return {
      ...detail,
      students: students.map(({ user, ...student }) => ({
        id: student.id,
        name: user.name,
        studentIdNumber: student.studentIdNumber,
        course: student.course,
        yearLevel: student.yearLevel,
        status: student.status,
      })),
    };
  }

  /**
   * An edit that touches `name` or `branch` recomputes both keys from the
   * resulting pair (a field left out keeps its stored value) and is a 409 if
   * another establishment already has them. Keeping its own name is fine —
   * the check excludes the row itself.
   */
  async update(id: string, data: EstablishmentUpdate) {
    const existing = await this.prisma.client.establishment.findUnique({
      where: { id },
      select: { id: true, name: true, branch: true },
    });
    if (!existing) {
      throw new NotFoundException('Establishment not found');
    }

    if (data.name === undefined && data.branch === undefined) {
      return this.prisma.client.establishment.update({
        where: { id },
        data,
        select: ESTABLISHMENT_FIELDS,
      });
    }

    const display = {
      name: data.name ?? existing.name,
      branch: data.branch === undefined ? existing.branch : data.branch,
    };
    const keys = establishmentKeys(display.name, display.branch);
    await assertNameAvailable(this.prisma.client, keys, display, id);

    return this.prisma.client.establishment
      .update({
        where: { id },
        data: { ...data, ...keys },
        select: ESTABLISHMENT_FIELDS,
      })
      .catch((err: unknown) => rethrowNameClash(err, display));
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

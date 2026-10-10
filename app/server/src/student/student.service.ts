import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DAY_SELECT,
  HOURS_PUNCH_SELECT,
  PUNCH_LABEL,
  PunchLike,
  punchAvailability,
  roundHours,
  summarizeDay,
  totalApprovedHours,
  totalPendingHours,
} from '../common/attendance-hours';
import { formatDateOnly, manilaToday, toUtcDateOnly } from '../common/dates';
import {
  buildObjectPath,
  deleteFile,
  getSignedUrl,
  uploadFile,
} from '../common/storage';
import { documentFileName } from '../common/document-types';
import { DocumentType, Prisma, PunchKind } from '../../generated/prisma/client';

interface UpdateProfileInput {
  /** `null` = explicitly cleared; `undefined` = not supplied, leave unchanged. */
  contactNumber?: string | null;
  address?: string | null;
}

interface UploadDocumentInput {
  type: DocumentType;
}

const PROFILE_INCLUDE = {
  user: { select: { id: true, email: true, name: true } },
  establishment: { select: { id: true, name: true, branch: true } },
} as const;

/** What a student's own document list reads — `fileUrl` is the stored PATH, signed on the way out. */
const MY_DOCUMENT_SELECT = {
  id: true,
  type: true,
  originalFileName: true,
  fileUrl: true,
  uploadedAt: true,
} as const;

interface MyDocumentRow {
  id: string;
  type: DocumentType;
  originalFileName: string | null;
  fileUrl: string;
  uploadedAt: Date;
}

export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
]);
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Removes a storage object nothing points at any more.
   *
   * Non-fatal by design: an orphaned file wastes a few KB and can be swept up
   * later, while failing the request here would report an error for a delete
   * or replace that actually succeeded. `reason` says why it is orphaned.
   */
  private async deleteStoredObject(path: string, reason: string) {
    try {
      await deleteFile(path);
    } catch (err) {
      this.logger.error(
        `Storage object "${path}" (${reason}) could not be deleted: ` +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  }

  private async getStudentByUserId(userId: string) {
    const student = await this.prisma.client.student.findUnique({
      where: { userId },
    });
    if (!student) {
      throw new NotFoundException('Student profile not found');
    }
    return student;
  }

  async getDashboard(userId: string) {
    const student = await this.prisma.client.student.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        establishment: {
          select: {
            id: true,
            name: true,
            branch: true,
            industryType: true,
            // The contact card is the establishment's supervisor (the old
            // coordinator* contact columns were the same person, and are
            // retired). Name, position and email only — nothing else of the
            // account leaves here. One per establishment, or none.
            supervisor: {
              select: {
                position: true,
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
        attendances: { orderBy: { date: 'desc' }, select: DAY_SELECT },
        _count: { select: { documents: true } },
      },
    });
    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    const { attendances, establishment, ...profile } = student;
    const completedHours = totalApprovedHours(attendances);
    // Counts are of punches, not days: each punch is approved on its own, so
    // "3 pending" means three decisions still owed.
    const punches = attendances.flatMap((a) => a.punches);
    const countOf = (status: 'PENDING' | 'APPROVED' | 'DECLINED') =>
      punches.filter((p) => p.status === status).length;

    return {
      ...profile,
      establishment: establishment && withSupervisorContact(establishment),
      stats: {
        // Only sessions with both punches approved count toward the
        // requirement, which is why this can trail what was punched.
        completedHours,
        pendingHours: totalPendingHours(attendances),
        requiredHours: student.requiredHours,
        remainingHours: Math.max(
          0,
          roundHours(student.requiredHours - completedHours),
        ),
        /** Days with at least one punch (or a remark). */
        totalLogs: attendances.length,
        approvedCount: countOf('APPROVED'),
        pendingCount: countOf('PENDING'),
        declinedCount: countOf('DECLINED'),
      },
      recentAttendance: attendances.slice(0, 5).map(toDay),
    };
  }

  /**
   * Today's punch card: the four punches, whether each may be punched now
   * (`true` or the reason not), and the derived status and hours. The client
   * renders the card from this alone and keeps no copy of the rules.
   */
  async getToday(userId: string) {
    const student = await this.getStudentByUserId(userId);
    return this.buildToday(student);
  }

  /**
   * Records one punch at the server's current time, on Manila's today.
   *
   * Neither a date nor a time is accepted from the request — the DTO declares
   * only `kind`, so `forbidNonWhitelisted` rejects either. That is the whole
   * point of a live punch: the student can't backdate or round a time.
   *
   * A DECLINED punch of the same kind is overwritten (new time, back to
   * PENDING, decision cleared) — the punch rules decide when that's allowed.
   */
  async punch(userId: string, kind: PunchKind) {
    const student = await this.getStudentByUserId(userId);
    const today = manilaToday();

    const blocked = attendanceBlockedReason(student, today);
    if (blocked) throw new BadRequestException(blocked);

    const day = await this.getOrCreateDay(student.id, today);
    const punches = await this.prisma.client.attendancePunch.findMany({
      where: { attendanceId: day.id },
      select: { id: true, ...HOURS_PUNCH_SELECT },
    });
    const existing = punches.find((p) => p.kind === kind) ?? null;

    const verdict = punchAvailability(punches, null)[kind];
    if (verdict !== true) {
      // A punch that already stands is a conflict with existing state; every
      // other refusal is an ordering rule the request broke.
      if (existing && existing.status !== 'DECLINED') {
        throw new ConflictException(verdict);
      }
      throw new BadRequestException(verdict);
    }

    const now = new Date();
    if (existing) {
      // `status: 'DECLINED'` in the filter makes this a compare-and-set: if the
      // row changed since it was read, nothing is overwritten.
      const { count } = await this.prisma.client.attendancePunch.updateMany({
        where: { id: existing.id, status: 'DECLINED' },
        data: {
          time: now,
          status: 'PENDING',
          decidedById: null,
          decidedAt: null,
          declineReason: null,
        },
      });
      if (count === 0) {
        throw new ConflictException(
          `${PUNCH_LABEL[kind]} changed while you were punching. Refresh and try again.`,
        );
      }
    } else {
      try {
        await this.prisma.client.attendancePunch.create({
          data: { attendanceId: day.id, kind, time: now },
        });
      } catch (err) {
        // A double tap: both requests passed the check above, and
        // @@unique([attendanceId, kind]) stopped the second insert.
        if (isUniqueViolation(err)) {
          throw new ConflictException(
            `${PUNCH_LABEL[kind]} is already recorded for today.`,
          );
        }
        throw err;
      }
    }

    return this.buildToday(student);
  }

  /**
   * Sets today's remark — the student's own note, never a decline reason.
   * Editable at any time on the day; `null` clears it, absent leaves it.
   * Held to the same blocks as punching: a day row for a student who can't
   * punch would be an orphan nobody can approve.
   */
  async updateTodayRemarks(userId: string, remarks: string | null | undefined) {
    const student = await this.getStudentByUserId(userId);
    const today = manilaToday();

    const blocked = attendanceBlockedReason(student, today);
    if (blocked) throw new BadRequestException(blocked);

    if (remarks !== undefined) {
      const day = await this.getOrCreateDay(student.id, today);
      await this.prisma.client.attendance.update({
        where: { id: day.id },
        data: { remarks },
      });
    }
    return this.buildToday(student);
  }

  async getAttendanceHistory(userId: string) {
    const student = await this.getStudentByUserId(userId);

    const days = await this.prisma.client.attendance.findMany({
      where: { studentId: student.id },
      orderBy: { date: 'desc' },
      select: DAY_SELECT,
    });

    return days.map(toDay);
  }

  private async buildToday(student: StudentRow) {
    const today = manilaToday();
    const blockedReason = attendanceBlockedReason(student, today);
    const day = await this.prisma.client.attendance.findUnique({
      where: { studentId_date: { studentId: student.id, date: today } },
      select: DAY_SELECT,
    });
    const punches = day?.punches ?? [];
    const summary = summarizeDay(punches);

    return {
      date: today,
      attendanceId: day?.id ?? null,
      remarks: day?.remarks ?? null,
      punches: summary.punches,
      // null, not INCOMPLETE, when nothing has been logged today at all.
      dayStatus: day ? summary.dayStatus : null,
      approvedHours: summary.approvedHours,
      pendingHours: summary.pendingHours,
      allowed: punchAvailability(punches, blockedReason),
      blockedReason,
    };
  }

  /**
   * The day row for (student, date), created on first use.
   *
   * `upsert` alone isn't race-proof: two first punches at the same instant
   * can both find no row and both INSERT, and the unique index rejects one.
   * The row exists by then, so the loser just reads it.
   */
  private async getOrCreateDay(studentId: string, date: Date) {
    const where = { studentId_date: { studentId, date } };
    try {
      return await this.prisma.client.attendance.upsert({
        where,
        create: { studentId, date },
        update: {},
        select: { id: true },
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      return this.prisma.client.attendance.findUniqueOrThrow({
        where,
        select: { id: true },
      });
    }
  }

  async getProfile(userId: string) {
    const student = await this.prisma.client.student.findUnique({
      where: { userId },
      include: PROFILE_INCLUDE,
    });
    if (!student) {
      throw new NotFoundException('Student profile not found');
    }
    return student;
  }

  async updateProfile(userId: string, data: UpdateProfileInput) {
    const student = await this.getStudentByUserId(userId);
    return this.prisma.client.student.update({
      where: { id: student.id },
      data,
      include: PROFILE_INCLUDE,
    });
  }

  /**
   * Uploads the file for one requirement type, replacing any file already
   * submitted for that type — `@@unique([studentId, type])` allows one.
   *
   * Order matters, because storage is not part of a database transaction:
   * upload the new object first, then point the row at it, and only then
   * delete the old object. Any failure part-way leaves the student's previous
   * file intact and still referenced; the worst case is an orphaned object,
   * never a row pointing at nothing.
   */
  async uploadDocument(
    userId: string,
    data: UploadDocumentInput,
    file: Express.Multer.File | undefined,
  ) {
    const student = await this.getStudentByUserId(userId);
    assertValidDocumentFile(file);

    const previous = await this.prisma.client.document.findUnique({
      where: { studentId_type: { studentId: student.id, type: data.type } },
      select: { fileUrl: true },
    });

    const path = buildObjectPath('documents', student.id, file.originalname);
    await uploadFile(path, file.buffer, file.mimetype);

    const fields = {
      fileUrl: path,
      originalFileName: file.originalname.slice(0, 255),
      // A replacement counts as submitted now, not when the first file was.
      uploadedAt: new Date(),
    };

    let saved: MyDocumentRow;
    try {
      saved = await this.prisma.client.document.upsert({
        where: { studentId_type: { studentId: student.id, type: data.type } },
        create: { studentId: student.id, type: data.type, ...fields },
        update: fields,
        select: MY_DOCUMENT_SELECT,
      });
    } catch (err) {
      // The row was never pointed at the new object, so it is the one to go.
      await this.deleteStoredObject(path, 'upload whose row was not saved');
      throw err;
    }

    if (previous) {
      await this.deleteStoredObject(
        previous.fileUrl,
        `replaced by a new upload on document ${saved.id}`,
      );
    }

    return presentMyDocument(saved);
  }

  async getMyDocuments(userId: string) {
    const student = await this.getStudentByUserId(userId);

    const documents = await this.prisma.client.document.findMany({
      where: { studentId: student.id },
      select: MY_DOCUMENT_SELECT,
      orderBy: { uploadedAt: 'desc' },
    });

    return Promise.all(documents.map(presentMyDocument));
  }

  /**
   * Deletes one of the student's own documents. There is no status to guard
   * on any more — the review workflow is gone — so any of their own goes.
   */
  async deleteDocument(userId: string, documentId: string) {
    const student = await this.getStudentByUserId(userId);

    const document = await this.prisma.client.document.findUnique({
      where: { id: documentId },
      select: { studentId: true, fileUrl: true },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    if (document.studentId !== student.id) {
      throw new ForbiddenException('This document does not belong to you');
    }

    // Row first, then the object — the same order the cascade deletes use
    // (CLAUDE.md §6). Reversed, a storage success followed by a failed row
    // delete leaves a row pointing at nothing, which is the state that used to
    // 500 the whole documents list.
    await this.prisma.client.document.delete({ where: { id: documentId } });
    await this.deleteStoredObject(
      document.fileUrl,
      `document ${documentId} was deleted`,
    );

    return { id: documentId, deleted: true };
  }
}

/**
 * The student-facing shape of a document: the display name resolved (with
 * its fallback for migrated rows) from the stored path *before* the path is
 * swapped for a signed URL, whose query string would hide the extension.
 */
async function presentMyDocument(row: MyDocumentRow) {
  const signed = await withSignedUrl(row);
  return {
    id: row.id,
    type: row.type,
    fileName: documentFileName(row),
    uploadedAt: row.uploadedAt,
    fileUrl: signed.fileUrl,
  };
}

/**
 * Swaps a stored object path for a short-lived signed URL.
 *
 * Never throws. A missing object yields `fileUrl: null` so the row still
 * renders as "unavailable" — these run under `Promise.all` across a whole list
 * (`getMyDocuments`), and
 * a throw there took out the entire page for every student rather than the one
 * bad row. The likeliest cause is a storage object deleted out from under the
 * row, so it is logged loudly and left for someone to clean up.
 */
export async function withSignedUrl<T extends { fileUrl: string }>(
  record: T,
): Promise<T & { fileUrl: string | null }> {
  try {
    return { ...record, fileUrl: await getSignedUrl(record.fileUrl) };
  } catch (err) {
    storageLogger.error(
      `No signed URL for stored object "${record.fileUrl}" — the row survives with fileUrl: null: ` +
        (err instanceof Error ? err.message : String(err)),
    );
    return { ...record, fileUrl: null };
  }
}

/** Module-scope: `withSignedUrl` is a free function, not part of the service. */
const storageLogger = new Logger('StorageSignedUrl');

function assertValidDocumentFile(
  file: Express.Multer.File | undefined,
): asserts file is Express.Multer.File {
  if (!file) {
    throw new BadRequestException('A file is required');
  }
  if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimetype)) {
    throw new BadRequestException('Only PDF, PNG or JPEG files are accepted');
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    throw new BadRequestException('File must be 10MB or smaller');
  }
}

/** A day as every attendance reader returns it. */
function toDay<D extends { punches: PunchLike[] }>({ punches, ...day }: D) {
  return { ...day, ...summarizeDay(punches) };
}

interface StudentRow {
  id: string;
  status: string;
  establishmentId: string | null;
  startDate: Date | null;
}

/**
 * Why this student can't log attendance today, or null if they can. The same
 * three blocks the old submit form enforced:
 * - COMPLETED closes logging. Completion is by hours; no calendar date
 *   ever closes it.
 * - No establishment: the approval queue is establishment-scoped, so a punch
 *   would sit PENDING forever (CLAUDE.md §8 item 21).
 * - Nothing before `startDate`, compared as Manila calendar days.
 */
function attendanceBlockedReason(
  student: StudentRow,
  today: Date,
): string | null {
  if (student.status === 'COMPLETED') {
    return 'Your OJT is complete. Attendance can no longer be logged.';
  }
  if (!student.establishmentId) {
    return 'You are not assigned to an establishment yet. Contact your coordinator.';
  }
  if (student.startDate) {
    const start = toUtcDateOnly(student.startDate);
    if (today.getTime() < start.getTime()) {
      return `Your OJT period starts on ${formatDateOnly(start)}. You cannot log attendance before then.`;
    }
  }
  return null;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

/**
 * Flattens the establishment's supervisor into the contact card's three
 * fields, each `null` when the establishment has no supervisor (the client
 * then shows its "—" empty state).
 */
function withSupervisorContact(establishment: {
  id: string;
  name: string;
  branch: string | null;
  industryType: string | null;
  supervisor: {
    position: string | null;
    user: { name: string; email: string };
  } | null;
}) {
  const { supervisor, ...rest } = establishment;
  return {
    ...rest,
    supervisorName: supervisor?.user.name ?? null,
    supervisorPosition: supervisor?.position ?? null,
    supervisorEmail: supervisor?.user.email ?? null,
  };
}

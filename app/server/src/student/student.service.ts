import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hoursForAttendance, totalHours } from '../common/attendance-hours';
import {
  formatDateOnly,
  manilaToday,
  startOfUtcDay,
  toUtcDateOnly,
} from '../common/dates';
import {
  buildObjectPath,
  deleteFile,
  getSignedUrl,
  uploadFile,
} from '../common/storage';

interface SubmitAttendanceInput {
  date: string;
  timeInAM?: string;
  timeOutAM?: string;
  timeInPM?: string;
  timeOutPM?: string;
  remarks?: string;
}

interface UpdateProfileInput {
  /** `null` = explicitly cleared; `undefined` = not supplied, leave unchanged. */
  contactNumber?: string | null;
  address?: string | null;
}

interface UploadDocumentInput {
  name: string;
}

interface UploadCredentialInput {
  type: string;
}

/** Exported so the client's dropdown offers exactly these — no Prisma enum, no migration. */
export const CREDENTIAL_TYPES = [
  'RESUME',
  'ENDORSEMENT_LETTER',
  'MEDICAL_CERTIFICATE',
  'PARENTAL_CONSENT',
  'INSURANCE',
  'CERTIFICATE_OF_REGISTRATION',
  'OTHER',
] as const;
export type CredentialType = (typeof CREDENTIAL_TYPES)[number];

const PROFILE_INCLUDE = {
  user: { select: { id: true, email: true, name: true } },
  establishment: { select: { id: true, name: true } },
} as const;

/** Shared with `coordinator.service.ts` — the reviewer's cross-establishment list. */
export const DOCUMENT_INCLUDE = {
  student: {
    select: {
      id: true,
      studentIdNumber: true,
      user: { select: { name: true } },
      establishment: { select: { id: true, name: true } },
    },
  },
  reviewedBy: {
    select: { id: true, user: { select: { name: true } } },
  },
} as const;

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
   * Removes a storage object after its row is already gone.
   *
   * Non-fatal by design: an orphaned file wastes a few KB and can be swept up
   * later, while failing the request here would report an error for a delete
   * that actually succeeded.
   */
  private async deleteStoredObject(path: string, label: string) {
    try {
      await deleteFile(path);
    } catch (err) {
      this.logger.error(
        `${label} row was deleted but its storage object "${path}" was not: ` +
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
            industryType: true,
            coordinatorFirstName: true,
            coordinatorLastName: true,
            coordinatorContact: true,
            coordinatorEmail: true,
          },
        },
        attendances: { orderBy: { date: 'desc' } },
        _count: { select: { documents: true, credentials: true } },
      },
    });
    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    const { attendances, ...profile } = student;
    const approved = attendances.filter((a) => a.status === 'APPROVED');

    return {
      ...profile,
      stats: {
        // Only approved attendance counts toward the requirement, which is
        // why this can be lower than the sum of everything submitted.
        completedHours: totalHours(approved),
        pendingHours: totalHours(
          attendances.filter((a) => a.status === 'PENDING'),
        ),
        requiredHours: student.requiredHours,
        remainingHours: Math.max(
          0,
          Math.round((student.requiredHours - totalHours(approved)) * 100) /
            100,
        ),
        totalLogs: attendances.length,
        approvedCount: approved.length,
        pendingCount: attendances.filter((a) => a.status === 'PENDING').length,
        declinedCount: attendances.filter((a) => a.status === 'DECLINED')
          .length,
      },
      recentAttendance: attendances.slice(0, 5).map(withHours),
    };
  }

  async submitAttendance(userId: string, data: SubmitAttendanceInput) {
    const student = await this.getStudentByUserId(userId);

    const date = startOfUtcDay(data.date);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('date is not a valid date');
    }

    // Completion is determined by hours, not the calendar — a student who
    // hasn't met requiredHours by their scheduled endDate keeps logging past
    // it, so endDate is NOT a bound here. Only status COMPLETED closes
    // logging.
    if (student.status === 'COMPLETED') {
      throw new BadRequestException(
        'Your OJT is complete. Attendance can no longer be logged.',
      );
    }

    // No establishment means no supervisor can see the row: the approval queue
    // is scoped to an establishment, so an unassigned student's submissions
    // would sit PENDING forever as unbankable hours. `establishmentId` is
    // nullable and the establishment cascade nulls it (CLAUDE.md §6), so this
    // is a reachable state, not a theoretical one.
    if (!student.establishmentId) {
      throw new BadRequestException(
        'You are not assigned to an establishment yet. Contact your coordinator.',
      );
    }

    // The submitted date must not be before the student's OJT start, and
    // never in the future — compared as calendar dates, never timestamps,
    // against Manila's calendar day rather than the server's (the server may
    // run in UTC, where an early-morning Manila (UTC+8) submission can
    // already be "tomorrow" while the server still reads "today").
    //
    // Two independent checks, not one combined range: startDate and "today"
    // can legitimately be inconsistent with each other (e.g. an OJT period
    // that hasn't started yet has startDate > today), so a single
    // "between X and Y" message can render as an inverted, nonsensical range.
    // Each bound gets its own message instead.
    const today = manilaToday();
    const lowerBound = student.startDate
      ? toUtcDateOnly(student.startDate)
      : null;

    if (lowerBound && date.getTime() < lowerBound.getTime()) {
      throw new BadRequestException(
        `Your OJT period starts on ${formatDateOnly(lowerBound)}. You cannot log attendance before then.`,
      );
    }
    if (date.getTime() > today.getTime()) {
      throw new BadRequestException(
        'Attendance cannot be logged for a future date.',
      );
    }

    const times = {
      timeInAM: parseTime(data.timeInAM),
      timeOutAM: parseTime(data.timeOutAM),
      timeInPM: parseTime(data.timeInPM),
      timeOutPM: parseTime(data.timeOutPM),
    };

    // A log with no complete session is meaningless — it would contribute zero
    // hours and just sit in the supervisor's approval queue.
    const hasAmSession = !!times.timeInAM && !!times.timeOutAM;
    const hasPmSession = !!times.timeInPM && !!times.timeOutPM;
    if (!hasAmSession && !hasPmSession) {
      throw new BadRequestException(
        'Provide a complete AM or PM session (both a time in and a time out)',
      );
    }

    // hoursForAttendance's total-only check would let an inverted session
    // (timeOut before timeIn) through silently scored as 0 as long as the
    // other session is positive — validate each supplied session on its own.
    if (
      hasAmSession &&
      times.timeOutAM!.getTime() <= times.timeInAM!.getTime()
    ) {
      throw new BadRequestException(
        'Morning time out must be later than time in',
      );
    }
    if (
      hasPmSession &&
      times.timeOutPM!.getTime() <= times.timeInPM!.getTime()
    ) {
      throw new BadRequestException(
        'Afternoon time out must be later than time in',
      );
    }

    const existing = await this.prisma.client.attendance.findUnique({
      where: { studentId_date: { studentId: student.id, date } },
    });
    if (existing && existing.status !== 'DECLINED') {
      throw new ConflictException(
        existing.status === 'APPROVED'
          ? 'This date has already been approved and cannot be resubmitted'
          : 'You have already submitted attendance for this date',
      );
    }

    // A DECLINED row is corrected in place rather than blocked — otherwise the
    // student would permanently lose those hours with no way to fix the log.
    const record = existing
      ? await this.prisma.client.attendance.update({
          where: { id: existing.id },
          data: {
            ...times,
            remarks: data.remarks,
            status: 'PENDING',
            declineReason: null,
            approvedById: null,
          },
        })
      : await this.prisma.client.attendance.create({
          data: {
            studentId: student.id,
            date,
            ...times,
            remarks: data.remarks,
            status: 'PENDING',
          },
        });

    return withHours(record);
  }

  async getAttendanceHistory(userId: string) {
    const student = await this.getStudentByUserId(userId);

    const attendances = await this.prisma.client.attendance.findMany({
      where: { studentId: student.id },
      orderBy: { date: 'desc' },
    });

    return attendances.map(withHours);
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

  async uploadDocument(
    userId: string,
    data: UploadDocumentInput,
    file: Express.Multer.File | undefined,
  ) {
    const student = await this.getStudentByUserId(userId);
    assertValidDocumentFile(file);

    const path = buildObjectPath('documents', student.id, file.originalname);
    await uploadFile(path, file.buffer, file.mimetype);

    const created = await this.prisma.client.document.create({
      data: {
        studentId: student.id,
        name: data.name,
        fileUrl: path,
        status: 'PENDING',
      },
    });

    return withSignedUrl(created);
  }

  async getMyDocuments(userId: string) {
    const student = await this.getStudentByUserId(userId);

    const documents = await this.prisma.client.document.findMany({
      where: { studentId: student.id },
      orderBy: { uploadedAt: 'desc' },
    });

    return Promise.all(documents.map(withSignedUrl));
  }

  async deleteDocument(userId: string, documentId: string) {
    const student = await this.getStudentByUserId(userId);

    const document = await this.prisma.client.document.findUnique({
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    if (document.studentId !== student.id) {
      throw new ForbiddenException('This document does not belong to you');
    }
    // Once a coordinator has acted on it, the review record (and any note the
    // student was given) should stay put rather than silently disappear.
    if (document.status !== 'PENDING') {
      throw new ConflictException(
        'Only a document still pending review can be deleted',
      );
    }

    // Row first, then the object — the same order the cascade deletes use
    // (CLAUDE.md §6). Reversed, a storage success followed by a failed row
    // delete leaves a row pointing at nothing, which is the state that used to
    // 500 the whole documents list.
    await this.prisma.client.document.delete({ where: { id: documentId } });
    await this.deleteStoredObject(document.fileUrl, `document ${documentId}`);

    return { id: documentId, deleted: true };
  }

  async uploadCredential(
    userId: string,
    data: UploadCredentialInput,
    file: Express.Multer.File | undefined,
  ) {
    const student = await this.getStudentByUserId(userId);
    assertValidDocumentFile(file);

    const path = buildObjectPath('credentials', student.id, file.originalname);
    await uploadFile(path, file.buffer, file.mimetype);

    const created = await this.prisma.client.credential.create({
      data: {
        studentId: student.id,
        type: data.type,
        fileUrl: path,
      },
    });

    return withSignedUrl(created);
  }

  async getMyCredentials(userId: string) {
    const student = await this.getStudentByUserId(userId);

    const credentials = await this.prisma.client.credential.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(credentials.map(withSignedUrl));
  }

  async deleteCredential(userId: string, credentialId: string) {
    const student = await this.getStudentByUserId(userId);

    const credential = await this.prisma.client.credential.findUnique({
      where: { id: credentialId },
    });
    if (!credential) {
      throw new NotFoundException('Credential not found');
    }
    if (credential.studentId !== student.id) {
      throw new ForbiddenException('This credential does not belong to you');
    }

    // No review state to guard on — a credential is uploaded and listed,
    // that's the whole lifecycle, so the student may delete any of their own.
    // Row first, then the object — see deleteDocument.
    await this.prisma.client.credential.delete({
      where: { id: credentialId },
    });
    await this.deleteStoredObject(
      credential.fileUrl,
      `credential ${credentialId}`,
    );

    return { id: credentialId, deleted: true };
  }
}

/** Replaces the stored object path with a freshly minted signed URL. */
/**
 * Swaps a stored object path for a short-lived signed URL.
 *
 * Never throws. A missing object yields `fileUrl: null` so the row still
 * renders as "unavailable" — these run under `Promise.all` across a whole list
 * (`getMyDocuments`, `getMyCredentials`, the coordinator's `getDocuments`), and
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

/** Adds the derived hours so the client never recomputes them. */
function withHours<T extends Parameters<typeof hoursForAttendance>[0]>(
  record: T,
) {
  return {
    ...record,
    hours: Math.round(hoursForAttendance(record) * 100) / 100,
  };
}

function parseTime(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`"${value}" is not a valid time`);
  }
  return parsed;
}

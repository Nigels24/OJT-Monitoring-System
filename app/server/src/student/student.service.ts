import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hoursForAttendance, totalHours } from '../common/attendance-hours';
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
  contactNumber?: string;
  address?: string;
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
  constructor(private prisma: PrismaService) {}

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

    await deleteFile(document.fileUrl);
    await this.prisma.client.document.delete({ where: { id: documentId } });

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
    await deleteFile(credential.fileUrl);
    await this.prisma.client.credential.delete({ where: { id: credentialId } });

    return { id: credentialId, deleted: true };
  }
}

/** Replaces the stored object path with a freshly minted signed URL. */
export async function withSignedUrl<T extends { fileUrl: string }>(
  document: T,
): Promise<T> {
  return { ...document, fileUrl: await getSignedUrl(document.fileUrl) };
}

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

/**
 * Normalises a submitted date to UTC midnight.
 *
 * The `@@unique([studentId, date])` constraint compares the full timestamp, so
 * without this two submissions for the same calendar day at different clock
 * times would both be accepted and the day would be counted twice.
 */
function startOfUtcDay(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return parsed;
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    ),
  );
}

function parseTime(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`"${value}" is not a valid time`);
  }
  return parsed;
}

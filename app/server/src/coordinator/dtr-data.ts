import {
  HOURS_PUNCH_SELECT,
  PunchLike,
  totalApprovedHours,
} from '../common/attendance-hours';
import type { DtrPdfData } from '../common/dtr-pdf';
import { safeFileName } from '../common/document-types';
import { establishmentLabel } from '../common/establishment-identity';
import { SCHOOL_NAME } from '../common/school';

/**
 * What a DTR is built from — shared by the single-student route
 * (`getStudentDtr`) and the monthly ZIP (`getDtrZip`), so both print exactly
 * the same thing. The queries live in the service; this module only turns
 * their rows into the renderer's input and the file's name.
 */

/** The student columns a DTR prints. Explicit select, nothing else. */
export const DTR_STUDENT_SELECT = {
  firstName: true,
  middleInitial: true,
  lastName: true,
  course: true,
  user: { select: { name: true } },
  establishment: {
    select: {
      name: true,
      branch: true,
      // The establishment's one supervisor; may be none.
      supervisor: { select: { user: { select: { name: true } } } },
    },
  },
} as const;

/**
 * A day as the DTR reads it: only APPROVED punches are selected, so PENDING
 * and DECLINED can never print.
 */
export const DTR_DAY_SELECT = {
  date: true,
  punches: {
    where: { status: 'APPROVED' as const },
    select: HOURS_PUNCH_SELECT,
  },
} as const;

export interface DtrStudent {
  firstName: string | null;
  lastName: string | null;
  course: string | null;
  user: { name: string };
  establishment: {
    name: string;
    branch: string | null;
    supervisor: { user: { name: string } } | null;
  } | null;
}

export interface DtrDayRow {
  date: Date;
  punches: PunchLike[];
}

/**
 * The renderer input for one student and month. Each day is placed by its own
 * `date` (the Manila day it was logged on), never by a punch's UTC timestamp.
 * The total is `totalApprovedHours` over the same days: complete approved
 * sessions only — the hours rule stays in `common/attendance-hours.ts`.
 */
export function buildDtrData(
  student: DtrStudent,
  range: { year: number; month: number },
  days: readonly DtrDayRow[],
): DtrPdfData {
  return {
    studentName: student.user.name,
    schoolName: SCHOOL_NAME,
    course: student.course,
    establishmentName: student.establishment
      ? establishmentLabel(student.establishment)
      : null,
    supervisorName: student.establishment?.supervisor?.user.name ?? null,
    year: range.year,
    month: range.month,
    days: days.map((day) => {
      const time = (kind: string) =>
        day.punches.find((p) => p.kind === kind)?.time ?? null;
      return {
        day: day.date.getUTCDate(),
        amArrival: time('TIME_IN_AM'),
        amDeparture: time('TIME_OUT_AM'),
        pmArrival: time('TIME_IN_PM'),
        pmDeparture: time('TIME_OUT_PM'),
      };
    }),
    totalApprovedHours: totalApprovedHours(days),
  };
}

/**
 * "Dela Cruz, Juan": surname first, as the DTR is filed; the account's full
 * name when either part is missing. Raw: the caller passes the whole file
 * name through `safeFileName` (path separators and control characters out),
 * exactly as the single-student route always did. Accents are kept —
 * attachmentDisposition and the ZIP's UTF-8 entry names carry them.
 */
export function dtrDisplayName(student: DtrStudent): string {
  return student.lastName?.trim() && student.firstName?.trim()
    ? `${student.lastName.trim()}, ${student.firstName.trim()}`
    : student.user.name;
}

/** "Dela Cruz, Juan - DTR 2026-10.pdf" — the single-student download's name. */
export function dtrFileName(student: DtrStudent, month: string): string {
  return safeFileName(`${dtrDisplayName(student)} - DTR ${month}.pdf`);
}

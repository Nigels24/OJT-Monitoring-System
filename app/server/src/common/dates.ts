/**
 * Calendar-date helpers, shared because the write and read paths must agree.
 *
 * Every date-only column (`Attendance.date`, `Student.startDate`) is
 * stored as **UTC midnight of the intended calendar day**, so a date-only
 * comparison is a straight timestamp comparison between two values produced
 * here. Mixing in a raw `new Date()` breaks that: the server may run in UTC
 * while the school is in Asia/Manila (UTC+8), and the UTC day only rolls over
 * at 08:00 Manila.
 *
 * The old `submitAttendance` used to be the only caller that got this right; the
 * coordinator's dashboard and oversight read the *server's* UTC day, so
 * between 00:00 and 07:59 Manila they disagreed with the write path by a day
 * and "Present Today" read 0 while students had already logged.
 */

const MANILA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Normalises a value to UTC midnight of its own UTC calendar date.
 *
 * The `@@unique([studentId, date])` constraint compares the full timestamp, so
 * without this two submissions for the same calendar day at different clock
 * times would both be accepted and the day counted twice. Also used to
 * date-only-compare a stored `startDate`, which may carry a nonzero
 * time component.
 *
 * An unparseable string returns an Invalid Date for the caller to reject.
 */
export function startOfUtcDay(value: string | Date): Date {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return parsed;
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    ),
  );
}

/** Alias kept for readability where the input is already a Date. */
export const toUtcDateOnly = startOfUtcDay;

/**
 * Today's calendar date in Asia/Manila, as a UTC-midnight Date — directly
 * comparable with `startOfUtcDay` results.
 *
 * **Use this, never `startOfUtcDay(new Date())`, for anything meaning "today".**
 */
export function manilaToday(): Date {
  const shifted = new Date(Date.now() + MANILA_UTC_OFFSET_MS);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ),
  );
}

/** Formats a UTC-midnight date-only Date for a message, e.g. "Dec 1, 2026". */
export function formatDateOnly(value: Date): string {
  return value.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** `YYYY-MM` with a real month (01-12). The only month format the API accepts. */
export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * A calendar month as date-only bounds (UTC midnight, the convention above):
 * `start` = the 1st, `end` = the last day (28-31), `next` = the 1st of the
 * following month (the exclusive upper bound for a `date` range query).
 * `null` for anything that isn't a strict `YYYY-MM`.
 */
export function parseMonth(value: string): {
  year: number;
  month: number;
  start: Date;
  end: Date;
  next: Date;
} | null {
  if (!MONTH_PATTERN.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const start = new Date(Date.UTC(year, month - 1, 1));
  const next = new Date(Date.UTC(year, month, 1));
  const end = new Date(next.getTime() - MS_PER_DAY);
  return { year, month, start, end, next };
}

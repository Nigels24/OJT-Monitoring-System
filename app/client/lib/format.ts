/**
 * Renders a **date-only** column (`Attendance.date`, `Student.startDate` /
 * `endDate` / `dateOfBirth`, `Evaluation.trainingStartedAt` / `trainingEndedAt`).
 *
 * Those are stored as UTC midnight of the intended calendar day, so they must
 * be read back in UTC. Plain `new Date(iso).toLocaleDateString()` converts to
 * the viewer's zone first and shifts the day backwards for anyone west of UTC —
 * a Monday log renders as Sunday.
 *
 * **Do not use this for `createdAt`, `updatedAt` or `uploadedAt`.** Those are
 * real instants and are correctly shown in the viewer's own local time.
 */
export function formatDateOnly(
  iso: string | null | undefined,
  fallback = "\u2014",
): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString(undefined, { timeZone: "UTC" });
}

/** The weekday of a date-only column, e.g. "Mon". Same UTC rule as above. */
export function formatWeekdayOnly(
  iso: string | null | undefined,
  fallback = "\u2014",
): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    timeZone: "UTC",
  });
}

/**
 * `1 document`, `2 documents` — a count with its noun, pluralised.
 *
 * Pass `plural` explicitly for anything an `s` doesn't fix.
 */
export function countLabel(
  n: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/*
 * Copy for the three coordinator delete confirmations.
 *
 * These deletes cascade (see the server's `src/common/cascade-delete.ts`), so
 * the dialog has to say exactly what is about to be destroyed and what
 * survives. They live here, taking plain counts rather than API rows, so the
 * wording is checkable in one place and the pages stay thin.
 */

export function deleteStudentMessage(
  name: string,
  counts: {
    attendances: number;
    evaluations: number;
    documents: number;
  },
): string {
  const items = [
    countLabel(counts.attendances, "attendance record"),
    countLabel(counts.evaluations, "evaluation"),
    countLabel(counts.documents, "document"),
  ].join(", ");
  return (
    `Permanently delete ${name}? This also deletes ${items} and their login. ` +
    "This cannot be undone."
  );
}

/** Approved attendance survives a supervisor's deletion — it just loses its approver. */
export function deleteSupervisorMessage(
  name: string,
  counts: { evaluations: number; attendanceApprovals: number },
): string {
  return (
    `Permanently delete ${name}? This also deletes ` +
    `${countLabel(counts.evaluations, "evaluation")} and their login. ` +
    `${countLabel(counts.attendanceApprovals, "approved attendance record")} will be kept ` +
    "but will no longer show who approved them. This cannot be undone."
  );
}

/** Students survive an establishment's deletion — they are unassigned, not removed. */
export function deleteEstablishmentMessage(
  name: string,
  counts: { supervisors: number; students: number },
): string {
  return (
    `Permanently delete ${name}? This also deletes ` +
    `${countLabel(counts.supervisors, "supervisor")} and their ` +
    `${counts.supervisors === 1 ? "login" : "logins"}. ` +
    `${countLabel(counts.students, "student")} will be unassigned but not deleted. ` +
    "This cannot be undone."
  );
}

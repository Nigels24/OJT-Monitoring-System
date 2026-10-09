/**
 * The programmes the school offers, and what each one decides: a student's
 * year level and required OJT hours follow from the course, so no form asks
 * for either. `label` is the value stored in `Student.course`.
 *
 * Display only — the server derives and stores the year level and hours
 * itself. Mirrored from `app/server/src/common/courses.ts`. The two projects
 * share no code, so this is deliberately duplicated rather than imported —
 * keep both tables identical.
 */
export const COURSES = [
  {
    code: "ACT",
    label: "Associate in Computer Technology",
    yearLevel: "2nd Year",
    requiredHours: 320,
  },
  {
    code: "BSIT",
    label: "Bachelor of Science in Information Technology",
    yearLevel: "4th Year",
    requiredHours: 486,
  },
] as const;

export type Course = (typeof COURSES)[number];

export function isOfferedCourse(value: string): boolean {
  return COURSES.some((c) => c.label === value);
}

/** The offered course with this label, or `null` (a legacy value, or none). */
export function findCourse(label: string | null | undefined): Course | null {
  return COURSES.find((c) => c.label === label) ?? null;
}

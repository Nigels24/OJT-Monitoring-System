/**
 * The programmes the school offers, and what each one decides.
 *
 * The course is the only input: a student's year level and required OJT hours
 * follow from it (ACT students go on OJT in 2nd year, BSIT students in 4th),
 * so no form asks for either. `label` is what `Student.course` stores — the
 * same full name it stored before this table existed, so students already on
 * one of these two courses needed no data change.
 *
 * A student saved with any other course, year level or hours keeps them until
 * their course is changed (see `CoordinatorService.updateStudent`).
 *
 * Mirrored on the client at `app/client/lib/courses.ts`. The two projects
 * share no code, so this is deliberately duplicated rather than imported —
 * keep both tables identical.
 */
export const COURSES = [
  {
    code: 'ACT',
    label: 'Associate in Computer Technology',
    yearLevel: '2nd Year',
    requiredHours: 320,
  },
  {
    code: 'BSIT',
    label: 'Bachelor of Science in Information Technology',
    yearLevel: '4th Year',
    requiredHours: 486,
  },
] as const;

/** The values `Student.course` may be set to. */
export const COURSE_LABELS: readonly string[] = COURSES.map((c) => c.label);

export function isOfferedCourse(value: string): boolean {
  return COURSE_LABELS.includes(value);
}

/**
 * The year level and required hours an offered course implies, or `null` for
 * a course that is not offered (a legacy value, or nothing at all).
 */
export function deriveFromCourse(
  course: string | null | undefined,
): { yearLevel: string; requiredHours: number } | null {
  const match = COURSES.find((c) => c.label === course);
  return match
    ? { yearLevel: match.yearLevel, requiredHours: match.requiredHours }
    : null;
}

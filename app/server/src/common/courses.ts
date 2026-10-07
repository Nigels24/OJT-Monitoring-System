/**
 * The programmes the school offers, in the order they are listed. A student's
 * course must be one of these — except that a student saved before this list
 * existed may keep their old value until it is changed (see
 * `CoordinatorService.updateStudent`).
 *
 * Mirrored on the client at `app/client/lib/courses.ts`. The two projects
 * share no code, so this is deliberately duplicated rather than imported —
 * keep both lists identical.
 */
export const COURSES = [
  'Bachelor of Science in Information Technology',
  'Associate in Computer Technology',
  'Bachelor of Arts in English Language Studies',
  'Bachelor of Technical Vocational Teacher Education',
] as const;

export function isOfferedCourse(value: string): boolean {
  return (COURSES as readonly string[]).includes(value);
}

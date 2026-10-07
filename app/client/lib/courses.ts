/**
 * The programmes the school offers, in the order they are listed. The only
 * course list in the client — the coordinator's student form reads it.
 *
 * Mirrored on the server at `app/server/src/common/courses.ts`, which
 * enforces it. The two projects share no code, so this is deliberately
 * duplicated rather than imported — keep both lists identical.
 */
export const COURSES = [
  "Bachelor of Science in Information Technology",
  "Associate in Computer Technology",
  "Bachelor of Arts in English Language Studies",
  "Bachelor of Technical Vocational Teacher Education",
] as const;

export function isOfferedCourse(value: string): boolean {
  return (COURSES as readonly string[]).includes(value);
}

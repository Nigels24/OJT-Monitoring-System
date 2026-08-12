/**
 * Display labels for the evaluation rubric.
 *
 * The weights and score→level bands are enforced server-side in
 * `app/server/src/common/evaluation-scoring.ts` — that file is the source of
 * truth. The weights are repeated here only so the form can show them; the
 * client never computes the stored rating.
 */

export const CRITERIA = [
  "quality",
  "quantity",
  "efficiency",
  "attendance",
  "teamwork",
  "communication",
  "knowledge",
  "problemSolving",
  "initiative",
] as const;

export type Criterion = (typeof CRITERIA)[number];

export const MIN_SCORE = 1;
export const MAX_SCORE = 5;

export const CATEGORIES: ReadonlyArray<{
  key: string;
  label: string;
  weight: number;
  criteria: ReadonlyArray<{ key: Criterion; label: string }>;
}> = [
  {
    key: "workPerformance",
    label: "Work Performance",
    weight: 0.4,
    criteria: [
      { key: "quality", label: "Quality of work" },
      { key: "quantity", label: "Quantity of work" },
      { key: "efficiency", label: "Efficiency" },
    ],
  },
  {
    key: "professionalBehavior",
    label: "Professional Behavior",
    weight: 0.3,
    criteria: [
      { key: "attendance", label: "Attendance & punctuality" },
      { key: "teamwork", label: "Teamwork" },
      { key: "communication", label: "Communication" },
    ],
  },
  {
    key: "technicalSkills",
    label: "Technical Skills",
    weight: 0.3,
    criteria: [
      { key: "knowledge", label: "Job knowledge" },
      { key: "problemSolving", label: "Problem solving" },
      { key: "initiative", label: "Initiative" },
    ],
  },
];

/** The 1–5 scale, described. Rendered as a dropdown, not stars. */
export const SCORE_OPTIONS = [
  { value: "5", label: "5 — Excellent", hint: "Exceeds expectations" },
  { value: "4", label: "4 — Very Good", hint: "Meets and sometimes exceeds" },
  { value: "3", label: "3 — Good", hint: "Consistently meets expectations" },
  { value: "2", label: "2 — Fair", hint: "Partially meets, needs improvement" },
  { value: "1", label: "1 — Poor", hint: "Does not meet expectations" },
];

export const PERFORMANCE_LEVELS = [
  { level: "Excellent", range: "4.5 – 5.0" },
  { level: "Very Good", range: "3.5 – 4.4" },
  { level: "Good", range: "2.5 – 3.4" },
  { level: "Fair", range: "1.5 – 2.4" },
  { level: "Poor", range: "below 1.5" },
];

/** Mirrors the server's bands, for previewing a rating before submit. */
export function previewLevel(rating: number): string {
  if (rating >= 4.5) return "Excellent";
  if (rating >= 3.5) return "Very Good";
  if (rating >= 2.5) return "Good";
  if (rating >= 1.5) return "Fair";
  return "Poor";
}

export function levelBadgeVariant(
  level: string,
): "excellent" | "veryGood" | "good" | "pending" | "declined" | "neutral" {
  switch (level) {
    case "Excellent":
      return "excellent";
    case "Very Good":
      return "veryGood";
    case "Good":
      return "good";
    case "Fair":
      return "pending";
    case "Poor":
      return "declined";
    default:
      return "neutral";
  }
}

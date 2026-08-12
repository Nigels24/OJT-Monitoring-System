/**
 * The evaluation rubric, mirroring the prototype's `calculateOverallRating`.
 *
 * Nine criteria scored 1–5, grouped into three weighted categories. The client
 * asked to drop the *star* rendering, not the scale — the numbers, weights and
 * bands below are exactly what the prototype computes.
 *
 * This lives in `common/` because the supervisor writes evaluations and the
 * coordinator reads them; both must agree on how a score becomes a label.
 */

export const CRITERIA = [
  'quality',
  'quantity',
  'efficiency',
  'attendance',
  'teamwork',
  'communication',
  'knowledge',
  'problemSolving',
  'initiative',
] as const;

export type Criterion = (typeof CRITERIA)[number];
export type CriteriaScores = Record<Criterion, number>;

export const MIN_SCORE = 1;
export const MAX_SCORE = 5;

/** Category → its criteria and its share of the overall rating. */
export const CATEGORIES = [
  {
    key: 'workPerformance',
    label: 'Work Performance',
    weight: 0.4,
    criteria: ['quality', 'quantity', 'efficiency'],
  },
  {
    key: 'professionalBehavior',
    label: 'Professional Behavior',
    weight: 0.3,
    criteria: ['attendance', 'teamwork', 'communication'],
  },
  {
    key: 'technicalSkills',
    label: 'Technical Skills',
    weight: 0.3,
    criteria: ['knowledge', 'problemSolving', 'initiative'],
  },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  weight: number;
  criteria: ReadonlyArray<Criterion>;
}>;

export type PerformanceLevel =
  | 'Excellent'
  | 'Very Good'
  | 'Good'
  | 'Fair'
  | 'Poor';

/**
 * Prototype bands. Ordered high→low and evaluated top-down, so the first
 * threshold an average clears wins.
 */
const BANDS: ReadonlyArray<{ min: number; level: PerformanceLevel }> = [
  { min: 4.5, level: 'Excellent' },
  { min: 3.5, level: 'Very Good' },
  { min: 2.5, level: 'Good' },
  { min: 1.5, level: 'Fair' },
  { min: -Infinity, level: 'Poor' },
];

/** Unweighted average of one category's criteria. */
export function categoryAverage(
  scores: CriteriaScores,
  criteria: ReadonlyArray<Criterion>,
): number {
  const sum = criteria.reduce((acc, key) => acc + scores[key], 0);
  return sum / criteria.length;
}

/**
 * Weighted overall rating, rounded to one decimal.
 *
 * Always computed server-side from the criteria — never taken from the request,
 * or a client could submit any nine scores alongside an unrelated overall.
 */
export function overallRating(scores: CriteriaScores): number {
  const weighted = CATEGORIES.reduce(
    (acc, category) =>
      acc + categoryAverage(scores, category.criteria) * category.weight,
    0,
  );
  return Math.round(weighted * 10) / 10;
}

export function performanceLevel(rating: number): PerformanceLevel {
  return BANDS.find((band) => rating >= band.min)!.level;
}

/** Per-category breakdown, for showing where a rating came from. */
export function categoryBreakdown(scores: CriteriaScores) {
  return CATEGORIES.map((category) => ({
    key: category.key,
    label: category.label,
    weight: category.weight,
    average: Math.round(categoryAverage(scores, category.criteria) * 10) / 10,
  }));
}

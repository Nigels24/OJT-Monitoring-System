/**
 * The school's official ON-THE-JOB TRAINING PERFORMANCE EVALUATION SHEET.
 *
 * Nineteen items, each scored 1-5, in four sections. The form shows a total per
 * section and a TOTAL RATING out of 95, and that raw total is used exactly as
 * printed — there is deliberately no percentage, no letter grade and no
 * performance band. The previous rubric's weights and its
 * Excellent/Very Good/Good/Fair/Poor labels were retired with it.
 *
 * This lives in `common/` because the supervisor writes evaluations and the
 * coordinator reads them; both must agree on how the items add up.
 */

export const MIN_SCORE = 1;
export const MAX_SCORE = 5;

/** The scale as the form prints it, highest first. */
export const SCORE_LABELS: Readonly<Record<number, string>> = {
  5: 'OUTSTANDING',
  4: 'VERY GOOD',
  3: 'GOOD',
  2: 'FAIR',
  1: 'NEEDS IMPROVEMENT',
};

/**
 * The form verbatim: four sections, each item keyed by the column it is stored
 * in and carrying the letter it is printed under.
 *
 * Section order and item order match the paper form, so the UI can render
 * straight from this without a second copy of the wording.
 */
export const SECTIONS = [
  {
    key: 'workAttitudesAndHabits',
    numeral: 'I',
    label: 'WORK ATTITUDES AND HABITS',
    maxPoints: 25,
    items: [
      {
        key: 'courtesy',
        letter: 'A',
        label: 'Courtesy in dealing with superiors and peers',
      },
      {
        key: 'patienceAndDiligence',
        letter: 'B',
        label: 'Patience and diligence in performing assigned tasks',
      },
      {
        key: 'punctualityAndAttendance',
        letter: 'C',
        label: 'Punctuality and regularity in attendance',
      },
      {
        key: 'neatnessOfReports',
        letter: 'D',
        label: 'Neatness of the reports submitted on the scheduled time',
      },
      {
        key: 'punctualityOfReports',
        letter: 'E',
        label: 'Punctuality in submitting reports on the assigned tasks',
      },
    ],
  },
  {
    key: 'workKnowledge',
    numeral: 'II',
    label: 'WORK KNOWLEDGE',
    maxPoints: 20,
    items: [
      { key: 'technicalKnowledge', letter: 'A', label: 'Technical knowledge' },
      {
        key: 'relatesTheoryToPractice',
        letter: 'B',
        label: 'Ability to relate the theories to actual experience',
      },
      {
        key: 'openToCriticism',
        letter: 'C',
        label: 'Open to constructive criticism',
      },
      {
        key: 'discretion',
        letter: 'D',
        label: 'Discreet, capable of observing prudent silence',
      },
    ],
  },
  {
    key: 'personalityAndAppearance',
    numeral: 'III',
    label: 'PERSONALITY AND PERSONAL APPEARANCE',
    maxPoints: 25,
    items: [
      {
        key: 'neatAndWellGroomed',
        letter: 'A',
        label: 'Always neat and well-groomed',
      },
      {
        key: 'properAttire',
        letter: 'B',
        label: 'Wears proper and decent attire',
      },
      {
        key: 'poiseAndSelfConfidence',
        letter: 'C',
        label: 'Shows poise and self-confidence',
      },
      {
        key: 'emotionalMaturity',
        letter: 'D',
        label: 'Shows emotional maturity',
      },
      {
        key: 'dealsWellWithCoworkers',
        letter: 'E',
        label: 'Can easily deal with co-workers',
      },
    ],
  },
  {
    key: 'professionalCompetence',
    numeral: 'IV',
    label: 'PROFESSIONAL COMPETENCE',
    maxPoints: 25,
    items: [
      {
        key: 'performanceOfWork',
        letter: 'A',
        label: 'Performance of work (as a whole)',
      },
      {
        key: 'understandsInstructions',
        letter: 'B',
        label: 'Easily understands instructions',
      },
      {
        key: 'sharesSuggestions',
        letter: 'C',
        label: 'Shares sounds suggestions to the problems',
      },
      {
        key: 'ethicalStandards',
        letter: 'D',
        label: 'Can cope up with the prescribed ethical standards',
      },
      {
        key: 'speaksAudibly',
        letter: 'E',
        label: 'Speaks audibility in a well-modulated voice',
      },
    ],
  },
] as const;

export type EvaluationItem = (typeof SECTIONS)[number]['items'][number]['key'];

/** One printed row of the sheet. */
export type SheetItem = { key: EvaluationItem; letter: string; label: string };

/**
 * The per-section `items` arrays are readonly tuples of four different shapes;
 * mapping over that union directly widens to `any`, so every walk over a
 * section's items goes through this.
 */
function itemsOf(section: (typeof SECTIONS)[number]): readonly SheetItem[] {
  return section.items;
}

/**
 * Every item key, in form order — the 19 columns on `Evaluation`.
 *
 * The per-section `items` arrays are readonly tuples of four different shapes,
 * and mapping straight over that union widens to `any`; flattening through an
 * explicit `SheetItem[]` keeps the key union intact.
 */
const ALL_ITEMS: readonly SheetItem[] = SECTIONS.flatMap(itemsOf);

export const EVALUATION_ITEMS: ReadonlyArray<EvaluationItem> = ALL_ITEMS.map(
  (item) => item.key,
);
export type ItemScores = Record<EvaluationItem, number>;

/** 19 items x 5 points. The TOTAL RATING the form prints out of. */
export const MAX_TOTAL_RATING = EVALUATION_ITEMS.length * MAX_SCORE;
/** All nineteen items at the floor of the scale. */
export const MIN_TOTAL_RATING = EVALUATION_ITEMS.length * MIN_SCORE;

/**
 * Narrows an arbitrary object to the nineteen item scores.
 *
 * Throws if any item is missing or outside 1-5, so a bad body can never reach
 * a stored `totalRating`. The controller's DTO validates the same bound first;
 * this is the backstop for any other caller.
 */
export function pickItemScores(source: Record<string, unknown>): ItemScores {
  const scores = {} as ItemScores;
  for (const key of EVALUATION_ITEMS) {
    const value = Number(source[key]);
    if (!Number.isInteger(value) || value < MIN_SCORE || value > MAX_SCORE) {
      throw new Error(
        `Evaluation item "${key}" must be an integer from ${MIN_SCORE} to ${MAX_SCORE}, received ${String(source[key])}`,
      );
    }
    scores[key] = value;
  }
  return scores;
}

/** One section's total, the raw sum of its items. */
export function sectionTotal(
  scores: ItemScores,
  items: ReadonlyArray<{ key: EvaluationItem }>,
): number {
  return items.reduce((sum, item) => sum + scores[item.key], 0);
}

/**
 * The TOTAL RATING: the raw sum of all nineteen items, 19-95.
 *
 * Always computed from the items, never read from the request — otherwise a
 * caller could submit nineteen low scores alongside a 95.
 */
export function totalRating(scores: ItemScores): number {
  return EVALUATION_ITEMS.reduce((sum, key) => sum + scores[key], 0);
}

/**
 * Per-section totals plus the overall total, for rendering the sheet the way it
 * is printed.
 *
 * Each section carries its items with their printed letter, wording and score,
 * so a reader (the coordinator's view dialog) can render the whole sheet from
 * one response without its own copy of the form text.
 */
export function scoreBreakdown(scores: ItemScores) {
  return {
    sections: SECTIONS.map((section) => ({
      key: section.key,
      numeral: section.numeral,
      label: section.label,
      maxPoints: section.maxPoints,
      total: sectionTotal(scores, section.items),
      items: itemsOf(section).map((item) => ({
        key: item.key,
        letter: item.letter,
        label: item.label,
        score: scores[item.key],
      })),
    })),
    totalRating: totalRating(scores),
    maxTotalRating: MAX_TOTAL_RATING,
  };
}

/**
 * The blank sheet, served to the client so the form renders from this module
 * rather than from a second copy of the form's wording that would drift.
 */
export function sheetDefinition() {
  return {
    sections: SECTIONS.map((section) => ({
      key: section.key,
      numeral: section.numeral,
      label: section.label,
      maxPoints: section.maxPoints,
      items: itemsOf(section).map((item) => ({
        key: item.key,
        letter: item.letter,
        label: item.label,
      })),
    })),
    /** Highest first, the order the legend is printed in. */
    scale: [5, 4, 3, 2, 1].map((value) => ({
      value,
      label: SCORE_LABELS[value],
    })),
    minScore: MIN_SCORE,
    maxScore: MAX_SCORE,
    maxTotalRating: MAX_TOTAL_RATING,
  };
}

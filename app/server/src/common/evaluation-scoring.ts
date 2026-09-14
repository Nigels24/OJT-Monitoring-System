/**
 * How the school's evaluation sheet adds up — and nothing about what is on it.
 *
 * The sheet itself is **data**, not code: it lives in `EvaluationTemplate` /
 * `EvaluationTemplateSection` / `EvaluationTemplateItem`, versioned and owned
 * by the coordinator, and an evaluation is rendered against the template
 * version it was signed on. This module keeps only what every version shares:
 * the 1-5 scale, how numerals, letters and maximums are derived from order and
 * item count, and how a set of scores becomes a printed breakdown.
 *
 * `DEFAULT_SHEET` at the foot is the *seed content* for template version 1 —
 * the wording the nineteen hardcoded columns were printed under, kept so the
 * migration and any future bootstrap agree on it. **Nothing reads the live
 * sheet from this file.**
 *
 * It lives in `common/` because the supervisor writes evaluations and the
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

/* ---------------------------------------------------------------------------
 * The shape a template takes once it is read out of the database.
 *
 * Structural, not Prisma types: callers pass a `select`ed row with its
 * sections and items already ordered, and extra columns on it are fine.
 * ------------------------------------------------------------------------ */

export interface SheetTemplateItem {
  key: string;
  label: string;
}

export interface SheetTemplateSection {
  key: string;
  label: string;
  /** In printed order — the caller orders by `order`, not this module. */
  items: readonly SheetTemplateItem[];
}

export interface SheetTemplate {
  id: string;
  version: number;
  title: string;
  sections: readonly SheetTemplateSection[];
}

/** Item key -> score, for one evaluation. */
export type ScoreMap = ReadonlyMap<string, number>;

/* ---------------------------------------------------------------------------
 * Derived, never stored.
 * ------------------------------------------------------------------------ */

const NUMERALS: ReadonlyArray<[number, string]> = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/**
 * The section's printed numeral, from its position: 1 -> I, 4 -> IV, 12 -> XII.
 *
 * Derived at read time rather than stored, so reordering the sheet can never
 * leave a section numbered as something it is not.
 */
export function numeralFor(position: number): string {
  let remaining = position;
  let out = '';
  for (const [value, symbol] of NUMERALS) {
    while (remaining >= value) {
      out += symbol;
      remaining -= value;
    }
  }
  return out;
}

/** The item's printed letter, from its position within its section: 1 -> A. */
export function letterFor(position: number): string {
  const alphabet = 26;
  let remaining = position;
  let out = '';
  while (remaining > 0) {
    const index = (remaining - 1) % alphabet;
    out = String.fromCharCode(65 + index) + out;
    remaining = Math.floor((remaining - 1) / alphabet);
  }
  return out;
}

/** A section is worth its item count x the top of the scale. */
export function sectionMaxPoints(itemCount: number): number {
  return itemCount * MAX_SCORE;
}

/**
 * The TOTAL RATING a sheet is printed out of: every item at the top of the
 * scale. Stored on each evaluation when it is written, because a later version
 * with more or fewer items must not change what an old sheet was scored out of.
 */
export function templateMaxTotalRating(template: SheetTemplate): number {
  return template.sections.reduce(
    (sum, section) => sum + sectionMaxPoints(section.items.length),
    0,
  );
}

/** Every item key on a template, in printed order. */
export function templateItemKeys(template: SheetTemplate): string[] {
  return template.sections.flatMap((section) =>
    section.items.map((item) => item.key),
  );
}

/**
 * The TOTAL RATING: the raw sum of the scored items.
 *
 * Always computed from the items, never read from the request — otherwise a
 * caller could submit nineteen low scores alongside a 95.
 */
export function totalRating(scores: ScoreMap): number {
  let sum = 0;
  for (const score of scores.values()) sum += score;
  return sum;
}

/**
 * The sheet's sections with their printed numerals, letters, maximums, per
 * section totals and each item's score.
 *
 * A key with no score reads 0 rather than throwing: this is the read path, and
 * the authoritative number is the `totalRating` stored on the row, not this
 * recomputation. Writes go through the service's own validation, which
 * requires every item of the template.
 */
export function buildSections(template: SheetTemplate, scores: ScoreMap) {
  return template.sections.map((section, sectionIndex) => {
    const items = section.items.map((item, itemIndex) => ({
      key: item.key,
      letter: letterFor(itemIndex + 1),
      label: item.label,
      score: scores.get(item.key) ?? 0,
    }));
    return {
      key: section.key,
      numeral: numeralFor(sectionIndex + 1),
      label: section.label,
      maxPoints: sectionMaxPoints(section.items.length),
      total: items.reduce((sum, item) => sum + item.score, 0),
      items,
    };
  });
}

/**
 * Per-section totals plus the overall total, for rendering the sheet the way it
 * is printed.
 *
 * Each section carries its items with their printed letter, wording and score,
 * so a reader (the coordinator's view dialog) can render the whole sheet from
 * one response without its own copy of the form text.
 */
export function scoreBreakdown(template: SheetTemplate, scores: ScoreMap) {
  return {
    sections: buildSections(template, scores),
    totalRating: totalRating(scores),
    maxTotalRating: templateMaxTotalRating(template),
  };
}

/**
 * The blank sheet, served to the client so the form renders from the published
 * template rather than from a second copy of the wording that would drift.
 */
export function sheetDefinition(template: SheetTemplate) {
  return {
    templateId: template.id,
    version: template.version,
    title: template.title,
    sections: template.sections.map((section, sectionIndex) => ({
      key: section.key,
      numeral: numeralFor(sectionIndex + 1),
      label: section.label,
      maxPoints: sectionMaxPoints(section.items.length),
      items: section.items.map((item, itemIndex) => ({
        key: item.key,
        letter: letterFor(itemIndex + 1),
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
    maxTotalRating: templateMaxTotalRating(template),
  };
}

/* ---------------------------------------------------------------------------
 * Seed content for template version 1 — NOT the live sheet.
 *
 * The school's ON-THE-JOB TRAINING PERFORMANCE EVALUATION SHEET as it was
 * hardcoded before the template tables existed: nineteen items in four
 * sections, each scored 1-5, printed out of 95. The item keys are the nineteen
 * column names they used to be stored in, which is what let migration
 * 20260914142544_evaluation_sheet_template copy every existing score across
 * without a lookup table.
 *
 * Read by nothing at runtime. Change the sheet through the coordinator's draft,
 * not here.
 * ------------------------------------------------------------------------ */

export const DEFAULT_SHEET = {
  title: 'ON-THE-JOB TRAINING PERFORMANCE EVALUATION SHEET',
  sections: [
    {
      key: 'workAttitudesAndHabits',
      label: 'WORK ATTITUDES AND HABITS',
      items: [
        {
          key: 'courtesy',
          label: 'Courtesy in dealing with superiors and peers',
        },
        {
          key: 'patienceAndDiligence',
          label: 'Patience and diligence in performing assigned tasks',
        },
        {
          key: 'punctualityAndAttendance',
          label: 'Punctuality and regularity in attendance',
        },
        {
          key: 'neatnessOfReports',
          label: 'Neatness of the reports submitted on the scheduled time',
        },
        {
          key: 'punctualityOfReports',
          label: 'Punctuality in submitting reports on the assigned tasks',
        },
      ],
    },
    {
      key: 'workKnowledge',
      label: 'WORK KNOWLEDGE',
      items: [
        { key: 'technicalKnowledge', label: 'Technical knowledge' },
        {
          key: 'relatesTheoryToPractice',
          label: 'Ability to relate the theories to actual experience',
        },
        { key: 'openToCriticism', label: 'Open to constructive criticism' },
        {
          key: 'discretion',
          label: 'Discreet, capable of observing prudent silence',
        },
      ],
    },
    {
      key: 'personalityAndAppearance',
      label: 'PERSONALITY AND PERSONAL APPEARANCE',
      items: [
        { key: 'neatAndWellGroomed', label: 'Always neat and well-groomed' },
        { key: 'properAttire', label: 'Wears proper and decent attire' },
        {
          key: 'poiseAndSelfConfidence',
          label: 'Shows poise and self-confidence',
        },
        { key: 'emotionalMaturity', label: 'Shows emotional maturity' },
        {
          key: 'dealsWellWithCoworkers',
          label: 'Can easily deal with co-workers',
        },
      ],
    },
    {
      key: 'professionalCompetence',
      label: 'PROFESSIONAL COMPETENCE',
      items: [
        { key: 'performanceOfWork', label: 'Performance of work (as a whole)' },
        {
          key: 'understandsInstructions',
          label: 'Easily understands instructions',
        },
        {
          key: 'sharesSuggestions',
          label: 'Shares sounds suggestions to the problems',
        },
        {
          key: 'ethicalStandards',
          label: 'Can cope up with the prescribed ethical standards',
        },
        {
          key: 'speaksAudibly',
          label: 'Speaks audibility in a well-modulated voice',
        },
      ],
    },
  ],
} as const;

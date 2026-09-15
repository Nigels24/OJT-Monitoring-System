import type {
  SaveDraftRequest,
  TemplateSheet,
} from "@/lib/api/evaluationTemplateApi";

/**
 * The editor's own model of a sheet, and the two things it has to do locally:
 * derive what the server would derive, and refuse what the server would refuse.
 *
 * **This is not a second copy of the form's text.** The wording always comes
 * from the server; what lives here is the *derivation* — numerals from section
 * order, letters from item order, a section's points from its item count — so
 * the preview can renumber as the user drags rows about, before anything is
 * saved. The server derives the same way from `order`, and the client never
 * sends a numeral, letter or maxPoints back.
 */

/* ---------------------------------------------------------------------------
 * Editor model
 * ------------------------------------------------------------------------ */

export interface EditorItem {
  /** Stable React key. `k:<serverKey>` for saved rows, generated for new ones. */
  uid: string;
  /** Absent until the server mints one — that is what marks a row as new. */
  key?: string;
  label: string;
}

export interface EditorSection {
  uid: string;
  key?: string;
  label: string;
  items: EditorItem[];
}

export interface EditorSheet {
  title: string;
  sections: EditorSection[];
}

/** The server's limits, mirrored so the user is never surprised by a 400. */
export const LIMITS = {
  titleMin: 3,
  titleMax: 200,
  sectionsMin: 1,
  sectionsMax: 12,
  sectionLabelMin: 3,
  sectionLabelMax: 120,
  itemsMin: 1,
  itemsMax: 20,
  itemLabelMin: 3,
  itemLabelMax: 200,
} as const;

let generatedUids = 0;

/**
 * A key for a row the server has not seen yet.
 *
 * Only ever called from an event handler (adding a section or item), never
 * during render: a counter that advanced on render would hand the same row a
 * new React key every pass and blow away the input's focus.
 */
export function newUid(): string {
  generatedUids += 1;
  return `new:${generatedUids}`;
}

/** Seeds the editor from a served sheet — the draft, or the published one. */
export function fromSheet(sheet: TemplateSheet): EditorSheet {
  return {
    title: sheet.title,
    sections: sheet.sections.map((section) => ({
      // Derived from the server key rather than a counter, so seeding during
      // render stays pure.
      uid: `k:${section.key}`,
      key: section.key,
      label: section.label,
      items: section.items.map((item) => ({
        uid: `k:${item.key}`,
        key: item.key,
        label: item.label,
      })),
    })),
  };
}

/**
 * The PUT body. Labels are trimmed; a row with no `key` is new and the server
 * mints one. Numerals, letters and maximums are never sent — they are derived.
 */
export function toPayload(sheet: EditorSheet): SaveDraftRequest {
  return {
    title: sheet.title.trim(),
    sections: sheet.sections.map((section) => ({
      ...(section.key ? { key: section.key } : {}),
      label: section.label.trim(),
      items: section.items.map((item) => ({
        ...(item.key ? { key: item.key } : {}),
        label: item.label.trim(),
      })),
    })),
  };
}

/** What "unsaved changes" compares — the payload, so uids never count as edits. */
export function serialize(sheet: EditorSheet): string {
  return JSON.stringify(toPayload(sheet));
}

/* ---------------------------------------------------------------------------
 * Derivation — the same rules the server applies on read
 * ------------------------------------------------------------------------ */

const NUMERALS: ReadonlyArray<[number, string]> = [
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** 1 → I, 4 → IV, 12 → XII. */
export function numeralFor(position: number): string {
  let remaining = position;
  let out = "";
  for (const [value, symbol] of NUMERALS) {
    while (remaining >= value) {
      out += symbol;
      remaining -= value;
    }
  }
  return out;
}

/** 1 → A, 26 → Z, 27 → AA. */
export function letterFor(position: number): string {
  const alphabet = 26;
  let remaining = position;
  let out = "";
  while (remaining > 0) {
    const index = (remaining - 1) % alphabet;
    out = String.fromCharCode(65 + index) + out;
    remaining = Math.floor((remaining - 1) / alphabet);
  }
  return out;
}

export interface PreviewItem extends EditorItem {
  letter: string;
  /** Why this row would be rejected, or "" when it is fine. */
  error: string;
}

export interface PreviewSection extends Omit<EditorSection, "items"> {
  numeral: string;
  maxPoints: number;
  items: PreviewItem[];
  error: string;
}

export interface SheetPreview {
  sections: PreviewSection[];
  /** Every item at the top of the scale — what the new sheet is scored out of. */
  maxTotalRating: number;
  itemCount: number;
  titleError: string;
  /** Everything wrong with the sheet, in the words the user needs. */
  problems: string[];
  isValid: boolean;
}

/**
 * The live preview *and* the validation, in one pass.
 *
 * They are the same walk over the sheet, and splitting them would mean two
 * places that decide what a section is worth.
 */
export function buildPreview(
  sheet: EditorSheet,
  maxScore: number,
): SheetPreview {
  const problems: string[] = [];

  const title = sheet.title.trim();
  let titleError = "";
  if (title.length < LIMITS.titleMin || title.length > LIMITS.titleMax) {
    titleError = `The title must be ${LIMITS.titleMin}–${LIMITS.titleMax} characters.`;
    problems.push(titleError);
  }

  if (sheet.sections.length < LIMITS.sectionsMin) {
    problems.push("The sheet needs at least one section.");
  }
  if (sheet.sections.length > LIMITS.sectionsMax) {
    problems.push(
      `A sheet may have at most ${LIMITS.sectionsMax} sections; this one has ${sheet.sections.length}.`,
    );
  }

  const seenSectionLabels = new Map<string, number>();
  for (const section of sheet.sections) {
    const label = section.label.trim().toLowerCase();
    seenSectionLabels.set(label, (seenSectionLabels.get(label) ?? 0) + 1);
  }

  const sections = sheet.sections.map((section, sectionIndex) => {
    const label = section.label.trim();
    let error = "";
    if (
      label.length < LIMITS.sectionLabelMin ||
      label.length > LIMITS.sectionLabelMax
    ) {
      error = `Section names must be ${LIMITS.sectionLabelMin}–${LIMITS.sectionLabelMax} characters.`;
    } else if ((seenSectionLabels.get(label.toLowerCase()) ?? 0) > 1) {
      error = "Another section already has this name.";
    } else if (section.items.length < LIMITS.itemsMin) {
      error = "A section needs at least one item.";
    } else if (section.items.length > LIMITS.itemsMax) {
      error = `A section may have at most ${LIMITS.itemsMax} items; this one has ${section.items.length}.`;
    }
    if (error) {
      problems.push(`${numeralFor(sectionIndex + 1)}. ${label || "Untitled"} — ${error}`);
    }

    const seenItemLabels = new Map<string, number>();
    for (const item of section.items) {
      const itemKey = item.label.trim().toLowerCase();
      seenItemLabels.set(itemKey, (seenItemLabels.get(itemKey) ?? 0) + 1);
    }

    const items = section.items.map((item, itemIndex) => {
      const itemLabel = item.label.trim();
      let itemError = "";
      if (
        itemLabel.length < LIMITS.itemLabelMin ||
        itemLabel.length > LIMITS.itemLabelMax
      ) {
        itemError = `Items must be ${LIMITS.itemLabelMin}–${LIMITS.itemLabelMax} characters.`;
      } else if ((seenItemLabels.get(itemLabel.toLowerCase()) ?? 0) > 1) {
        itemError = "This section already lists this item.";
      }
      if (itemError) {
        problems.push(
          `${numeralFor(sectionIndex + 1)}.${letterFor(itemIndex + 1)} ${itemLabel || "Untitled"} — ${itemError}`,
        );
      }
      return { ...item, letter: letterFor(itemIndex + 1), error: itemError };
    });

    return {
      ...section,
      numeral: numeralFor(sectionIndex + 1),
      maxPoints: section.items.length * maxScore,
      items,
      error,
    };
  });

  const itemCount = sections.reduce((sum, s) => sum + s.items.length, 0);

  return {
    sections,
    maxTotalRating: itemCount * maxScore,
    itemCount,
    titleError,
    problems,
    isValid: problems.length === 0,
  };
}

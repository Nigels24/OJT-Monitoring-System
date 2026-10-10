/**
 * How establishments are told apart, and how one is printed.
 *
 * An establishment is identified by its name plus an optional branch: two
 * establishments may not share both. The comparison runs on two stored key
 * columns (`Establishment.nameKey`, `branchKey`) under a unique index, so the
 * database enforces it, not just this service. Only the keys are normalised;
 * `name` and `branch` are stored as typed (trimmed).
 *
 * The client keeps its own copy of `establishmentLabel` (lib/establishment.ts),
 * deliberately duplicated like SCHOOL_NAME — the two projects share no code.
 */

/**
 * Collapse every whitespace run to one space, trim, lower-case — in that
 * order, the same as the migration's backfill:
 * `lower(btrim(regexp_replace(x, '\s+', ' ', 'g')))`.
 *
 * Equivalent for ASCII letters and ASCII whitespace. Two edges differ from
 * Postgres (CLAUDE.md §8 item 32): JS `\s` also matches Unicode spaces (NBSP,
 * U+3000, BOM …) where Postgres' `\s` follows the database locale, and JS
 * `toLowerCase` is locale-free Unicode where Postgres `lower()` follows the
 * database's LC_CTYPE (identical for accented Latin letters like É, Ñ in a
 * UTF-8 locale). Neither side normalises Unicode composition, so "José"
 * typed with a combining accent is a different key from the composed one.
 */
export function normalizeKey(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** The two stored keys. `branchKey` is '' for no branch, never null. */
export function establishmentKeys(
  name: string,
  branch: string | null | undefined,
): { nameKey: string; branchKey: string } {
  return {
    nameKey: normalizeKey(name),
    branchKey: branch ? normalizeKey(branch) : '',
  };
}

/** "Name (Branch)", or just "Name" — how an establishment is printed. */
export function establishmentLabel(establishment: {
  name: string;
  branch?: string | null;
}): string {
  return establishment.branch
    ? `${establishment.name} (${establishment.branch})`
    : establishment.name;
}

/** The 409 for a name (+ branch) already taken. */
export function duplicateEstablishmentMessage(
  name: string,
  branch: string | null | undefined,
): string {
  return branch
    ? `An establishment named "${name}" with branch "${branch}" already exists.`
    : `An establishment named "${name}" already exists. Add a branch to tell them apart.`;
}

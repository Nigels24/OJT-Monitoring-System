/**
 * How an establishment is printed: "Name (Branch)", or just "Name".
 *
 * Mirrors `establishmentLabel` in the server's
 * `src/common/establishment-identity.ts` — deliberately duplicated, like
 * SCHOOL_NAME, since the two projects share no code. Use it everywhere an
 * establishment's name is shown, so two branches of one name never look
 * like the same place. (The server already applies it to the flattened
 * strings it sends: `establishmentName`, `trainingEmployedAt`, …)
 */
export function establishmentLabel(establishment: {
  name: string;
  branch?: string | null;
}): string {
  return establishment.branch
    ? `${establishment.name} (${establishment.branch})`
    : establishment.name;
}

/** As `establishmentLabel`, for an optional relation: `undefined` when absent. */
export function optionalEstablishmentLabel(
  establishment: { name: string; branch?: string | null } | null | undefined,
): string | undefined {
  return establishment ? establishmentLabel(establishment) : undefined;
}

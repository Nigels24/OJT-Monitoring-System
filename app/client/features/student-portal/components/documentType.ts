import type { DocumentType } from "@/lib/api/studentPortalApi";

/**
 * Shared between the upload dropdown, the checklist and the table's type
 * column. Same order as the enum. The server keeps its own copy in
 * `src/common/document-types.ts` — the two projects share no code.
 */
export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  APPLICATION_LETTER: "Application Letter",
  ENDORSEMENT_LETTER: "Endorsement Letter",
  RESUME: "Resume",
  MOA: "MOA",
  PARENTS_CONSENT: "Parents Consent",
  WAIVER: "Waiver",
};

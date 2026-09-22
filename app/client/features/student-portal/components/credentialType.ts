import type { CredentialType } from "@/lib/api/studentPortalApi";

/** Shared between the upload dropdown and the table's type column. */
export const CREDENTIAL_TYPE_LABEL: Record<CredentialType, string> = {
  APPLICATION_LETTER: "Application Letter",
  ENDORSEMENT_LETTER: "Endorsement Letter",
  RESUME: "Resume",
  MOA: "MOA",
  PARENTS_CONSENT: "Parents Consent",
  WAIVER: "Waiver",
};

import type { CredentialType } from "@/lib/api/studentPortalApi";

/** Shared between the upload dropdown and the table's type column. */
export const CREDENTIAL_TYPE_LABEL: Record<CredentialType, string> = {
  RESUME: "Resume",
  ENDORSEMENT_LETTER: "Endorsement Letter",
  MEDICAL_CERTIFICATE: "Medical Certificate",
  PARENTAL_CONSENT: "Parental Consent",
  INSURANCE: "Insurance",
  CERTIFICATE_OF_REGISTRATION: "Certificate of Registration",
  OTHER: "Other",
};

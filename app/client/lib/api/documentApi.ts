import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./baseQuery";
import type { DocumentType } from "./studentPortalApi";

/**
 * The coordinator's cross-student requirements checklist
 * (`/coordinator/documents`).
 *
 * Distinct from `studentPortalApi`'s document endpoints, which are the
 * student's own upload/list/delete view of the same table. The file bytes
 * (single download, ZIP) don't go through this slice — see `fileDownload.ts`.
 */

/** One submitted file. No URL: downloads go through the server. */
export interface ChecklistDocument {
  id: string;
  uploadedAt: string;
  fileName: string;
}

/** One row per student, including students who have submitted nothing. */
export interface StudentDocumentChecklist {
  /** The Student id — what the ZIP route takes. */
  id: string;
  name: string;
  studentIdNumber: string;
  establishment: { id: string; name: string; branch?: string | null } | null;
  submittedCount: number;
  /** Every type is present as a key; `null` means not submitted. */
  documents: Record<DocumentType, ChecklistDocument | null>;
}

export const documentApi = createApi({
  reducerPath: "documentApi",
  baseQuery: baseQueryWithAuth,
  // "Document" is also invalidated cross-slice by the student and
  // establishment deletes (studentApi.ts, establishmentApi.ts).
  tagTypes: ["Document"],
  endpoints: (builder) => ({
    getCoordinatorDocuments: builder.query<StudentDocumentChecklist[], void>({
      query: () => "/coordinator/documents",
      providesTags: ["Document"],
    }),
  }),
});

export const { useGetCoordinatorDocumentsQuery } = documentApi;

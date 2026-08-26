import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./baseQuery";
import type { DocumentStatus } from "./studentPortalApi";

/**
 * The coordinator's cross-student review queue (`/coordinator/documents`).
 *
 * Distinct from `studentPortalApi`'s document endpoints, which are the
 * student's own upload/list/delete view of the same table.
 */

export interface CoordinatorDocument {
  id: string;
  studentId: string;
  name: string;
  /** A freshly minted 1-hour signed URL, never the raw storage path. */
  fileUrl: string;
  status: DocumentStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  uploadedAt: string;
  student: {
    id: string;
    studentIdNumber: string;
    user: { name: string };
    establishment: { id: string; name: string } | null;
  };
  reviewedBy: { id: string; user: { name: string } } | null;
}

export interface ReviewDocumentRequest {
  id: string;
  status: "APPROVED" | "REJECTED";
  /** Required by the server when status is REJECTED, ignored otherwise. */
  reviewNote?: string;
}

export const documentApi = createApi({
  reducerPath: "documentApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: ["Document"],
  endpoints: (builder) => ({
    getDocuments: builder.query<CoordinatorDocument[], void>({
      query: () => "/coordinator/documents",
      providesTags: ["Document"],
    }),
    reviewDocument: builder.mutation<
      CoordinatorDocument,
      ReviewDocumentRequest
    >({
      query: ({ id, status, reviewNote }) => ({
        url: `/coordinator/documents/${id}/review`,
        method: "PATCH",
        // JSON.stringify drops an undefined reviewNote, so an APPROVED body
        // never sends the field forbidNonWhitelisted would otherwise ignore.
        body: { status, reviewNote },
      }),
      invalidatesTags: ["Document"],
    }),
  }),
});

export const { useGetDocumentsQuery, useReviewDocumentMutation } =
  documentApi;

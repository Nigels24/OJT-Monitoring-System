import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./baseQuery";

/**
 * The school's official ON-THE-JOB TRAINING PERFORMANCE EVALUATION SHEET.
 *
 * Nothing here restates the form: the sections, printed letters and item
 * wording all come from the server — the sheet is a versioned template the
 * coordinator maintains, served by `GET /supervisor/evaluations/form` — and a
 * stored evaluation carries its own scored sections, rendered from the version
 * it was signed on. A second copy in the client would drift from the sheet the
 * school actually issues, and could not follow a new version at all.
 */

/** One printed row of the blank sheet. */
export interface SheetItem {
  key: string;
  letter: string;
  label: string;
}

export interface SheetSection {
  key: string;
  numeral: string;
  label: string;
  maxPoints: number;
  items: SheetItem[];
}

/** The blank sheet, as served: whichever template version is published. */
export interface EvaluationSheet {
  templateId: string;
  /** 1, 2, 3 … — which version of the school's sheet this is. */
  version: number;
  /** The sheet's printed title, from the template. */
  title: string;
  sections: SheetSection[];
  /** The legend, highest first: 5 OUTSTANDING … 1 NEEDS IMPROVEMENT. */
  scale: { value: number; label: string }[];
  minScore: number;
  maxScore: number;
  maxTotalRating: number;
  /**
   * The header/footer blanks as they will be filled in for the signed-in
   * supervisor. Served with the sheet so the form needs one endpoint, not two —
   * these used to come off /supervisor/dashboard, which meant a failing
   * dashboard blanked the footer.
   */
  evaluator: { name: string; position: string | null };
  employedAt: string | null;
}

/** A blank-sheet item with the score it was given. */
export interface ScoredItem extends SheetItem {
  score: number;
}

export interface ScoredSection extends Omit<SheetSection, "items"> {
  /** Raw sum of this section's items, out of `maxPoints`. */
  total: number;
  items: ScoredItem[];
}

export interface Evaluation {
  id: string;
  studentId: string;
  supervisorId: string;
  /** Raw sum of this sheet's items, out of `maxTotalRating`. */
  totalRating: number;
  /**
   * What this sheet was scored out of, frozen when it was signed. Not a
   * constant: a later template version with more or fewer items changes it for
   * new evaluations only.
   */
  maxTotalRating: number;
  /** The template version this sheet was signed on, and its title. */
  templateVersion: number;
  templateTitle: string;
  sections: ScoredSection[];
  trainingStartedAt: string | null;
  trainingEndedAt: string | null;
  /** Establishment name, snapshotted when the sheet was written. */
  trainingEmployedAt: string | null;
  evaluatorName: string | null;
  evaluatorPosition: string | null;
  comments: string | null;
  recommendations: string | null;
  /**
   * Whether the caller may edit or delete this sheet — true only for its
   * author, and always false for a coordinator. Decided server-side, so the
   * UI never has to derive authorship from a second request.
   */
  canModify: boolean;
  createdAt: string;
  updatedAt: string;
  student: {
    id: string;
    studentIdNumber: string;
    course: string | null;
    school: string | null;
    user: { name: string; email: string };
    establishment: { id: string; name: string } | null;
  };
  supervisor: {
    id: string;
    position: string | null;
    user: { name: string };
  };
}

/**
 * What create and edit both send.
 *
 * `scores` is keyed by the item keys the sheet defines and is sent as a nested
 * object: the server validates it against the template version the evaluation
 * belongs to, which a DTO of fixed fields could not do. `totalRating`,
 * `maxTotalRating` and the evaluator/establishment snapshots are absent on
 * purpose: the server derives them and rejects a body that supplies them.
 */
export interface EvaluationSheetPayload {
  trainingStartedAt?: string;
  trainingEndedAt?: string;
  /** `null` clears the field on an edit; omitting it leaves it unchanged. */
  comments?: string | null;
  recommendations?: string | null;
  scores: Record<string, number>;
}

/** The generated sheet, plus whatever filename the server named it. */
export interface EvaluationPdfDownload {
  blob: Blob;
  /** From Content-Disposition; `null` when the browser could not read it. */
  filename: string | null;
}

/** `attachment; filename="Evaluation-....pdf"` -> the filename. */
function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  return match ? decodeURIComponent(match[1]) : null;
}

export const evaluationApi = createApi({
  reducerPath: "evaluationApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: ["Evaluation", "EvaluationSheet"],
  endpoints: (builder) => ({
    /** The blank sheet's structure. Static, so it is fetched once and cached. */
    getEvaluationSheet: builder.query<EvaluationSheet, void>({
      query: () => "/supervisor/evaluations/form",
      providesTags: ["EvaluationSheet"],
    }),
    /** Supervisor: evaluations for their own establishment. */
    getMyEvaluations: builder.query<Evaluation[], void>({
      query: () => "/supervisor/evaluations",
      providesTags: ["Evaluation"],
    }),
    /** Coordinator: every evaluation, across all establishments. */
    getAllEvaluations: builder.query<Evaluation[], void>({
      query: () => "/coordinator/evaluations",
      providesTags: ["Evaluation"],
    }),
    /**
     * Coordinator: the filled-in sheet as a PDF.
     *
     * Goes through the slice rather than a plain `<a href>` because the route
     * is bearer-authenticated — an anchor would send neither the token nor the
     * API base URL. Nothing is cached (`keepUnusedDataFor: 0`, no tags): the
     * response is a file the user is saving, not state the UI reads.
     */
    downloadEvaluationPdf: builder.query<EvaluationPdfDownload, string>({
      query: (id) => ({
        url: `/coordinator/evaluations/${id}/pdf`,
        responseHandler: async (response) => {
          // An error still answers in Nest's JSON shape; parsing it as one
          // keeps the snackbar readable instead of showing a blob of bytes.
          if (!response.ok) return response.json();
          return {
            blob: await response.blob(),
            filename: filenameFromDisposition(
              response.headers.get("Content-Disposition"),
            ),
          };
        },
      }),
      keepUnusedDataFor: 0,
    }),
    createEvaluation: builder.mutation<
      Evaluation,
      EvaluationSheetPayload & { studentId: string }
    >({
      query: (body) => ({
        url: "/supervisor/evaluations",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Evaluation"],
    }),
    /** Edit sends the whole sheet again — every item is required on the form. */
    updateEvaluation: builder.mutation<
      Evaluation,
      EvaluationSheetPayload & { id: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/supervisor/evaluations/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Evaluation"],
    }),
    deleteEvaluation: builder.mutation<
      { id: string; deleted: boolean },
      string
    >({
      query: (id) => ({
        url: `/supervisor/evaluations/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Evaluation"],
    }),
  }),
});

export const {
  useGetEvaluationSheetQuery,
  useLazyDownloadEvaluationPdfQuery,
  useGetMyEvaluationsQuery,
  useGetAllEvaluationsQuery,
  useCreateEvaluationMutation,
  useUpdateEvaluationMutation,
  useDeleteEvaluationMutation,
} = evaluationApi;

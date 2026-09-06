import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./baseQuery";

/**
 * The school's official ON-THE-JOB TRAINING PERFORMANCE EVALUATION SHEET.
 *
 * Nothing here restates the form: the sections, printed letters and item
 * wording all come from the server (`src/common/evaluation-scoring.ts`, served
 * by `GET /supervisor/evaluations/form`), and a stored evaluation carries its
 * own scored sections. A second copy in the client would drift from the sheet
 * the school actually issues.
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

/** The blank sheet, as served. */
export interface EvaluationSheet {
  sections: SheetSection[];
  /** The legend, highest first: 5 OUTSTANDING … 1 NEEDS IMPROVEMENT. */
  scale: { value: number; label: string }[];
  minScore: number;
  maxScore: number;
  maxTotalRating: number;
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
  /** Raw sum of all nineteen items, out of `maxTotalRating` (95). */
  totalRating: number;
  maxTotalRating: number;
  sections: ScoredSection[];
  trainingStartedAt: string | null;
  trainingEndedAt: string | null;
  /** Establishment name, snapshotted when the sheet was written. */
  trainingEmployedAt: string | null;
  evaluatorName: string | null;
  evaluatorPosition: string | null;
  comments: string | null;
  recommendations: string | null;
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
 * `scores` is keyed by the item keys the sheet defines and is flattened into
 * the body by the endpoints below — the server takes the nineteen items as
 * top-level fields. `totalRating` and the evaluator/establishment snapshots are
 * absent on purpose: the server derives them and rejects a body that supplies
 * them.
 */
export interface EvaluationSheetPayload {
  trainingStartedAt?: string;
  trainingEndedAt?: string;
  /** `null` clears the field on an edit; omitting it leaves it unchanged. */
  comments?: string | null;
  recommendations?: string | null;
  scores: Record<string, number>;
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
    createEvaluation: builder.mutation<
      Evaluation,
      EvaluationSheetPayload & { studentId: string }
    >({
      query: ({ scores, ...rest }) => ({
        url: "/supervisor/evaluations",
        method: "POST",
        body: { ...rest, ...scores },
      }),
      invalidatesTags: ["Evaluation"],
    }),
    /** Edit sends the whole sheet again — every item is required on the form. */
    updateEvaluation: builder.mutation<
      Evaluation,
      EvaluationSheetPayload & { id: string }
    >({
      query: ({ id, scores, ...rest }) => ({
        url: `/supervisor/evaluations/${id}`,
        method: "PATCH",
        body: { ...rest, ...scores },
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
  useGetMyEvaluationsQuery,
  useGetAllEvaluationsQuery,
  useCreateEvaluationMutation,
  useUpdateEvaluationMutation,
  useDeleteEvaluationMutation,
} = evaluationApi;

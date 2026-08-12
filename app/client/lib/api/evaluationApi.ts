import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./baseQuery";
import type { Criterion } from "@/features/evaluation/rubric";

export type CriteriaScores = Record<Criterion, number>;

export interface EvaluationCategory {
  key: string;
  label: string;
  weight: number;
  average: number;
}

export interface Evaluation extends CriteriaScores {
  id: string;
  studentId: string;
  supervisorId: string;
  /** Weighted result, computed and stored server-side. */
  overallRating: number;
  performanceLevel: string;
  periodStart: string | null;
  periodEnd: string | null;
  comments: string | null;
  recommendations: string | null;
  createdAt: string;
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
  /** Per-category averages, recomputed on read. */
  categories: EvaluationCategory[];
}

export interface CreateEvaluationRequest extends CriteriaScores {
  studentId: string;
  periodStart?: string;
  periodEnd?: string;
  comments?: string;
  recommendations?: string;
}

export const evaluationApi = createApi({
  reducerPath: "evaluationApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: ["Evaluation"],
  endpoints: (builder) => ({
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
    createEvaluation: builder.mutation<Evaluation, CreateEvaluationRequest>({
      query: (body) => ({
        url: "/supervisor/evaluations",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Evaluation"],
    }),
  }),
});

export const {
  useGetMyEvaluationsQuery,
  useGetAllEvaluationsQuery,
  useCreateEvaluationMutation,
} = evaluationApi;

import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./baseQuery";

/**
 * The coordinator's versioned evaluation sheet (`/coordinator/evaluation-template`).
 *
 * Distinct from `evaluationApi`, which reads *submitted* evaluations: this is
 * the form itself. One version is PUBLISHED at a time, at most one DRAFT
 * exists, and a published version is immutable — editing means drafting,
 * then publishing a new version, which archives the outgoing one. Evaluations
 * already signed keep the version they were signed with.
 *
 * Numerals, letters and `maxPoints` are derived server-side from order and item
 * count; they are read here and never sent back.
 */

export type TemplateStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface TemplateSheetItem {
  key: string;
  /** Printed letter, derived from order: A, B, C … */
  letter: string;
  label: string;
}

export interface TemplateSheetSection {
  key: string;
  /** Printed numeral, derived from order: I, II, III … */
  numeral: string;
  label: string;
  /** Item count × `maxScore`, derived. */
  maxPoints: number;
  items: TemplateSheetItem[];
}

/** One version of the sheet, as served. */
export interface TemplateSheet {
  templateId: string;
  version: number;
  title: string;
  status: TemplateStatus;
  publishedAt: string | null;
  sections: TemplateSheetSection[];
  /** The legend, highest first: 5 OUTSTANDING … 1 NEEDS IMPROVEMENT. */
  scale: { value: number; label: string }[];
  minScore: number;
  maxScore: number;
  maxTotalRating: number;
}

export interface EvaluationTemplateOverview {
  published: TemplateSheet | null;
  draft: TemplateSheet | null;
}

/**
 * The whole draft, every time — the server replaces it in one call.
 *
 * A row that carries its `key` is kept; a row sent without one is new and the
 * server mints a key for it. A key the draft does not already have is a 400,
 * so rows must never invent one.
 */
export interface SaveDraftRequest {
  title: string;
  sections: {
    key?: string;
    label: string;
    items: { key?: string; label: string }[];
  }[];
}

export const evaluationTemplateApi = createApi({
  reducerPath: "evaluationTemplateApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: ["EvaluationTemplate"],
  endpoints: (builder) => ({
    getEvaluationTemplate: builder.query<EvaluationTemplateOverview, void>({
      query: () => "/coordinator/evaluation-template",
      providesTags: ["EvaluationTemplate"],
    }),
    /** Replaces the whole draft; creates it when there is none. */
    saveDraft: builder.mutation<TemplateSheet, SaveDraftRequest>({
      query: (body) => ({
        url: "/coordinator/evaluation-template/draft",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["EvaluationTemplate"],
    }),
    /**
     * Publishes the draft as the next version and archives the outgoing one.
     *
     * Only this store is invalidated. A supervisor's blank-sheet query
     * (`evaluationApi`'s `EvaluationSheet` tag) lives in a different login's
     * store, so there is nothing to reach from here — they pick the new
     * version up on their next page load.
     */
    publishDraft: builder.mutation<TemplateSheet, void>({
      query: () => ({
        url: "/coordinator/evaluation-template/publish",
        method: "POST",
      }),
      invalidatesTags: ["EvaluationTemplate"],
    }),
    discardDraft: builder.mutation<{ id: string; discarded: boolean }, void>({
      query: () => ({
        url: "/coordinator/evaluation-template/draft",
        method: "DELETE",
      }),
      invalidatesTags: ["EvaluationTemplate"],
    }),
  }),
});

export const {
  useGetEvaluationTemplateQuery,
  useSaveDraftMutation,
  usePublishDraftMutation,
  useDiscardDraftMutation,
} = evaluationTemplateApi;

import { useMemo, useState } from "react";
import {
  useGetMyEvaluationsQuery,
  useCreateEvaluationMutation,
  Evaluation,
} from "@/lib/api/evaluationApi";
import { useGetSupervisorStudentsQuery } from "@/lib/api/supervisorApi";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";
import { CATEGORIES, CRITERIA, Criterion, previewLevel } from "../rubric";

/** Blank scores plus the free-text fields. "" means "not yet chosen". */
const EMPTY_FORM = {
  studentId: "",
  periodStart: "",
  periodEnd: "",
  comments: "",
  recommendations: "",
  ...(Object.fromEntries(CRITERIA.map((c) => [c, ""])) as Record<
    Criterion,
    string
  >),
};

export type EvaluationFormValues = typeof EMPTY_FORM;

const PAGE_SIZE = 10;

export function useEvaluations() {
  const [form, setForm] = useState<EvaluationFormValues>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [viewTarget, setViewTarget] = useState<Evaluation | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { showSuccess, showError } = useSnackbar();

  const { data: evaluations, isLoading } = useGetMyEvaluationsQuery();
  const { data: students, isLoading: studentsLoading } =
    useGetSupervisorStudentsQuery();
  const [createEvaluation, { isLoading: isSubmitting }] =
    useCreateEvaluationMutation();

  const setField =
    (key: keyof EvaluationFormValues) =>
    (e: { target: { value: string } }) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };

  const allScored = CRITERIA.every((c) => form[c] !== "");

  /**
   * Live preview of the weighted rating.
   *
   * Mirrors the server's formula so the supervisor sees the result before
   * submitting — the stored value is always the server's own calculation.
   */
  const preview = useMemo(() => {
    if (!allScored) return null;
    const weighted = CATEGORIES.reduce((acc, category) => {
      const sum = category.criteria.reduce(
        (a, c) => a + Number(form[c.key]),
        0,
      );
      return acc + (sum / category.criteria.length) * category.weight;
    }, 0);
    const rating = Math.round(weighted * 10) / 10;
    return { rating, level: previewLevel(rating) };
  }, [form, allScored]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.studentId) {
      setError("Pick the student you are evaluating.");
      return;
    }
    if (!allScored) {
      setError("Score every criterion before submitting.");
      return;
    }

    try {
      const scores = Object.fromEntries(
        CRITERIA.map((c) => [c, Number(form[c])]),
      ) as Record<Criterion, number>;

      const result = await createEvaluation({
        studentId: form.studentId,
        ...scores,
        periodStart: form.periodStart || undefined,
        periodEnd: form.periodEnd || undefined,
        comments: form.comments || undefined,
        recommendations: form.recommendations || undefined,
      }).unwrap();

      showSuccess(
        `Evaluation saved for ${result.student.user.name} — ${result.overallRating} (${result.performanceLevel}).`,
      );
      setForm(EMPTY_FORM);
    } catch (err: unknown) {
      const message = readError(err, "Failed to save the evaluation.");
      setError(message);
      showError(message);
    }
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setError("");
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return evaluations ?? [];
    return (evaluations ?? []).filter((ev) =>
      [
        ev.student.user.name,
        ev.student.studentIdNumber,
        ev.student.course,
        ev.performanceLevel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [evaluations, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    const all = evaluations ?? [];
    const avg =
      all.length === 0
        ? 0
        : Math.round(
            (all.reduce((a, e) => a + e.overallRating, 0) / all.length) * 10,
          ) / 10;
    // "Pending" = students at this establishment with no evaluation yet.
    const evaluatedIds = new Set(all.map((e) => e.studentId));
    const pending = (students ?? []).filter(
      (s) => !evaluatedIds.has(s.id),
    ).length;
    return {
      total: all.length,
      averageRating: avg,
      averageLevel: all.length === 0 ? "—" : previewLevel(avg),
      pending,
    };
  }, [evaluations, students]);

  return {
    form,
    error,
    preview,
    allScored,
    evaluations,
    students,
    isLoading,
    studentsLoading,
    isSubmitting,
    viewTarget,
    search,
    page,
    paged,
    totalPages,
    filtered,
    stats,

    setField,
    setViewTarget,
    setSearch,
    setPage,
    handleSubmit,
    resetForm,
  };
}

function readError(err: unknown, fallback: string): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  if (Array.isArray(data?.message)) return data.message.join(", ");
  return data?.message ?? fallback;
}

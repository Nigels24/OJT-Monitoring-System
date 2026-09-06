import { useMemo, useState } from "react";
import {
  useGetEvaluationSheetQuery,
  useGetMyEvaluationsQuery,
  useCreateEvaluationMutation,
  useUpdateEvaluationMutation,
  useDeleteEvaluationMutation,
  Evaluation,
  EvaluationSheet,
} from "@/lib/api/evaluationApi";
import {
  useGetSupervisorStudentsQuery,
  useGetSupervisorDashboardQuery,
} from "@/lib/api/supervisorApi";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";

/** `""` means "not yet scored" — distinct from any real 1-5 value. */
type ScoreDraft = Record<string, string>;

interface FormState {
  studentId: string;
  trainingStartedAt: string;
  trainingEndedAt: string;
  comments: string;
  recommendations: string;
  scores: ScoreDraft;
}

const EMPTY_FORM: FormState = {
  studentId: "",
  trainingStartedAt: "",
  trainingEndedAt: "",
  comments: "",
  recommendations: "",
  scores: {},
};

const PAGE_SIZE = 10;

/** An ISO timestamp as `<input type="date">` wants it. */
function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

/** Every item key on the sheet, in printed order. */
function itemKeys(sheet: EvaluationSheet | undefined): string[] {
  return (sheet?.sections ?? []).flatMap((s) => s.items.map((i) => i.key));
}

export function useEvaluations() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editTarget, setEditTarget] = useState<Evaluation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Evaluation | null>(null);
  const [viewTarget, setViewTarget] = useState<Evaluation | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { showSuccess, showError } = useSnackbar();

  const { data: sheet, isLoading: sheetLoading } = useGetEvaluationSheetQuery();
  const { data: evaluations, isLoading } = useGetMyEvaluationsQuery();
  const { data: students, isLoading: studentsLoading } =
    useGetSupervisorStudentsQuery();
  const { data: dashboard } = useGetSupervisorDashboardQuery();

  const [createEvaluation, { isLoading: isCreating }] =
    useCreateEvaluationMutation();
  const [updateEvaluation, { isLoading: isUpdating }] =
    useUpdateEvaluationMutation();
  const [deleteEvaluation, { isLoading: isDeleting }] =
    useDeleteEvaluationMutation();

  const isEditing = editTarget !== null;
  const isSubmitting = isCreating || isUpdating;

  /* ---------- form editing ---------- */

  const setHeaderField =
    (key: "trainingStartedAt" | "trainingEndedAt" | "comments" | "recommendations") =>
    (e: { target: { value: string } }) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };

  /**
   * Picking the student also prefills the training dates from their record,
   * which is what the paper form's header expects. Done here rather than in an
   * effect — deriving state from a change is not a synchronisation problem, and
   * `react-hooks/set-state-in-effect` rules the effect version out anyway.
   */
  const setStudentId = (studentId: string) => {
    const student = (students ?? []).find((s) => s.id === studentId);
    setForm((f) => ({
      ...f,
      studentId,
      trainingStartedAt: toDateInput(student?.startDate ?? null),
      trainingEndedAt: toDateInput(student?.endDate ?? null),
    }));
  };

  const setScore = (itemKey: string, value: number) => {
    setForm((f) => ({ ...f, scores: { ...f.scores, [itemKey]: String(value) } }));
  };

  /* ---------- live totals ---------- */

  const keys = useMemo(() => itemKeys(sheet), [sheet]);
  const scoredCount = keys.filter((k) => form.scores[k]).length;
  const allScored = keys.length > 0 && scoredCount === keys.length;

  /** Section totals and the running TOTAL RATING, as scores are picked. */
  const sectionTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const section of sheet?.sections ?? []) {
      totals[section.key] = section.items.reduce(
        (sum, item) => sum + (Number(form.scores[item.key]) || 0),
        0,
      );
    }
    return totals;
  }, [sheet, form.scores]);

  const totalRating = useMemo(
    () => Object.values(sectionTotals).reduce((a, b) => a + b, 0),
    [sectionTotals],
  );

  /**
   * Which sections still have blanks, named as printed, so the form can say
   * *where* the gaps are instead of "fill in everything".
   */
  const incompleteSections = useMemo(
    () =>
      (sheet?.sections ?? [])
        .filter((section) => section.items.some((i) => !form.scores[i.key]))
        .map((section) => {
          const missing = section.items.filter((i) => !form.scores[i.key]);
          return {
            key: section.key,
            label: `${section.numeral}. ${section.label}`,
            missing: missing.length,
            letters: missing.map((i) => i.letter),
          };
        }),
    [sheet, form.scores],
  );

  /* ---------- header / footer, read-only ---------- */

  const selectedStudent = useMemo(
    () => (students ?? []).find((s) => s.id === form.studentId) ?? null,
    [students, form.studentId],
  );

  const traineeName = isEditing
    ? editTarget.student.user.name
    : (selectedStudent?.user.name ?? "");

  const employedAt = isEditing
    ? (editTarget.trainingEmployedAt ?? "")
    : (dashboard?.establishment?.name ?? "");

  const evaluator = isEditing
    ? {
        name: editTarget.evaluatorName ?? "",
        position: editTarget.evaluatorPosition ?? "",
      }
    : {
        name: dashboard?.supervisor.name ?? "",
        position: dashboard?.supervisor.position ?? "",
      };

  /* ---------- submit / edit / delete ---------- */

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setError("");
  };

  /** Loads an existing sheet back into the form. */
  const startEdit = (evaluation: Evaluation) => {
    setEditTarget(evaluation);
    setError("");
    setForm({
      studentId: evaluation.studentId,
      trainingStartedAt: toDateInput(evaluation.trainingStartedAt),
      trainingEndedAt: toDateInput(evaluation.trainingEndedAt),
      comments: evaluation.comments ?? "",
      recommendations: evaluation.recommendations ?? "",
      scores: Object.fromEntries(
        evaluation.sections.flatMap((section) =>
          section.items.map((item) => [item.key, String(item.score)]),
        ),
      ),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isEditing && !form.studentId) {
      setError("Pick the trainee you are evaluating.");
      return;
    }
    if (!allScored) {
      setError(
        `Score every item before submitting — ${keys.length - scoredCount} still blank.`,
      );
      return;
    }

    // Emptied free-text goes as `null`, not omitted: the server reads an
    // absent field as "leave unchanged", so omitting it would silently restore
    // the text the supervisor just deleted.
    const payload = {
      trainingStartedAt: form.trainingStartedAt || undefined,
      trainingEndedAt: form.trainingEndedAt || undefined,
      comments: form.comments || null,
      recommendations: form.recommendations || null,
      scores: Object.fromEntries(keys.map((k) => [k, Number(form.scores[k])])),
    };

    try {
      const result = isEditing
        ? await updateEvaluation({ id: editTarget.id, ...payload }).unwrap()
        : await createEvaluation({
            studentId: form.studentId,
            ...payload,
          }).unwrap();

      showSuccess(
        `${isEditing ? "Evaluation updated" : "Evaluation saved"} for ${
          result.student.user.name
        } — ${result.totalRating}/${result.maxTotalRating}.`,
      );
      resetForm();
    } catch (err: unknown) {
      const message = readError(err, "Failed to save the evaluation.");
      setError(message);
      showError(message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const name = deleteTarget.student.user.name;
    try {
      await deleteEvaluation(deleteTarget.id).unwrap();
      // Deleting the sheet currently open for editing would leave the form
      // pointing at a row that no longer exists.
      if (editTarget?.id === deleteTarget.id) resetForm();
      setDeleteTarget(null);
      showSuccess(`Evaluation of ${name} deleted.`);
    } catch (err: unknown) {
      showError(readError(err, "Failed to delete the evaluation."));
    }
  };

  /* ---------- list ---------- */

  /**
   * Only the author may edit or delete. The server 403s either way; this keeps
   * the button from being offered at all.
   */
  const mySupervisorId = dashboard?.supervisor.id ?? null;
  const canModify = (evaluation: Evaluation) =>
    mySupervisorId !== null && evaluation.supervisorId === mySupervisorId;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return evaluations ?? [];
    return (evaluations ?? []).filter((ev) =>
      [
        ev.student.user.name,
        ev.student.studentIdNumber,
        ev.student.course,
        ev.evaluatorName,
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
    // null, not 0, until something has been evaluated — a real average of zero
    // and "nothing measured yet" are different claims.
    const average =
      all.length === 0
        ? null
        : Math.round((all.reduce((a, e) => a + e.totalRating, 0) / all.length) * 10) /
          10;
    const evaluatedIds = new Set(all.map((e) => e.studentId));
    return {
      total: all.length,
      averageRating: average,
      maxTotalRating: sheet?.maxTotalRating ?? null,
      /** Students at this establishment with no evaluation at all yet. */
      pending: (students ?? []).filter((s) => !evaluatedIds.has(s.id)).length,
    };
  }, [evaluations, students, sheet]);

  return {
    sheet,
    sheetLoading,
    form,
    error,
    editTarget,
    isEditing,
    traineeName,
    employedAt,
    evaluator,
    sectionTotals,
    totalRating,
    scoredCount,
    totalItems: keys.length,
    incompleteSections,
    allScored,
    students,
    studentsLoading,
    isSubmitting,
    evaluations,
    isLoading,
    canModify,
    viewTarget,
    deleteTarget,
    isDeleting,
    search,
    page,
    paged,
    totalPages,
    stats,

    setStudentId,
    setHeaderField,
    setScore,
    setViewTarget,
    setDeleteTarget,
    setSearch,
    setPage,
    handleSubmit,
    startEdit,
    resetForm,
    handleDeleteConfirm,
  };
}

function readError(err: unknown, fallback: string): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  if (Array.isArray(data?.message)) return data.message.join(", ");
  return data?.message ?? fallback;
}

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
  SupervisorStudent,
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

/**
 * One in-progress sheet: its own answers and its own running totals.
 *
 * Called **twice** by `useEvaluations` — once for the page's New Evaluation
 * card, once for the edit modal — so the two are genuinely independent drafts.
 * They used to share a single `FormState`, which meant opening a pencil wiped a
 * half-filled new evaluation and cancelling the edit wiped it a second time.
 */
function useEvaluationDraft(
  sheet: EvaluationSheet | undefined,
  students: SupervisorStudent[] | undefined,
) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState("");

  const setHeaderField =
    (
      key: "trainingStartedAt" | "trainingEndedAt" | "comments" | "recommendations",
    ) =>
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

  const selectedStudent = useMemo(
    () => (students ?? []).find((s) => s.id === form.studentId) ?? null,
    [students, form.studentId],
  );

  const reset = () => {
    setForm(EMPTY_FORM);
    setError("");
  };

  /** Seeds the draft from an existing sheet — the edit modal's entry point. */
  const load = (evaluation: Evaluation) => {
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

  /**
   * The whole sheet, every time — `PATCH` is not a partial update. Emptied
   * free-text goes as `null`, not omitted: the server reads an absent field as
   * "leave unchanged", so omitting it would silently restore the text the
   * supervisor just deleted. `totalRating` is never sent; the server computes
   * it.
   */
  const payload = () => ({
    trainingStartedAt: form.trainingStartedAt || undefined,
    trainingEndedAt: form.trainingEndedAt || undefined,
    comments: form.comments || null,
    recommendations: form.recommendations || null,
    scores: Object.fromEntries(keys.map((k) => [k, Number(form.scores[k])])),
  });

  return {
    form,
    error,
    setError,
    setStudentId,
    setHeaderField,
    setScore,
    keys,
    scoredCount,
    allScored,
    sectionTotals,
    totalRating,
    incompleteSections,
    selectedStudent,
    reset,
    load,
    payload,
  };
}

export function useEvaluations() {
  const [editTarget, setEditTarget] = useState<Evaluation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Evaluation | null>(null);
  const [viewTarget, setViewTarget] = useState<Evaluation | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { showSuccess, showError } = useSnackbar();

  const { data: sheet, isLoading: sheetLoading } = useGetEvaluationSheetQuery();
  const { data: evaluations, isLoading } = useGetMyEvaluationsQuery();
  const { data: students, isLoading: studentsLoading } =
    useGetSupervisorStudentsQuery();

  const [createEvaluation, { isLoading: isCreating }] =
    useCreateEvaluationMutation();
  const [updateEvaluation, { isLoading: isUpdating }] =
    useUpdateEvaluationMutation();
  const [deleteEvaluation, { isLoading: isDeleting }] =
    useDeleteEvaluationMutation();

  // Two drafts, never one: the page's card is create-only and the modal's is
  // discarded when it closes.
  const create = useEvaluationDraft(sheet, students);
  const edit = useEvaluationDraft(sheet, students);

  const isEditOpen = editTarget !== null;

  /* ---------- the edit modal ---------- */

  /** The pencil in the table. Seeds the modal's draft, then opens it. */
  const startEdit = (evaluation: Evaluation) => {
    edit.load(evaluation);
    setEditTarget(evaluation);
  };

  const closeEdit = () => {
    setEditTarget(null);
    edit.reset();
  };

  /* ---------- submit ---------- */

  const blanksMessage = (draft: ReturnType<typeof useEvaluationDraft>) =>
    `Score every item before submitting — ${
      draft.keys.length - draft.scoredCount
    } still blank.`;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    create.setError("");

    if (!create.form.studentId) {
      create.setError("Pick the trainee you are evaluating.");
      return;
    }
    if (!create.allScored) {
      create.setError(blanksMessage(create));
      return;
    }

    try {
      const result = await createEvaluation({
        studentId: create.form.studentId,
        ...create.payload(),
      }).unwrap();
      showSuccess(
        `Evaluation saved for ${result.student.user.name} — ${result.totalRating}/${result.maxTotalRating}.`,
      );
      create.reset();
    } catch (err: unknown) {
      const message = readError(err, "Failed to save the evaluation.");
      create.setError(message);
      showError(message);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    edit.setError("");

    if (!edit.allScored) {
      edit.setError(blanksMessage(edit));
      return;
    }

    try {
      const result = await updateEvaluation({
        id: editTarget.id,
        ...edit.payload(),
      }).unwrap();
      showSuccess(
        `Evaluation updated for ${result.student.user.name} — ${result.totalRating}/${result.maxTotalRating}.`,
      );
      closeEdit();
    } catch (err: unknown) {
      // The modal stays open on failure — closing it would throw away the
      // sheet the supervisor just filled in.
      const message = readError(err, "Failed to save the evaluation.");
      edit.setError(message);
      showError(message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const name = deleteTarget.student.user.name;
    try {
      await deleteEvaluation(deleteTarget.id).unwrap();
      // Deleting the sheet currently open in the modal would leave it pointing
      // at a row that no longer exists.
      if (editTarget?.id === deleteTarget.id) closeEdit();
      setDeleteTarget(null);
      showSuccess(`Evaluation of ${name} deleted.`);
    } catch (err: unknown) {
      showError(readError(err, "Failed to delete the evaluation."));
    }
  };

  /* ---------- header / footer, read-only ---------- */

  // A new sheet shows what the server will stamp on it, served alongside the
  // blank sheet; an existing one shows the snapshot it was signed with.
  const createForm = {
    form: create.form,
    error: create.error,
    editTarget: null,
    isEditing: false,
    traineeName: create.selectedStudent?.user.name ?? "",
    employedAt: sheet?.employedAt ?? "",
    evaluator: {
      name: sheet?.evaluator.name ?? "",
      position: sheet?.evaluator.position ?? "",
    },
    sectionTotals: create.sectionTotals,
    totalRating: create.totalRating,
    scoredCount: create.scoredCount,
    totalItems: create.keys.length,
    incompleteSections: create.incompleteSections,
    allScored: create.allScored,
    isSubmitting: isCreating,
    setStudentId: create.setStudentId,
    setHeaderField: create.setHeaderField,
    setScore: create.setScore,
    onSubmit: handleCreateSubmit,
    onCancelEdit: create.reset,
  };

  const editForm = {
    form: edit.form,
    error: edit.error,
    editTarget,
    isEditing: true,
    traineeName: editTarget?.student.user.name ?? "",
    employedAt: editTarget?.trainingEmployedAt ?? "",
    evaluator: {
      name: editTarget?.evaluatorName ?? "",
      position: editTarget?.evaluatorPosition ?? "",
    },
    sectionTotals: edit.sectionTotals,
    totalRating: edit.totalRating,
    scoredCount: edit.scoredCount,
    totalItems: edit.keys.length,
    incompleteSections: edit.incompleteSections,
    allScored: edit.allScored,
    isSubmitting: isUpdating,
    setStudentId: edit.setStudentId,
    setHeaderField: edit.setHeaderField,
    setScore: edit.setScore,
    onSubmit: handleEditSubmit,
    onCancelEdit: closeEdit,
  };

  /**
   * What the sheet is, in one line, for the card's subheading.
   *
   * Counted from the served template rather than written out: the sheet is
   * versioned now, so "nineteen items in four sections" stops being true the
   * first time the coordinator publishes a change.
   */
  const sheetSummary = useMemo(() => {
    if (!sheet) return "";
    const items = sheet.sections.reduce(
      (count, section) => count + section.items.length,
      0,
    );
    return `${plural(items, "item")}, each scored ${sheet.minScore}–${sheet.maxScore}, in ${plural(
      sheet.sections.length,
      "section",
    )} (sheet version ${sheet.version}). The total is calculated on the server when you submit.`;
  }, [sheet]);

  /* ---------- list ---------- */

  /**
   * Only the author may edit or delete. The server decides this per row and
   * sends it as `canModify`; the client no longer derives it by comparing
   * against a second endpoint's supervisor id, which silently hid both buttons
   * whenever that request was slow or failing.
   */
  const canModify = (evaluation: Evaluation) => evaluation.canModify;

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
    sheetSummary,
    students,
    studentsLoading,

    /** Props for the page's permanently-create-mode card. */
    createForm,
    /** Props for the same form inside the edit modal. */
    editForm,
    editTarget,
    isEditOpen,
    startEdit,
    closeEdit,

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

    setViewTarget,
    setDeleteTarget,
    setSearch,
    setPage,
    handleDeleteConfirm,
  };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function readError(err: unknown, fallback: string): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  if (Array.isArray(data?.message)) return data.message.join(", ");
  return data?.message ?? fallback;
}

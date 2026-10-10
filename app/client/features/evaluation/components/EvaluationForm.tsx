import {
  CalendarDays,
  ClipboardCheck,
  MessageSquare,
  PencilLine,
  Send,
  User,
  Building2,
  AlertCircle,
} from "lucide-react";
import TextArea from "@/components/ui/TextArea";
import Button from "@/components/ui/Button";
import SelectField from "@/components/ui/SelectField";
import { SupervisorStudent } from "@/lib/api/supervisorApi";
import type { Evaluation, EvaluationSheet } from "@/lib/api/evaluationApi";
import { formatDateOnly } from "@/lib/format";
import { canEvaluate } from "../hooks/use-evaluations";

interface IncompleteSection {
  key: string;
  label: string;
  missing: number;
  letters: string[];
}

export interface EvaluationFormProps {
  sheet: EvaluationSheet | undefined;
  sheetLoading: boolean;
  form: {
    studentId: string;
    comments: string;
    recommendations: string;
    scores: Record<string, string>;
  };
  error: string;
  editTarget: Evaluation | null;
  isEditing: boolean;
  traineeName: string;
  employedAt: string;
  /**
   * Server-derived, display only (date-only ISO, `null` = dash): on create
   * the selected trainee's start date and last approved day, on edit the
   * dates stored with the sheet.
   */
  trainingStartedAt: string | null;
  trainingEndedAt: string | null;
  evaluator: { name: string; position: string };
  sectionTotals: Record<string, number>;
  totalRating: number;
  scoredCount: number;
  totalItems: number;
  incompleteSections: IncompleteSection[];
  allScored: boolean;
  students: SupervisorStudent[];
  isSubmitting: boolean;
  setStudentId: (id: string) => void;
  setHeaderField: (
    key: "comments" | "recommendations",
  ) => (e: { target: { value: string } }) => void;
  setScore: (itemKey: string, value: number) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancelEdit: () => void;
}

/** A read-only header/footer cell, printed like the blanks on the paper form. */
function FormFieldValue({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof User;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
        {label}
      </div>
      <div className="flex items-center gap-1.5 border-b border-gray-400 pb-1 min-h-[26px]">
        {Icon && <Icon size={14} className="text-gray-400 shrink-0" />}
        <span className="text-sm font-medium text-gray-900 truncate">
          {value || <span className="text-gray-400 font-normal">—</span>}
        </span>
      </div>
    </div>
  );
}

export default function EvaluationForm({
  sheet,
  sheetLoading,
  form,
  error,
  editTarget,
  isEditing,
  traineeName,
  employedAt,
  trainingStartedAt,
  trainingEndedAt,
  evaluator,
  sectionTotals,
  totalRating,
  scoredCount,
  totalItems,
  incompleteSections,
  allScored,
  students,
  isSubmitting,
  setStudentId,
  setHeaderField,
  setScore,
  onSubmit,
  onCancelEdit,
}: EvaluationFormProps) {
  if (sheetLoading || !sheet) {
    return <p className="text-sm text-gray-400">Loading the evaluation sheet…</p>;
  }

  const canSubmit = allScored && (isEditing || form.studentId !== "");
  // A new sheet only for a COMPLETED trainee; the rest are listed, disabled,
  // with their approved against required hours.
  const hasEvaluable = students.some(canEvaluate);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Editing an existing sheet must never be mistakable for a new one — a
          student can legitimately have several evaluations. */}
      {isEditing && editTarget && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-start gap-2">
            <PencilLine size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-900">
              <span className="font-semibold">Editing an existing evaluation</span>{" "}
              of {editTarget.student.user.name}, submitted{" "}
              {new Date(editTarget.createdAt).toLocaleDateString()} and scored{" "}
              {editTarget.totalRating}/{editTarget.maxTotalRating}. Saving
              replaces it — it does not add a new one.
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="shrink-0 px-3 py-1.5 rounded-lg border border-amber-400 bg-white text-amber-800 text-xs font-medium hover:bg-amber-100"
          >
            Cancel edit
          </button>
        </div>
      )}

      <div className="text-center border-b-2 border-gray-800 pb-3">
        <h2 className="text-sm md:text-lg font-bold tracking-wide text-gray-900">
          ON-THE-JOB TRAINING PERFORMANCE EVALUATION SHEET
        </h2>
      </div>

      {/* The form's own header block. */}
      <div className="space-y-3">
        {!isEditing && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name of the Trainee <span className="text-red-500">*</span>
            </label>
            <SelectField
              value={form.studentId}
              onChange={setStudentId}
              placeholder="Select the trainee to evaluate"
              options={students.map((s) => ({
                label: `${s.user.name} — ${s.studentIdNumber}${s.course ? ` (${s.course})` : ""}`,
                value: s.id,
                disabled: !canEvaluate(s),
                hint: canEvaluate(s)
                  ? undefined
                  : `OJT not completed (${s.completedHours} / ${s.requiredHours} hrs)`,
              }))}
              className="w-full"
            />
            {!hasEvaluable && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {students.length === 0
                  ? "No trainees are assigned to your establishment yet."
                  : "No trainee can be evaluated yet. Evaluation unlocks once a trainee's OJT is marked completed."}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {isEditing && (
            <FormFieldValue
              label="Name of the Trainee"
              value={traineeName}
              icon={User}
            />
          )}
          <FormFieldValue
            label="Training Employed at"
            value={employedAt}
            icon={Building2}
          />
          {/* Read-only: derived by the server (start date, last approved
              day) and frozen on the sheet when it is written. */}
          <FormFieldValue
            label="Training Date Started"
            value={formatDateOnly(trainingStartedAt, "")}
            icon={CalendarDays}
          />
          <FormFieldValue
            label="Training Date Ended"
            value={formatDateOnly(trainingEndedAt, "")}
            icon={CalendarDays}
          />
        </div>
      </div>

      {/* The scale, exactly as printed on the sheet. */}
      <div className="rounded-lg bg-gray-100 border border-gray-300 px-3 py-2.5">
        <div className="flex flex-wrap gap-x-5 gap-y-1 justify-center text-[11px] md:text-xs font-medium text-gray-700">
          {sheet.scale.map((s) => (
            <span key={s.value}>
              <span className="font-bold text-gray-900">({s.value})</span>{" "}
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {sheet.sections.map((section) => (
        <fieldset key={section.key} className="border border-gray-300 rounded-lg">
          <legend className="sr-only">
            {section.numeral}. {section.label}
          </legend>
          <div className="flex items-center justify-between gap-3 bg-gray-800 text-white px-3 py-2 rounded-t-lg">
            <h3 className="text-xs md:text-sm font-bold tracking-wide">
              {section.numeral}. {section.label} ({section.maxPoints} POINTS)
            </h3>
            <span className="text-xs font-semibold shrink-0 tabular-nums">
              {sectionTotals[section.key] ?? 0} / {section.maxPoints}
            </span>
          </div>

          <div className="divide-y divide-gray-200">
            {section.items.map((item) => {
              const value = form.scores[item.key] ?? "";
              return (
                <div
                  key={item.key}
                  className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 px-3 py-2.5"
                >
                  <div className="flex-1 text-sm text-gray-800">
                    <span className="font-semibold text-gray-500 mr-1.5">
                      {item.letter}.
                    </span>
                    {item.label}
                  </div>
                  <div
                    role="radiogroup"
                    aria-label={`${item.letter}. ${item.label}`}
                    className="flex gap-1.5 shrink-0"
                  >
                    {sheet.scale.map((s) => {
                      const selected = value === String(s.value);
                      return (
                        <label
                          key={s.value}
                          title={s.label}
                          className={`w-9 h-9 rounded-md border text-sm font-semibold flex items-center justify-center cursor-pointer transition-colors ${
                            selected
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "bg-white border-gray-300 text-gray-600 hover:bg-blue-50 hover:border-blue-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name={item.key}
                            value={s.value}
                            checked={selected}
                            onChange={() => {
                              setScore(item.key, s.value);
                            }}
                            className="sr-only"
                          />
                          {s.value}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      {/* TOTAL RATING, as printed at the foot of the sheet. */}
      <div className="rounded-lg border-2 border-gray-800 px-4 py-3 flex items-center justify-between">
        <span className="text-sm md:text-base font-bold tracking-wide text-gray-900">
          TOTAL RATING
        </span>
        <span className="text-xl md:text-2xl font-bold text-gray-900 tabular-nums">
          {totalRating}
          <span className="text-sm font-normal text-gray-500">
            {" "}
            / {sheet.maxTotalRating}
          </span>
        </span>
      </div>

      {!allScored && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
          <div className="flex items-start gap-2 text-sm text-amber-900">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <span className="font-medium">
                {scoredCount} of {totalItems} items scored.
              </span>{" "}
              Still to score:
              <ul className="mt-1 space-y-0.5">
                {incompleteSections.map((section) => (
                  <li key={section.key}>
                    {section.label} — {section.missing} item
                    {section.missing === 1 ? "" : "s"} ({section.letters.join(", ")})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <TextArea
          label="Comments"
          labelIcon={MessageSquare}
          fieldIcon={MessageSquare}
          value={form.comments}
          onChange={setHeaderField("comments")}
          placeholder="How did the trainee perform overall?"
          rows={3}
        />
        <TextArea
          label="Recommendations"
          labelIcon={ClipboardCheck}
          fieldIcon={ClipboardCheck}
          value={form.recommendations}
          onChange={setHeaderField("recommendations")}
          placeholder="What should they work on next?"
          rows={3}
        />
      </div>

      {/* The form's footer. Both are read-only: the server snapshots them from
          the signed-in supervisor. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 border-t border-gray-200 pt-4">
        <FormFieldValue label="Evaluated by" value={evaluator.name} icon={User} />
        <FormFieldValue label="Position" value={evaluator.position} />
      </div>

      {error && (
        <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* The end of the sheet, in the card and in the modal alike: the user
          scrolls past TOTAL RATING and the footer blanks, and these are the
          last thing on the page — not a bar pinned over the form. */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
        <button
          type="button"
          onClick={onCancelEdit}
          className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
        >
          {isEditing ? "Cancel edit" : "Reset"}
        </button>
        <div className="sm:w-60">
          <Button
            type="submit"
            icon={isEditing ? PencilLine : Send}
            loading={isSubmitting}
            disabled={!canSubmit}
          >
            {isEditing ? "Save Changes" : "Submit Evaluation"}
          </Button>
        </div>
      </div>
    </form>
  );
}

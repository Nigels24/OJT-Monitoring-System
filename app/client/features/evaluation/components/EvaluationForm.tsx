import { ClipboardCheck, CalendarDays, MessageSquare, Send } from "lucide-react";
import TextField from "@/components/ui/TextField";
import TextArea from "@/components/ui/TextArea";
import Button from "@/components/ui/Button";
import SelectField from "@/components/ui/SelectField";
import StatusBadge from "@/components/ui/StatusBadge";
import { SupervisorStudent } from "@/lib/api/supervisorApi";
import {
  CATEGORIES,
  SCORE_OPTIONS,
  levelBadgeVariant,
} from "../rubric";
import type { EvaluationFormValues } from "../hooks/use-evaluations";

interface EvaluationFormProps {
  form: EvaluationFormValues;
  error: string;
  preview: { rating: number; level: string } | null;
  students: SupervisorStudent[];
  isSubmitting: boolean;
  setField: (
    key: keyof EvaluationFormValues,
  ) => (e: { target: { value: string } }) => void;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
}

export default function EvaluationForm({
  form,
  error,
  preview,
  students,
  isSubmitting,
  setField,
  onSubmit,
  onReset,
}: EvaluationFormProps) {
  const setValue = (key: keyof EvaluationFormValues) => (value: string) => {
    setField(key)({ target: { value } });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Student <span className="text-red-500">*</span>
          </label>
          <SelectField
            value={form.studentId}
            onChange={setValue("studentId")}
            placeholder="Select a student to evaluate"
            options={students.map((s) => ({
              label: `${s.user.name} — ${s.studentIdNumber}${s.course ? ` (${s.course})` : ""}`,
              value: s.id,
            }))}
            className="w-full"
          />
        </div>
        <TextField
          label="Period Start"
          labelIcon={CalendarDays}
          fieldIcon={CalendarDays}
          type="date"
          value={form.periodStart}
          onChange={setField("periodStart")}
        />
        <TextField
          label="Period End"
          labelIcon={CalendarDays}
          fieldIcon={CalendarDays}
          type="date"
          value={form.periodEnd}
          onChange={setField("periodEnd")}
        />
        <div className="flex items-end">
          {/* Preview only — the stored rating is always the server's own
              calculation from the nine criteria. */}
          <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5">
            <div className="text-xs text-gray-500 mb-1">Overall rating</div>
            {preview ? (
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-gray-900">
                  {preview.rating.toFixed(1)}
                </span>
                <StatusBadge
                  label={preview.level}
                  variant={levelBadgeVariant(preview.level)}
                />
              </div>
            ) : (
              <span className="text-sm text-gray-400">
                Score every criterion
              </span>
            )}
          </div>
        </div>
      </div>

      {CATEGORIES.map((category) => (
        <fieldset
          key={category.key}
          className="border-l-4 border-blue-400 pl-4 md:pl-6"
        >
          <legend className="sr-only">{category.label}</legend>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 text-sm md:text-base">
              {category.label}
            </h3>
            <span className="text-xs text-gray-500">
              {Math.round(category.weight * 100)}% of overall
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {category.criteria.map((criterion) => (
              <div key={criterion.key}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {criterion.label} <span className="text-red-500">*</span>
                </label>
                <SelectField
                  value={form[criterion.key]}
                  onChange={setValue(criterion.key)}
                  placeholder="Rate 1–5"
                  options={SCORE_OPTIONS.map((o) => ({
                    label: o.label,
                    value: o.value,
                  }))}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <TextArea
          label="Comments"
          labelIcon={MessageSquare}
          fieldIcon={MessageSquare}
          value={form.comments}
          onChange={setField("comments")}
          placeholder="How did the student perform overall?"
          rows={3}
        />
        <TextArea
          label="Recommendations"
          labelIcon={ClipboardCheck}
          fieldIcon={ClipboardCheck}
          value={form.recommendations}
          onChange={setField("recommendations")}
          placeholder="What should they work on next?"
          rows={3}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
        <button
          type="button"
          onClick={onReset}
          className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
        >
          Reset
        </button>
        <div className="sm:w-52">
          <Button type="submit" icon={Send} loading={isSubmitting}>
            Submit Evaluation
          </Button>
        </div>
      </div>
    </form>
  );
}

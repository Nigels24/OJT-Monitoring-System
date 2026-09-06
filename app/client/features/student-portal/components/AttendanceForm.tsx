import { CalendarDays, Clock, Send, Sun, Moon, MessageSquare, Info } from "lucide-react";
import TextField from "@/components/ui/TextField";
import TextArea from "@/components/ui/TextArea";
import Button from "@/components/ui/Button";
import type { AttendanceFormValues } from "../hooks/use-attendance-log";

interface AttendanceFormProps {
  form: AttendanceFormValues;
  error: string;
  isSubmitting: boolean;
  /** Earliest loggable date — the student's OJT start date, if set. Undefined when the form is disabled. */
  minDate?: string;
  /** Latest loggable date — today. Undefined when the form is disabled. */
  maxDate?: string;
  /** True when the OJT period hasn't started yet, is complete, or bounds are unavailable — the whole form is inert. */
  disabled: boolean;
  /** Shown instead of the fields' normal helper text when disabled. */
  disabledMessage?: string;
  /** Non-blocking notice (e.g. past the scheduled end date but still working toward required hours) — form stays usable. */
  noticeMessage?: string;
  setField: (
    key: keyof AttendanceFormValues,
  ) => (e: { target: { value: string } }) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function AttendanceForm({
  form,
  error,
  isSubmitting,
  minDate,
  maxDate,
  disabled,
  disabledMessage,
  noticeMessage,
  setField,
  onSubmit,
}: AttendanceFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {disabledMessage && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
          <Info size={16} className="shrink-0 mt-0.5" />
          {disabledMessage}
        </p>
      )}
      {noticeMessage && (
        <p className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-start gap-2">
          <Info size={16} className="shrink-0 mt-0.5" />
          {noticeMessage}
        </p>
      )}

      {/* Total hours is deliberately not shown here — the client asked for the
          submit form to collect only the AM/PM times. The value is still
          computed and validated, just not displayed. */}
      <TextField
        label="Date"
        labelIcon={CalendarDays}
        fieldIcon={CalendarDays}
        type="date"
        required
        disabled={disabled}
        min={minDate}
        max={maxDate}
        value={form.date}
        onChange={setField("date")}
      />

      <fieldset className="border-l-4 border-amber-300 pl-4">
        <legend className="sr-only">Morning session</legend>
        <div className="flex items-center gap-2 mb-3">
          <Sun size={16} className="text-amber-500" />
          <h3 className="font-semibold text-gray-900 text-sm">
            Morning session
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <TextField
            label="Time In"
            labelIcon={Clock}
            fieldIcon={Clock}
            type="time"
            disabled={disabled}
            value={form.timeInAM}
            onChange={setField("timeInAM")}
          />
          <TextField
            label="Time Out"
            labelIcon={Clock}
            fieldIcon={Clock}
            type="time"
            disabled={disabled}
            value={form.timeOutAM}
            onChange={setField("timeOutAM")}
          />
        </div>
      </fieldset>

      <fieldset className="border-l-4 border-indigo-300 pl-4">
        <legend className="sr-only">Afternoon session</legend>
        <div className="flex items-center gap-2 mb-3">
          <Moon size={16} className="text-indigo-500" />
          <h3 className="font-semibold text-gray-900 text-sm">
            Afternoon session
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <TextField
            label="Time In"
            labelIcon={Clock}
            fieldIcon={Clock}
            type="time"
            disabled={disabled}
            value={form.timeInPM}
            onChange={setField("timeInPM")}
          />
          <TextField
            label="Time Out"
            labelIcon={Clock}
            fieldIcon={Clock}
            type="time"
            disabled={disabled}
            value={form.timeOutPM}
            onChange={setField("timeOutPM")}
          />
        </div>
      </fieldset>

      <TextArea
        label="Remarks (optional)"
        labelIcon={MessageSquare}
        fieldIcon={MessageSquare}
        disabled={disabled}
        value={form.remarks}
        onChange={setField("remarks")}
        placeholder="What did you work on?"
        rows={2}
      />

      {!disabled && (
        <p className="text-xs text-gray-500">
          Fill in at least one complete session. Your supervisor must approve
          a log before its hours count toward your required total, and you
          can only submit once per day.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="sm:w-56">
        <Button
          type="submit"
          icon={Send}
          loading={isSubmitting}
          disabled={disabled}
        >
          Submit Attendance
        </Button>
      </div>
    </form>
  );
}

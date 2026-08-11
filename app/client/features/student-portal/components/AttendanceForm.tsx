import { CalendarDays, Clock, Send, Sun, Moon, MessageSquare } from "lucide-react";
import TextField from "@/components/ui/TextField";
import TextArea from "@/components/ui/TextArea";
import Button from "@/components/ui/Button";
import type { AttendanceFormValues } from "../hooks/use-attendance-log";

interface AttendanceFormProps {
  form: AttendanceFormValues;
  error: string;
  isSubmitting: boolean;
  setField: (
    key: keyof AttendanceFormValues,
  ) => (e: { target: { value: string } }) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function AttendanceForm({
  form,
  error,
  isSubmitting,
  setField,
  onSubmit,
}: AttendanceFormProps) {
  // The server rejects future dates implicitly by being the record of what was
  // worked; keeping the picker capped at today avoids the obvious mistake.
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Total hours is deliberately not shown here — the client asked for the
          submit form to collect only the AM/PM times. The value is still
          computed and validated, just not displayed. */}
      <TextField
        label="Date"
        labelIcon={CalendarDays}
        fieldIcon={CalendarDays}
        type="date"
        required
        max={today}
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
            value={form.timeInAM}
            onChange={setField("timeInAM")}
          />
          <TextField
            label="Time Out"
            labelIcon={Clock}
            fieldIcon={Clock}
            type="time"
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
            value={form.timeInPM}
            onChange={setField("timeInPM")}
          />
          <TextField
            label="Time Out"
            labelIcon={Clock}
            fieldIcon={Clock}
            type="time"
            value={form.timeOutPM}
            onChange={setField("timeOutPM")}
          />
        </div>
      </fieldset>

      <TextArea
        label="Remarks (optional)"
        labelIcon={MessageSquare}
        fieldIcon={MessageSquare}
        value={form.remarks}
        onChange={setField("remarks")}
        placeholder="What did you work on?"
        rows={2}
      />

      <p className="text-xs text-gray-500">
        Fill in at least one complete session. Your supervisor must approve a
        log before its hours count toward your required total, and you can only
        submit once per day.
      </p>

      {error && (
        <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="sm:w-56">
        <Button type="submit" icon={Send} loading={isSubmitting}>
          Submit Attendance
        </Button>
      </div>
    </form>
  );
}

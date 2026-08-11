import { XCircle, X } from "lucide-react";
import TextArea from "@/components/ui/TextArea";
import Button from "@/components/ui/Button";
import { SupervisorAttendance } from "@/lib/api/supervisorApi";

interface DeclineDialogProps {
  target: SupervisorAttendance | null;
  reason: string;
  error: string;
  isSubmitting: boolean;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Declining requires a written reason — it is stored on the record and shown
 * to the student, so a plain yes/no confirm would not be enough.
 */
export default function DeclineDialog({
  target,
  reason,
  error,
  isSubmitting,
  onReasonChange,
  onConfirm,
  onCancel,
}: DeclineDialogProps) {
  if (!target) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <XCircle size={20} className="text-red-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Decline Attendance
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-4">
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm">
            <div className="font-semibold text-gray-900">
              {target.student.user.name}
            </div>
            <div className="text-gray-600">
              {new Date(target.date).toLocaleDateString()} · {target.hours} hrs
            </div>
            {target.remarks && (
              <div className="text-gray-500 mt-1">
                Student&apos;s note: {target.remarks}
              </div>
            )}
          </div>

          <TextArea
            label="Reason for declining"
            required
            value={reason}
            onChange={(e) => {
              onReasonChange(e.target.value);
            }}
            placeholder="e.g. Time out doesn't match the logbook — please resubmit."
            rows={3}
          />
          <p className="text-xs text-gray-500">
            The student sees this on their attendance history, so make it
            specific enough for them to fix.
          </p>

          {error && (
            <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <div className="sm:w-44">
              <Button
                type="button"
                icon={XCircle}
                loading={isSubmitting}
                onClick={onConfirm}
              >
                Decline log
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

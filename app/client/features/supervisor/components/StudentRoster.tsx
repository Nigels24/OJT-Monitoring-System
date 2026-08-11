import { useState } from "react";
import { Users, CheckCircle2, RotateCcw } from "lucide-react";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import ProgressBar from "@/components/ui/ProgressBar";
import StatusBadge from "@/components/ui/StatusBadge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  SupervisorStudent,
  useSetStudentStatusMutation,
} from "@/lib/api/supervisorApi";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";

interface StudentRosterProps {
  students: SupervisorStudent[];
  isLoading: boolean;
}

/**
 * The establishment's students, with the control that ends an OJT batch.
 *
 * Marking a student COMPLETED takes them and their logs out of the approval
 * queue so the next intake starts on a clean board. Nothing is deleted — the
 * records stay for the coordinator's reports and for any later dispute about
 * hours worked — and the action is reversible.
 */
export default function StudentRoster({
  students,
  isLoading,
}: StudentRosterProps) {
  const [target, setTarget] = useState<SupervisorStudent | null>(null);
  const [setStudentStatus] = useSetStudentStatusMutation();
  const { showSuccess, showError } = useSnackbar();

  const isCompleting = target?.status !== "COMPLETED";

  const handleConfirm = async () => {
    if (!target) return;
    const nextStatus = target.status === "COMPLETED" ? "ACTIVE" : "COMPLETED";
    try {
      await setStudentStatus({ id: target.id, status: nextStatus }).unwrap();
      showSuccess(
        nextStatus === "COMPLETED"
          ? `${target.user.name} marked as completed and moved out of the queue.`
          : `${target.user.name} is back in the active queue.`,
      );
      setTarget(null);
    } catch (err: unknown) {
      const data = (err as { data?: { message?: string | string[] } })?.data;
      const message = Array.isArray(data?.message)
        ? data.message.join(", ")
        : (data?.message ?? "Failed to update the student's status.");
      showError(message);
    }
  };

  const columns: DataTableColumn<SupervisorStudent>[] = [
    {
      key: "studentIdNumber",
      label: "ID",
      render: (r) => (
        <span className="font-mono text-xs text-gray-700">
          {r.studentIdNumber}
        </span>
      ),
    },
    {
      key: "name",
      label: "Student",
      render: (r) => (
        <div>
          <div className="font-semibold text-gray-900">{r.user.name}</div>
          <div className="text-xs text-gray-500">{r.user.email}</div>
        </div>
      ),
    },
    { key: "course", label: "Course", render: (r) => r.course || "—" },
    {
      key: "hours",
      label: "Hours",
      render: (r) => (
        <span className="whitespace-nowrap">
          {r.completedHours}/{r.requiredHours} hrs
        </span>
      ),
    },
    {
      key: "progress",
      label: "Progress",
      render: (r) => (
        <div className="min-w-28">
          <ProgressBar
            value={r.completedHours}
            max={r.requiredHours || 1}
            variant="thin"
            showLabel
            colorByValue
          />
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <StatusBadge
          label={r.status === "ACTIVE" ? "Active" : r.status}
          variant={
            r.status === "ACTIVE"
              ? "active"
              : r.status === "COMPLETED"
                ? "completed"
                : "neutral"
          }
        />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) =>
        r.status === "COMPLETED" ? (
          <button
            onClick={() => setTarget(r)}
            className="px-2 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1 text-xs font-medium"
            aria-label={`Reopen ${r.user.name}'s OJT`}
          >
            <RotateCcw size={14} />
            Reopen
          </button>
        ) : (
          <button
            onClick={() => setTarget(r)}
            className="px-2 py-1.5 rounded-md border border-green-200 text-green-700 hover:bg-green-50 inline-flex items-center gap-1 text-xs font-medium"
            aria-label={`Mark ${r.user.name}'s OJT complete`}
          >
            <CheckCircle2 size={14} />
            Mark Complete
          </button>
        ),
    },
  ];

  return (
    <>
      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : students.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">
          No students are assigned to your establishment yet.
        </p>
      ) : (
        <DataTable
          title=""
          icon={Users}
          columns={columns}
          data={students}
          keyField="id"
        />
      )}

      <ConfirmDialog
        open={!!target}
        title={isCompleting ? "Mark OJT as Complete?" : "Reopen this OJT?"}
        message={
          isCompleting
            ? `${target?.user.name} will be moved out of your approval queue so the next batch starts clean. Their ${target?.completedHours ?? 0} approved hours and every attendance record are kept, and you can reopen this at any time.`
            : `${target?.user.name} will go back into your active approval queue.`
        }
        confirmLabel={isCompleting ? "Mark complete" : "Reopen"}
        icon={isCompleting ? CheckCircle2 : RotateCcw}
        onConfirm={handleConfirm}
        onCancel={() => {
          setTarget(null);
        }}
      />
    </>
  );
}

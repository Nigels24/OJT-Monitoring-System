import { UserCog, X } from "lucide-react";
import SupervisorForm from "./SupervisorForm";
import type { CoordinatorSupervisor } from "@/lib/api/supervisorManagementApi";
import type { SupervisorForm as SupervisorFormValues } from "../hooks/use-supervisor-management";
import Overlay from "@/components/ui/Overlay";
import { optionalEstablishmentLabel } from "@/lib/establishment";

/** Edits an existing supervisor; they are created on the Establishments page. */
interface SupervisorFormDialogProps {
  /** The supervisor being edited; `null` = closed. */
  supervisor: CoordinatorSupervisor | null;
  form: SupervisorFormValues;
  isSaving: boolean;
  error: string;
  setField: (
    key: keyof SupervisorFormValues,
  ) => (e: { target: { value: string } }) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function SupervisorFormDialog({
  supervisor,
  form,
  isSaving,
  error,
  setField,
  onSubmit,
  onClose,
}: SupervisorFormDialogProps) {
  if (!supervisor) return null;

  return (
    <Overlay
      open
      label="Edit Supervisor"
      onClose={onClose}
      closeOnBackdrop={false}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <UserCog size={20} className="text-blue-600" />
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-gray-900">
                Edit Supervisor
              </h2>
              <p className="text-xs text-gray-500">
                {supervisor.user.username ?? supervisor.user.email} ·{" "}
                {optionalEstablishmentLabel(supervisor.establishment) ?? "No establishment"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <SupervisorForm
            form={form}
            isSaving={isSaving}
            error={error}
            setField={setField}
            onSubmit={onSubmit}
            onCancel={onClose}
          />
        </div>
      </div>
    </Overlay>
  );
}

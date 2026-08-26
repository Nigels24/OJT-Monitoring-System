import { UserCog, X } from "lucide-react";
import SupervisorForm from "./SupervisorForm";
import { Establishment } from "@/lib/api/establishmentApi";
import type { SupervisorForm as SupervisorFormValues } from "../hooks/use-supervisor-management";

interface SupervisorFormDialogProps {
  open: boolean;
  form: SupervisorFormValues;
  isCreating: boolean;
  error: string;
  establishments: Establishment[];
  setField: (
    key: keyof SupervisorFormValues,
  ) => (e: { target: { value: string } }) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function SupervisorFormDialog({
  open,
  form,
  isCreating,
  error,
  establishments,
  setField,
  onSubmit,
  onClose,
}: SupervisorFormDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <UserCog size={20} className="text-blue-600" />
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">
              Add Supervisor
            </h2>
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
            isCreating={isCreating}
            error={error}
            establishments={establishments}
            setField={setField}
            onSubmit={onSubmit}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}

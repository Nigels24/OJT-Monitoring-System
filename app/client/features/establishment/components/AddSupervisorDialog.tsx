import { UserPlus } from "lucide-react";
import FormDialog from "@/components/ui/FormDialog";
import Button from "@/components/ui/Button";
import type { Establishment } from "@/lib/api/establishmentApi";
import { establishmentLabel } from "@/lib/establishment";
import SupervisorFields from "./SupervisorFields";
import type { SupervisorFields as SupervisorFieldsState } from "../hooks/use-supervisor-fields";

interface AddSupervisorDialogProps {
  /** `null` = closed. */
  establishment: Establishment | null;
  supervisor: SupervisorFieldsState;
  isSubmitting: boolean;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

/**
 * Adds a supervisor to an establishment created without one. A `FormDialog`
 * (closes only on Escape or X), since it holds unsaved input. On success the
 * hook closes it and opens `CredentialsDialog` with the generated login.
 */
export default function AddSupervisorDialog({
  establishment,
  supervisor,
  isSubmitting,
  error,
  onSubmit,
  onClose,
}: AddSupervisorDialogProps) {
  return (
    <FormDialog
      open={!!establishment}
      title="Add Supervisor"
      subtitle={establishment ? establishmentLabel(establishment) : undefined}
      icon={UserPlus}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <SupervisorFields
          values={supervisor.values}
          setField={supervisor.setField}
          required
        />
        <p className="text-xs text-gray-500">
          A username and a temporary password are generated and shown to you
          once. The supervisor must choose their own password the first time
          they sign in.
        </p>

        {error && (
          <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            fullWidth={false}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            icon={UserPlus}
            fullWidth={false}
            loading={isSubmitting}
          >
            Add Supervisor
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}

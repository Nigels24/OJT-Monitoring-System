import { User, Mail, Briefcase, Save } from "lucide-react";
import TextField from "@/components/ui/TextField";
import Button from "@/components/ui/Button";
import type { SupervisorForm as SupervisorFormValues } from "../hooks/use-supervisor-management";

interface SupervisorFormProps {
  form: SupervisorFormValues;
  isSaving: boolean;
  error: string;
  setField: (
    key: keyof SupervisorFormValues,
  ) => (e: { target: { value: string } }) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export default function SupervisorForm({
  form,
  isSaving,
  error,
  setField,
  onSubmit,
  onCancel,
}: SupervisorFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <TextField
          label="First Name"
          labelIcon={User}
          fieldIcon={User}
          required
          value={form.firstName}
          onChange={setField("firstName")}
          placeholder="Juan"
        />
        <TextField
          label="Last Name"
          labelIcon={User}
          fieldIcon={User}
          required
          value={form.lastName}
          onChange={setField("lastName")}
          placeholder="Dela Cruz"
        />
        <TextField
          label="Middle Initial"
          labelIcon={User}
          fieldIcon={User}
          value={form.middleInitial}
          onChange={setField("middleInitial")}
          placeholder="P"
          maxLength={10}
        />
        <TextField
          label="Email Address"
          labelIcon={Mail}
          fieldIcon={Mail}
          type="email"
          required
          value={form.email}
          onChange={setField("email")}
          placeholder="supervisor@company.com"
        />
        <TextField
          label="Position"
          labelIcon={Briefcase}
          fieldIcon={Briefcase}
          value={form.position}
          onChange={setField("position")}
          placeholder="HR Manager"
        />
      </div>
      <p className="text-xs text-gray-500">
        Check the name parts before saving — the full name is rebuilt from
        them. The username and establishment don&apos;t change here; use Resend
        login for a new password.
      </p>

      {error && (
        <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
        >
          Cancel
        </button>
        <div className="sm:w-48">
          <Button type="submit" icon={Save} loading={isSaving}>
            Save Changes
          </Button>
        </div>
      </div>
    </form>
  );
}

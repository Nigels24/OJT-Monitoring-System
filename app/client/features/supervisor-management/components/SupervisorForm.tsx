import { User, Mail, Briefcase, UserPlus } from "lucide-react";
import TextField from "@/components/ui/TextField";
import Button from "@/components/ui/Button";
import SelectField from "@/components/ui/SelectField";
import { Establishment } from "@/lib/api/establishmentApi";
import type { SupervisorForm as SupervisorFormValues } from "../hooks/use-supervisor-management";

interface SupervisorFormProps {
  form: SupervisorFormValues;
  isCreating: boolean;
  error: string;
  establishments: Establishment[];
  setField: (
    key: keyof SupervisorFormValues,
  ) => (e: { target: { value: string } }) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export default function SupervisorForm({
  form,
  isCreating,
  error,
  establishments,
  setField,
  onSubmit,
  onCancel,
}: SupervisorFormProps) {
  const setValue = (key: keyof SupervisorFormValues) => (value: string) => {
    setField(key)({ target: { value } });
  };

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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Establishment
          </label>
          <SelectField
            value={form.establishmentId}
            onChange={setValue("establishmentId")}
            placeholder="Select Establishment"
            options={establishments.map((e) => ({
              label: e.name,
              value: e.id,
            }))}
            className="w-full"
          />
        </div>
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
        A username and a temporary password are generated when you add the
        supervisor, and shown to you once. The supervisor must choose their own
        password the first time they sign in.
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
          <Button type="submit" icon={UserPlus} loading={isCreating}>
            Add Supervisor
          </Button>
        </div>
      </div>
    </form>
  );
}

import { User, Mail, KeyRound, Briefcase, UserPlus } from "lucide-react";
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
          label="Full Name"
          labelIcon={User}
          fieldIcon={User}
          required
          value={form.name}
          onChange={setField("name")}
          placeholder="John Smith"
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
          label="Username"
          labelIcon={User}
          fieldIcon={User}
          required
          value={form.username}
          onChange={setField("username")}
          placeholder="e.g., john.smith"
          pattern="[a-zA-Z0-9._\-]{4,30}"
          title="4-30 characters: letters, numbers, dot, underscore or hyphen. No @ sign."
          autoComplete="off"
        />
        <TextField
          label="Password"
          labelIcon={KeyRound}
          fieldIcon={KeyRound}
          type="text"
          required
          value={form.password}
          onChange={setField("password")}
          placeholder="At least 8 characters"
          minLength={8}
          autoComplete="off"
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
        You choose the supervisor&apos;s username and password, then pass them
        on. The password is shown as plain text here so you can read it back
        to them — it is stored hashed and cannot be retrieved later.
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

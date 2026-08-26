import { Phone, MapPin, Save, X } from "lucide-react";
import TextField from "@/components/ui/TextField";
import TextArea from "@/components/ui/TextArea";
import Button from "@/components/ui/Button";
import type { ProfileFormValues } from "../hooks/use-profile";

interface ProfileEditFormProps {
  form: ProfileFormValues;
  error: string;
  isSubmitting: boolean;
  setField: (
    key: keyof ProfileFormValues,
  ) => (e: { target: { value: string } }) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export default function ProfileEditForm({
  form,
  error,
  isSubmitting,
  setField,
  onSubmit,
  onCancel,
}: ProfileEditFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <TextField
        label="Contact Number"
        labelIcon={Phone}
        fieldIcon={Phone}
        placeholder="09123456789"
        value={form.contactNumber}
        onChange={setField("contactNumber")}
      />

      <TextArea
        label="Address"
        labelIcon={MapPin}
        fieldIcon={MapPin}
        value={form.address}
        onChange={setField("address")}
        placeholder="House no., street, barangay, city"
        rows={3}
      />

      <p className="text-xs text-gray-500">
        Only your contact number and address can be updated here. Everything
        else on your profile is managed by your coordinator.
      </p>

      {error && (
        <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" icon={Save} loading={isSubmitting}>
          Save Changes
        </Button>
        <Button
          type="button"
          variant="secondary"
          icon={X}
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

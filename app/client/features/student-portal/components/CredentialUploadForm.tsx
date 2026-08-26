import { Upload } from "lucide-react";
import SelectField from "@/components/ui/SelectField";
import Button from "@/components/ui/Button";
import { CREDENTIAL_TYPES } from "@/lib/api/studentPortalApi";
import type { CredentialFormValues } from "../hooks/use-credentials";
import { CREDENTIAL_TYPE_LABEL } from "./credentialType";

interface CredentialUploadFormProps {
  form: CredentialFormValues;
  file: File | null;
  error: string;
  isSubmitting: boolean;
  setType: (type: string) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const TYPE_OPTIONS = CREDENTIAL_TYPES.map((value) => ({
  value,
  label: CREDENTIAL_TYPE_LABEL[value],
}));

export default function CredentialUploadForm({
  form,
  file,
  error,
  isSubmitting,
  setType,
  onFileChange,
  onSubmit,
}: CredentialUploadFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
          Credential Type
        </label>
        <SelectField
          value={form.type}
          onChange={setType}
          placeholder="Select a credential type"
          options={TYPE_OPTIONS}
        />
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
          <Upload size={15} className="text-blue-600" />
          File
        </label>
        <input
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          onChange={onFileChange}
          className="w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {file && (
          <p className="text-xs text-gray-500 mt-1.5">
            {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        )}
      </div>

      <p className="text-xs text-gray-500">
        PDF, PNG or JPEG, up to 10MB. Credentials have no review step —
        they&apos;re stored as soon as you upload them.
      </p>

      {error && (
        <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="sm:w-56">
        <Button type="submit" icon={Upload} loading={isSubmitting}>
          Upload Credential
        </Button>
      </div>
    </form>
  );
}

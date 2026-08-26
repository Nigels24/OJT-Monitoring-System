import { FileText, Upload } from "lucide-react";
import TextField from "@/components/ui/TextField";
import Button from "@/components/ui/Button";
import type { DocumentFormValues } from "../hooks/use-documents";

interface DocumentUploadFormProps {
  form: DocumentFormValues;
  file: File | null;
  error: string;
  isSubmitting: boolean;
  setField: (
    key: keyof DocumentFormValues,
  ) => (e: { target: { value: string } }) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function DocumentUploadForm({
  form,
  file,
  error,
  isSubmitting,
  setField,
  onFileChange,
  onSubmit,
}: DocumentUploadFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <TextField
        label="Document Name"
        labelIcon={FileText}
        fieldIcon={FileText}
        placeholder="e.g. Endorsement Letter"
        value={form.name}
        onChange={setField("name")}
      />

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
        PDF, PNG or JPEG, up to 10MB. Your coordinator reviews every upload
        before it counts as submitted.
      </p>

      {error && (
        <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="sm:w-56">
        <Button type="submit" icon={Upload} loading={isSubmitting}>
          Upload Document
        </Button>
      </div>
    </form>
  );
}

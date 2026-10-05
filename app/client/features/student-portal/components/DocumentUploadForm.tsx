import { Upload, FileText } from "lucide-react";
import SelectField from "@/components/ui/SelectField";
import Button from "@/components/ui/Button";
import { DOCUMENT_TYPES, DocumentType } from "@/lib/api/studentPortalApi";
import type { DocumentFormValues } from "../hooks/use-documents";
import { DOCUMENT_TYPE_LABEL } from "./documentType";

interface DocumentUploadFormProps {
  form: DocumentFormValues;
  file: File | null;
  /** Bumped by the hook to clear the uncontrolled file input. */
  fileInputKey: number;
  uploadedTypes: Set<DocumentType>;
  error: string;
  isSubmitting: boolean;
  setType: (type: string) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function DocumentUploadForm({
  form,
  file,
  fileInputKey,
  uploadedTypes,
  error,
  isSubmitting,
  setType,
  onFileChange,
  onSubmit,
}: DocumentUploadFormProps) {
  const typeOptions = DOCUMENT_TYPES.map((value) => ({
    value,
    label: uploadedTypes.has(value)
      ? `${DOCUMENT_TYPE_LABEL[value]} — uploaded, will replace`
      : DOCUMENT_TYPE_LABEL[value],
  }));

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
          <FileText size={15} className="text-blue-600" />
          Document Type
        </label>
        <SelectField
          value={form.type}
          onChange={setType}
          placeholder="Select a document type"
          options={typeOptions}
        />
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
          <Upload size={15} className="text-blue-600" />
          File
        </label>
        <input
          key={fileInputKey}
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
        PDF, PNG or JPEG, up to 10MB. Uploading a type you&apos;ve already
        submitted replaces that file.
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

import { FileText, RefreshCw, Trash2 } from "lucide-react";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import { StudentDocument, DocumentType } from "@/lib/api/studentPortalApi";
import FileLink from "@/components/ui/FileLink";
import { DOCUMENT_TYPE_LABEL } from "./documentType";

interface DocumentsTableProps {
  rows: StudentDocument[];
  isLoading: boolean;
  /** Disables Replace while an upload is in flight. */
  isUploading: boolean;
  onReplaceFile: (type: DocumentType, file: File) => void;
  onDelete: (doc: StudentDocument) => void;
  emptyMessage?: string;
}

export default function DocumentsTable({
  rows,
  isLoading,
  isUploading,
  onReplaceFile,
  onDelete,
  emptyMessage = "You haven't uploaded any documents yet.",
}: DocumentsTableProps) {
  const columns: DataTableColumn<StudentDocument>[] = [
    {
      key: "type",
      label: "Document",
      render: (r) => (
        <span className="font-semibold text-gray-900">
          {DOCUMENT_TYPE_LABEL[r.type]}
        </span>
      ),
    },
    {
      key: "fileName",
      label: "File",
      render: (r) => (
        <span className="text-gray-700 break-all">{r.fileName}</span>
      ),
    },
    {
      key: "uploadedAt",
      label: "Uploaded",
      render: (r) => (
        <span className="text-gray-600">
          {new Date(r.uploadedAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex gap-2">
          <FileLink href={r.fileUrl} label={DOCUMENT_TYPE_LABEL[r.type]} />
          {/* A label wrapping a hidden input opens the picker with no ref. */}
          <label
            className={`px-2 py-1.5 rounded-md border border-gray-200 text-gray-700 inline-flex items-center gap-1 text-xs font-medium ${
              isUploading
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-gray-50 cursor-pointer"
            }`}
            aria-label={`Replace ${DOCUMENT_TYPE_LABEL[r.type]}`}
          >
            <RefreshCw size={14} />
            Replace
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              className="sr-only"
              disabled={isUploading}
              onChange={(e) => {
                const chosen = e.target.files?.[0];
                // Cleared so picking the same file again still fires onChange.
                e.target.value = "";
                if (chosen) onReplaceFile(r.type, chosen);
              }}
            />
          </label>
          <button
            onClick={() => onDelete(r)}
            className="px-2 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 inline-flex items-center gap-1 text-xs font-medium"
            aria-label={`Delete ${DOCUMENT_TYPE_LABEL[r.type]}`}
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">
          {emptyMessage}
        </p>
      ) : (
        <DataTable
          title=""
          icon={FileText}
          columns={columns}
          data={rows}
          keyField="id"
        />
      )}
    </div>
  );
}

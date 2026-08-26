import { BadgeCheck, Eye, Trash2 } from "lucide-react";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import { StudentCredential } from "@/lib/api/studentPortalApi";
import { CREDENTIAL_TYPE_LABEL } from "./credentialType";

interface CredentialsTableProps {
  rows: StudentCredential[];
  isLoading: boolean;
  onDelete: (credential: StudentCredential) => void;
  emptyMessage?: string;
}

export default function CredentialsTable({
  rows,
  isLoading,
  onDelete,
  emptyMessage = "You haven't uploaded any credentials yet.",
}: CredentialsTableProps) {
  const columns: DataTableColumn<StudentCredential>[] = [
    {
      key: "type",
      label: "Credential",
      render: (r) => (
        <div className="font-semibold text-gray-900">
          {CREDENTIAL_TYPE_LABEL[r.type]}
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Uploaded",
      render: (r) => new Date(r.createdAt).toLocaleDateString(),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex gap-2">
          <a
            href={r.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1.5 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 inline-flex items-center gap-1 text-xs font-medium"
          >
            <Eye size={14} />
            View
          </a>
          <button
            onClick={() => onDelete(r)}
            className="px-2 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 inline-flex items-center gap-1 text-xs font-medium"
            aria-label={`Delete ${CREDENTIAL_TYPE_LABEL[r.type]}`}
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
          icon={BadgeCheck}
          columns={columns}
          data={rows}
          keyField="id"
        />
      )}
    </div>
  );
}

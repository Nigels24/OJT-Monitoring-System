import { FileText, Eye, Trash2 } from "lucide-react";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import StatusBadge, { BadgeVariant } from "@/components/ui/StatusBadge";
import { StudentDocument, DocumentStatus } from "@/lib/api/studentPortalApi";

interface DocumentsTableProps {
  rows: StudentDocument[];
  isLoading: boolean;
  onDelete: (doc: StudentDocument) => void;
  emptyMessage?: string;
}

const STATUS_VARIANT: Record<DocumentStatus, BadgeVariant> = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "declined",
};

const STATUS_LABEL: Record<DocumentStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export default function DocumentsTable({
  rows,
  isLoading,
  onDelete,
  emptyMessage = "You haven't uploaded any documents yet.",
}: DocumentsTableProps) {
  const columns: DataTableColumn<StudentDocument>[] = [
    {
      key: "name",
      label: "Document",
      render: (r) => (
        <div>
          <div className="font-semibold text-gray-900">{r.name}</div>
          <div className="text-xs text-gray-500">
            Uploaded {new Date(r.uploadedAt).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <div>
          <StatusBadge
            label={STATUS_LABEL[r.status]}
            variant={STATUS_VARIANT[r.status]}
          />
          {r.status === "REJECTED" && r.reviewNote && (
            <p className="text-xs text-red-600 mt-1 max-w-xs">
              <span className="font-medium">Reason:</span> {r.reviewNote}
            </p>
          )}
        </div>
      ),
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
          {r.status === "PENDING" && (
            <button
              onClick={() => onDelete(r)}
              className="px-2 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 inline-flex items-center gap-1 text-xs font-medium"
              aria-label={`Delete ${r.name}`}
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}
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

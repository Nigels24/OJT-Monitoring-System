import {
  Search,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Eye,
  FileText,
} from "lucide-react";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import StatusBadge, { BadgeVariant } from "@/components/ui/StatusBadge";
import SelectField from "@/components/ui/SelectField";
import { CoordinatorDocument } from "@/lib/api/documentApi";
import type { DocumentStatus } from "@/lib/api/studentPortalApi";

interface DocumentsReviewTableProps {
  rows: CoordinatorDocument[];
  isLoading: boolean;
  isError: boolean;
  search: string;
  statusFilter: DocumentStatus | "";
  page: number;
  totalPages: number;
  actioningId: string | null;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: DocumentStatus | "") => void;
  onPageChange: (page: number) => void;
  onApprove: (doc: CoordinatorDocument) => void;
  onReject: (doc: CoordinatorDocument) => void;
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

const STATUS_FILTER_OPTIONS = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "All Statuses", value: "" },
];

export default function DocumentsReviewTable({
  rows,
  isLoading,
  isError,
  search,
  statusFilter,
  page,
  totalPages,
  actioningId,
  onSearchChange,
  onStatusFilterChange,
  onPageChange,
  onApprove,
  onReject,
}: DocumentsReviewTableProps) {
  const columns: DataTableColumn<CoordinatorDocument>[] = [
    {
      key: "student",
      label: "Student",
      render: (r) => (
        <div>
          <div className="font-semibold text-gray-900">
            {r.student.user.name}
          </div>
          <div className="text-xs text-gray-500">
            {r.student.studentIdNumber}
          </div>
        </div>
      ),
    },
    {
      key: "establishment",
      label: "Establishment",
      render: (r) => r.student.establishment?.name ?? "—",
    },
    {
      key: "document",
      label: "Document",
      render: (r) => (
        <div>
          <div className="font-medium text-gray-900">{r.name}</div>
          <div className="text-xs text-gray-500">
            {new Date(r.uploadedAt).toLocaleDateString()}
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
      render: (r) => {
        const busy = actioningId === r.id;
        return (
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
              onClick={() => onApprove(r)}
              disabled={busy || r.status === "APPROVED"}
              className="px-2 py-1.5 rounded-md border border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-40 disabled:hover:bg-transparent inline-flex items-center gap-1 text-xs font-medium"
              aria-label={`Approve ${r.name}`}
            >
              <Check size={14} />
              Approve
            </button>
            <button
              onClick={() => onReject(r)}
              disabled={busy || r.status === "REJECTED"}
              className="px-2 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent inline-flex items-center gap-1 text-xs font-medium"
              aria-label={`Reject ${r.name}`}
            >
              <X size={14} />
              Reject
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(e) => {
              onSearchChange(e.target.value);
              onPageChange(1);
            }}
            placeholder="Search by student, ID, establishment or document..."
            className="w-full h-10 md:h-12 pl-9 md:pl-11 pr-3 md:pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-400"
          />
        </div>
        <div className="md:w-52">
          <SelectField
            value={statusFilter}
            onChange={(value) => {
              onStatusFilterChange(value as DocumentStatus | "");
              onPageChange(1);
            }}
            placeholder="Pending"
            options={STATUS_FILTER_OPTIONS}
            className="w-full"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : isError ? (
        <p className="text-red-600 text-sm py-8 text-center">
          Couldn&apos;t load documents. Please refresh to try again.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">
          {statusFilter === "PENDING"
            ? "Nothing waiting for review. You're all caught up."
            : "No documents match your filters."}
        </p>
      ) : (
        <>
          <DataTable
            title=""
            icon={FileText}
            columns={columns}
            data={rows}
            keyField="id"
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                disabled={page === 1}
                onClick={() => onPageChange(Math.max(1, page - 1))}
                className="p-2 rounded-md border border-gray-300 text-gray-500 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => onPageChange(n)}
                  className={`w-9 h-9 rounded-md text-sm font-medium ${
                    n === page
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                disabled={page === totalPages}
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                className="p-2 rounded-md border border-gray-300 text-gray-500 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

import {
  Search,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  CalendarCheck,
} from "lucide-react";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import StatusBadge, { BadgeVariant } from "@/components/ui/StatusBadge";
import SelectField from "@/components/ui/SelectField";
import { SupervisorAttendance } from "@/lib/api/supervisorApi";
import type { AttendanceStatus } from "@/lib/api/studentPortalApi";

interface ApprovalTableProps {
  rows: SupervisorAttendance[];
  isLoading: boolean;
  search: string;
  statusFilter: AttendanceStatus | "";
  page: number;
  totalPages: number;
  actioningId: string | null;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: AttendanceStatus | "") => void;
  onPageChange: (page: number) => void;
  onApprove: (record: SupervisorAttendance) => void;
  onDecline: (record: SupervisorAttendance) => void;
}

const STATUS_VARIANT: Record<AttendanceStatus, BadgeVariant> = {
  PENDING: "pending",
  APPROVED: "approved",
  DECLINED: "declined",
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  DECLINED: "Declined",
};

const STATUS_FILTER_OPTIONS = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Declined", value: "DECLINED" },
  { label: "All Statuses", value: "" },
];

function clock(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ApprovalTable({
  rows,
  isLoading,
  search,
  statusFilter,
  page,
  totalPages,
  actioningId,
  onSearchChange,
  onStatusFilterChange,
  onPageChange,
  onApprove,
  onDecline,
}: ApprovalTableProps) {
  const columns: DataTableColumn<SupervisorAttendance>[] = [
    {
      key: "date",
      label: "Date",
      render: (r) => (
        <span className="font-medium text-gray-900 whitespace-nowrap">
          {new Date(r.date).toLocaleDateString()}
        </span>
      ),
    },
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
            {r.student.course ? ` · ${r.student.course}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "am",
      label: "AM (in — out)",
      render: (r) => (
        <span className="whitespace-nowrap">
          {clock(r.timeInAM)} — {clock(r.timeOutAM)}
        </span>
      ),
    },
    {
      key: "pm",
      label: "PM (in — out)",
      render: (r) => (
        <span className="whitespace-nowrap">
          {clock(r.timeInPM)} — {clock(r.timeOutPM)}
        </span>
      ),
    },
    {
      key: "hours",
      label: "Hours",
      render: (r) => (
        <span className="font-semibold text-gray-900">{r.hours}</span>
      ),
    },
    {
      key: "remarks",
      label: "Remarks",
      render: (r) => (
        <div className="max-w-xs">
          <span className="text-gray-600">{r.remarks || "—"}</span>
          {r.status === "DECLINED" && r.declineReason && (
            <p className="text-xs text-red-600 mt-1">
              <span className="font-medium">Declined:</span> {r.declineReason}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <StatusBadge
          label={STATUS_LABEL[r.status]}
          variant={STATUS_VARIANT[r.status]}
        />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => {
        const busy = actioningId === r.id;
        return (
          <div className="flex gap-2">
            <button
              onClick={() => onApprove(r)}
              disabled={busy || r.status === "APPROVED"}
              className="px-2 py-1.5 rounded-md border border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-40 disabled:hover:bg-transparent inline-flex items-center gap-1 text-xs font-medium"
              aria-label={`Approve ${r.student.user.name}'s log`}
            >
              <Check size={14} />
              Approve
            </button>
            <button
              onClick={() => onDecline(r)}
              disabled={busy || r.status === "DECLINED"}
              className="px-2 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent inline-flex items-center gap-1 text-xs font-medium"
              aria-label={`Decline ${r.student.user.name}'s log`}
            >
              <X size={14} />
              Decline
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
            placeholder="Search by student name, ID or course..."
            className="w-full h-10 md:h-12 pl-9 md:pl-11 pr-3 md:pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-400"
          />
        </div>
        <div className="md:w-52">
          <SelectField
            value={statusFilter}
            onChange={(value) => {
              onStatusFilterChange(value as AttendanceStatus | "");
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
      ) : rows.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">
          {statusFilter === "PENDING"
            ? "Nothing waiting for approval. You're all caught up."
            : "No attendance records match your filters."}
        </p>
      ) : (
        <>
          <DataTable
            title=""
            icon={CalendarCheck}
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

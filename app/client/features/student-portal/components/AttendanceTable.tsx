import { ChevronLeft, ChevronRight, CalendarCheck } from "lucide-react";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import StatusBadge, { BadgeVariant } from "@/components/ui/StatusBadge";
import { AttendanceRecord, AttendanceStatus } from "@/lib/api/studentPortalApi";

interface AttendanceTableProps {
  rows: AttendanceRecord[];
  isLoading: boolean;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  emptyMessage?: string;
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

/** `HH:mm` in the viewer's timezone, or an em dash when the slot is unused. */
function clock(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AttendanceTable({
  rows,
  isLoading,
  page,
  totalPages,
  onPageChange,
  emptyMessage = "No attendance logged yet.",
}: AttendanceTableProps) {
  const columns: DataTableColumn<AttendanceRecord>[] = [
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
      key: "day",
      label: "Day",
      render: (r) =>
        new Date(r.date).toLocaleDateString([], { weekday: "short" }),
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
      label: "Total Hours",
      render: (r) => (
        <span className="font-semibold text-gray-900">{r.hours}</span>
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
      key: "remarks",
      label: "Remarks",
      render: (r) => (
        <div className="max-w-xs">
          <span className="text-gray-600">{r.remarks || "—"}</span>
          {/* A declined log is only actionable if the student can see why. */}
          {r.status === "DECLINED" && r.declineReason && (
            <p className="text-xs text-red-600 mt-1">
              <span className="font-medium">Declined:</span> {r.declineReason}
            </p>
          )}
        </div>
      ),
    },
  ];

  if (isLoading) {
    return <p className="text-gray-400 text-sm">Loading...</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="text-gray-500 text-sm py-8 text-center">{emptyMessage}</p>
    );
  }

  return (
    <>
      <DataTable
        title=""
        icon={CalendarCheck}
        columns={columns}
        data={rows}
        keyField="id"
      />

      {onPageChange && totalPages && totalPages > 1 && page && (
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
  );
}

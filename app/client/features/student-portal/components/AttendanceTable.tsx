import { ChevronLeft, ChevronRight, CalendarCheck } from "lucide-react";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import PunchStamp from "@/components/ui/PunchStamp";
import { AttendanceDay } from "@/lib/api/studentPortalApi";
import {
  DAY_STATUS_LABEL,
  DAY_STATUS_VARIANT,
  SESSIONS,
} from "@/lib/attendance";
import { formatDateOnly, formatWeekdayOnly } from "@/lib/format";

interface AttendanceTableProps {
  rows: AttendanceDay[];
  isLoading: boolean;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  emptyMessage?: string;
}

/** Attendance history, one row per day. Also the student dashboard's recent list. */
export default function AttendanceTable({
  rows,
  isLoading,
  page,
  totalPages,
  onPageChange,
  emptyMessage = "No attendance logged yet.",
}: AttendanceTableProps) {
  const columns: DataTableColumn<AttendanceDay>[] = [
    {
      key: "date",
      label: "Date",
      render: (r) => (
        <div className="whitespace-nowrap">
          <div className="font-medium text-gray-900">
            {formatDateOnly(r.date)}
          </div>
          <div className="text-xs text-gray-500">
            {formatWeekdayOnly(r.date)}
          </div>
        </div>
      ),
    },
    // In above Out in one cell per session. A declined punch carries its
    // reason inline — never behind a hover — since it is only actionable if
    // the student can see why.
    ...SESSIONS.map((session) => ({
      key: session.label,
      label: session.label,
      render: (r: AttendanceDay) => (
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-xs text-gray-500 w-7 pt-1">In</span>
            <PunchStamp punch={r.punches[session.inKind]} showReason />
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xs text-gray-500 w-7 pt-1">Out</span>
            <PunchStamp punch={r.punches[session.outKind]} showReason />
          </div>
        </div>
      ),
    })),
    // No Hours column — removed at the client's request (CLAUDE.md §8 item
    // 29). Hours are shown as the running totals on the dashboard and the
    // stat cards, which is what tells the student how far through their
    // requirement they are.
    {
      key: "status",
      label: "Day Status",
      render: (r) => (
        <StatusBadge
          label={DAY_STATUS_LABEL[r.dayStatus]}
          variant={DAY_STATUS_VARIANT[r.dayStatus]}
        />
      ),
    },
    {
      key: "remarks",
      label: "Remarks",
      render: (r) => (
        <span className="text-gray-600 block max-w-xs">{r.remarks || "—"}</span>
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

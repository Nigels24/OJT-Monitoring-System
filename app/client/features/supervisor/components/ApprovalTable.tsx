import {
  Search,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  CalendarCheck,
  Loader2,
} from "lucide-react";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import SelectField from "@/components/ui/SelectField";
import PunchStamp from "@/components/ui/PunchStamp";
import { SupervisorAttendance } from "@/lib/api/supervisorApi";
import type { Punch, PunchKind } from "@/lib/api/studentPortalApi";
import {
  DAY_STATUS_LABEL,
  DAY_STATUS_VARIANT,
  PUNCH_LABEL,
} from "@/lib/attendance";
import { formatDateOnly } from "@/lib/format";
import type { QueueFilter } from "../hooks/use-attendance-approval";

interface ApprovalTableProps {
  rows: SupervisorAttendance[];
  isLoading: boolean;
  search: string;
  filter: QueueFilter;
  page: number;
  totalPages: number;
  actioningId: string | null;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: QueueFilter) => void;
  onPageChange: (page: number) => void;
  onApprove: (day: SupervisorAttendance, punch: Punch) => void;
  onDecline: (day: SupervisorAttendance, punch: Punch) => void;
}

const FILTER_OPTIONS = [
  { label: "Has pending punches", value: "PENDING" },
  { label: "All", value: "" },
];

const PUNCH_COLUMNS: { kind: PunchKind; label: string }[] = [
  { kind: "TIME_IN_AM", label: "Morning In" },
  { kind: "TIME_OUT_AM", label: "Morning Out" },
  { kind: "TIME_IN_PM", label: "Afternoon In" },
  { kind: "TIME_OUT_PM", label: "Afternoon Out" },
];

/**
 * One row per student-day, one column per punch. Only a PENDING punch has
 * Approve/Decline buttons — decisions are final, so a decided punch shows its
 * result (and, on hover, who decided it) and nothing to click.
 */
export default function ApprovalTable({
  rows,
  isLoading,
  search,
  filter,
  page,
  totalPages,
  actioningId,
  onSearchChange,
  onFilterChange,
  onPageChange,
  onApprove,
  onDecline,
}: ApprovalTableProps) {
  const renderPunchCell = (kind: PunchKind, r: SupervisorAttendance) => {
    const punch = r.punches[kind];
    if (!punch || punch.status !== "PENDING") {
      return <PunchStamp punch={punch} showReason />;
    }
    const busy = actioningId === punch.id;
    const label = `${PUNCH_LABEL[kind]} for ${r.student.user.name}`;
    return (
      <div className="space-y-1.5">
        <PunchStamp punch={punch} />
        <div className="flex gap-1.5">
          <button
            onClick={() => onApprove(r, punch)}
            disabled={busy}
            title={`Approve ${PUNCH_LABEL[kind]}`}
            aria-label={`Approve ${label}`}
            className="p-1.5 rounded-md border border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-40"
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Check size={14} />
            )}
          </button>
          <button
            onClick={() => onDecline(r, punch)}
            disabled={busy}
            title={`Decline ${PUNCH_LABEL[kind]}`}
            aria-label={`Decline ${label}`}
            className="p-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  };

  const columns: DataTableColumn<SupervisorAttendance>[] = [
    {
      key: "student",
      label: "Student",
      render: (r) => (
        <div className="min-w-36">
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
      key: "date",
      label: "Date",
      render: (r) => (
        <div>
          <div className="font-medium text-gray-900 whitespace-nowrap">
            {formatDateOnly(r.date)}
          </div>
          {r.remarks && (
            <div
              className="text-xs text-gray-500 max-w-48 mt-0.5"
              title="The student's note"
            >
              Note: {r.remarks}
            </div>
          )}
        </div>
      ),
    },
    ...PUNCH_COLUMNS.map(({ kind, label }) => ({
      key: kind,
      label,
      render: (r: SupervisorAttendance) => renderPunchCell(kind, r),
    })),
    {
      key: "hours",
      label: "Hours",
      render: (r) => (
        <div className="whitespace-nowrap">
          <div className="font-semibold text-gray-900">
            {r.approvedHours} hrs
          </div>
          {r.pendingHours > 0 && (
            <div className="text-xs text-gray-500">
              {r.pendingHours} pending
            </div>
          )}
        </div>
      ),
    },
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
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by student name, ID or course..."
            className="w-full h-10 md:h-12 pl-9 md:pl-11 pr-3 md:pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-400"
          />
        </div>
        <div className="md:w-56">
          <SelectField
            value={filter}
            onChange={(value) => onFilterChange(value as QueueFilter)}
            options={FILTER_OPTIONS}
            className="w-full"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">
          {filter === "PENDING" && !search.trim()
            ? "No punches waiting for approval. You're all caught up."
            : "No attendance matches your filters."}
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

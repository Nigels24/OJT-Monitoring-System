import { Search, ChevronLeft, ChevronRight, CalendarCheck } from "lucide-react";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import ProgressBar from "@/components/ui/ProgressBar";
import { AttendanceOversightRow } from "@/lib/api/attendanceOversightApi";

interface AttendanceOversightTableProps {
  rows: AttendanceOversightRow[];
  isLoading: boolean;
  isError: boolean;
  search: string;
  page: number;
  totalPages: number;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  emptyMessage?: string;
}

export default function AttendanceOversightTable({
  rows,
  isLoading,
  isError,
  search,
  page,
  totalPages,
  onSearchChange,
  onPageChange,
  emptyMessage = "No students match your filters.",
}: AttendanceOversightTableProps) {
  const columns: DataTableColumn<AttendanceOversightRow>[] = [
    {
      key: "student",
      label: "Student",
      render: (r) => (
        <div>
          <div className="font-semibold text-gray-900">{r.name}</div>
          <div className="font-mono text-xs text-gray-500">
            {r.studentIdNumber}
          </div>
        </div>
      ),
    },
    {
      key: "establishment",
      label: "Establishment",
      render: (r) => r.establishmentName ?? "—",
    },
    {
      key: "attendancePercentage",
      label: "Attendance Percentage",
      render: (r) =>
        // No start date, or one still in the future: there is no window to
        // measure, and a 0% bar would read as "never turned up".
        r.attendancePercentage === null ? (
          <span className="text-gray-400">—</span>
        ) : (
          <div className="min-w-[10rem]">
            <ProgressBar
              value={r.attendancePercentage}
              variant="thin"
              colorByValue
            />
            <div className="text-xs text-gray-500 mt-1">
              {r.presentDays} of {r.totalDays} day
              {r.totalDays === 1 ? "" : "s"}
            </div>
          </div>
        ),
    },
  ];

  return (
    <div>
      <div className="relative mb-4">
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
          placeholder="Search by student, ID or establishment..."
          className="w-full h-10 md:h-12 pl-9 md:pl-11 pr-3 md:pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-400"
        />
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : isError ? (
        // A failed request must not fall through to the empty state below — an
        // "no students" table and a programme that genuinely has none would
        // otherwise be indistinguishable.
        <p className="text-red-600 text-sm py-8 text-center">
          Couldn&apos;t load attendance. Please refresh to try again.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">{emptyMessage}</p>
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

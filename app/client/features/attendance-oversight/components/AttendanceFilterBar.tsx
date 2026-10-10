import { FilterX } from "lucide-react";
import SelectField from "@/components/ui/SelectField";
import {
  STATUS_LABEL,
  currentManilaMonth,
  monthLabel,
  type AttendanceOversight,
} from "../hooks/use-attendance-oversight";

/** How many months back the month picker offers, counting the current one. */
const MONTHS_OFFERED = 18;

/** `YYYY-MM` for the current Manila month and the ones before it. */
function recentMonths(count: number): string[] {
  const [year, month] = currentManilaMonth().split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

interface AttendanceFilterBarProps {
  oversight: AttendanceOversight;
}

/**
 * Month, establishment, course, year level and status, plus "Showing X of Y"
 * and Clear filters — laid out like the Student Management page's filter row.
 *
 * Month is a select of recent months rather than `<input type="month">`,
 * which desktop Safari renders as a plain text box. Picking one refetches with
 * `?month=`; "All time" keeps today's all-time figures. Every other filter is
 * client-side, with options taken from the loaded rows.
 */
export default function AttendanceFilterBar({
  oversight: o,
}: AttendanceFilterBarProps) {
  const all = (label: string) => ({ label, value: "" });

  return (
    <div className="mb-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <SelectField
          value={o.month}
          onChange={o.setMonth}
          placeholder="All time"
          options={[
            all("All time"),
            ...recentMonths(MONTHS_OFFERED).map((m) => ({
              label: monthLabel(m),
              value: m,
            })),
          ]}
          className="w-full"
        />
        <SelectField
          value={o.establishmentId}
          onChange={o.setEstablishmentId}
          placeholder="All Establishments"
          options={[all("All Establishments"), ...o.options.establishments]}
          className="w-full"
        />
        <SelectField
          value={o.course}
          onChange={o.setCourse}
          placeholder="All Courses"
          options={[
            all("All Courses"),
            ...o.options.courses.map((v) => ({ label: v, value: v })),
          ]}
          className="w-full"
        />
        <SelectField
          value={o.yearLevel}
          onChange={o.setYearLevel}
          placeholder="All Year Levels"
          options={[
            all("All Year Levels"),
            ...o.options.yearLevels.map((v) => ({ label: v, value: v })),
          ]}
          className="w-full"
        />
        <SelectField
          value={o.status}
          onChange={o.setStatus}
          placeholder="All Statuses"
          options={[
            all("All Statuses"),
            ...Object.entries(STATUS_LABEL).map(([value, label]) => ({
              label,
              value,
            })),
          ]}
          className="w-full"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
        <span>
          Showing {o.shownCount} of {o.totalCount} student
          {o.totalCount === 1 ? "" : "s"}
          {o.month ? ` · figures for ${monthLabel(o.month)}` : " · all-time figures"}
          {o.isFetching && !o.isLoading ? " · updating…" : ""}
        </span>
        {o.isFiltered && (
          <button
            type="button"
            onClick={o.clearFilters}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50"
          >
            <FilterX size={14} />
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

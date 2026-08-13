import { useMemo, useState } from "react";
import { useGetAttendanceOversightQuery } from "@/lib/api/attendanceOversightApi";

/**
 * Longer than the 5 used by StudentList/EstablishmentList: this table is three
 * columns of plain text, so a fuller page still reads cleanly. Matches the
 * coordinator's evaluations list.
 */
const PAGE_SIZE = 10;

/** Below this an attendance percentage counts as at risk, matching ProgressBar's amber/red split. */
const AT_RISK_THRESHOLD = 80;

export function useAttendanceOversight() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data: rows, isLoading, isError } = useGetAttendanceOversightQuery();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows ?? [];
    return (rows ?? []).filter((r) =>
      [r.name, r.studentIdNumber, r.establishmentName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [rows, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    const all = rows ?? [];
    // Students with no measurable window (no start date, or one still in the
    // future) carry a null percentage and are left out of both figures — an
    // unknown is not a zero.
    const measured = all
      .map((r) => r.attendancePercentage)
      .filter((p): p is number => p !== null);

    return {
      total: all.length,
      averageAttendance:
        measured.length === 0
          ? null
          : Math.round(
              measured.reduce((sum, p) => sum + p, 0) / measured.length,
            ),
      atRisk: measured.filter((p) => p < AT_RISK_THRESHOLD).length,
    };
  }, [rows]);

  return {
    rows,
    isLoading,
    isError,
    search,
    page,
    paged,
    totalPages,
    filtered,
    stats,

    setSearch,
    setPage,
  };
}

import { useMemo, useState } from "react";
import {
  AttendanceOversightRow,
  useGetAttendanceOversightQuery,
} from "@/lib/api/attendanceOversightApi";
import { downloadFile } from "@/lib/api/fileDownload";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";

/**
 * Longer than the 5 used by StudentList/EstablishmentList: this table is three
 * columns of plain text, so a fuller page still reads cleanly. Matches the
 * coordinator's evaluations list.
 */
const PAGE_SIZE = 10;

/** Below this an attendance percentage counts as at risk, matching ProgressBar's amber/red split. */
const AT_RISK_THRESHOLD = 80;

/** The establishment filter's value for students with no establishment. */
export const NO_ESTABLISHMENT = "__none__";

export const STATUS_LABEL: Record<AttendanceOversightRow["status"], string> = {
  ACTIVE: "Active",
  PENDING: "Pending",
  COMPLETED: "Completed",
  INACTIVE: "Inactive",
};

/** The current month on Manila's calendar, `YYYY-MM` — never the browser's zone. */
export function currentManilaMonth(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })
    .slice(0, 7);
}

/** "2026-10" -> "October 2026", read in UTC so the month can't shift. */
export function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Distinct non-empty values, sorted. */
function distinct(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort((a, b) =>
    a.localeCompare(b),
  );
}

/**
 * Attendance oversight with filters and the per-student DTR download.
 *
 * `month` is the only server-side filter: it changes the computed figures,
 * so it is a query argument (one cache entry per month). Establishment,
 * course, year level, status and search filter the loaded rows client-side,
 * and their options are the distinct values present in those rows — so a
 * filter never offers something that matches nothing, and costs no request.
 */
export function useAttendanceOversight() {
  const { showError } = useSnackbar();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  /** `""` = no month: all-time figures. */
  const [month, setMonthState] = useState("");
  const [establishmentId, setEstablishmentState] = useState("");
  const [course, setCourseState] = useState("");
  const [yearLevel, setYearLevelState] = useState("");
  const [status, setStatusState] = useState("");
  /** The row whose DTR is downloading — one at a time, its button spins. */
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const {
    data: rows,
    isLoading,
    isFetching,
    isError,
  } = useGetAttendanceOversightQuery(month || undefined);

  // Every filter change returns to page 1, in the handler. These are passed
  // to the table as-is; `setSearch` and `setPage` are plain, stable state
  // setters (F7's lesson: an inline arrow per render re-runs any effect that
  // depends on it).
  const setMonth = (value: string) => {
    setMonthState(value);
    setPage(1);
  };
  const setEstablishmentId = (value: string) => {
    setEstablishmentState(value);
    setPage(1);
  };
  const setCourse = (value: string) => {
    setCourseState(value);
    setPage(1);
  };
  const setYearLevel = (value: string) => {
    setYearLevelState(value);
    setPage(1);
  };
  const setStatus = (value: string) => {
    setStatusState(value);
    setPage(1);
  };

  const all = useMemo(() => rows ?? [], [rows]);

  const options = useMemo(() => {
    const establishments = new Map<string, string>();
    let hasUnassigned = false;
    for (const r of all) {
      if (r.establishmentId && r.establishmentName) {
        establishments.set(r.establishmentId, r.establishmentName);
      } else {
        hasUnassigned = true;
      }
    }
    return {
      establishments: [
        ...[...establishments]
          .sort((a, b) => a[1].localeCompare(b[1]))
          .map(([value, label]) => ({ label, value })),
        ...(hasUnassigned
          ? [{ label: "No establishment", value: NO_ESTABLISHMENT }]
          : []),
      ],
      courses: distinct(all.map((r) => r.course)),
      yearLevels: distinct(all.map((r) => r.yearLevel)),
    };
  }, [all]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((r) => {
      if (
        term &&
        ![r.name, r.studentIdNumber, r.establishmentName]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term)
      ) {
        return false;
      }
      if (establishmentId === NO_ESTABLISHMENT && r.establishmentId) {
        return false;
      }
      if (
        establishmentId &&
        establishmentId !== NO_ESTABLISHMENT &&
        r.establishmentId !== establishmentId
      ) {
        return false;
      }
      if (course && r.course !== course) return false;
      if (yearLevel && r.yearLevel !== yearLevel) return false;
      if (status && r.status !== status) return false;
      return true;
    });
  }, [all, search, establishmentId, course, yearLevel, status]);

  const isFiltered =
    !!month ||
    search.trim() !== "" ||
    !!establishmentId ||
    !!course ||
    !!yearLevel ||
    !!status;

  const clearFilters = () => {
    setMonthState("");
    setSearch("");
    setEstablishmentState("");
    setCourseState("");
    setYearLevelState("");
    setStatusState("");
    setPage(1);
  };

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /**
   * The stat cards follow the filters, so they describe the rows on screen
   * (and the month, when one is picked).
   */
  const stats = useMemo(() => {
    // Students with no measurable window carry a null percentage and are left
    // out of both figures — an unknown is not a zero.
    const measured = filtered
      .map((r) => r.attendancePercentage)
      .filter((p): p is number => p !== null);

    return {
      total: filtered.length,
      averageAttendance:
        measured.length === 0
          ? null
          : Math.round(
              measured.reduce((sum, p) => sum + p, 0) / measured.length,
            ),
      atRisk: measured.filter((p) => p < AT_RISK_THRESHOLD).length,
    };
  }, [filtered]);

  /** The month a DTR download uses: the picked one, else Manila's current month. */
  const dtrMonth = month || currentManilaMonth();

  const downloadDtr = async (row: AttendanceOversightRow) => {
    if (downloadingId) return;
    setDownloadingId(row.id);
    try {
      await downloadFile(
        `/coordinator/students/${encodeURIComponent(row.id)}/dtr?month=${dtrMonth}`,
        `${row.name} - DTR ${dtrMonth}.pdf`,
      );
    } catch (err: unknown) {
      showError(
        err instanceof Error ? err.message : "Couldn't download the DTR.",
      );
    } finally {
      setDownloadingId(null);
    }
  };

  return {
    rows,
    isLoading,
    /** True while a new month's figures load — the table dims, not blanks. */
    isFetching,
    isError,
    search,
    page,
    paged,
    totalPages,
    filtered,
    stats,

    month,
    establishmentId,
    course,
    yearLevel,
    status,
    options,
    isFiltered,
    shownCount: filtered.length,
    totalCount: all.length,

    dtrMonth,
    dtrMonthLabel: monthLabel(dtrMonth),
    downloadingId,
    downloadDtr,

    setSearch,
    setPage,
    setMonth,
    setEstablishmentId,
    setCourse,
    setYearLevel,
    setStatus,
    clearFilters,
  };
}

export type AttendanceOversight = ReturnType<typeof useAttendanceOversight>;

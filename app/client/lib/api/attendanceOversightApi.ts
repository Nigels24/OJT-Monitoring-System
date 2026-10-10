import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./baseQuery";

/**
 * The coordinator's cross-establishment attendance view — read-only.
 *
 * Distinct from `supervisorApi`'s approval queue, which is scoped to one
 * establishment and writes; this only reports.
 */
export interface AttendanceOversightRow {
  id: string;
  studentIdNumber: string;
  name: string;
  course: string | null;
  yearLevel: string | null;
  status: "ACTIVE" | "PENDING" | "COMPLETED" | "INACTIVE";
  establishmentId: string | null;
  establishmentName: string | null;
  /**
   * Days in the window with at least one approved session. The window is
   * [startDate, today] — or, with a month, [max(month start, startDate),
   * min(month end, today)] (Manila calendar).
   */
  presentDays: number;
  /** Calendar days in the window, inclusive; 0 when it is empty or there is no start date. */
  totalDays: number;
  /** Hours of the approved sessions in the window. */
  approvedHours: number;
  /**
   * null when there is no window to measure against (no start date, a start
   * date after the window, a future month). Render it as "—", never as 0%.
   */
  attendancePercentage: number | null;
}

export const attendanceOversightApi = createApi({
  reducerPath: "attendanceOversightApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: ["AttendanceOversight"],
  endpoints: (builder) => ({
    /**
     * `month` (`YYYY-MM`) recomputes the figures for that month and is the
     * only server-side filter — every other filter is client-side over these
     * rows. One cache entry per month; all share the tag, so a student
     * delete still invalidates every month.
     */
    getAttendanceOversight: builder.query<
      AttendanceOversightRow[],
      string | undefined
    >({
      query: (month) =>
        month
          ? `/coordinator/attendance?month=${encodeURIComponent(month)}`
          : "/coordinator/attendance",
      providesTags: ["AttendanceOversight"],
    }),
  }),
});

export const { useGetAttendanceOversightQuery } = attendanceOversightApi;

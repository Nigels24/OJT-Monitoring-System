import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./baseQuery";

/**
 * Coordinator dashboard aggregates.
 *
 * Every field is derived from real rows. Figures the prototype showed but that
 * have no data source yet — unread messages, pending documents — are absent
 * rather than zero, so the UI can't imply an unbuilt feature is working.
 */

/**
 * Declared as a type alias, not an interface: TrendChart takes
 * `Record<string, string | number>[]`, and only type aliases get the implicit
 * index signature that makes them assignable to it.
 */
export type AttendanceTrendPoint = {
  /** MM-DD of the week's Monday. */
  label: string;
  approved: number;
  pending: number;
  declined: number;
};

export interface TopEstablishment {
  id: string;
  name: string;
  studentCount: number;
}

export interface RecentStudent {
  id: string;
  studentIdNumber: string;
  name: string;
  course: string | null;
  establishment: string | null;
  startDate: string | null;
  requiredHours: number;
  completedHours: number;
  status: string;
}

export interface CoordinatorDashboard {
  /**
   * Sections whose queries failed. The endpoint returns empty defaults for
   * these rather than a 500, so the page renders what loaded and offers a
   * retry. One of "stats", "attendanceTrend", "topEstablishments",
   * "recentStudents".
   */
  failedSections: string[];
  stats: {
    totalStudents: number;
    activeStudents: number;
    completedStudents: number;
    partnerEstablishments: number;
    activeEstablishments: number;
    presentToday: number;
    pendingApprovals: number;
    totalHoursLogged: number;
    /**
     * Average TOTAL RATING of the official evaluation sheet, out of
     * `maxTotalRating`. null when nothing has been evaluated — distinct from an
     * average of 0. The old `averageLevel` performance band is gone with the
     * retired rubric.
     */
    averageRating: number | null;
    /**
     * The currently published sheet's maximum, or null when the school has not
     * published one. Evaluations written on an earlier version were scored out
     * of that version's maximum, so the average is only strictly comparable
     * against this number while every sheet shares a version.
     */
    maxTotalRating: number | null;
    totalEvaluations: number;
  };
  attendanceTrend: AttendanceTrendPoint[];
  topEstablishments: TopEstablishment[];
  recentStudents: RecentStudent[];
}

export const dashboardApi = createApi({
  reducerPath: "dashboardApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: ["Dashboard"],
  endpoints: (builder) => ({
    getCoordinatorDashboard: builder.query<CoordinatorDashboard, void>({
      query: () => "/coordinator/dashboard",
      providesTags: ["Dashboard"],
    }),
  }),
});

export const { useGetCoordinatorDashboardQuery } = dashboardApi;

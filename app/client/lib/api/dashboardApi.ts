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
  stats: {
    totalStudents: number;
    activeStudents: number;
    completedStudents: number;
    partnerEstablishments: number;
    activeEstablishments: number;
    presentToday: number;
    pendingApprovals: number;
    totalHoursLogged: number;
    /** null when nothing has been evaluated — distinct from an average of 0. */
    averageRating: number | null;
    averageLevel: string | null;
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

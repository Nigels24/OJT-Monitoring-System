import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./baseQuery";
import type { AttendanceStatus } from "./studentPortalApi";

/** The signed-in supervisor's view of their establishment (`/supervisor/*`). */

export interface SupervisorAttendance {
  id: string;
  date: string;
  timeInAM: string | null;
  timeOutAM: string | null;
  timeInPM: string | null;
  timeOutPM: string | null;
  remarks: string | null;
  declineReason: string | null;
  status: AttendanceStatus;
  createdAt: string;
  hours: number;
  student: {
    id: string;
    studentIdNumber: string;
    course: string | null;
    requiredHours: number;
    user: { name: string; email: string };
  };
  approvedBy: { id: string; user: { name: string } } | null;
}

export interface SupervisorDashboard {
  supervisor: {
    id: string;
    name: string;
    email: string;
    position: string | null;
  };
  establishment: {
    id: string;
    name: string;
    industryType: string | null;
  } | null;
  stats: {
    totalStudents: number;
    activeStudents: number;
    pendingApprovals: number;
    approvedThisWeek: number;
    declinedCount: number;
    totalApprovedHours: number;
  };
}

export interface SupervisorStudent {
  id: string;
  studentIdNumber: string;
  course: string | null;
  yearLevel: string | null;
  requiredHours: number;
  status: string;
  completedHours: number;
  user: { id: string; email: string; name: string };
}

export const supervisorApi = createApi({
  reducerPath: "supervisorApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: ["SupervisorAttendance", "SupervisorDashboard"],
  endpoints: (builder) => ({
    getSupervisorDashboard: builder.query<SupervisorDashboard, void>({
      query: () => "/supervisor/dashboard",
      providesTags: ["SupervisorDashboard"],
    }),
    getSupervisorStudents: builder.query<SupervisorStudent[], void>({
      query: () => "/supervisor/students",
    }),
    getSupervisorAttendance: builder.query<
      SupervisorAttendance[],
      AttendanceStatus | undefined
    >({
      query: (status) =>
        status ? `/supervisor/attendance?status=${status}` : "/supervisor/attendance",
      providesTags: ["SupervisorAttendance"],
    }),
    approveAttendance: builder.mutation<SupervisorAttendance, string>({
      query: (id) => ({
        url: `/supervisor/attendance/${id}/approve`,
        method: "PATCH",
      }),
      // Approving changes the dashboard counters too.
      invalidatesTags: ["SupervisorAttendance", "SupervisorDashboard"],
    }),
    declineAttendance: builder.mutation<
      SupervisorAttendance,
      { id: string; reason: string }
    >({
      query: ({ id, reason }) => ({
        url: `/supervisor/attendance/${id}/decline`,
        method: "PATCH",
        body: { reason },
      }),
      invalidatesTags: ["SupervisorAttendance", "SupervisorDashboard"],
    }),
  }),
});

export const {
  useGetSupervisorDashboardQuery,
  useGetSupervisorStudentsQuery,
  useGetSupervisorAttendanceQuery,
  useApproveAttendanceMutation,
  useDeclineAttendanceMutation,
} = supervisorApi;

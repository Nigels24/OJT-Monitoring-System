import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./baseQuery";
import type {
  AttendanceDay,
  AttendanceStatus,
  Punch,
} from "./studentPortalApi";

/** The signed-in supervisor's view of their establishment (`/supervisor/*`). */

/** One student's day, punches nested — the same day shape the student reads. */
export interface SupervisorAttendance extends AttendanceDay {
  student: {
    id: string;
    studentIdNumber: string;
    course: string | null;
    requiredHours: number;
    user: { name: string; email: string };
  };
}

export interface SupervisorDashboard {
  /** Sections whose queries failed — "students" and/or "attendance". */
  failedSections: string[];
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
    completedStudents: number;
    /** Punches, not days — each is its own decision. Active students only. */
    pendingApprovals: number;
    /** Punches approved since Monday, by decision time. */
    approvedThisWeek: number;
    declinedCount: number;
    /** Sessions with both punches approved, across all students. */
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
  /** The evaluation sheet's Training Date Started / Ended prefill. */
  startDate: string | null;
  endDate: string | null;
  user: { id: string; email: string; name: string };
}

export const supervisorApi = createApi({
  reducerPath: "supervisorApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: [
    "SupervisorAttendance",
    "SupervisorDashboard",
    "SupervisorStudent",
  ],
  endpoints: (builder) => ({
    getSupervisorDashboard: builder.query<SupervisorDashboard, void>({
      query: () => "/supervisor/dashboard",
      providesTags: ["SupervisorDashboard"],
    }),
    getSupervisorStudents: builder.query<SupervisorStudent[], void>({
      query: () => "/supervisor/students",
      providesTags: ["SupervisorStudent"],
    }),
    /**
     * Marks an OJT finished, or reopens it.
     *
     * COMPLETED students drop out of the approval queue so the next intake
     * starts clean — their attendance records are kept, not deleted.
     */
    setStudentStatus: builder.mutation<
      SupervisorStudent,
      { id: string; status: "ACTIVE" | "COMPLETED" }
    >({
      query: ({ id, status }) => ({
        url: `/supervisor/students/${id}/status`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: [
        "SupervisorStudent",
        "SupervisorAttendance",
        "SupervisorDashboard",
      ],
    }),
    /**
     * Days at this establishment. `PENDING` narrows to days with at least one
     * punch still awaiting a decision; omitted returns every day.
     */
    getSupervisorAttendance: builder.query<
      SupervisorAttendance[],
      AttendanceStatus | undefined
    >({
      query: (status) =>
        status
          ? `/supervisor/attendance?status=${status}`
          : "/supervisor/attendance",
      providesTags: ["SupervisorAttendance"],
    }),
    /** Decisions are final — the server 409s on a punch that isn't PENDING. */
    approvePunch: builder.mutation<Punch & { attendanceId: string }, string>({
      query: (id) => ({
        url: `/supervisor/punches/${id}/approve`,
        method: "PATCH",
      }),
      // The queue, the dashboard counters, and the roster's completed hours
      // all move on an approval (the roster used to go stale here).
      invalidatesTags: [
        "SupervisorAttendance",
        "SupervisorDashboard",
        "SupervisorStudent",
      ],
    }),
    declinePunch: builder.mutation<
      Punch & { attendanceId: string },
      { id: string; reason: string }
    >({
      query: ({ id, reason }) => ({
        url: `/supervisor/punches/${id}/decline`,
        method: "PATCH",
        body: { reason },
      }),
      invalidatesTags: [
        "SupervisorAttendance",
        "SupervisorDashboard",
        "SupervisorStudent",
      ],
    }),
  }),
});

export const {
  useGetSupervisorDashboardQuery,
  useGetSupervisorStudentsQuery,
  useSetStudentStatusMutation,
  useGetSupervisorAttendanceQuery,
  useApprovePunchMutation,
  useDeclinePunchMutation,
} = supervisorApi;

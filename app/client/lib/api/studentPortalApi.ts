import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./baseQuery";

/**
 * The signed-in student's own view of their record (`/student/*`).
 *
 * Distinct from `studentApi`, which is the coordinator managing every student
 * through `/coordinator/students`.
 */

export type AttendanceStatus = "PENDING" | "APPROVED" | "DECLINED";

export interface AttendanceRecord {
  id: string;
  date: string;
  timeInAM: string | null;
  timeOutAM: string | null;
  timeInPM: string | null;
  timeOutPM: string | null;
  remarks: string | null;
  status: AttendanceStatus;
  createdAt: string;
  /** Derived server-side from the four clock fields. */
  hours: number;
}

export interface StudentDashboard {
  id: string;
  studentIdNumber: string;
  course: string | null;
  yearLevel: string | null;
  school: string | null;
  contactNumber: string | null;
  address: string | null;
  requiredHours: number;
  startDate: string | null;
  status: string;
  user: { id: string; email: string; name: string };
  establishment: {
    id: string;
    name: string;
    industryType: string | null;
    coordinatorFirstName: string | null;
    coordinatorLastName: string | null;
    coordinatorContact: string | null;
    coordinatorEmail: string | null;
  } | null;
  stats: {
    completedHours: number;
    pendingHours: number;
    requiredHours: number;
    remainingHours: number;
    totalLogs: number;
    approvedCount: number;
    pendingCount: number;
    declinedCount: number;
  };
  recentAttendance: AttendanceRecord[];
  _count: { documents: number; credentials: number };
}

export interface SubmitAttendanceRequest {
  /** Calendar day, `yyyy-mm-dd`. */
  date: string;
  /** Full ISO timestamps — the server stores real instants, not clock strings. */
  timeInAM?: string;
  timeOutAM?: string;
  timeInPM?: string;
  timeOutPM?: string;
  remarks?: string;
}

export const studentPortalApi = createApi({
  reducerPath: "studentPortalApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: ["MyDashboard", "MyAttendance"],
  endpoints: (builder) => ({
    getMyDashboard: builder.query<StudentDashboard, void>({
      query: () => "/student/dashboard",
      providesTags: ["MyDashboard"],
    }),
    getMyAttendance: builder.query<AttendanceRecord[], void>({
      query: () => "/student/attendance",
      providesTags: ["MyAttendance"],
    }),
    submitAttendance: builder.mutation<
      AttendanceRecord,
      SubmitAttendanceRequest
    >({
      query: (body) => ({
        url: "/student/attendance",
        method: "POST",
        body,
      }),
      // A new log changes the dashboard totals too.
      invalidatesTags: ["MyAttendance", "MyDashboard"],
    }),
  }),
});

export const {
  useGetMyDashboardQuery,
  useGetMyAttendanceQuery,
  useSubmitAttendanceMutation,
} = studentPortalApi;

import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./baseQuery";
import type {
  AttendanceDay,
  AttendanceStatus,
  Punch,
} from "./studentPortalApi";
import type {
  CredentialsEmailStatus,
  EmailOutcome,
  GeneratedCredentials,
  ResendCredentialsResponse,
} from "./studentApi";
import { messagesApi } from "./messagesApi";

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
    branch: string | null;
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
  /** Approved hours: sessions with both punches APPROVED. */
  completedHours: number;
  /**
   * Date-only. What a new evaluation's Training Date Started will be — the
   * server derives and stores it; the form only displays it.
   */
  startDate: string | null;
  /**
   * Date-only: the latest day with an approved session, or `null`. What a new
   * evaluation's Training Date Ended will be (server-derived, display only).
   */
  lastApprovedDay: string | null;
  user: { id: string; email: string; name: string } & CredentialsEmailStatus;
}

/**
 * A student created by the signed-in supervisor. No `establishmentId` — the
 * server always uses the supervisor's own — and no username, password, year
 * level or hours: generated or derived server-side. `course` is one of the
 * offered labels (`lib/courses.ts`).
 */
export interface CreateSupervisorStudentRequest {
  studentIdNumber: string;
  firstName: string;
  middleInitial?: string;
  lastName: string;
  email: string;
  course: string;
  contactNumber?: string;
  address?: string;
  /** yyyy-mm-dd */
  startDate?: string;
}

/** The roster row, plus the one-time login. */
export type CreateSupervisorStudentResponse = SupervisorStudent &
  EmailOutcome & {
    credentials: GeneratedCredentials;
  };

/**
 * The decided punch, plus whether this approval took the student's approved
 * hours across their requirement and so set them COMPLETED (ACTIVE students
 * only, and only on the approval that crosses). `completedStudent` is `null`
 * unless `studentCompleted`.
 */
export type ApprovePunchResponse = Punch & {
  attendanceId: string;
  studentCompleted: boolean;
  completedStudent: {
    name: string;
    approvedHours: number;
    requiredHours: number;
  } | null;
};

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
     * Creates a student at this supervisor's establishment and returns the
     * generated login once. The roster (also the evaluation page's student
     * list) and the dashboard's counts gain a row, and so do this
     * supervisor's message contacts.
     *
     * The coordinator's student list, dashboard, establishment counts and
     * oversight also change, but those caches live in a different login's
     * store — they refetch on the coordinator's next load (CLAUDE.md §8
     * item 22).
     */
    createSupervisorStudent: builder.mutation<
      CreateSupervisorStudentResponse,
      CreateSupervisorStudentRequest
    >({
      query: (body) => ({
        url: "/supervisor/students",
        method: "POST",
        body,
      }),
      invalidatesTags: ["SupervisorStudent", "SupervisorDashboard"],
      async onQueryStarted(_body, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(messagesApi.util.invalidateTags(["Contacts"]));
        } catch {
          // Create failed — nothing else to invalidate.
        }
      },
    }),
    /**
     * "Resend login" for one of this establishment's students, emailed.
     * Invalidates the roster for the row's email badge.
     */
    resendSupervisorStudentCredentials: builder.mutation<
      ResendCredentialsResponse,
      string
    >({
      query: (id) => ({
        url: `/supervisor/students/${id}/resend-credentials`,
        method: "POST",
      }),
      invalidatesTags: ["SupervisorStudent"],
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
    approvePunch: builder.mutation<ApprovePunchResponse, string>({
      query: (id) => ({
        url: `/supervisor/punches/${id}/approve`,
        method: "PATCH",
      }),
      // The queue, the dashboard counters, and the roster's completed hours
      // all move on an approval (the roster used to go stale here). An
      // approval that auto-completes a student needs nothing more: the queue
      // hides COMPLETED students, the dashboard counts them, and the roster
      // (SupervisorStudent) is also the evaluation picker's source.
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
  useCreateSupervisorStudentMutation,
  useResendSupervisorStudentCredentialsMutation,
  useGetSupervisorAttendanceQuery,
  useApprovePunchMutation,
  useDeclinePunchMutation,
} = supervisorApi;

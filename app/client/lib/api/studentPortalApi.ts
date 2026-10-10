import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./baseQuery";

/**
 * The signed-in student's own view of their record (`/student/*`).
 *
 * Distinct from `studentApi`, which is the coordinator managing every student
 * through `/coordinator/students`.
 */

export type AttendanceStatus = "PENDING" | "APPROVED" | "DECLINED";

/** Mirrors the server's `PunchKind` enum, in the order a day is lived. */
export const PUNCH_KINDS = [
  "TIME_IN_AM",
  "TIME_OUT_AM",
  "TIME_IN_PM",
  "TIME_OUT_PM",
] as const;

export type PunchKind = (typeof PUNCH_KINDS)[number];

/** One clock event, stamped by the server and decided on its own. */
export interface Punch {
  id: string;
  kind: PunchKind;
  /** A real instant (ISO), stamped by the server. */
  time: string;
  status: AttendanceStatus;
  /** The supervisor's explanation, set only when status is DECLINED. */
  declineReason: string | null;
  /** `null` while pending, and on punches migrated from the old per-day model. */
  decidedAt: string | null;
  decidedBy: { id: string; user: { name: string } } | null;
}

/** Every kind as a key; `null` where nothing was punched. */
export type PunchMap = Record<PunchKind, Punch | null>;

/**
 * Derived by the server, never stored: PENDING (a punch awaits a decision),
 * PARTIAL (something declined, a session approved), DECLINED, APPROVED (all
 * approved, at least one complete session), INCOMPLETE (no complete session).
 */
export type DayStatus =
  "PENDING" | "PARTIAL" | "DECLINED" | "APPROVED" | "INCOMPLETE";

/** One day with its punches, as history and the dashboard read it. */
export interface AttendanceDay {
  id: string;
  /** UTC midnight of the Manila day — render with formatDateOnly. */
  date: string;
  /** The student's own note. Never a decline reason — those are per punch. */
  remarks: string | null;
  createdAt: string;
  punches: PunchMap;
  dayStatus: DayStatus;
  /** Sessions with both punches approved — the hours that count. */
  approvedHours: number;
  /** Sessions with both punches present, none declined, not yet both approved. */
  pendingHours: number;
}

/**
 * Today's punch card. `allowed` is the server's verdict per kind — `true`, or
 * the reason it can't be punched now, shown verbatim. The client holds no
 * copy of the punch rules.
 */
export interface TodayAttendance {
  date: string;
  attendanceId: string | null;
  remarks: string | null;
  punches: PunchMap;
  /** `null` when nothing has been logged today yet. */
  dayStatus: DayStatus | null;
  approvedHours: number;
  pendingHours: number;
  allowed: Record<PunchKind, true | string>;
  /** Completed OJT, no establishment, or before the start date — blocks every punch. */
  blockedReason: string | null;
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
    branch: string | null;
    industryType: string | null;
    /**
     * The contact card: the establishment's supervisor. All three `null`
     * when the establishment has no supervisor yet.
     */
    supervisorName: string | null;
    supervisorPosition: string | null;
    supervisorEmail: string | null;
  } | null;
  stats: {
    completedHours: number;
    pendingHours: number;
    requiredHours: number;
    remainingHours: number;
    /** Days logged. */
    totalLogs: number;
    /** Punch counts, not days — each punch is its own decision. */
    approvedCount: number;
    pendingCount: number;
    declinedCount: number;
  };
  recentAttendance: AttendanceDay[];
  _count: { documents: number };
}

export interface StudentProfile {
  id: string;
  studentIdNumber: string;
  course: string | null;
  yearLevel: string | null;
  school: string | null;
  firstName: string | null;
  lastName: string | null;
  middleInitial: string | null;
  contactNumber: string | null;
  address: string | null;
  requiredHours: number;
  startDate: string | null;
  status: string;
  user: { id: string; email: string; name: string };
  establishment: { id: string; name: string; branch?: string | null } | null;
}

/** The only two fields a student may edit on their own record. */
export interface UpdateProfileRequest {
  /** `null` clears the field; omitting it leaves the stored value alone. */
  contactNumber?: string | null;
  address?: string | null;
}

/** Mirrors the server's `DocumentType` enum, in the same order — keep both in sync by hand. */
export const DOCUMENT_TYPES = [
  "APPLICATION_LETTER",
  "ENDORSEMENT_LETTER",
  "RESUME",
  "MOA",
  "PARENTS_CONSENT",
  "WAIVER",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** One file per type: a second upload of the same type replaces this row's file. */
export interface StudentDocument {
  id: string;
  type: DocumentType;
  /** Display name, resolved server-side from the original upload. */
  fileName: string;
  /**
   * Short-lived signed URL, minted per request. `null` when the stored object
   * is missing — the row is shown as unavailable rather than the whole list
   * failing to load.
   */
  fileUrl: string | null;
  /** Bumped when the file is replaced. */
  uploadedAt: string;
}

export const studentPortalApi = createApi({
  reducerPath: "studentPortalApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: ["MyDashboard", "MyAttendance", "MyProfile", "MyDocuments"],
  endpoints: (builder) => ({
    getMyDashboard: builder.query<StudentDashboard, void>({
      query: () => "/student/dashboard",
      providesTags: ["MyDashboard"],
    }),
    getAttendanceHistory: builder.query<AttendanceDay[], void>({
      query: () => "/student/attendance",
      providesTags: ["MyAttendance"],
    }),
    getTodayAttendance: builder.query<TodayAttendance, void>({
      query: () => "/student/attendance/today",
      providesTags: ["MyAttendance"],
    }),
    /** `{ kind }` only — the server stamps the time and the day. */
    punch: builder.mutation<TodayAttendance, { kind: PunchKind }>({
      query: (body) => ({
        url: "/student/attendance/punch",
        method: "POST",
        body,
      }),
      // Today, history and the dashboard's counts and hours all move.
      invalidatesTags: ["MyAttendance", "MyDashboard"],
    }),
    updateTodayRemarks: builder.mutation<
      TodayAttendance,
      { remarks: string | null }
    >({
      query: (body) => ({
        url: "/student/attendance/today/remarks",
        method: "PATCH",
        body,
      }),
      // The dashboard's recent-attendance table shows remarks too.
      invalidatesTags: ["MyAttendance", "MyDashboard"],
    }),
    getMyProfile: builder.query<StudentProfile, void>({
      query: () => "/student/profile",
      providesTags: ["MyProfile"],
    }),
    updateMyProfile: builder.mutation<StudentProfile, UpdateProfileRequest>({
      query: (body) => ({
        url: "/student/profile",
        method: "PATCH",
        body,
      }),
      // The dashboard's spread of the student record carries contactNumber
      // and address too, so it goes stale alongside the profile.
      invalidatesTags: ["MyProfile", "MyDashboard"],
    }),
    getMyDocuments: builder.query<StudentDocument[], void>({
      query: () => "/student/documents",
      providesTags: ["MyDocuments"],
    }),
    /**
     * `body` is a FormData with `type` and `file` fields. Upserts on type: an
     * already-uploaded type has its file replaced, not a second row added.
     */
    uploadDocument: builder.mutation<StudentDocument, FormData>({
      query: (body) => ({
        url: "/student/documents",
        method: "POST",
        body,
      }),
      // The dashboard's _count.documents changes on every upload too.
      invalidatesTags: ["MyDocuments", "MyDashboard"],
    }),
    deleteDocument: builder.mutation<{ id: string; deleted: boolean }, string>({
      query: (id) => ({
        url: `/student/documents/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["MyDocuments", "MyDashboard"],
    }),
  }),
});

export const {
  useGetMyDashboardQuery,
  useGetAttendanceHistoryQuery,
  useGetTodayAttendanceQuery,
  usePunchMutation,
  useUpdateTodayRemarksMutation,
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
  useGetMyDocumentsQuery,
  useUploadDocumentMutation,
  useDeleteDocumentMutation,
} = studentPortalApi;

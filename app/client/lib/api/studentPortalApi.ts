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
  /** The student's own note. */
  remarks: string | null;
  /** The supervisor's explanation when status is DECLINED. */
  declineReason: string | null;
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

export interface StudentProfile {
  id: string;
  studentIdNumber: string;
  course: string | null;
  yearLevel: string | null;
  school: string | null;
  firstName: string | null;
  lastName: string | null;
  middleInitial: string | null;
  age: number | null;
  dateOfBirth: string | null;
  gender: string | null;
  contactNumber: string | null;
  address: string | null;
  requiredHours: number;
  startDate: string | null;
  endDate: string | null;
  status: string;
  user: { id: string; email: string; name: string };
  establishment: { id: string; name: string } | null;
}

/** The only two fields a student may edit on their own record. */
export interface UpdateProfileRequest {
  contactNumber?: string;
  address?: string;
}

export type DocumentStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface StudentDocument {
  id: string;
  name: string;
  /** A freshly minted 1-hour signed URL, never the raw storage path. */
  fileUrl: string;
  status: DocumentStatus;
  /** The coordinator's explanation, set only when status is REJECTED. */
  reviewNote: string | null;
  reviewedAt: string | null;
  uploadedAt: string;
}

/** Mirrors the server's CREDENTIAL_TYPES — no Prisma enum, so keep both lists in sync by hand. */
export const CREDENTIAL_TYPES = [
  "RESUME",
  "ENDORSEMENT_LETTER",
  "MEDICAL_CERTIFICATE",
  "PARENTAL_CONSENT",
  "INSURANCE",
  "CERTIFICATE_OF_REGISTRATION",
  "OTHER",
] as const;

export type CredentialType = (typeof CREDENTIAL_TYPES)[number];

export interface StudentCredential {
  id: string;
  type: CredentialType;
  /** A freshly minted 1-hour signed URL, never the raw storage path. */
  fileUrl: string;
  createdAt: string;
}

export const studentPortalApi = createApi({
  reducerPath: "studentPortalApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: [
    "MyDashboard",
    "MyAttendance",
    "MyProfile",
    "MyDocuments",
    "MyCredentials",
  ],
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
    /** `body` is a FormData with `name` and `file` fields — see the Documents upload form. */
    uploadDocument: builder.mutation<StudentDocument, FormData>({
      query: (body) => ({
        url: "/student/documents",
        method: "POST",
        body,
      }),
      // The dashboard's _count.documents changes on every upload too.
      invalidatesTags: ["MyDocuments", "MyDashboard"],
    }),
    deleteDocument: builder.mutation<{ id: string; deleted: boolean }, string>(
      {
        query: (id) => ({
          url: `/student/documents/${id}`,
          method: "DELETE",
        }),
        invalidatesTags: ["MyDocuments", "MyDashboard"],
      },
    ),
    getMyCredentials: builder.query<StudentCredential[], void>({
      query: () => "/student/credentials",
      providesTags: ["MyCredentials"],
    }),
    /** `body` is a FormData with `type` and `file` fields — see the Credentials upload form. */
    uploadCredential: builder.mutation<StudentCredential, FormData>({
      query: (body) => ({
        url: "/student/credentials",
        method: "POST",
        body,
      }),
      // The dashboard's _count.credentials changes on every upload too.
      invalidatesTags: ["MyCredentials", "MyDashboard"],
    }),
    deleteCredential: builder.mutation<
      { id: string; deleted: boolean },
      string
    >({
      query: (id) => ({
        url: `/student/credentials/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["MyCredentials", "MyDashboard"],
    }),
  }),
});

export const {
  useGetMyDashboardQuery,
  useGetMyAttendanceQuery,
  useSubmitAttendanceMutation,
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
  useGetMyDocumentsQuery,
  useUploadDocumentMutation,
  useDeleteDocumentMutation,
  useGetMyCredentialsQuery,
  useUploadCredentialMutation,
  useDeleteCredentialMutation,
} = studentPortalApi;

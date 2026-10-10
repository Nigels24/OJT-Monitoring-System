import { createApi } from "@reduxjs/toolkit/query/react";
import type { ThunkDispatch, UnknownAction } from "@reduxjs/toolkit";
import { baseQueryWithAuth } from "./baseQuery";
import { dashboardApi } from "./dashboardApi";
import { attendanceOversightApi } from "./attendanceOversightApi";
import { documentApi } from "./documentApi";
import { evaluationApi } from "./evaluationApi";
import { messagesApi } from "./messagesApi";

export type StudentStatus = "ACTIVE" | "PENDING" | "COMPLETED" | "INACTIVE";

/**
 * A student as returned by the coordinator endpoints (`/coordinator/students`).
 *
 * Not to be confused with the student-facing `/student/*` routes, which serve
 * the signed-in student their own record and will get their own slice.
 */
export interface Student {
  id: string;
  userId: string;
  studentIdNumber: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  middleInitial?: string | null;
  school?: string | null;
  contactNumber?: string | null;
  address?: string | null;
  course?: string | null;
  yearLevel?: string | null;
  establishmentId?: string | null;
  requiredHours: number;
  startDate?: string | null;
  status: StudentStatus;
  /** Sum of APPROVED attendance hours, computed server-side. */
  completedHours: number;
  user: {
    id: string;
    email: string;
    username: string | null;
    name: string;
    createdAt: string;
  } & CredentialsEmailStatus;
  establishment?: { id: string; name: string; branch?: string | null } | null;
  /**
   * Dependent-row counts. The delete confirmation spells these out, since
   * deleting a student now cascades through all four (see the server's
   * `deleteStudentCascade`).
   */
  _count?: {
    documents: number;
    attendances: number;
    evaluations: number;
  } | null;
}

/**
 * `null` on a nullable field clears it; omitting the field leaves the stored
 * value alone.
 *
 * No `yearLevel` or `requiredHours`: both are derived from `course` on the
 * server (`lib/courses.ts` mirrors the table), and the server rejects a body
 * that carries either.
 *
 * `school` is deliberately absent — the server ignores any client-supplied
 * value and always sets it to the one permanent school name (`SCHOOL_NAME`,
 * `lib/school.ts`), so there is nothing for this form to send.
 */
export interface StudentDetailsRequest {
  firstName?: string | null;
  lastName?: string | null;
  middleInitial?: string | null;
  contactNumber?: string | null;
  address?: string | null;
  course?: string | null;
  establishmentId?: string | null;
  startDate?: string | null;
}

/**
 * Generated login details. The only response that ever carries the plaintext
 * password — show it once (`CredentialsDialog`) and keep no copy.
 */
export interface GeneratedCredentials {
  /** `null` only for an account from before usernames — it signs in by email. */
  username: string | null;
  tempPassword: string;
}

/**
 * How emailing a just-issued login went. On every response that carries
 * `credentials`. The email is sent after the account is saved and never undoes
 * it, so `credentials` is there either way for the one-time dialog.
 */
export interface EmailOutcome {
  emailSent: boolean;
  /** When not sent: a short reason ("No email address on file", …). */
  emailError?: string;
  /** Where it went — the MAIL_REDIRECT_TO test inbox when one is set. */
  emailedTo?: string;
}

/**
 * The stored outcome of the last credentials email, on list rows' `user`:
 * survives a reload, unlike `EmailOutcome`. Both null = never sent (an
 * account from before emails, or log mode).
 */
export interface CredentialsEmailStatus {
  credentialsSentAt: string | null;
  credentialsEmailError: string | null;
}

/** "Resend login": a new temporary password for an existing account. */
export interface ResendCredentialsResponse extends EmailOutcome {
  id: string;
  name: string;
  email: string;
  credentials: GeneratedCredentials;
}

/** Status is NOT NULL server-side, so it is omit-only. */
export interface UpdateStudentRequest extends StudentDetailsRequest {
  status?: StudentStatus;
}

export interface BulkDeleteStudentsResponse {
  deleted: string[];
  failed: { id: string; reason: string }[];
}

/**
 * The server-side cascade (deleteStudentCascade) takes attendance, documents,
 * evaluations and messages with a deleted student. Those live in other
 * createApi slices whose tags a student mutation can't reach on its own, so
 * every coordinator page that reads them would keep showing the deleted
 * student's rows until revisited (CLAUDE.md §8 item 22).
 */
function invalidateStudentCascade(
  dispatch: ThunkDispatch<unknown, unknown, UnknownAction>,
) {
  dispatch(dashboardApi.util.invalidateTags(["Dashboard"]));
  dispatch(attendanceOversightApi.util.invalidateTags(["AttendanceOversight"]));
  dispatch(documentApi.util.invalidateTags(["Document"]));
  dispatch(evaluationApi.util.invalidateTags(["Evaluation"]));
  dispatch(messagesApi.util.invalidateTags(["Conversations", "Contacts"]));
}

export const studentApi = createApi({
  reducerPath: "studentApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: ["Student"],
  endpoints: (builder) => ({
    getStudents: builder.query<Student[], void>({
      query: () => "/coordinator/students",
      providesTags: ["Student"],
    }),
    updateStudent: builder.mutation<
      Student,
      { id: string } & UpdateStudentRequest
    >({
      query: ({ id, ...body }) => ({
        url: `/coordinator/students/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Student"],
    }),
    deleteStudent: builder.mutation<{ id: string; deleted: boolean }, string>({
      query: (id) => ({
        url: `/coordinator/students/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Student"],
      async onQueryStarted(_id, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          invalidateStudentCascade(dispatch);
        } catch {
          // Delete failed — nothing else to invalidate.
        }
      },
    }),
    /**
     * Deletes up to 100 COMPLETED students. A 400 means nothing was deleted;
     * a 200 can still carry per-student `failed` entries.
     */
    bulkDeleteStudents: builder.mutation<
      BulkDeleteStudentsResponse,
      string[]
    >({
      query: (ids) => ({
        url: "/coordinator/students/bulk-delete",
        method: "POST",
        body: { ids },
      }),
      invalidatesTags: ["Student"],
      async onQueryStarted(_ids, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          invalidateStudentCascade(dispatch);
        } catch {
          // Rejected before anything was deleted — nothing to invalidate.
        }
      },
    }),
    /**
     * "Resend login": the server generates a new temporary password, forces a
     * change at next sign-in and emails it. Invalidates the list because the
     * row's email badge (credentialsSentAt / credentialsEmailError) changed.
     */
    resendStudentCredentials: builder.mutation<
      ResendCredentialsResponse,
      string
    >({
      query: (id) => ({
        url: `/coordinator/students/${id}/resend-credentials`,
        method: "POST",
      }),
      invalidatesTags: ["Student"],
    }),
  }),
});

export const {
  useGetStudentsQuery,
  useUpdateStudentMutation,
  useDeleteStudentMutation,
  useBulkDeleteStudentsMutation,
  useResendStudentCredentialsMutation,
} = studentApi;

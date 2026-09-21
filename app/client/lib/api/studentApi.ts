import { createApi } from "@reduxjs/toolkit/query/react";
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
  age?: number | null;
  dateOfBirth?: string | null;
  school?: string | null;
  contactNumber?: string | null;
  address?: string | null;
  course?: string | null;
  yearLevel?: string | null;
  establishmentId?: string | null;
  requiredHours: number;
  startDate?: string | null;
  /** Expected end of the OJT, not the actual completion date. */
  endDate?: string | null;
  gender?: string | null;
  status: StudentStatus;
  /** Sum of APPROVED attendance hours, computed server-side. */
  completedHours: number;
  user: {
    id: string;
    email: string;
    username: string | null;
    name: string;
    createdAt: string;
  };
  establishment?: { id: string; name: string } | null;
  /**
   * Dependent-row counts. The delete confirmation spells these out, since
   * deleting a student now cascades through all four (see the server's
   * `deleteStudentCascade`).
   */
  _count?: {
    credentials: number;
    documents: number;
    attendances: number;
    evaluations: number;
  } | null;
}

/**
 * `null` on a nullable field clears it; omitting the field leaves the stored
 * value alone. `requiredHours` and `status` are NOT NULL server-side, so they
 * are omit-only.
 *
 * `school` is deliberately absent — the server ignores any client-supplied
 * value and always sets it to the one permanent school name (`SCHOOL_NAME`,
 * `lib/school.ts`), so there is nothing for this form to send.
 */
export interface StudentDetailsRequest {
  firstName?: string | null;
  lastName?: string | null;
  middleInitial?: string | null;
  age?: number | null;
  dateOfBirth?: string | null;
  contactNumber?: string | null;
  address?: string | null;
  course?: string | null;
  yearLevel?: string | null;
  establishmentId?: string | null;
  requiredHours?: number;
  startDate?: string | null;
  endDate?: string | null;
  gender?: string | null;
  status?: StudentStatus;
}

export interface CreateStudentRequest extends StudentDetailsRequest {
  email: string;
  /** Login name issued by the coordinator. No "@" allowed. */
  username: string;
  /** Set by the coordinator and handed to the student. */
  password: string;
  studentIdNumber: string;
  name?: string;
}

export interface CreateStudentResponse {
  id: string;
  email: string;
  username: string | null;
  name: string;
  role: string;
}

export type UpdateStudentRequest = StudentDetailsRequest;

export const studentApi = createApi({
  reducerPath: "studentApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: ["Student"],
  endpoints: (builder) => ({
    getStudents: builder.query<Student[], void>({
      query: () => "/coordinator/students",
      providesTags: ["Student"],
    }),
    createStudent: builder.mutation<CreateStudentResponse, CreateStudentRequest>(
      {
        query: (body) => ({
          url: "/coordinator/students",
          method: "POST",
          body,
        }),
        invalidatesTags: ["Student"],
      },
    ),
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
      // The server-side cascade (deleteStudentCascade) takes attendance,
      // documents, credentials, evaluations and messages with it. Those live
      // in other createApi slices whose tags this mutation can't reach on its
      // own, so every coordinator page that reads them would keep showing
      // the deleted student's rows until revisited (CLAUDE.md §8 item 22).
      async onQueryStarted(_id, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(dashboardApi.util.invalidateTags(["Dashboard"]));
          dispatch(
            attendanceOversightApi.util.invalidateTags([
              "AttendanceOversight",
            ]),
          );
          dispatch(documentApi.util.invalidateTags(["Document"]));
          dispatch(evaluationApi.util.invalidateTags(["Evaluation"]));
          dispatch(
            messagesApi.util.invalidateTags(["Conversations", "Contacts"]),
          );
        } catch {
          // Delete failed — nothing else to invalidate.
        }
      },
    }),
    /**
     * Issues a new password for a student who has forgotten theirs.
     * No current password needed — that's the point.
     */
    resetStudentPassword: builder.mutation<
      { id: string; name: string; username: string | null },
      { id: string; password: string }
    >({
      query: ({ id, password }) => ({
        url: `/coordinator/students/${id}/password`,
        method: "PATCH",
        body: { password },
      }),
    }),
  }),
});

export const {
  useGetStudentsQuery,
  useCreateStudentMutation,
  useUpdateStudentMutation,
  useDeleteStudentMutation,
  useResetStudentPasswordMutation,
} = studentApi;

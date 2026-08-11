import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./baseQuery";

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
  _count?: { credentials: number; documents: number } | null;
}

export interface StudentDetailsRequest {
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  age?: number;
  dateOfBirth?: string;
  school?: string;
  contactNumber?: string;
  address?: string;
  course?: string;
  yearLevel?: string;
  establishmentId?: string;
  requiredHours?: number;
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
    }),
  }),
});

export const {
  useGetStudentsQuery,
  useCreateStudentMutation,
  useUpdateStudentMutation,
  useDeleteStudentMutation,
} = studentApi;

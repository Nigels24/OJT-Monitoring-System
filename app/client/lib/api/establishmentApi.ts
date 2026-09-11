import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./baseQuery";
import { studentApi } from "./studentApi";
import { supervisorManagementApi } from "./supervisorManagementApi";
import { dashboardApi } from "./dashboardApi";
import { attendanceOversightApi } from "./attendanceOversightApi";
import { documentApi } from "./documentApi";
import { evaluationApi } from "./evaluationApi";
import { messagesApi } from "./messagesApi";

export interface Establishment {
  id: string;
  name: string;
  industryType?: string | null;
  streetAddress?: string | null;
  region?: string | null;
  barangay?: string | null;
  city?: string | null;
  province?: string | null;
  zipCode?: string | null;
  status?: "ACTIVE" | "INACTIVE" | null;
  coordinatorFirstName?: string | null;
  coordinatorLastName?: string | null;
  coordinatorMiddleInitial?: string | null;
  coordinatorAge?: number | null;
  coordinatorGender?: string | null;
  coordinatorPosition?: string | null;
  coordinatorAddress?: string | null;
  coordinatorContact?: string | null;
  coordinatorEmail?: string | null;
  createdAt: string;
  _count?: {
    students: number;
    supervisors: number;
  } | null;
}

export interface CreateEstablishmentRequest {
  name: string;
  industryType?: string;
  streetAddress?: string;
  region?: string;
  barangay?: string;
  city?: string;
  province?: string;
  zipCode?: string;
  status?: "ACTIVE" | "INACTIVE";
  coordinatorFirstName?: string;
  coordinatorLastName?: string;
  coordinatorMiddleInitial?: string;
  coordinatorAge?: number;
  coordinatorGender?: string;
  coordinatorPosition?: string;
  coordinatorAddress?: string;
  coordinatorContact?: string;
  coordinatorEmail?: string;
}

export type UpdateEstablishmentRequest = Partial<CreateEstablishmentRequest>;

export const establishmentApi = createApi({
  reducerPath: "establishmentApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: ["Establishment"],
  endpoints: (builder) => ({
    getEstablishments: builder.query<Establishment[], void>({
      query: () => "/establishments",
      providesTags: ["Establishment"],
    }),
    getEstablishment: builder.query<Establishment, string>({
      query: (id) => `/establishments/${id}`,
      providesTags: ["Establishment"],
    }),
    createEstablishment: builder.mutation<
      Establishment,
      CreateEstablishmentRequest
    >({
      query: (body) => ({
        url: "/establishments",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Establishment"],
    }),
    updateEstablishment: builder.mutation<
      Establishment,
      { id: string } & UpdateEstablishmentRequest
    >({
      query: ({ id, ...body }) => ({
        url: `/establishments/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Establishment"],
    }),
    deleteEstablishment: builder.mutation<void, string>({
      query: (id) => ({
        url: `/establishments/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Establishment"],
      // EstablishmentService.remove deletes every supervisor at this
      // establishment (each via deleteSupervisorCascade — their evaluations
      // and messages go with them) and nulls establishmentId on its students
      // rather than deleting them. Both halves leave other slices stale.
      // See CLAUDE.md §8 item 22.
      async onQueryStarted(_id, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(studentApi.util.invalidateTags(["Student"]));
          dispatch(
            supervisorManagementApi.util.invalidateTags([
              "CoordinatorSupervisor",
            ]),
          );
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
  }),
});

export const {
  useGetEstablishmentsQuery,
  useGetEstablishmentQuery,
  useCreateEstablishmentMutation,
  useUpdateEstablishmentMutation,
  useDeleteEstablishmentMutation,
} = establishmentApi;

import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./baseQuery";
import { studentApi } from "./studentApi";
import { supervisorManagementApi } from "./supervisorManagementApi";
import { dashboardApi } from "./dashboardApi";
import { attendanceOversightApi } from "./attendanceOversightApi";
import { documentApi } from "./documentApi";
import { evaluationApi } from "./evaluationApi";
import { messagesApi } from "./messagesApi";
import type { GeneratedCredentials } from "./studentApi";

/**
 * The establishment's supervisor as the list shows it. Until one supervisor
 * per establishment is enforced an older establishment may have several: the
 * earliest is shown here and `_count.supervisors` says how many there are.
 */
export interface EstablishmentSupervisor {
  id: string;
  name: string;
  email: string;
  position: string | null;
}

/**
 * The old "Establishment Coordinator" contact fields are gone: that person is
 * the supervisor. Their columns stay in the database but the server no longer
 * returns them.
 */
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
  createdAt: string;
  /** Present on the list (`GET /establishments`); `null` = none yet. */
  supervisor?: EstablishmentSupervisor | null;
  _count?: {
    students: number;
    supervisors: number;
  } | null;
}

/**
 * A supervisor created with an establishment, or added to one later. No
 * username or password: the server generates both and returns them once.
 */
export interface NewSupervisorRequest {
  firstName: string;
  middleInitial?: string;
  lastName: string;
  email: string;
  position?: string;
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
  /** Optional: created in the same transaction as the establishment. */
  supervisor?: NewSupervisorRequest;
}

/** `credentials` is present only when a supervisor was created. */
export type CreateEstablishmentResponse = Establishment & {
  credentials?: GeneratedCredentials;
};

export interface AddSupervisorResponse extends EstablishmentSupervisor {
  establishmentId: string;
  credentials: GeneratedCredentials;
}

/**
 * Status is edit-only: a new establishment is always ACTIVE, and the server
 * rejects a create body that carries one. `supervisor` is create-only —
 * supervisors are edited on the Supervisors page.
 */
export type UpdateEstablishmentRequest = Partial<
  Omit<CreateEstablishmentRequest, "supervisor">
> & {
  status?: "ACTIVE" | "INACTIVE";
};

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
      CreateEstablishmentResponse,
      CreateEstablishmentRequest
    >({
      query: (body) => ({
        url: "/establishments",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Establishment"],
      // The dashboard counts establishments. With a nested supervisor the
      // coordinator's supervisor list and message contacts gain a row too.
      async onQueryStarted(body, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(dashboardApi.util.invalidateTags(["Dashboard"]));
          if (body.supervisor) invalidateSupervisorViews(dispatch);
        } catch {
          // Create failed — nothing else to invalidate.
        }
      },
    }),
    /**
     * Adds a supervisor to an existing establishment and returns the one-time
     * credentials. Refreshes this list (its Supervisor column) and every other
     * coordinator view that lists supervisors.
     */
    addEstablishmentSupervisor: builder.mutation<
      AddSupervisorResponse,
      { establishmentId: string } & NewSupervisorRequest
    >({
      query: ({ establishmentId, ...body }) => ({
        url: `/establishments/${establishmentId}/supervisor`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Establishment"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          invalidateSupervisorViews(dispatch);
        } catch {
          // Create failed — nothing else to invalidate.
        }
      },
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

/**
 * A new supervisor appears in the coordinator's supervisor list and in their
 * message contacts. (The dashboard counts no supervisors.) See CLAUDE.md §8
 * item 22 for why other slices need an explicit nudge.
 */
function invalidateSupervisorViews(dispatch: (action: unknown) => unknown) {
  dispatch(
    supervisorManagementApi.util.invalidateTags(["CoordinatorSupervisor"]),
  );
  dispatch(messagesApi.util.invalidateTags(["Contacts"]));
}

export const {
  useGetEstablishmentsQuery,
  useGetEstablishmentQuery,
  useCreateEstablishmentMutation,
  useAddEstablishmentSupervisorMutation,
  useUpdateEstablishmentMutation,
  useDeleteEstablishmentMutation,
} = establishmentApi;

import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./baseQuery";
import type { ResendCredentialsResponse } from "./studentApi";
import { dashboardApi } from "./dashboardApi";
import { evaluationApi } from "./evaluationApi";
import { messagesApi } from "./messagesApi";
// A cycle (establishmentApi imports this file too), and a safe one: each side
// only reads the other inside an onQueryStarted callback, long after both
// modules have finished loading.
import { establishmentApi } from "./establishmentApi";

/**
 * The coordinator's view of supervisors (`/coordinator/supervisors`).
 *
 * Not to be confused with `supervisorApi.ts`, which serves a signed-in
 * supervisor their own approval queue and dashboard.
 */
export interface CoordinatorSupervisor {
  id: string;
  userId: string;
  establishmentId: string;
  position?: string | null;
  user: {
    id: string;
    email: string;
    username: string | null;
    name: string;
    createdAt: string;
  };
  establishment?: { id: string; name: string; branch?: string | null } | null;
  /**
   * What deleting this supervisor would destroy (`evaluations`) versus merely
   * un-attribute (`approvedPunches` — the punches they approved are kept and
   * only lose their decider). The delete confirmation states both.
   */
  _count?: { evaluations: number; approvedPunches: number } | null;
}

/**
 * Editing a supervisor. No establishment and no username: a supervisor stays
 * at the establishment they were created in, and the username was generated
 * once. The name is stored whole, so the server needs firstName and lastName
 * together whenever any part is sent. `null` clears a nullable field.
 */
export interface UpdateSupervisorRequest {
  firstName: string;
  middleInitial: string | null;
  lastName: string;
  email: string;
  position: string | null;
}

export const supervisorManagementApi = createApi({
  reducerPath: "supervisorManagementApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: ["CoordinatorSupervisor"],
  endpoints: (builder) => ({
    getSupervisors: builder.query<CoordinatorSupervisor[], void>({
      query: () => "/coordinator/supervisors",
      providesTags: ["CoordinatorSupervisor"],
    }),
    /**
     * Name, email and position. The new name shows on the establishments
     * list, the coordinator's evaluations list (read live, not snapshotted)
     * and in messages, so those slices are nudged too.
     */
    updateSupervisor: builder.mutation<
      CoordinatorSupervisor,
      { id: string } & UpdateSupervisorRequest
    >({
      query: ({ id, ...body }) => ({
        url: `/coordinator/supervisors/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["CoordinatorSupervisor"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(establishmentApi.util.invalidateTags(["Establishment"]));
          dispatch(evaluationApi.util.invalidateTags(["Evaluation"]));
          dispatch(
            messagesApi.util.invalidateTags(["Conversations", "Contacts"]),
          );
        } catch {
          // Update failed — nothing else to invalidate.
        }
      },
    }),
    /**
     * "Resend login": a new generated temporary password and a forced change
     * at next sign-in. Invalidates nothing — the supervisor list shows neither
     * the password nor the flag, and the username never changes.
     */
    resendSupervisorCredentials: builder.mutation<
      ResendCredentialsResponse,
      string
    >({
      query: (id) => ({
        url: `/coordinator/supervisors/${id}/resend-credentials`,
        method: "POST",
      }),
    }),
    deleteSupervisor: builder.mutation<{ id: string; deleted: boolean }, string>(
      {
        query: (id) => ({
          url: `/coordinator/supervisors/${id}`,
          method: "DELETE",
        }),
        invalidatesTags: ["CoordinatorSupervisor"],
        // deleteSupervisorCascade takes the supervisor's evaluations and
        // messages with it (attendance they approved is kept, just
        // un-attributed — attendanceOversightApi and documentApi show
        // nothing derived from the approver, so they don't need a nudge
        // here). See CLAUDE.md §8 item 22.
        async onQueryStarted(_id, { dispatch, queryFulfilled }) {
          try {
            await queryFulfilled;
            dispatch(dashboardApi.util.invalidateTags(["Dashboard"]));
            dispatch(evaluationApi.util.invalidateTags(["Evaluation"]));
            dispatch(
              messagesApi.util.invalidateTags(["Conversations", "Contacts"]),
            );
          } catch {
            // Delete failed — nothing else to invalidate.
          }
        },
      },
    ),
  }),
});

export const {
  useGetSupervisorsQuery,
  useUpdateSupervisorMutation,
  useResendSupervisorCredentialsMutation,
  useDeleteSupervisorMutation,
} = supervisorManagementApi;

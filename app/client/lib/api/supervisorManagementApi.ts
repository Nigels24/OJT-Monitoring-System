import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./baseQuery";
import { dashboardApi } from "./dashboardApi";
import { evaluationApi } from "./evaluationApi";
import { messagesApi } from "./messagesApi";

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
  establishment?: { id: string; name: string } | null;
  /**
   * What deleting this supervisor would destroy (`evaluations`) versus merely
   * un-attribute (`attendanceApprovals` — the attendance rows are kept and
   * only lose their approver). The delete confirmation states both.
   */
  _count?: { evaluations: number; attendanceApprovals: number } | null;
}

export interface CreateSupervisorRequest {
  email: string;
  /** Login name issued by the coordinator. No "@" allowed. */
  username: string;
  /** Set by the coordinator and handed to the supervisor. */
  password: string;
  name: string;
  establishmentId: string;
  position?: string;
}

export interface CreateSupervisorResponse {
  id: string;
  email: string;
  username: string | null;
  name: string;
  role: string;
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
    createSupervisor: builder.mutation<
      CreateSupervisorResponse,
      CreateSupervisorRequest
    >({
      query: (body) => ({
        url: "/coordinator/supervisors",
        method: "POST",
        body,
      }),
      invalidatesTags: ["CoordinatorSupervisor"],
    }),
    /**
     * Issues a new password for a supervisor who has forgotten theirs.
     * No current password needed — that's the point.
     */
    resetSupervisorPassword: builder.mutation<
      { id: string; name: string; username: string | null },
      { id: string; password: string }
    >({
      query: ({ id, password }) => ({
        url: `/coordinator/supervisors/${id}/password`,
        method: "PATCH",
        body: { password },
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
  useCreateSupervisorMutation,
  useResetSupervisorPasswordMutation,
  useDeleteSupervisorMutation,
} = supervisorManagementApi;

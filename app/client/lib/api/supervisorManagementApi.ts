import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./baseQuery";

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

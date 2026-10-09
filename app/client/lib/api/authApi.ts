import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./baseQuery";

type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    username: string | null;
    name: string;
    role: string;
    /** True when the password was system-generated and must be changed first. */
    mustChangePassword: boolean;
  };
};

/**
 * A password change hands back a fresh session: the token in use may carry
 * the server's must-change claim, which every other route refuses.
 */
type ChangePasswordResponse = LoginResponse & { changed: boolean };

type LoginRequest = {
  /** Username or email — the server matches either. */
  identifier: string;
  password: string;
};

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: [],
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
    }),
    /** Any signed-in user changing their own password. */
    changePassword: builder.mutation<
      ChangePasswordResponse,
      { currentPassword: string; newPassword: string }
    >({
      query: (body) => ({
        url: "/auth/password",
        method: "PATCH",
        body,
      }),
    }),
  }),
});

export const { useLoginMutation, useChangePasswordMutation } = authApi;
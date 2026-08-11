import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn } from "@reduxjs/toolkit/query/react";
import type {
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { clearSession } from "@/lib/auth";

/**
 * API base URL. Set NEXT_PUBLIC_API_URL to point at a non-local server; the
 * fallback keeps the default dev setup (`npm run start:dev` on :3000) working
 * with no env file.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

/**
 * Shared base query for every RTK Query slice.
 *
 * On a 401 it tears down the session and sends the user to /login. Without
 * this, a token that stops being accepted before its cookie expires leaves the
 * app in a loop: `proxy.ts` sees the role cookie, bounces the user off /login
 * to their home page, and every request there 401s again. Clearing the cookie
 * here is what breaks that cycle.
 *
 * `/auth/login` is exempt — a 401 there is just wrong credentials, and the page
 * shows the error itself.
 */
export const baseQueryWithAuth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  const url = typeof args === "string" ? args : args.url;
  const isLoginRequest = url.includes("/auth/login");

  if (
    result.error?.status === 401 &&
    !isLoginRequest &&
    typeof window !== "undefined"
  ) {
    clearSession();
    // Deliberate full navigation. This module is not a component, so there is
    // no useRouter() to call, and a hard load guarantees the proxy re-runs and
    // every cached RTK Query result for the old session is dropped.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }

  return result;
};

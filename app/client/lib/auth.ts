export type UserRole = "STUDENT" | "SUPERVISOR" | "COORDINATOR";

export interface StoredUser {
  id: string;
  email: string;
  username: string | null;
  name: string;
  role: UserRole;
}

/**
 * Cookie holding only the role, mirrored from the stored user.
 *
 * `middleware.ts` runs on the server and cannot read localStorage, so it needs
 * a cookie to know who is browsing. Deliberately NOT the JWT: putting the token
 * in a JS-readable cookie widens the attack surface for no gain, since the
 * RTK Query slices already read it from localStorage.
 *
 * A user can forge this cookie in devtools and reach another role's page
 * shell — that is fine. The middleware is navigation UX, not the security
 * boundary. Every request the page makes still carries the real JWT, and
 * `RolesGuard` on the server rejects it.
 */
export const ROLE_COOKIE = "ojt_role";

/**
 * Must match the server's JWT lifetime (`signOptions: { expiresIn: '1d' }` in
 * app/server/src/auth/auth.module.ts).
 *
 * The cookie and the token have to expire together. A cookie that outlives the
 * token traps the user: `proxy.ts` keeps redirecting them off /login to a home
 * page whose every request 401s. A cookie that dies before the token (which is
 * what a session cookie did) forces a needless re-login. If you change the
 * server's expiresIn, change this too.
 */
export const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

/** Where each role lands after login. */
export const ROLE_HOME: Record<UserRole, string> = {
  STUDENT: "/student/dashboard",
  SUPERVISOR: "/supervisor/attendance",
  COORDINATOR: "/coordinator/dashboard",
};

/** Route prefix each role owns, used by the middleware to block cross-role access. */
export const ROLE_PREFIX: Record<UserRole, string> = {
  STUDENT: "/student",
  SUPERVISOR: "/supervisor",
  COORDINATOR: "/coordinator",
};

export function persistSession(token: string, user: StoredUser) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
  document.cookie = `${ROLE_COOKIE}=${user.role}; path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  document.cookie = `${ROLE_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
}

/** Reads the stored user, tolerating absent or corrupt JSON. */
export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ROLE_COOKIE, ROLE_HOME, ROLE_PREFIX, type UserRole } from "@/lib/auth";

// Next 16 renamed the `middleware` file convention to `proxy`; the behaviour is
// unchanged. See node_modules/next/dist/docs/01-app/03-api-reference/
// 03-file-conventions/proxy.md.

const ROLES = Object.keys(ROLE_PREFIX) as UserRole[];

function isRole(value: string | undefined): value is UserRole {
  return !!value && (ROLES as string[]).includes(value);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieRole = request.cookies.get(ROLE_COOKIE)?.value;
  const role = isRole(cookieRole) ? cookieRole : null;

  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, request.url));

  // `/` is still create-next-app boilerplate — send people somewhere useful.
  if (pathname === "/") {
    return redirectTo(role ? ROLE_HOME[role] : "/login");
  }

  // Already signed in? Skip the login form.
  if (pathname === "/login") {
    return role ? redirectTo(ROLE_HOME[role]) : NextResponse.next();
  }

  const owningRole = ROLES.find((r) => pathname.startsWith(ROLE_PREFIX[r]));
  if (!owningRole) {
    return NextResponse.next();
  }

  if (!role) {
    const login = new URL("/login", request.url);
    // Preserve where they were headed so login can bounce them back later.
    login.searchParams.set("next", pathname);
    return redirectTo(`${login.pathname}${login.search}`);
  }

  if (role !== owningRole) {
    return redirectTo(ROLE_HOME[role]);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals, the favicon, and files in public/.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

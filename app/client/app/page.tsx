import { redirect } from "next/navigation";

// `proxy.ts` normally intercepts "/" and sends the visitor to their role's home
// (or /login when there is no session cookie). This page only renders if that
// interception is ever bypassed, so it fails safe to the login screen rather
// than to a blank route.
export default function RootPage() {
  redirect("/login");
}

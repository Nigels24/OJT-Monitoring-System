import { LayoutDashboard, CalendarCheck, Star } from "lucide-react";

/**
 * Supervisor sidebar.
 *
 * The prototype also lists Messages, which has no page yet, so it is left out
 * rather than linked as a dead end — a 404 renders no sidebar and therefore no
 * logout button. Add it when messaging lands.
 */
export const SUPERVISOR_NAV = [
  { label: "Dashboard", href: "/supervisor/dashboard", icon: LayoutDashboard },
  {
    label: "Attendance Approval",
    href: "/supervisor/attendance",
    icon: CalendarCheck,
  },
  { label: "Evaluation", href: "/supervisor/evaluation", icon: Star },
];

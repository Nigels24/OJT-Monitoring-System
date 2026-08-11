import { LayoutDashboard, CalendarCheck } from "lucide-react";

/**
 * Supervisor sidebar.
 *
 * The prototype also lists Evaluation and Messages. Neither has a page yet, so
 * they are left out rather than linked as dead ends. Add each as its module
 * lands (evaluations is module 5, messaging module 9).
 */
export const SUPERVISOR_NAV = [
  { label: "Dashboard", href: "/supervisor/dashboard", icon: LayoutDashboard },
  {
    label: "Attendance Approval",
    href: "/supervisor/attendance",
    icon: CalendarCheck,
  },
];

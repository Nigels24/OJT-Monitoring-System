import { LayoutDashboard, CalendarCheck } from "lucide-react";

/**
 * Student sidebar.
 *
 * Deliberately shorter than the prototype's, which also lists My Documents,
 * Credentials, Profile and Messages. Those have no backend yet, so linking to
 * them would recreate the dead-link problem this module exists to fix. Add each
 * entry as its module lands.
 */
export const STUDENT_NAV = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/student/attendance", icon: CalendarCheck },
];

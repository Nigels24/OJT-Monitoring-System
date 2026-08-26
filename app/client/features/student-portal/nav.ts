import {
  LayoutDashboard,
  CalendarCheck,
  UserCircle,
  FileText,
  BadgeCheck,
} from "lucide-react";

/**
 * Student sidebar.
 *
 * Deliberately shorter than the prototype's, which also lists Messages. That
 * has no backend yet, so linking to it would recreate the dead-link problem
 * this module exists to fix. Add each entry as its module lands.
 */
export const STUDENT_NAV = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/student/attendance", icon: CalendarCheck },
  { label: "Documents", href: "/student/documents", icon: FileText },
  { label: "Credentials", href: "/student/credentials", icon: BadgeCheck },
  { label: "Profile", href: "/student/profile", icon: UserCircle },
];

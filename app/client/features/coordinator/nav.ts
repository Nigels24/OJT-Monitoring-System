import { LayoutDashboard, Building2, Users, Star } from "lucide-react";

/**
 * Coordinator sidebar.
 *
 * Was duplicated inline in every coordinator page; centralised here so a new
 * entry doesn't have to be added in several places at once.
 *
 * Lists only pages that exist — Attendance oversight and Messages have no page
 * yet, and a 404 renders no sidebar, which strands the user with no logout
 * button. Add each entry as its module lands.
 */
export const COORDINATOR_NAV = [
  { label: "Dashboard", href: "/coordinator/dashboard", icon: LayoutDashboard },
  {
    label: "Establishment Management",
    href: "/coordinator/establishments",
    icon: Building2,
  },
  { label: "Student Management", href: "/coordinator/students", icon: Users },
  { label: "Evaluations", href: "/coordinator/evaluations", icon: Star },
];

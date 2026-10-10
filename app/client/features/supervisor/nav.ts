import {
  LayoutDashboard,
  CalendarCheck,
  Users,
  Star,
  MessageSquare,
} from "lucide-react";

/** Supervisor sidebar. */
export const SUPERVISOR_NAV = [
  { label: "Dashboard", href: "/supervisor/dashboard", icon: LayoutDashboard },
  {
    label: "Attendance Approval",
    href: "/supervisor/attendance",
    icon: CalendarCheck,
  },
  { label: "Students", href: "/supervisor/students", icon: Users },
  { label: "Evaluation", href: "/supervisor/evaluation", icon: Star },
  { label: "Messages", href: "/supervisor/messages", icon: MessageSquare },
];

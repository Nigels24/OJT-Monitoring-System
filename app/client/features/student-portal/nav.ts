import {
  LayoutDashboard,
  CalendarCheck,
  UserCircle,
  FileText,
  MessageSquare,
} from "lucide-react";

/** Student sidebar. */
export const STUDENT_NAV = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/student/attendance", icon: CalendarCheck },
  { label: "Documents", href: "/student/documents", icon: FileText },
  { label: "Profile", href: "/student/profile", icon: UserCircle },
  { label: "Messages", href: "/student/messages", icon: MessageSquare },
];

"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import TrendChart from "@/components/ui/TrendChart";
import RankedBarList from "@/components/ui/RankedBarList";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  LayoutDashboard,
  Building2,
  Users,
  Users2,
  CalendarCheck,
  MessageSquare,
  Star,
  CheckCircle2,
  Clock,
  FileText,
  TrendingUp,
  PieChart,
} from "lucide-react";

const COORDINATOR_NAV = [
  { label: "Dashboard", href: "/coordinator/dashboard", icon: LayoutDashboard },
  {
    label: "Establishment Management",
    href: "/coordinator/establishments",
    icon: Building2,
  },
  { label: "Student Management", href: "/coordinator/students", icon: Users },
  { label: "Attendance", href: "/coordinator/attendance", icon: CalendarCheck },
  { label: "Messages", href: "/coordinator/messages", icon: MessageSquare },
  { label: "Evaluations", href: "/coordinator/evaluations", icon: Star },
];

interface DashboardStats {
  totalStudents: number;
  partnerEstablishments: number;
  presentToday: number;
  avgPerformance: number;
  completedOjt: number;
  totalHoursLogged: number;
  messages: number;
  pendingDocuments: number;
}

interface RecentStudent {
  studentId: string;
  name: string;
  course: string;
  establishment: string;
  startDate: string;
  hoursCompleted: number;
  hoursRequired: number;
  status: "Active" | "Pending";
}

// TODO: replace with real GET /coordinator/attendance-trends data
// once that endpoint exists on the backend.
const ATTENDANCE_TREND = [
  { label: "Week 1", present: 120, late: 15, absent: 8 },
  { label: "Week 2", present: 135, late: 18, absent: 10 },
  { label: "Week 3", present: 142, late: 12, absent: 7 },
  { label: "Week 4", present: 138, late: 20, absent: 12 },
  { label: "Week 5", present: 148, late: 16, absent: 9 },
  { label: "Week 6", present: 152, late: 14, absent: 8 },
];

const TREND_SERIES = [
  { key: "present", label: "Present", color: "#22c55e" },
  { key: "late", label: "Late", color: "#eab308" },
  { key: "absent", label: "Absent", color: "#ef4444" },
];

// TODO: replace with real GET /coordinator/top-establishments data
// once that endpoint exists on the backend.
const TOP_ESTABLISHMENTS = [
  {
    label: "Tech Solutions Inc.",
    value: 28,
    badge: "28 students",
    badgeVariant: "green" as const,
  },
  {
    label: "Digital Innovations Corp.",
    value: 22,
    badge: "22 students",
    badgeVariant: "green" as const,
  },
  {
    label: "Business Analytics Co.",
    value: 18,
    badge: "18 students",
    badgeVariant: "green" as const,
  },
  {
    label: "Hospitality Services Group",
    value: 15,
    badge: "15 students",
    badgeVariant: "amber" as const,
  },
  {
    label: "Accounting Partners Ltd.",
    value: 12,
    badge: "12 students",
    badgeVariant: "green" as const,
  },
];

// TODO: replace with real GET /coordinator/students?recent=true
// once that endpoint exists on the backend.
const RECENT_STUDENTS: RecentStudent[] = [
  {
    studentId: "2024-001",
    name: "Juan Dela Cruz",
    course: "BSIT",
    establishment: "Tech Solutions Inc.",
    startDate: "2024-03-01",
    hoursCompleted: 325,
    hoursRequired: 500,
    status: "Active",
  },
  {
    studentId: "2024-002",
    name: "Maria Santos",
    course: "BSBA",
    establishment: "Business Analytics Co.",
    startDate: "2024-03-02",
    hoursCompleted: 180,
    hoursRequired: 400,
    status: "Active",
  },
  {
    studentId: "2024-003",
    name: "John Smith",
    course: "BSCS",
    establishment: "Digital Innovations Corp.",
    startDate: "2024-03-03",
    hoursCompleted: 480,
    hoursRequired: 600,
    status: "Active",
  },
  {
    studentId: "2024-004",
    name: "Anna Reyes",
    course: "BSHM",
    establishment: "Hospitality Services Group",
    startDate: "2024-03-04",
    hoursCompleted: 100,
    hoursRequired: 500,
    status: "Pending",
  },
  {
    studentId: "2024-005",
    name: "Pedro Gonzales",
    course: "BSA",
    establishment: "Accounting Partners Ltd.",
    startDate: "2024-03-05",
    hoursCompleted: 380,
    hoursRequired: 400,
    status: "Active",
  },
];

const STUDENT_COLUMNS: DataTableColumn<RecentStudent>[] = [
  { key: "studentId", label: "Student ID", render: (r) => r.studentId },
  {
    key: "name",
    label: "Name",
    render: (r) => <span className="font-medium text-gray-900">{r.name}</span>,
  },
  { key: "course", label: "Course", render: (r) => r.course },
  {
    key: "establishment",
    label: "Establishment",
    render: (r) => r.establishment,
  },
  { key: "startDate", label: "Start Date", render: (r) => r.startDate },
  {
    key: "hours",
    label: "Hours Completed",
    render: (r) =>
      `${r.hoursCompleted}/${r.hoursRequired} hrs (${Math.round(
        (r.hoursCompleted / r.hoursRequired) * 100,
      )}%)`,
  },
  {
    key: "status",
    label: "Status",
    render: (r) => (
      <StatusBadge
        label={r.status}
        variant={r.status === "Active" ? "active" : "pending"}
      />
    ),
  },
];

export default function CoordinatorDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [userName, setUserName] = useState("Admin");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUserName(JSON.parse(storedUser).name || "Admin");
    }
    // TODO: replace with a real GET /coordinator/dashboard-stats call
    // once that endpoint exists on the backend.
    setStats({
      totalStudents: 9,
      partnerEstablishments: 5,
      presentToday: 125,
      avgPerformance: 3.8,
      completedOjt: 0,
      totalHoursLogged: 1705,
      messages: 2,
      pendingDocuments: 12,
    });
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        orgName="WPH Institute"
        orgSubtitle="Barangay San Francisco"
        items={COORDINATOR_NAV}
        userName={userName}
      />

      <main className="flex-1 p-6">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-6 mb-6">
          <PageHeader
            title="Dashboard Overview"
            subtitle={`Welcome back, ${userName}! Here's a comprehensive overview of your OJT program.`}
            icon={LayoutDashboard}
          />
        </div>

        {!stats ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <StatCard
                label="Total Students"
                value={stats.totalStudents}
                icon={Users}
                subtext="Active OJT"
                variant="accent"
              />
              <StatCard
                label="Partner Establishments"
                value={stats.partnerEstablishments}
                icon={Building2}
                subtext="Active partners"
              />
              <StatCard
                label="Present Today"
                value={stats.presentToday}
                icon={CalendarCheck}
                subtext={`out of ${stats.partnerEstablishments}`}
              />
              <StatCard
                label="Avg. Performance"
                value={stats.avgPerformance}
                icon={Star}
                subtext="Very Good"
              />
            </div>

            <div className="grid grid-cols-4 gap-4 mb-4">
              <StatCard
                label="Completed OJT"
                value={stats.completedOjt}
                icon={CheckCircle2}
                subtext="Finished program"
              />
              <StatCard
                label="Total Hours Logged"
                value={stats.totalHoursLogged.toLocaleString()}
                icon={Clock}
                subtext="hours accumulated"
              />
              <StatCard
                label="Messages"
                value={stats.messages}
                icon={MessageSquare}
              />
              <StatCard
                label="Pending Documents"
                value={stats.pendingDocuments}
                icon={FileText}
                subtext="Awaiting approval"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <TrendChart
                title="Attendance Trends (Last 30 Days)"
                icon={TrendingUp}
                data={ATTENDANCE_TREND}
                series={TREND_SERIES}
              />
              <RankedBarList
                title="Top Establishments by Student Count"
                icon={PieChart}
                items={TOP_ESTABLISHMENTS}
              />
            </div>

            <DataTable
              title="Recently Added Students"
              icon={Users2}
              columns={STUDENT_COLUMNS}
              data={RECENT_STUDENTS}
              keyField="studentId"
              actionLabel="View All"
              onAction={() => (window.location.href = "/coordinator/students")}
            />
          </>
        )}
      </main>
    </div>
  );
}

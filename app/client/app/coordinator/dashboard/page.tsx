"use client";

import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import { COORDINATOR_NAV } from "@/features/coordinator/nav";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import TrendChart from "@/components/ui/TrendChart";
import RankedBarList from "@/components/ui/RankedBarList";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import ProgressBar from "@/components/ui/ProgressBar";
import {
  LayoutDashboard,
  Building2,
  Users,
  Users2,
  CalendarCheck,
  Star,
  CheckCircle2,
  Clock,
  Hourglass,
  TrendingUp,
  PieChart,
} from "lucide-react";
import {
  useGetCoordinatorDashboardQuery,
  RecentStudent,
} from "@/lib/api/dashboardApi";

// Charting the statuses that actually exist. The prototype showed
// present/late/absent; attendance has no such states.
const TREND_SERIES = [
  { key: "approved", label: "Approved", color: "#22c55e" },
  { key: "pending", label: "Pending", color: "#eab308" },
  { key: "declined", label: "Declined", color: "#ef4444" },
];

const STUDENT_COLUMNS: DataTableColumn<RecentStudent>[] = [
  {
    key: "studentIdNumber",
    label: "Student ID",
    render: (r) => (
      <span className="font-mono text-xs text-gray-700">
        {r.studentIdNumber}
      </span>
    ),
  },
  {
    key: "name",
    label: "Name",
    render: (r) => <span className="font-medium text-gray-900">{r.name}</span>,
  },
  { key: "course", label: "Course", render: (r) => r.course || "—" },
  {
    key: "establishment",
    label: "Establishment",
    render: (r) => r.establishment || "Unassigned",
  },
  {
    key: "startDate",
    label: "Start Date",
    render: (r) =>
      r.startDate ? new Date(r.startDate).toLocaleDateString() : "—",
  },
  {
    key: "hours",
    label: "Hours Completed",
    render: (r) => (
      <div className="min-w-32">
        <div className="text-xs text-gray-600 mb-1">
          {r.completedHours}/{r.requiredHours} hrs
        </div>
        <ProgressBar
          value={r.completedHours}
          max={r.requiredHours || 1}
          variant="thin"
          showLabel
          colorByValue
        />
      </div>
    ),
  },
  {
    key: "status",
    label: "Status",
    render: (r) => (
      <StatusBadge
        label={r.status === "ACTIVE" ? "Active" : r.status}
        variant={
          r.status === "ACTIVE"
            ? "active"
            : r.status === "COMPLETED"
              ? "completed"
              : r.status === "PENDING"
                ? "pending"
                : "neutral"
        }
      />
    ),
  },
];

export default function CoordinatorDashboard() {
  const currentUser = useCurrentUser();
  const userName = currentUser?.name || "Admin";
  const { data, isLoading, error } = useGetCoordinatorDashboardQuery();

  const hasTrendData =
    data?.attendanceTrend.some(
      (p) => p.approved + p.pending + p.declined > 0,
    ) ?? false;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        orgName="WPH Institute"
        orgSubtitle="Barangay San Francisco"
        items={COORDINATOR_NAV}
        userName={userName}
      />

      <main className="flex-1 p-4 md:p-6">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-4 md:p-6 mb-6">
          <PageHeader
            title="Dashboard Overview"
            subtitle={`Welcome back, ${userName}! Here's how the OJT program is going.`}
            icon={LayoutDashboard}
          />
        </div>

        {isLoading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : error || !data ? (
          <Card>
            <p className="text-sm text-gray-600">
              We couldn&apos;t load the dashboard. Check that the API is running.
            </p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
              <StatCard
                label="Total Students"
                value={data.stats.totalStudents}
                icon={Users}
                subtext={`${data.stats.activeStudents} active`}
                variant="accent"
              />
              <StatCard
                label="Partner Establishments"
                value={data.stats.partnerEstablishments}
                icon={Building2}
                subtext={`${data.stats.activeEstablishments} active`}
              />
              <StatCard
                label="Logged Today"
                value={data.stats.presentToday}
                icon={CalendarCheck}
                subtext={`of ${data.stats.activeStudents} active students`}
              />
              <StatCard
                label="Avg. Performance"
                value={data.stats.averageRating ?? "—"}
                icon={Star}
                subtext={
                  data.stats.averageLevel ??
                  (data.stats.totalEvaluations === 0
                    ? "No evaluations yet"
                    : undefined)
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
              <StatCard
                label="Completed OJT"
                value={data.stats.completedStudents}
                icon={CheckCircle2}
                subtext="Finished program"
              />
              <StatCard
                label="Total Hours Logged"
                value={data.stats.totalHoursLogged.toLocaleString()}
                icon={Clock}
                subtext="approved hours"
              />
              <StatCard
                label="Pending Approvals"
                value={data.stats.pendingApprovals}
                icon={Hourglass}
                subtext="awaiting supervisors"
              />
              <StatCard
                label="Evaluations"
                value={data.stats.totalEvaluations}
                icon={Star}
                subtext="submitted"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <Card>
                <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                  <TrendingUp size={18} className="text-blue-600" />
                  Attendance Trends (last 6 weeks)
                </h2>
                <p className="text-xs text-gray-500 mb-3">
                  Attendance logs by week, grouped by approval status.
                </p>
                {hasTrendData ? (
                  <TrendChart
                    title=""
                    icon={TrendingUp}
                    data={data.attendanceTrend}
                    series={TREND_SERIES}
                  />
                ) : (
                  <p className="text-gray-500 text-sm py-8 text-center">
                    No attendance logged in the last six weeks.
                  </p>
                )}
              </Card>

              {data.topEstablishments.length > 0 ? (
                <RankedBarList
                  title="Top Establishments by Student Count"
                  icon={PieChart}
                  items={data.topEstablishments.map((e) => ({
                    label: e.name,
                    value: e.studentCount,
                    badge: `${e.studentCount} student${e.studentCount === 1 ? "" : "s"}`,
                    badgeVariant: e.studentCount > 0 ? "green" : "amber",
                  }))}
                />
              ) : (
                <Card>
                  <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <PieChart size={18} className="text-blue-600" />
                    Top Establishments by Student Count
                  </h2>
                  <p className="text-gray-500 text-sm py-8 text-center">
                    No establishments yet.
                  </p>
                </Card>
              )}
            </div>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base md:text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Users2 size={18} className="text-blue-600" />
                  Recently Added Students
                </h2>
                <Link
                  href="/coordinator/students"
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  View all
                </Link>
              </div>
              {data.recentStudents.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">
                  No students yet — add one from Student Management.
                </p>
              ) : (
                <DataTable
                  title=""
                  icon={Users2}
                  columns={STUDENT_COLUMNS}
                  data={data.recentStudents}
                  keyField="id"
                />
              )}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

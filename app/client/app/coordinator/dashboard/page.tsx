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
import { formatDateOnly } from "@/lib/format";
import SectionError from "@/components/ui/SectionError";

// Charting the statuses that actually exist, one count per punch. The
// prototype showed present/late/absent; attendance has no such states.
const TREND_SERIES = [
  { key: "approved", label: "Approved punches", color: "#22c55e" },
  { key: "pending", label: "Pending punches", color: "#eab308" },
  { key: "declined", label: "Declined punches", color: "#ef4444" },
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
    render: (r) => formatDateOnly(r.startDate),
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
  const { data, isLoading, error, refetch, isFetching } =
    useGetCoordinatorDashboardQuery();

  /**
   * Sections the endpoint reported as failed. It returns empty defaults for
   * these rather than a 500, so everything that loaded still renders and only
   * the broken part shows a retry.
   */
  const failed = (section: string) =>
    data?.failedSections.includes(section) ?? false;
  const retry = () => {
    void refetch();
  };

  const hasTrendData =
    data?.attendanceTrend.some(
      (p) => p.approved + p.pending + p.declined > 0,
    ) ?? false;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        orgName="WPH Institute"
        orgSubtitle="Barangay San Francisco Pag. City ZDS"
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
            {failed("stats") && (
              <SectionError
                label="The summary figures"
                onRetry={retry}
                retrying={isFetching}
              />
            )}
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
                label="Avg. Total Rating"
                value={data.stats.averageRating ?? "—"}
                icon={Star}
                subtext={
                  data.stats.averageRating === null
                    ? "No evaluations yet"
                    : data.stats.maxTotalRating === null
                      ? "no published sheet"
                      : `out of ${data.stats.maxTotalRating}`
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
                subtext="punches awaiting supervisors"
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
                  Punches by week, grouped by approval status.
                </p>
                {failed("attendanceTrend") && (
                  <SectionError
                    label="The attendance trend"
                    onRetry={retry}
                    retrying={isFetching}
                  />
                )}
                {hasTrendData ? (
                  <TrendChart
                    title=""
                    icon={TrendingUp}
                    data={data.attendanceTrend}
                    series={TREND_SERIES}
                  />
                ) : (
                  <p className="text-gray-500 text-sm py-8 text-center">
                    No punches recorded in the last six weeks.
                  </p>
                )}
              </Card>

              {failed("topEstablishments") ? (
                <Card>
                  <SectionError
                    label="Top establishments"
                    onRetry={retry}
                    retrying={isFetching}
                  />
                </Card>
              ) : data.topEstablishments.length > 0 ? (
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
              {failed("recentStudents") ? (
                <SectionError
                  label="Recently added students"
                  onRetry={retry}
                  retrying={isFetching}
                />
              ) : data.recentStudents.length === 0 ? (
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

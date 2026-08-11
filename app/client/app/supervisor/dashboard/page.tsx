"use client";

import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import DataTable, { DataTableColumn } from "@/components/ui/DataTable";
import ProgressBar from "@/components/ui/ProgressBar";
import StatusBadge from "@/components/ui/StatusBadge";
import DetailItem from "@/components/ui/DetailItem";
import {
  LayoutDashboard,
  Users,
  Hourglass,
  CheckCircle2,
  Clock,
  Building2,
  XCircle,
  UserCheck,
} from "lucide-react";
import {
  useGetSupervisorDashboardQuery,
  useGetSupervisorStudentsQuery,
  SupervisorStudent,
} from "@/lib/api/supervisorApi";
import { SUPERVISOR_NAV } from "@/features/supervisor/nav";

const STUDENT_COLUMNS: DataTableColumn<SupervisorStudent>[] = [
  {
    key: "studentIdNumber",
    label: "ID",
    render: (r) => (
      <span className="font-mono text-xs text-gray-700">
        {r.studentIdNumber}
      </span>
    ),
  },
  {
    key: "name",
    label: "Student",
    render: (r) => (
      <div>
        <div className="font-semibold text-gray-900">{r.user.name}</div>
        <div className="text-xs text-gray-500">{r.user.email}</div>
      </div>
    ),
  },
  { key: "course", label: "Course", render: (r) => r.course || "—" },
  {
    key: "hours",
    label: "Hours",
    render: (r) => (
      <span className="whitespace-nowrap">
        {r.completedHours}/{r.requiredHours} hrs
      </span>
    ),
  },
  {
    key: "progress",
    label: "Progress",
    render: (r) => (
      <div className="min-w-28">
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
        variant={r.status === "ACTIVE" ? "active" : "neutral"}
      />
    ),
  },
];

export default function SupervisorDashboardPage() {
  const { data, isLoading, error } = useGetSupervisorDashboardQuery();
  const { data: students, isLoading: studentsLoading } =
    useGetSupervisorStudentsQuery();

  const displayName = data?.supervisor.name ?? "Supervisor";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        orgName={data?.establishment?.name ?? "Establishment"}
        orgSubtitle="OJT Monitoring"
        items={SUPERVISOR_NAV}
        userName={displayName}
        userSubtitle={data?.supervisor.position ?? undefined}
      />

      <main className="flex-1 p-4 md:p-6">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-4 md:p-6 mb-6">
          <PageHeader
            title={`Welcome back, ${displayName}!`}
            subtitle="Your establishment's OJT students at a glance."
            icon={LayoutDashboard}
          />
        </div>

        {isLoading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : error || !data ? (
          <Card>
            <p className="text-sm text-gray-600">
              We couldn&apos;t load your establishment. If you were just added,
              your coordinator may still be setting up your profile.
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
                label="Pending Approvals"
                value={data.stats.pendingApprovals}
                icon={Hourglass}
                subtext="Needs your review"
              />
              <StatCard
                label="Approved This Week"
                value={data.stats.approvedThisWeek}
                icon={CheckCircle2}
                subtext="since Monday"
              />
              <StatCard
                label="Total Hours Approved"
                value={data.stats.totalApprovedHours}
                icon={Clock}
                subtext="across all students"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              <Card>
                <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Building2 size={18} className="text-blue-600" />
                  My Establishment
                </h2>
                <div className="space-y-3">
                  <DetailItem
                    label="Name"
                    value={data.establishment?.name}
                    icon={Building2}
                  />
                  <DetailItem
                    label="Industry"
                    value={data.establishment?.industryType}
                    icon={Building2}
                  />
                  <DetailItem
                    label="My Position"
                    value={data.supervisor.position}
                    icon={UserCheck}
                  />
                  <DetailItem
                    label="Declined Logs"
                    value={data.stats.declinedCount}
                    icon={XCircle}
                  />
                </div>
              </Card>

              <Card className="lg:col-span-2 flex flex-col justify-center">
                <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Hourglass size={18} className="text-blue-600" />
                  Approval Queue
                </h2>
                {data.stats.pendingApprovals > 0 ? (
                  <>
                    <p className="text-sm text-gray-600 mb-4">
                      <span className="font-semibold text-gray-900">
                        {data.stats.pendingApprovals}
                      </span>{" "}
                      attendance log
                      {data.stats.pendingApprovals === 1 ? "" : "s"} are waiting
                      on you. Students&apos; hours don&apos;t count toward their
                      requirement until you approve them.
                    </p>
                    <Link
                      href="/supervisor/attendance"
                      className="inline-flex w-fit items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                    >
                      Review pending approvals
                    </Link>
                  </>
                ) : (
                  <p className="text-sm text-gray-600">
                    Nothing waiting for approval — you&apos;re all caught up.
                  </p>
                )}
              </Card>
            </div>

            <Card>
              <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Users size={18} className="text-blue-600" />
                My Students
              </h2>
              {studentsLoading ? (
                <p className="text-gray-400 text-sm">Loading...</p>
              ) : !students || students.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">
                  No students are assigned to your establishment yet.
                </p>
              ) : (
                <DataTable
                  title=""
                  icon={Users}
                  columns={STUDENT_COLUMNS}
                  data={students}
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

"use client";

import Sidebar from "@/components/layout/Sidebar";
import { COORDINATOR_NAV } from "@/features/coordinator/nav";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import { CalendarCheck, Users, TrendingUp, AlertTriangle } from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useAttendanceOversight } from "@/features/attendance-oversight/hooks/use-attendance-oversight";
import AttendanceOversightTable from "@/features/attendance-oversight/components/AttendanceOversightTable";

/**
 * Read-only attendance oversight across every establishment.
 *
 * The coordinator neither logs nor approves attendance — students submit and
 * supervisors approve — so this page only reports. The prototype's
 * admin/attendance_management.html pairs its table with "send messages", which
 * has no module yet and is left out.
 */
export default function CoordinatorAttendancePage() {
  const currentUser = useCurrentUser();
  const {
    isLoading,
    isError,
    search,
    page,
    paged,
    totalPages,
    stats,
    setSearch,
    setPage,
  } = useAttendanceOversight();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        orgName="WPH Institute"
        orgSubtitle="Barangay San Francisco"
        items={COORDINATOR_NAV}
        userName={currentUser?.name || "Coordinator"}
      />

      <main className="flex-1 p-4 md:p-6">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-4 md:p-6 mb-6">
          <PageHeader
            title="Attendance Monitoring"
            subtitle="Track student attendance across all establishments"
            icon={CalendarCheck}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {/*
            On a failed request these read "—" rather than 0: the figures are
            unknown, and a row of real-looking zeroes beside the table's error
            message would contradict it.
          */}
          <StatCard
            label="Total Students"
            value={isError ? "—" : stats.total}
            icon={Users}
            variant="accent"
          />
          <StatCard
            label="Average Attendance"
            // "—" when no student has a measurable window yet, rather than a
            // 0% that would read as universal absence.
            value={
              isError || stats.averageAttendance === null
                ? "—"
                : `${stats.averageAttendance}%`
            }
            icon={TrendingUp}
          />
          <StatCard
            label="At Risk"
            value={isError ? "—" : stats.atRisk}
            icon={AlertTriangle}
            subtext="Below 80% attendance"
          />
        </div>

        <Card>
          <AttendanceOversightTable
            rows={paged}
            isLoading={isLoading}
            isError={isError}
            search={search}
            page={page}
            totalPages={totalPages}
            onSearchChange={setSearch}
            onPageChange={setPage}
          />
        </Card>
      </main>
    </div>
  );
}

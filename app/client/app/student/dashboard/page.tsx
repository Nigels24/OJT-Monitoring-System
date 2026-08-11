"use client";

import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import ProgressBar from "@/components/ui/ProgressBar";
import DetailItem from "@/components/ui/DetailItem";
import {
  LayoutDashboard,
  Clock,
  CheckCircle2,
  Hourglass,
  CalendarCheck,
  Building2,
  User,
  Phone,
  Mail,
  IdCard,
  GraduationCap,
} from "lucide-react";
import { useGetMyDashboardQuery } from "@/lib/api/studentPortalApi";
import { STUDENT_NAV } from "@/features/student-portal/nav";
import AttendanceTable from "@/features/student-portal/components/AttendanceTable";

export default function StudentDashboardPage() {
  const { data, isLoading, error } = useGetMyDashboardQuery();

  const displayName = data?.user.name ?? "Student";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        orgName="WPH Institute"
        orgSubtitle="OJT Monitoring"
        items={STUDENT_NAV}
        userName={displayName}
        userSubtitle={data?.studentIdNumber}
      />

      <main className="flex-1 p-4 md:p-6">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-4 md:p-6 mb-6">
          <PageHeader
            title={`Welcome back, ${displayName}!`}
            subtitle="Here's how your on-the-job training is going."
            icon={LayoutDashboard}
          />
        </div>

        {isLoading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : error || !data ? (
          <Card>
            <p className="text-sm text-gray-600">
              We couldn&apos;t load your record. If you were just enrolled, your
              coordinator may still be setting up your profile.
            </p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
              <StatCard
                label="Approved Hours"
                value={data.stats.completedHours}
                icon={Clock}
                subtext={`of ${data.stats.requiredHours} required`}
                variant="accent"
              />
              <StatCard
                label="Hours Remaining"
                value={data.stats.remainingHours}
                icon={Hourglass}
                subtext="until you finish"
              />
              <StatCard
                label="Approved Logs"
                value={data.stats.approvedCount}
                icon={CheckCircle2}
                subtext={`${data.stats.totalLogs} submitted`}
              />
              <StatCard
                label="Awaiting Approval"
                value={data.stats.pendingCount}
                icon={CalendarCheck}
                subtext={`${data.stats.pendingHours} hrs pending`}
              />
            </div>

            <Card className="mb-4">
              <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Clock size={18} className="text-blue-600" />
                Overall Progress
              </h2>
              <ProgressBar
                value={data.stats.completedHours}
                max={data.stats.requiredHours || 1}
                showLabel
                colorByValue
              />
              <p className="text-xs text-gray-500 mt-2">
                Only hours your supervisor has approved count toward this total.
                {data.stats.pendingHours > 0 &&
                  ` ${data.stats.pendingHours} more hours are awaiting approval.`}
              </p>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              <Card className="lg:col-span-1">
                <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <GraduationCap size={18} className="text-blue-600" />
                  My Details
                </h2>
                <div className="space-y-3">
                  <DetailItem
                    label="Student ID"
                    value={data.studentIdNumber}
                    icon={IdCard}
                  />
                  <DetailItem
                    label="Course"
                    value={data.course}
                    icon={GraduationCap}
                  />
                  <DetailItem
                    label="Year Level"
                    value={data.yearLevel}
                    icon={GraduationCap}
                  />
                  <DetailItem
                    label="Email"
                    value={data.user.email}
                    icon={Mail}
                  />
                </div>
              </Card>

              <Card className="lg:col-span-2">
                <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Building2 size={18} className="text-blue-600" />
                  My Establishment
                </h2>
                {data.establishment ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <DetailItem
                      label="Establishment"
                      value={data.establishment.name}
                      icon={Building2}
                    />
                    <DetailItem
                      label="Industry"
                      value={data.establishment.industryType}
                      icon={Building2}
                    />
                    <DetailItem
                      label="Contact Person"
                      value={
                        [
                          data.establishment.coordinatorFirstName,
                          data.establishment.coordinatorLastName,
                        ]
                          .filter(Boolean)
                          .join(" ") || null
                      }
                      icon={User}
                    />
                    <DetailItem
                      label="Contact Number"
                      value={data.establishment.coordinatorContact}
                      icon={Phone}
                    />
                    <DetailItem
                      label="Email"
                      value={data.establishment.coordinatorEmail}
                      icon={Mail}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    You haven&apos;t been assigned to an establishment yet. Your
                    coordinator will assign one.
                  </p>
                )}
              </Card>
            </div>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base md:text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <CalendarCheck size={18} className="text-blue-600" />
                  Recent Attendance
                </h2>
                <Link
                  href="/student/attendance"
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  Log attendance
                </Link>
              </div>
              <AttendanceTable
                rows={data.recentAttendance}
                isLoading={false}
                emptyMessage="You haven't logged any attendance yet."
              />
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

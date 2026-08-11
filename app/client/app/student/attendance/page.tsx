"use client";

import Sidebar from "@/components/layout/Sidebar";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import SelectField from "@/components/ui/SelectField";
import {
  CalendarCheck,
  Clock,
  CheckCircle2,
  Hourglass,
  XCircle,
  ClipboardList,
} from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { AttendanceStatus } from "@/lib/api/studentPortalApi";
import { STUDENT_NAV } from "@/features/student-portal/nav";
import { useAttendanceLog } from "@/features/student-portal/hooks/use-attendance-log";
import AttendanceForm from "@/features/student-portal/components/AttendanceForm";
import AttendanceTable from "@/features/student-portal/components/AttendanceTable";

const STATUS_FILTER_OPTIONS = [
  { label: "All Statuses", value: "" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Declined", value: "DECLINED" },
];

export default function StudentAttendancePage() {
  const currentUser = useCurrentUser();
  const {
    form,
    error,
    previewHours,
    isLoading,
    isSubmitting,
    statusFilter,
    page,
    paged,
    totalPages,
    summary,
    setField,
    setStatusFilter,
    setPage,
    handleSubmit,
  } = useAttendanceLog();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        orgName="WPH Institute"
        orgSubtitle="OJT Monitoring"
        items={STUDENT_NAV}
        userName={currentUser?.name || "Student"}
      />

      <main className="flex-1 p-4 md:p-6">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-4 md:p-6 mb-6">
          <PageHeader
            title="Attendance"
            subtitle="Log your daily hours and track their approval"
            icon={CalendarCheck}
            showDateTime
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
          <StatCard
            label="Approved Hours"
            value={summary.approvedHours}
            icon={Clock}
            variant="accent"
          />
          <StatCard
            label="Approved Logs"
            value={summary.approvedCount}
            icon={CheckCircle2}
          />
          <StatCard
            label="Pending"
            value={summary.pendingCount}
            icon={Hourglass}
            subtext={`${summary.pendingHours} hrs awaiting`}
          />
          <StatCard
            label="Declined"
            value={summary.declinedCount}
            icon={XCircle}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <Card className="xl:col-span-2 h-fit">
            <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <ClipboardList size={18} className="text-blue-600" />
              Log Attendance
            </h2>
            <AttendanceForm
              form={form}
              error={error}
              previewHours={previewHours}
              isSubmitting={isSubmitting}
              setField={setField}
              onSubmit={handleSubmit}
            />
          </Card>

          <Card className="xl:col-span-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-base md:text-lg font-semibold text-gray-800 flex items-center gap-2">
                <CalendarCheck size={18} className="text-blue-600" />
                Attendance History
              </h2>
              <div className="sm:w-48">
                <SelectField
                  value={statusFilter}
                  onChange={(value) => {
                    setStatusFilter(value as AttendanceStatus | "");
                    setPage(1);
                  }}
                  placeholder="All Statuses"
                  options={STATUS_FILTER_OPTIONS}
                  className="w-full"
                />
              </div>
            </div>

            <AttendanceTable
              rows={paged}
              isLoading={isLoading}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              emptyMessage={
                statusFilter
                  ? "No logs with that status."
                  : "You haven't logged any attendance yet."
              }
            />
          </Card>
        </div>
      </main>
    </div>
  );
}

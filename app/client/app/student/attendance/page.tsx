"use client";

import Sidebar from "@/components/layout/Sidebar";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import SelectField from "@/components/ui/SelectField";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  CalendarCheck,
  Clock,
  Hourglass,
  XCircle,
  Fingerprint,
  CheckCircle2,
} from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { DayStatus } from "@/lib/api/studentPortalApi";
import { DAY_STATUS_LABEL, PUNCH_LABEL } from "@/lib/attendance";
import { STUDENT_NAV } from "@/features/student-portal/nav";
import { useAttendanceLog } from "@/features/student-portal/hooks/use-attendance-log";
import PunchCard from "@/features/student-portal/components/PunchCard";
import AttendanceTable from "@/features/student-portal/components/AttendanceTable";

const STATUS_FILTER_OPTIONS = [
  { label: "All Days", value: "" },
  ...(Object.keys(DAY_STATUS_LABEL) as DayStatus[]).map((value) => ({
    label: DAY_STATUS_LABEL[value],
    value,
  })),
];

export default function StudentAttendancePage() {
  const currentUser = useCurrentUser();
  const {
    today,
    isTodayLoading,
    isTodayError,
    blockedReason,
    confirmKind,
    punchingKind,
    remarksDraft,
    remarksDirty,
    isSavingRemarks,
    isHistoryLoading,
    statusFilter,
    page,
    paged,
    totalPages,
    summary,
    requestPunch,
    cancelPunch,
    confirmPunch,
    setRemarksDraft,
    saveRemarks,
    setStatusFilter,
    setPage,
  } = useAttendanceLog();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        orgName="WPH Institute"
        orgSubtitle="Barangay San Francisco Pag. City ZDS"
        items={STUDENT_NAV}
        userName={currentUser?.name || "Student"}
      />

      <main className="flex-1 min-w-0 p-4 md:p-6">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-4 md:p-6 mb-6">
          <PageHeader
            title="Attendance"
            subtitle="Punch in and out — each punch is approved by your supervisor"
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
            label="Approved Punches"
            value={summary.approvedPunches}
            icon={CheckCircle2}
          />
          <StatCard
            label="Punches Awaiting Approval"
            value={summary.pendingPunches}
            icon={Hourglass}
            subtext={`${summary.pendingHours} hrs awaiting`}
          />
          <StatCard
            label="Declined Punches"
            value={summary.declinedPunches}
            icon={XCircle}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <Card className="xl:col-span-2 h-fit">
            <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Fingerprint size={18} className="text-blue-600" />
              Today
            </h2>
            <PunchCard
              today={today}
              isLoading={isTodayLoading}
              isError={isTodayError}
              blockedReason={blockedReason}
              punchingKind={punchingKind}
              remarksDraft={remarksDraft}
              remarksDirty={remarksDirty}
              isSavingRemarks={isSavingRemarks}
              onPunch={requestPunch}
              onRemarksChange={setRemarksDraft}
              onSaveRemarks={saveRemarks}
            />
          </Card>

          <Card className="xl:col-span-3 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-base md:text-lg font-semibold text-gray-800 flex items-center gap-2">
                <CalendarCheck size={18} className="text-blue-600" />
                Attendance History
              </h2>
              <div className="sm:w-52">
                <SelectField
                  value={statusFilter}
                  onChange={(value) => setStatusFilter(value as DayStatus | "")}
                  placeholder="All Days"
                  options={STATUS_FILTER_OPTIONS}
                  className="w-full"
                />
              </div>
            </div>

            <AttendanceTable
              rows={paged}
              isLoading={isHistoryLoading}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              emptyMessage={
                statusFilter
                  ? "No days with that status."
                  : "You haven't logged any attendance yet."
              }
            />
          </Card>
        </div>
      </main>

      {/* A punch can't be undone, so every one is confirmed. Cancel holds
          focus (ConfirmDialog's default), so a stray Enter doesn't punch. */}
      <ConfirmDialog
        open={!!confirmKind}
        title={confirmKind ? `Record ${PUNCH_LABEL[confirmKind]}?` : ""}
        message={
          confirmKind
            ? `Record ${PUNCH_LABEL[confirmKind]} now? The time is taken from the server when you confirm. This can't be undone.`
            : ""
        }
        confirmLabel="Yes, record it"
        icon={Fingerprint}
        onConfirm={confirmPunch}
        onCancel={cancelPunch}
      />
    </div>
  );
}

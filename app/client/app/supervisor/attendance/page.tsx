"use client";

import Sidebar from "@/components/layout/Sidebar";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import { CalendarCheck, Hourglass, Clock, ListChecks } from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { SUPERVISOR_NAV } from "@/features/supervisor/nav";
import { useAttendanceApproval } from "@/features/supervisor/hooks/use-attendance-approval";
import ApprovalTable from "@/features/supervisor/components/ApprovalTable";
import DeclineDialog from "@/features/supervisor/components/DeclineDialog";

export default function SupervisorAttendancePage() {
  const currentUser = useCurrentUser();
  const {
    attendance,
    isLoading,
    statusFilter,
    search,
    page,
    paged,
    totalPages,
    filtered,
    pendingHours,
    declineTarget,
    declineReason,
    declineError,
    isDeclining,
    actioningId,
    setStatusFilter,
    setSearch,
    setPage,
    setDeclineReason,
    handleApprove,
    openDecline,
    closeDecline,
    handleDeclineConfirm,
  } = useAttendanceApproval();

  const pendingCount = (attendance ?? []).filter(
    (a) => a.status === "PENDING",
  ).length;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        orgName="WPH Institute"
        orgSubtitle="OJT Monitoring"
        items={SUPERVISOR_NAV}
        userName={currentUser?.name || "Supervisor"}
      />

      <main className="flex-1 p-4 md:p-6">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-4 md:p-6 mb-6">
          <PageHeader
            title="Attendance Approval"
            subtitle="Review and sign off the hours your students have logged"
            icon={CalendarCheck}
            showDateTime
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <StatCard
            label="Awaiting Approval"
            value={pendingCount}
            icon={Hourglass}
            subtext={`${pendingHours} hrs pending`}
            variant="accent"
          />
          <StatCard
            label="Hours in This View"
            value={
              Math.round(
                filtered.reduce((acc, a) => acc + a.hours, 0) * 100,
              ) / 100
            }
            icon={Clock}
          />
          <StatCard
            label="Records Shown"
            value={filtered.length}
            icon={ListChecks}
          />
        </div>

        <Card>
          <ApprovalTable
            rows={paged}
            isLoading={isLoading}
            search={search}
            statusFilter={statusFilter}
            page={page}
            totalPages={totalPages}
            actioningId={actioningId}
            onSearchChange={setSearch}
            onStatusFilterChange={setStatusFilter}
            onPageChange={setPage}
            onApprove={handleApprove}
            onDecline={openDecline}
          />
        </Card>
      </main>

      <DeclineDialog
        target={declineTarget}
        reason={declineReason}
        error={declineError}
        isSubmitting={isDeclining}
        onReasonChange={setDeclineReason}
        onConfirm={handleDeclineConfirm}
        onCancel={closeDecline}
      />
    </div>
  );
}

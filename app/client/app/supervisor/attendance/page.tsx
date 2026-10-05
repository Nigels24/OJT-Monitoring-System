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
    isLoading,
    filter,
    search,
    page,
    paged,
    totalPages,
    filtered,
    summary,
    declineTarget,
    declineReason,
    declineError,
    isDeclining,
    actioningId,
    setFilter,
    setSearch,
    setPage,
    setDeclineReason,
    handleApprove,
    openDecline,
    closeDecline,
    handleDeclineConfirm,
  } = useAttendanceApproval();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        orgName="WPH Institute"
        orgSubtitle="Barangay San Francisco Pag. City ZDS"
        items={SUPERVISOR_NAV}
        userName={currentUser?.name || "Supervisor"}
      />

      <main className="flex-1 min-w-0 p-4 md:p-6">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-4 md:p-6 mb-6">
          <PageHeader
            title="Attendance Approval"
            subtitle="Approve or decline each punch your students record"
            icon={CalendarCheck}
            showDateTime
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <StatCard
            label="Punches Awaiting Approval"
            value={summary.pendingPunches}
            icon={Hourglass}
            subtext={`${summary.pendingHours} hrs pending`}
            variant="accent"
          />
          <StatCard
            label="Approved Hours in View"
            value={summary.approvedHours}
            icon={Clock}
          />
          <StatCard
            label="Days Shown"
            value={filtered.length}
            icon={ListChecks}
          />
        </div>

        <Card>
          <ApprovalTable
            rows={paged}
            isLoading={isLoading}
            search={search}
            filter={filter}
            page={page}
            totalPages={totalPages}
            actioningId={actioningId}
            onSearchChange={setSearch}
            onFilterChange={setFilter}
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

"use client";

import Sidebar from "@/components/layout/Sidebar";
import { COORDINATOR_NAV } from "@/features/coordinator/nav";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import { FileText, Hourglass, ListChecks } from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useDocumentsReview } from "@/features/document/hooks/use-documents-review";
import DocumentsReviewTable from "@/features/document/components/DocumentsReviewTable";
import RejectDialog from "@/features/document/components/RejectDialog";

/**
 * Cross-establishment document review queue. Modeled on the attendance
 * approval page — the coordinator reviews, students upload and see the
 * outcome on their own Documents page.
 */
export default function CoordinatorDocumentsPage() {
  const currentUser = useCurrentUser();
  const {
    isLoading,
    isError,
    statusFilter,
    search,
    page,
    paged,
    totalPages,
    filtered,
    pendingCount,
    rejectTarget,
    rejectReason,
    rejectError,
    isRejecting,
    actioningId,
    setStatusFilter,
    setSearch,
    setPage,
    setRejectReason,
    handleApprove,
    openReject,
    closeReject,
    handleRejectConfirm,
  } = useDocumentsReview();

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
            title="Documents"
            subtitle="Review requirements uploaded across every establishment"
            icon={FileText}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <StatCard
            label="Awaiting Review"
            value={isError ? "—" : pendingCount}
            icon={Hourglass}
            variant="accent"
          />
          <StatCard
            label="Records Shown"
            value={isError ? "—" : filtered.length}
            icon={ListChecks}
          />
        </div>

        <Card>
          <DocumentsReviewTable
            rows={paged}
            isLoading={isLoading}
            isError={isError}
            search={search}
            statusFilter={statusFilter}
            page={page}
            totalPages={totalPages}
            actioningId={actioningId}
            onSearchChange={setSearch}
            onStatusFilterChange={setStatusFilter}
            onPageChange={setPage}
            onApprove={handleApprove}
            onReject={openReject}
          />
        </Card>
      </main>

      <RejectDialog
        target={rejectTarget}
        reason={rejectReason}
        error={rejectError}
        isSubmitting={isRejecting}
        onReasonChange={setRejectReason}
        onConfirm={handleRejectConfirm}
        onCancel={closeReject}
      />
    </div>
  );
}

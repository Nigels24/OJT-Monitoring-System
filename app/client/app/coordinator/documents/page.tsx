"use client";

import Sidebar from "@/components/layout/Sidebar";
import { COORDINATOR_NAV } from "@/features/coordinator/nav";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import { FileText, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import {
  useCoordinatorDocuments,
  TOTAL_DOCUMENT_TYPES,
} from "@/features/document/hooks/use-coordinator-documents";
import DocumentsChecklistTable from "@/features/document/components/DocumentsChecklistTable";
import StudentDocumentsDialog from "@/features/document/components/StudentDocumentsDialog";

/**
 * Cross-establishment requirements checklist: one row per student, one column
 * per document type. The coordinator views and downloads; there is no review.
 */
export default function CoordinatorDocumentsPage() {
  const currentUser = useCurrentUser();
  const {
    isLoading,
    isError,
    stats,
    search,
    completionFilter,
    establishmentFilter,
    establishmentOptions,
    page,
    paged,
    totalPages,
    viewTarget,
    selectedIds,
    allSelected,
    busyKey,
    setSearch,
    setCompletionFilter,
    setEstablishmentFilter,
    setPage,
    openView,
    closeView,
    toggleSelected,
    toggleSelectAll,
    viewFile,
    downloadOne,
    downloadAll,
    downloadSelected,
  } = useCoordinatorDocuments();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        orgName="WPH Institute"
        orgSubtitle="Barangay San Francisco Pag. City ZDS"
        items={COORDINATOR_NAV}
        userName={currentUser?.name || "Coordinator"}
      />

      <main className="flex-1 min-w-0 p-4 md:p-6">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-4 md:p-6 mb-6">
          <PageHeader
            title="Documents"
            subtitle="Track requirements submitted by every student"
            icon={FileText}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <StatCard
            label={`Complete (${TOTAL_DOCUMENT_TYPES}/${TOTAL_DOCUMENT_TYPES})`}
            value={isError ? "—" : stats.complete}
            icon={CheckCircle2}
            variant="accent"
          />
          <StatCard
            label="Incomplete"
            value={isError ? "—" : stats.incomplete}
            icon={AlertCircle}
          />
          <StatCard
            label="Students"
            value={isError ? "—" : stats.students}
            icon={Users}
          />
        </div>

        <Card>
          <DocumentsChecklistTable
            rows={paged}
            isLoading={isLoading}
            isError={isError}
            search={search}
            completionFilter={completionFilter}
            establishmentFilter={establishmentFilter}
            establishmentOptions={establishmentOptions}
            page={page}
            totalPages={totalPages}
            busyKey={busyKey}
            onSearchChange={setSearch}
            onCompletionFilterChange={setCompletionFilter}
            onEstablishmentFilterChange={setEstablishmentFilter}
            onPageChange={setPage}
            onView={openView}
            onDownloadAll={downloadAll}
          />
        </Card>
      </main>

      <StudentDocumentsDialog
        student={viewTarget}
        selectedIds={selectedIds}
        allSelected={allSelected}
        busyKey={busyKey}
        onToggleSelected={toggleSelected}
        onToggleSelectAll={toggleSelectAll}
        onViewFile={viewFile}
        onDownloadFile={downloadOne}
        onDownloadSelected={downloadSelected}
        onClose={closeView}
      />
    </div>
  );
}

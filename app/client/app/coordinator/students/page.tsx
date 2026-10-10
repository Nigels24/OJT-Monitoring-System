"use client";

import Sidebar from "@/components/layout/Sidebar";
import { COORDINATOR_NAV } from "@/features/coordinator/nav";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import TextField from "@/components/ui/TextField";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import {
  Users,
  CheckCircle2,
  Clock,
  UserCheck,
  KeyRound,
} from "lucide-react";
import {
  useStudents,
  BULK_DELETE_CONFIRM_WORD,
} from "@/features/student/hooks/use-students";
import StudentList from "@/features/student/components/StudentList";
import StudentViewDialog from "@/features/student/components/StudentViewDialog";
import StudentEditDialog from "@/features/student/components/StudentEditDialog";
import CredentialsDialog from "@/features/account/CredentialsDialog";
import {
  BULK_DELETE_STUDENTS_EFFECTS,
  deleteStudentMessage,
} from "@/lib/format";


export default function StudentManagementPage() {
  const currentUser = useCurrentUser();
  const {
    form,
    error,
    establishments,
    isLoading,
    isUpdating,
    deleteTarget,
    viewTarget,
    editTarget,
    search,
    statusFilter,
    page,
    paged,
    totalPages,
    stats,
    courseOptions,
    placement,
    STATUS_OPTIONS,
    resendTarget,
    setResendTarget,
    isResending,
    handleResendConfirm,
    issuedCredentials,
    closeIssuedCredentials,
    setField,
    setSearch,
    setStatusFilter,
    setPage,
    setDeleteTarget,
    setViewTarget,
    handleSubmit,
    handleDeleteConfirm,
    handleView,
    handleEdit,
    closeDialog,
    selectedIds,
    selectedStudents,
    selectableFilteredCount,
    allFilteredSelected,
    someFilteredSelected,
    isBulkDeleteOpen,
    isBulkDeleting,
    bulkConfirmText,
    setBulkConfirmText,
    toggleSelected,
    toggleSelectAllFiltered,
    selectAllCompleted,
    clearSelection,
    openBulkDelete,
    closeBulkDelete,
    handleBulkDeleteConfirm,
  } = useStudents();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        orgName="WPH Institute"
        orgSubtitle="Barangay San Francisco Pag. City ZDS"
        items={COORDINATOR_NAV}
        userName={currentUser?.name || "Coordinator"}
      />

      <main className="flex-1 p-4 md:p-6">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-4 md:p-6 mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <PageHeader
            title="Student Management"
            subtitle="Manage OJT students, their assignments and progress. Students are added by their establishment's supervisor."
            icon={Users}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
          <StatCard
            label="Total Students"
            value={stats.total}
            icon={Users}
            variant="accent"
          />
          <StatCard
            label="Active"
            value={stats.active}
            icon={UserCheck}
            subtext="Currently on OJT"
          />
          <StatCard
            label="In Progress"
            value={stats.inProgress}
            icon={Clock}
            subtext="Hours not yet met"
          />
          <StatCard
            label="Completed"
            value={stats.completed}
            icon={CheckCircle2}
            subtext="Finished program"
          />
        </div>

        <Card>
          <StudentList
            isLoading={isLoading}
            search={search}
            statusFilter={statusFilter}
            page={page}
            totalPages={totalPages}
            paged={paged}
            statusOptions={STATUS_OPTIONS}
            onSearchChange={setSearch}
            onStatusFilterChange={setStatusFilter}
            onPageChange={setPage}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={(student) => {
              setDeleteTarget(student);
            }}
            onResendLogin={(student) => {
              setResendTarget(student);
            }}
            selectedIds={selectedIds}
            selectedCount={selectedStudents.length}
            selectableFilteredCount={selectableFilteredCount}
            allFilteredSelected={allFilteredSelected}
            someFilteredSelected={someFilteredSelected}
            onToggleSelected={toggleSelected}
            onToggleSelectAllFiltered={toggleSelectAllFiltered}
            onSelectAllCompleted={selectAllCompleted}
            onClearSelection={clearSelection}
            onBulkDelete={openBulkDelete}
          />
        </Card>
      </main>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Student?"
        message={
          deleteTarget
            ? deleteStudentMessage(deleteTarget.user.name, {
                attendances: deleteTarget._count?.attendances ?? 0,
                evaluations: deleteTarget._count?.evaluations ?? 0,
                documents: deleteTarget._count?.documents ?? 0,
              })
            : ""
        }
        confirmLabel="Yes, delete permanently"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteTarget(null);
        }}
      />

      <ConfirmDialog
        open={isBulkDeleteOpen}
        title={`Delete ${selectedStudents.length} ${
          selectedStudents.length === 1 ? "student" : "students"
        }?`}
        message={`This permanently removes, for each student below, ${BULK_DELETE_STUDENTS_EFFECTS}. This cannot be undone.`}
        confirmLabel={isBulkDeleting ? "Deleting..." : "Delete permanently"}
        variant="danger"
        confirmDisabled={
          isBulkDeleting || bulkConfirmText !== BULK_DELETE_CONFIRM_WORD
        }
        onConfirm={handleBulkDeleteConfirm}
        onCancel={closeBulkDelete}
      >
        <ul className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 text-sm text-gray-700 mb-4">
          {selectedStudents.map((s) => (
            <li key={s.id} className="px-3 py-1.5">
              <span className="font-medium">{s.user.name}</span>{" "}
              <span className="text-xs text-gray-500 font-mono">
                {s.studentIdNumber}
              </span>
            </li>
          ))}
        </ul>
        <TextField
          label={`Type ${BULK_DELETE_CONFIRM_WORD} to confirm`}
          value={bulkConfirmText}
          onChange={(e) => {
            setBulkConfirmText(e.target.value);
          }}
          placeholder={BULK_DELETE_CONFIRM_WORD}
          autoComplete="off"
        />
      </ConfirmDialog>

      <StudentViewDialog
        open={!!viewTarget}
        student={viewTarget}
        onClose={() => {
          setViewTarget(null);
        }}
      />

      <StudentEditDialog
        form={form}
        editTarget={editTarget}
        isUpdating={isUpdating}
        error={error}
        establishments={establishments || []}
        courseOptions={courseOptions}
        placement={placement}
        statusOptions={STATUS_OPTIONS}
        setField={setField}
        onSubmit={handleSubmit}
        onClose={closeDialog}
      />

      <ConfirmDialog
        open={!!resendTarget}
        title="Resend login?"
        message={
          resendTarget
            ? `This generates a new temporary password for ${resendTarget.user.name} and stops their current password from working. They must choose a new one when they next sign in.`
            : ""
        }
        confirmLabel={isResending ? "Generating..." : "Yes, issue a new login"}
        confirmDisabled={isResending}
        icon={KeyRound}
        onConfirm={handleResendConfirm}
        onCancel={() => {
          setResendTarget(null);
        }}
      />

      <CredentialsDialog
        credentials={issuedCredentials}
        onDone={closeIssuedCredentials}
      />
    </div>
  );
}

"use client";

import Sidebar from "@/components/layout/Sidebar";
import { COORDINATOR_NAV } from "@/features/coordinator/nav";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { UserCog, Building2, UserX, KeyRound } from "lucide-react";
import { useSupervisorManagement } from "@/features/supervisor-management/hooks/use-supervisor-management";
import SupervisorList from "@/features/supervisor-management/components/SupervisorList";
import SupervisorFormDialog from "@/features/supervisor-management/components/SupervisorFormDialog";
import CredentialsDialog from "@/features/account/CredentialsDialog";
import { deleteSupervisorMessage } from "@/lib/format";

export default function SupervisorManagementPage() {
  const currentUser = useCurrentUser();
  const {
    form,
    error,
    isLoading,
    isSaving,
    editTarget,
    resendTarget,
    isResending,
    issuedCredentials,
    deleteTarget,
    search,
    page,
    paged,
    totalPages,
    stats,
    setField,
    setSearch,
    setPage,
    setResendTarget,
    setDeleteTarget,
    handleSubmit,
    handleDeleteConfirm,
    handleResendConfirm,
    closeIssuedCredentials,
    handleOpenEdit,
    closeDialog,
  } = useSupervisorManagement();

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
            title="Supervisor Management"
            subtitle="Supervisors are added from the Establishments page; edit their details and logins here"
            icon={UserCog}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <StatCard
            label="Total Supervisors"
            value={stats.total}
            icon={UserCog}
            variant="accent"
          />
          <StatCard
            label="Establishments Covered"
            value={stats.establishmentsCovered}
            icon={Building2}
            subtext="With at least one supervisor"
          />
          <StatCard
            label="No Position Set"
            value={stats.withoutPosition}
            icon={UserX}
            subtext="Missing job title"
          />
        </div>

        <Card>
          <SupervisorList
            isLoading={isLoading}
            search={search}
            page={page}
            totalPages={totalPages}
            paged={paged}
            onSearchChange={setSearch}
            onPageChange={setPage}
            onEdit={handleOpenEdit}
            onResendLogin={(supervisor) => {
              setResendTarget(supervisor);
            }}
            onDelete={(supervisor) => {
              setDeleteTarget(supervisor);
            }}
          />
        </Card>
      </main>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Supervisor?"
        message={
          deleteTarget
            ? deleteSupervisorMessage(deleteTarget.user.name, {
                evaluations: deleteTarget._count?.evaluations ?? 0,
                approvedPunches: deleteTarget._count?.approvedPunches ?? 0,
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

      <SupervisorFormDialog
        supervisor={editTarget}
        form={form}
        isSaving={isSaving}
        error={error}
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

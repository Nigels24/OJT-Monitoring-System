"use client";

import Sidebar from "@/components/layout/Sidebar";
import { COORDINATOR_NAV } from "@/features/coordinator/nav";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { UserCog, Plus, Building2, UserX } from "lucide-react";
import { useSupervisorManagement } from "@/features/supervisor-management/hooks/use-supervisor-management";
import SupervisorList from "@/features/supervisor-management/components/SupervisorList";
import SupervisorFormDialog from "@/features/supervisor-management/components/SupervisorFormDialog";
import ResetSupervisorPasswordDialog from "@/features/supervisor-management/components/ResetSupervisorPasswordDialog";

export default function SupervisorManagementPage() {
  const currentUser = useCurrentUser();
  const {
    form,
    error,
    establishments,
    isLoading,
    isCreating,
    resetTarget,
    deleteTarget,
    isDialogOpen,
    search,
    page,
    paged,
    totalPages,
    stats,
    setField,
    setSearch,
    setPage,
    setResetTarget,
    setDeleteTarget,
    handleSubmit,
    handleDeleteConfirm,
    handleOpenAddDialog,
    closeDialog,
  } = useSupervisorManagement();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        orgName="WPH Institute"
        orgSubtitle="Barangay San Francisco"
        items={COORDINATOR_NAV}
        userName={currentUser?.name || "Coordinator"}
      />

      <main className="flex-1 p-4 md:p-6">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-4 md:p-6 mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <PageHeader
            title="Supervisor Management"
            subtitle="Manage establishment supervisors and their credentials"
            icon={UserCog}
          />
          <Button
            icon={Plus}
            onClick={handleOpenAddDialog}
            fullWidth={false}
            className="self-start md:self-auto"
          >
            Add Supervisor
          </Button>
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
            onResetPassword={(supervisor) => {
              setResetTarget(supervisor);
            }}
            onDelete={(supervisor) => {
              setDeleteTarget(supervisor);
            }}
          />
        </Card>
      </main>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove Supervisor?"
        message={`This permanently deletes "${deleteTarget?.user.name}" and their login. Supervisors with attendance approvals or evaluations cannot be deleted — reassign those records first.`}
        confirmLabel="Yes, remove"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteTarget(null);
        }}
      />

      <SupervisorFormDialog
        open={isDialogOpen}
        form={form}
        isCreating={isCreating}
        error={error}
        establishments={establishments || []}
        setField={setField}
        onSubmit={handleSubmit}
        onClose={closeDialog}
      />

      <ResetSupervisorPasswordDialog
        supervisor={resetTarget}
        onClose={() => {
          setResetTarget(null);
        }}
      />
    </div>
  );
}

"use client";

import Sidebar from "@/components/layout/Sidebar";
import { COORDINATOR_NAV } from "@/features/coordinator/nav";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { deleteEstablishmentMessage } from "@/lib/format";
import Button from "@/components/ui/Button";
import {
  Building2,
  Plus,
} from "lucide-react";
import { useEstablishment } from "../../../features/establishment/hooks/use-establishment";
import EstablishmentList from "../../../features/establishment/components/EstablishmentList";
import EstablishmentViewDialog from "../../../features/establishment/components/EstablishmentViewDialog";
import EstablishmentEditDialog from "../../../features/establishment/components/EstablishmentEditDialog";
import AddSupervisorDialog from "../../../features/establishment/components/AddSupervisorDialog";
import EstablishmentFilterBar from "../../../features/establishment/components/EstablishmentFilterBar";
import { useEstablishmentFilters } from "../../../features/establishment/hooks/use-establishment-filters";
import { useEstablishmentDetail } from "../../../features/establishment/hooks/use-establishment-detail";
import CredentialsDialog from "@/features/account/CredentialsDialog";


export default function EstablishmentManagementPage() {
  const currentUser = useCurrentUser();
  const {
    form,
    error,
    deleteTarget,
    setDeleteTarget,
    viewTarget,
    setViewTarget,
    editTarget,
    establishments,
    isLoading,
    isCreating,
    isUpdating,
    INDUSTRY_OPTIONS,
    newSupervisor,
    laterSupervisor,
    addSupervisorTarget,
    addSupervisorError,
    isAddingSupervisor,
    issuedCredentials,
    regions,
    provinces,
    municipalities,
    barangays,
    selectedRegion,
    selectedProvince,
    selectedMunicipality,
    selectedBarangay,
    setSelectedRegion,
    setSelectedProvince,
    setSelectedMunicipality,
    setSelectedBarangay,
    setField,
    setIsDialogOpen,
    isDialogOpen,
    handleSubmit,
    handleDeleteConfirm,
    handleView,
    handleEdit,
    handleOpenAddDialog,
    handleCloseDialog,
    handleOpenAddSupervisor,
    handleCloseAddSupervisor,
    handleAddSupervisorSubmit,
    closeIssuedCredentials,
  } = useEstablishment();
  // Search, filters and pagination for the list live in their own hook, so
  // nothing here touches useEstablishment's form or address cascade.
  const filters = useEstablishmentFilters(establishments);
  // The view dialog's assigned students (coordinator-only data).
  const detail = useEstablishmentDetail(viewTarget?.id ?? null);

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
            title="Establishment Management"
            subtitle="Manage partner establishments and their supervisors"
            icon={Building2}
          />
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-xl px-3 py-2 md:px-4 md:py-2 flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-800">
              <Building2 size={14} className="md:size-16" />
              <span className="hidden sm:inline">
                Total Establishments:
              </span>{" "}
              {establishments?.length ?? 0}
            </div>
            <Button
              icon={Plus}
              onClick={handleOpenAddDialog}
              fullWidth={false}
              className="self-start md:self-auto"
            >
              Add Establishment
            </Button>
          </div>
        </div>

        <Card>
          <EstablishmentList
            establishments={establishments || []}
            isLoading={isLoading}
            search={filters.search}
            page={filters.page}
            totalPages={filters.totalPages}
            paged={filters.paged}
            onSearchChange={filters.setSearch}
            onPageChange={filters.setPage}
            toolbar={<EstablishmentFilterBar filters={filters} />}
            onClearFilters={filters.clearFilters}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={(establishment) => setDeleteTarget(establishment)}
            onAddSupervisor={handleOpenAddSupervisor}
          />
        </Card>
      </main>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Establishment?"
        message={
          deleteTarget
            ? deleteEstablishmentMessage(deleteTarget.name, {
                supervisorName: deleteTarget.supervisor?.name ?? null,
                students: deleteTarget._count?.students ?? 0,
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

      <EstablishmentViewDialog
        open={!!viewTarget}
        establishment={viewTarget}
        students={detail.students}
        studentsLoading={detail.isLoading}
        studentsError={detail.isError}
        onClose={() => {
          setViewTarget(null);
        }}
      />

      <EstablishmentEditDialog
        open={isDialogOpen}
        form={form}
        editTarget={editTarget}
        isCreating={isCreating}
        isUpdating={isUpdating}
        error={error}
        industryOptions={INDUSTRY_OPTIONS}
        supervisor={newSupervisor}
        regions={regions}
        provinces={provinces}
        municipalities={municipalities}
        barangays={barangays}
        selectedRegion={selectedRegion}
        selectedProvince={selectedProvince}
        selectedMunicipality={selectedMunicipality}
        selectedBarangay={selectedBarangay}
        setSelectedRegion={setSelectedRegion}
        setSelectedProvince={setSelectedProvince}
        setSelectedMunicipality={setSelectedMunicipality}
        setSelectedBarangay={setSelectedBarangay}
        setField={setField}
        onSubmit={handleSubmit}
        onReset={handleCloseDialog}
        onClose={handleCloseDialog}
      />

      <AddSupervisorDialog
        establishment={addSupervisorTarget}
        supervisor={laterSupervisor}
        isSubmitting={isAddingSupervisor}
        error={addSupervisorError}
        onSubmit={handleAddSupervisorSubmit}
        onClose={handleCloseAddSupervisor}
      />

      <CredentialsDialog
        credentials={issuedCredentials}
        onDone={closeIssuedCredentials}
      />
    </div>
  );
}

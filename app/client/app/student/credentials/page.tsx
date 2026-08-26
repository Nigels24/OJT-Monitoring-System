"use client";

import Sidebar from "@/components/layout/Sidebar";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { BadgeCheck, ClipboardList, Trash2 } from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { STUDENT_NAV } from "@/features/student-portal/nav";
import { useCredentials } from "@/features/student-portal/hooks/use-credentials";
import CredentialUploadForm from "@/features/student-portal/components/CredentialUploadForm";
import CredentialsTable from "@/features/student-portal/components/CredentialsTable";
import { CREDENTIAL_TYPE_LABEL } from "@/features/student-portal/components/credentialType";

export default function StudentCredentialsPage() {
  const currentUser = useCurrentUser();
  const {
    credentials,
    isLoading,
    form,
    file,
    error,
    isUploading,
    deleteTarget,
    isDeleting,
    setType,
    handleFileChange,
    handleSubmit,
    openDelete,
    closeDelete,
    handleDeleteConfirm,
  } = useCredentials();

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
            title="Credentials"
            subtitle="Keep your certificates and requirements on file"
            icon={BadgeCheck}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <Card className="xl:col-span-2 h-fit">
            <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <ClipboardList size={18} className="text-blue-600" />
              Upload Credential
            </h2>
            <CredentialUploadForm
              form={form}
              file={file}
              error={error}
              isSubmitting={isUploading}
              setType={setType}
              onFileChange={handleFileChange}
              onSubmit={handleSubmit}
            />
          </Card>

          <Card className="xl:col-span-3">
            <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <BadgeCheck size={18} className="text-blue-600" />
              My Credentials
            </h2>
            <CredentialsTable
              rows={credentials ?? []}
              isLoading={isLoading}
              onDelete={openDelete}
            />
          </Card>
        </div>
      </main>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this credential?"
        message={
          deleteTarget
            ? `"${CREDENTIAL_TYPE_LABEL[deleteTarget.type]}" will be permanently removed. This can't be undone.`
            : ""
        }
        confirmLabel={isDeleting ? "Deleting..." : "Yes, delete it"}
        icon={Trash2}
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={closeDelete}
      />
    </div>
  );
}

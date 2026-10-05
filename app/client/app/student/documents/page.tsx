"use client";

import Sidebar from "@/components/layout/Sidebar";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  FileText,
  ClipboardList,
  ListChecks,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { STUDENT_NAV } from "@/features/student-portal/nav";
import { useDocuments } from "@/features/student-portal/hooks/use-documents";
import DocumentUploadForm from "@/features/student-portal/components/DocumentUploadForm";
import DocumentsTable from "@/features/student-portal/components/DocumentsTable";
import DocumentChecklist from "@/features/student-portal/components/DocumentChecklist";
import { DOCUMENT_TYPE_LABEL } from "@/features/student-portal/components/documentType";

export default function StudentDocumentsPage() {
  const currentUser = useCurrentUser();
  const {
    documents,
    uploadedTypes,
    isLoading,
    form,
    file,
    fileInputKey,
    error,
    isUploading,
    replaceTarget,
    deleteTarget,
    isDeleting,
    setType,
    handleFileChange,
    handleSubmit,
    handleReplaceFile,
    closeReplace,
    handleReplaceConfirm,
    openDelete,
    closeDelete,
    handleDeleteConfirm,
  } = useDocuments();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        orgName="WPH Institute"
        orgSubtitle="Barangay San Francisco Pag. City ZDS"
        items={STUDENT_NAV}
        userName={currentUser?.name || "Student"}
      />

      <main className="flex-1 p-4 md:p-6">
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-4 md:p-6 mb-6">
          <PageHeader
            title="Documents"
            subtitle="Upload your OJT requirements, one file per type"
            icon={FileText}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <div className="xl:col-span-2 space-y-4">
            <Card className="h-fit">
              <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <ClipboardList size={18} className="text-blue-600" />
                Upload Document
              </h2>
              <DocumentUploadForm
                form={form}
                file={file}
                fileInputKey={fileInputKey}
                uploadedTypes={uploadedTypes}
                error={error}
                isSubmitting={isUploading}
                setType={setType}
                onFileChange={handleFileChange}
                onSubmit={handleSubmit}
              />
            </Card>

            <Card className="h-fit">
              <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <ListChecks size={18} className="text-blue-600" />
                Requirements
              </h2>
              <DocumentChecklist uploadedTypes={uploadedTypes} />
            </Card>
          </div>

          <Card className="xl:col-span-3">
            <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileText size={18} className="text-blue-600" />
              My Documents
            </h2>
            <DocumentsTable
              rows={documents ?? []}
              isLoading={isLoading}
              isUploading={isUploading}
              onReplaceFile={handleReplaceFile}
              onDelete={openDelete}
            />
          </Card>
        </div>
      </main>

      <ConfirmDialog
        open={!!replaceTarget}
        title="Replace this document?"
        message={
          replaceTarget
            ? `This will replace your current ${DOCUMENT_TYPE_LABEL[replaceTarget.type]} with "${replaceTarget.file.name}". Continue?`
            : ""
        }
        confirmLabel={isUploading ? "Replacing..." : "Yes, replace it"}
        icon={RefreshCw}
        onConfirm={handleReplaceConfirm}
        onCancel={closeReplace}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this document?"
        message={
          deleteTarget
            ? `Your ${DOCUMENT_TYPE_LABEL[deleteTarget.type]} ("${deleteTarget.fileName}") will be permanently removed. This can't be undone.`
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

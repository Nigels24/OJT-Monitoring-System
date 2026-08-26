import { useState } from "react";
import {
  useGetMyDocumentsQuery,
  useUploadDocumentMutation,
  useDeleteDocumentMutation,
  StudentDocument,
} from "@/lib/api/studentPortalApi";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";

const EMPTY_FORM = { name: "" };

export type DocumentFormValues = typeof EMPTY_FORM;

export function useDocuments() {
  const { data: documents, isLoading } = useGetMyDocumentsQuery();
  const [uploadDocument, { isLoading: isUploading }] =
    useUploadDocumentMutation();
  const [deleteDocument, { isLoading: isDeleting }] =
    useDeleteDocumentMutation();

  const [form, setForm] = useState<DocumentFormValues>(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<StudentDocument | null>(
    null,
  );
  const { showSuccess, showError } = useSnackbar();

  const setField =
    (key: keyof DocumentFormValues) => (e: { target: { value: string } }) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Give the document a name.");
      return;
    }
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }

    const body = new FormData();
    body.append("name", form.name.trim());
    body.append("file", file);

    try {
      await uploadDocument(body).unwrap();
      setForm(EMPTY_FORM);
      setFile(null);
      showSuccess("Document uploaded and sent for review.");
    } catch (err: unknown) {
      const message = readError(err, "Failed to upload document.");
      setError(message);
      showError(message);
    }
  };

  const openDelete = (doc: StudentDocument) => setDeleteTarget(doc);
  const closeDelete = () => setDeleteTarget(null);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDocument(deleteTarget.id).unwrap();
      showSuccess(`Deleted "${deleteTarget.name}".`);
      closeDelete();
    } catch (err: unknown) {
      showError(readError(err, "Failed to delete document."));
    }
  };

  return {
    documents,
    isLoading,
    form,
    file,
    error,
    isUploading,
    deleteTarget,
    isDeleting,

    setField,
    handleFileChange,
    handleSubmit,
    openDelete,
    closeDelete,
    handleDeleteConfirm,
  };
}

function readError(err: unknown, fallback: string): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  if (Array.isArray(data?.message)) return data.message.join(", ");
  return data?.message ?? fallback;
}

import { useState } from "react";
import {
  useGetMyCredentialsQuery,
  useUploadCredentialMutation,
  useDeleteCredentialMutation,
  StudentCredential,
  CredentialType,
} from "@/lib/api/studentPortalApi";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";

const EMPTY_FORM = { type: "" as CredentialType | "" };

export type CredentialFormValues = typeof EMPTY_FORM;

export function useCredentials() {
  const { data: credentials, isLoading } = useGetMyCredentialsQuery();
  const [uploadCredential, { isLoading: isUploading }] =
    useUploadCredentialMutation();
  const [deleteCredential, { isLoading: isDeleting }] =
    useDeleteCredentialMutation();

  const [form, setForm] = useState<CredentialFormValues>(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<StudentCredential | null>(
    null,
  );
  const { showSuccess, showError } = useSnackbar();

  const setType = (type: string) =>
    setForm({ type: type as CredentialType | "" });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.type) {
      setError("Choose a credential type.");
      return;
    }
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }

    const body = new FormData();
    body.append("type", form.type);
    body.append("file", file);

    try {
      await uploadCredential(body).unwrap();
      setForm(EMPTY_FORM);
      setFile(null);
      showSuccess("Credential uploaded.");
    } catch (err: unknown) {
      const message = readError(err, "Failed to upload credential.");
      setError(message);
      showError(message);
    }
  };

  const openDelete = (credential: StudentCredential) =>
    setDeleteTarget(credential);
  const closeDelete = () => setDeleteTarget(null);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCredential(deleteTarget.id).unwrap();
      showSuccess("Credential deleted.");
      closeDelete();
    } catch (err: unknown) {
      showError(readError(err, "Failed to delete credential."));
    }
  };

  return {
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
  };
}

function readError(err: unknown, fallback: string): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  if (Array.isArray(data?.message)) return data.message.join(", ");
  return data?.message ?? fallback;
}

import { useState } from "react";
import {
  useGetMyDocumentsQuery,
  useUploadDocumentMutation,
  useDeleteDocumentMutation,
  StudentDocument,
  DocumentType,
  DOCUMENT_TYPES,
} from "@/lib/api/studentPortalApi";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";
import { DOCUMENT_TYPE_LABEL } from "../components/documentType";

/** Mirrors the server's upload limits, so a 400 isn't how the student finds out. */
const ALLOWED_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const EMPTY_FORM = { type: "" as DocumentType | "" };

export type DocumentFormValues = typeof EMPTY_FORM;

/**
 * A replace waiting on the student's confirmation. `fromForm` says whether to
 * clear the upload form once it lands — a replace started from the table
 * leaves whatever is half-filled in the form alone.
 */
export interface ReplaceTarget {
  type: DocumentType;
  file: File;
  fromForm: boolean;
}

export function useDocuments() {
  const { data, isLoading } = useGetMyDocumentsQuery();
  const [uploadDocument, { isLoading: isUploading }] =
    useUploadDocumentMutation();
  const [deleteDocument, { isLoading: isDeleting }] =
    useDeleteDocumentMutation();

  const [form, setForm] = useState<DocumentFormValues>(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  // The file input is uncontrolled; bumping its key is what clears it.
  const [fileInputKey, setFileInputKey] = useState(0);
  const [error, setError] = useState("");
  const [replaceTarget, setReplaceTarget] = useState<ReplaceTarget | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<StudentDocument | null>(
    null,
  );
  const { showSuccess, showError } = useSnackbar();

  // Enum order, so the table reads like the checklist.
  const documents = [...(data ?? [])].sort(
    (a, b) => DOCUMENT_TYPES.indexOf(a.type) - DOCUMENT_TYPES.indexOf(b.type),
  );
  const uploadedTypes = new Set(documents.map((d) => d.type));

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setFile(null);
    setFileInputKey((k) => k + 1);
  };

  const setType = (type: string) => setForm({ type: type as DocumentType | "" });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
  };

  /** Returns true on success; failures are reported here, not by the caller. */
  const upload = async (
    type: DocumentType,
    chosen: File,
    fromForm: boolean,
  ): Promise<boolean> => {
    const replacing = uploadedTypes.has(type);
    const body = new FormData();
    body.append("type", type);
    body.append("file", chosen);

    try {
      await uploadDocument(body).unwrap();
      showSuccess(
        `${DOCUMENT_TYPE_LABEL[type]} ${replacing ? "replaced" : "uploaded"}.`,
      );
      return true;
    } catch (err: unknown) {
      const message = readError(err, "Failed to upload document.");
      if (fromForm) setError(message);
      showError(message);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.type) {
      setError("Choose a document type.");
      return;
    }
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    const fileError = checkFile(file);
    if (fileError) {
      setError(fileError);
      return;
    }

    if (uploadedTypes.has(form.type)) {
      setReplaceTarget({ type: form.type, file, fromForm: true });
      return;
    }
    if (await upload(form.type, file, true)) resetForm();
  };

  /** The table's Replace button: a file picked for that row's type. */
  const handleReplaceFile = (type: DocumentType, chosen: File) => {
    const fileError = checkFile(chosen);
    if (fileError) {
      showError(fileError);
      return;
    }
    setReplaceTarget({ type, file: chosen, fromForm: false });
  };

  const closeReplace = () => setReplaceTarget(null);

  const handleReplaceConfirm = async () => {
    if (!replaceTarget) return;
    const { type, file: chosen, fromForm } = replaceTarget;
    const ok = await upload(type, chosen, fromForm);
    // Close either way — on failure the snackbar (and, for the form, its
    // error slot) carries the reason, and a retry starts from the form again.
    closeReplace();
    if (ok && fromForm) resetForm();
  };

  const openDelete = (doc: StudentDocument) => setDeleteTarget(doc);
  const closeDelete = () => setDeleteTarget(null);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDocument(deleteTarget.id).unwrap();
      showSuccess(`${DOCUMENT_TYPE_LABEL[deleteTarget.type]} deleted.`);
      closeDelete();
    } catch (err: unknown) {
      showError(readError(err, "Failed to delete document."));
    }
  };

  return {
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
  };
}

function checkFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return "Only PDF, PNG or JPEG files can be uploaded.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return "That file is larger than 10MB.";
  }
  return null;
}

function readError(err: unknown, fallback: string): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  if (Array.isArray(data?.message)) return data.message.join(", ");
  return data?.message ?? fallback;
}

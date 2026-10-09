import { useMemo, useState } from "react";
import {
  useGetSupervisorsQuery,
  useCreateSupervisorMutation,
  useDeleteSupervisorMutation,
  useResendSupervisorCredentialsMutation,
  CoordinatorSupervisor,
} from "@/lib/api/supervisorManagementApi";
import type { IssuedCredentials } from "@/features/account/CredentialsDialog";
import { useGetEstablishmentsQuery } from "@/lib/api/establishmentApi";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";

// No username or password: the server generates both and returns them once.
// The name is in parts because the username is built from the first initial
// and the last name.
const EMPTY_FORM = {
  email: "",
  firstName: "",
  middleInitial: "",
  lastName: "",
  establishmentId: "",
  position: "",
};

export type SupervisorForm = typeof EMPTY_FORM;

const PAGE_SIZE = 5;

export function useSupervisorManagement() {
  const [form, setForm] = useState<SupervisorForm>(EMPTY_FORM);
  const [error, setError] = useState("");
  /** The supervisor whose Resend login is awaiting confirmation. */
  const [resendTarget, setResendTarget] =
    useState<CoordinatorSupervisor | null>(null);
  /**
   * Login details just generated (create or resend), shown once. Cleared on
   * close and kept nowhere else, so nothing can reopen it.
   */
  const [issuedCredentials, setIssuedCredentials] =
    useState<IssuedCredentials | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CoordinatorSupervisor | null>(
    null,
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { showSuccess, showError } = useSnackbar();

  const { data: supervisors, isLoading } = useGetSupervisorsQuery();
  const { data: establishments } = useGetEstablishmentsQuery();
  const [createSupervisor, { isLoading: isCreating }] =
    useCreateSupervisorMutation();
  const [deleteSupervisor] = useDeleteSupervisorMutation();
  const [resendCredentials, { isLoading: isResending }] =
    useResendSupervisorCredentialsMutation();

  const setField =
    (key: keyof SupervisorForm) =>
    (e: { target: { value: string } }) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // SelectField has no native `required`.
    if (!form.establishmentId) {
      setError("Select an establishment.");
      return;
    }

    try {
      const result = await createSupervisor({
        email: form.email,
        firstName: form.firstName,
        middleInitial: form.middleInitial || undefined,
        lastName: form.lastName,
        establishmentId: form.establishmentId,
        position: form.position || undefined,
      }).unwrap();

      closeDialog();
      // The generated username and temporary password, shown once.
      setIssuedCredentials({
        name: result.name,
        email: result.email,
        username: result.credentials.username,
        tempPassword: result.credentials.tempPassword,
        reason: "created",
      });
    } catch (err: unknown) {
      const message = readError(err, "Failed to add supervisor.");
      setError(message);
      showError(message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSupervisor(deleteTarget.id).unwrap();
      showSuccess(`"${deleteTarget.user.name}" has been removed.`);
      setDeleteTarget(null);
    } catch (err: unknown) {
      const message = readError(err, "Failed to remove supervisor.");
      showError(message);
    }
  };

  /** Resend login: a new generated password, after the coordinator confirms. */
  const handleResendConfirm = async () => {
    if (!resendTarget) return;
    try {
      const result = await resendCredentials(resendTarget.id).unwrap();
      setResendTarget(null);
      setIssuedCredentials({
        name: result.name,
        email: result.email,
        username: result.credentials.username,
        tempPassword: result.credentials.tempPassword,
        reason: "resent",
      });
    } catch (err: unknown) {
      showError(readError(err, "Failed to issue a new login."));
    }
  };

  const handleOpenAddDialog = () => {
    setForm(EMPTY_FORM);
    setError("");
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setForm(EMPTY_FORM);
    setError("");
  };

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return (supervisors ?? []).filter((s) => {
      const haystack = [
        s.user.name,
        s.user.username,
        s.user.email,
        s.position,
        s.establishment?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [supervisors, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    const all = supervisors ?? [];
    return {
      total: all.length,
      establishmentsCovered: new Set(all.map((s) => s.establishmentId)).size,
      withoutPosition: all.filter((s) => !s.position).length,
    };
  }, [supervisors]);

  return {
    form,
    error,
    establishments,
    isLoading,
    isCreating,
    resendTarget,
    isResending,
    issuedCredentials,
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
    setResendTarget,
    setDeleteTarget,

    handleSubmit,
    handleDeleteConfirm,
    handleResendConfirm,
    closeIssuedCredentials: () => {
      setIssuedCredentials(null);
    },
    handleOpenAddDialog,
    closeDialog,
  };
}

/** Pulls the API's message out of an RTK Query error, with a fallback. */
function readError(err: unknown, fallback: string): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  if (Array.isArray(data?.message)) return data.message.join(", ");
  return data?.message ?? fallback;
}

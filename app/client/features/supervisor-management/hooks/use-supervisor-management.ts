import { useMemo, useState } from "react";
import {
  useGetSupervisorsQuery,
  useCreateSupervisorMutation,
  useDeleteSupervisorMutation,
  CoordinatorSupervisor,
} from "@/lib/api/supervisorManagementApi";
import { useGetEstablishmentsQuery } from "@/lib/api/establishmentApi";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";

const EMPTY_FORM = {
  email: "",
  username: "",
  password: "",
  name: "",
  establishmentId: "",
  position: "",
};

export type SupervisorForm = typeof EMPTY_FORM;

const PAGE_SIZE = 5;

export function useSupervisorManagement() {
  const [form, setForm] = useState<SupervisorForm>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [resetTarget, setResetTarget] = useState<CoordinatorSupervisor | null>(
    null,
  );
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

  const setField =
    (key: keyof SupervisorForm) =>
    (e: { target: { value: string } }) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const result = await createSupervisor({
        email: form.email,
        username: form.username,
        password: form.password,
        name: form.name,
        establishmentId: form.establishmentId,
        position: form.position || undefined,
      }).unwrap();

      showSuccess(
        `"${result.name}" has been added. Give them the username and password you set.`,
      );
      closeDialog();
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
  };
}

/** Pulls the API's message out of an RTK Query error, with a fallback. */
function readError(err: unknown, fallback: string): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  if (Array.isArray(data?.message)) return data.message.join(", ");
  return data?.message ?? fallback;
}

import { useState } from "react";
import {
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
} from "@/lib/api/studentPortalApi";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";

const EMPTY_FORM = { contactNumber: "", address: "" };

export type ProfileFormValues = typeof EMPTY_FORM;

export function useProfile() {
  const { data, isLoading, error: loadError } = useGetMyProfileQuery();
  const [updateProfile, { isLoading: isSubmitting }] =
    useUpdateMyProfileMutation();
  const [form, setForm] = useState<ProfileFormValues>(EMPTY_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const { showSuccess, showError } = useSnackbar();

  const setField =
    (key: keyof ProfileFormValues) =>
    (e: { target: { value: string } }) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };

  // Seeded from the loaded record only at the moment editing starts, rather
  // than synced via an effect — the student's in-progress edits shouldn't be
  // clobbered by a background refetch.
  const startEditing = () => {
    if (!data) return;
    setForm({
      contactNumber: data.contactNumber ?? "",
      address: data.address ?? "",
    });
    setError("");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await updateProfile({
        contactNumber: form.contactNumber || undefined,
        address: form.address || undefined,
      }).unwrap();

      setIsEditing(false);
      showSuccess("Profile updated.");
    } catch (err: unknown) {
      const message = readError(err, "Failed to update profile.");
      setError(message);
      showError(message);
    }
  };

  return {
    data,
    isLoading,
    loadError,
    form,
    error,
    isEditing,
    isSubmitting,

    setField,
    startEditing,
    cancelEditing,
    handleSubmit,
  };
}

function readError(err: unknown, fallback: string): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  if (Array.isArray(data?.message)) return data.message.join(", ");
  return data?.message ?? fallback;
}

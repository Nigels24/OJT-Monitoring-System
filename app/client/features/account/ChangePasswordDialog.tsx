"use client";

import { useState } from "react";
import { KeyRound, X } from "lucide-react";
import TextField from "@/components/ui/TextField";
import Button from "@/components/ui/Button";
import { useChangePasswordMutation } from "@/lib/api/authApi";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

const MIN_LENGTH = 8;

/**
 * Lets any signed-in user change their own password.
 *
 * Rendered from the Sidebar so all three roles get it from one place. The
 * current password is required — see AuthService.changePassword for why holding
 * a valid session isn't sufficient on its own.
 */
export default function ChangePasswordDialog({
  open,
  onClose,
}: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [changePassword, { isLoading }] = useChangePasswordMutation();
  const { showSuccess } = useSnackbar();

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < MIN_LENGTH) {
      setError(`New password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    // Caught here rather than server-side: the confirmation field exists only
    // to catch typing mistakes, so it never needs to reach the API.
    if (newPassword !== confirmPassword) {
      setError("The two new passwords don't match.");
      return;
    }

    try {
      await changePassword({ currentPassword, newPassword }).unwrap();
      showSuccess("Your password has been changed.");
      close();
    } catch (err: unknown) {
      const data = (err as { data?: { message?: string | string[] } })?.data;
      setError(
        Array.isArray(data?.message)
          ? data.message.join(", ")
          : (data?.message ?? "Failed to change your password."),
      );
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <KeyRound size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Change Password
            </h2>
          </div>
          <button
            onClick={close}
            className="p-2 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4">
          <TextField
            label="Current Password"
            labelIcon={KeyRound}
            fieldIcon={KeyRound}
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Your password right now"
          />
          <TextField
            label="New Password"
            labelIcon={KeyRound}
            fieldIcon={KeyRound}
            type="password"
            required
            minLength={MIN_LENGTH}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={`At least ${MIN_LENGTH} characters`}
          />
          <TextField
            label="Confirm New Password"
            labelIcon={KeyRound}
            fieldIcon={KeyRound}
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Type it again"
          />

          {error && (
            <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={close}
              className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <div className="sm:w-44">
              <Button type="submit" icon={KeyRound} loading={isLoading}>
                Change password
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

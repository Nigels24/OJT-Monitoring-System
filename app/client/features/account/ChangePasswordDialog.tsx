"use client";

import { useState } from "react";
import { KeyRound, LogOut, X } from "lucide-react";
import TextField from "@/components/ui/TextField";
import Button from "@/components/ui/Button";
import { useChangePasswordMutation } from "@/lib/api/authApi";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";
import Overlay from "@/components/ui/Overlay";
import { persistSession, type StoredUser } from "@/lib/auth";

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * The signed-in password is system-generated and must be replaced first.
   * The dialog then cannot be dismissed — no close button, no Cancel, and
   * Escape and the backdrop do nothing — and offers Log out as the only other
   * way out. The server enforces the same thing (RolesGuard's
   * PASSWORD_CHANGE_REQUIRED), so this is the UI for a rule, not the rule.
   */
  forced?: boolean;
  /** Required in forced mode: the one alternative to changing the password. */
  onLogout?: () => void;
}

const MIN_LENGTH = 8;

/**
 * Lets any signed-in user change their own password.
 *
 * Rendered from the Sidebar so all three roles get it from one place — in
 * forced mode too, which the Sidebar opens on its own whenever the stored
 * user has `mustChangePassword`. The current password is required either way
 * — see AuthService.changePassword for why holding a valid session isn't
 * sufficient on its own.
 */
export default function ChangePasswordDialog({
  open,
  onClose,
  forced = false,
  onLogout,
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
      const result = await changePassword({
        currentPassword,
        newPassword,
      }).unwrap();
      // The response is a fresh session. Storing it matters most in forced
      // mode: the old token carries the must-change claim and every request
      // with it is refused.
      persistSession(result.accessToken, result.user as StoredUser);
      if (forced) {
        // Full reload: everything this page queried was refused while the
        // flag was set, and a reload refetches all of it with the new token
        // in one step rather than resetting a dozen RTK Query slices by hand.
        window.location.reload();
        return;
      }
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
    <Overlay
      open
      label={forced ? "Set a New Password" : "Change Password"}
      // Overlay sends Escape to onClose; forced mode gives it nothing to do.
      onClose={forced ? () => undefined : close}
      closeOnBackdrop={false}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <KeyRound size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {forced ? "Set a New Password" : "Change Password"}
            </h2>
          </div>
          {!forced && (
            <button
              onClick={close}
              className="p-2 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4">
          {forced && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              You signed in with a temporary password. Choose your own password
              to continue — enter the temporary one as your current password.
            </p>
          )}
          <TextField
            label="Current Password"
            labelIcon={KeyRound}
            fieldIcon={KeyRound}
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={
              forced ? "The temporary password you were given" : "Your password right now"
            }
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
            {forced ? (
              <button
                type="button"
                onClick={onLogout}
                className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 inline-flex items-center justify-center gap-2"
              >
                <LogOut size={16} />
                Log out
              </button>
            ) : (
              <button
                type="button"
                onClick={close}
                className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
            <div className="sm:w-44">
              <Button type="submit" icon={KeyRound} loading={isLoading}>
                Change password
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Overlay>
  );
}

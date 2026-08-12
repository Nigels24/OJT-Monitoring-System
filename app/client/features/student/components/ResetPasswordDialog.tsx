import { useState } from "react";
import { KeyRound, X, Copy, Check } from "lucide-react";
import TextField from "@/components/ui/TextField";
import Button from "@/components/ui/Button";
import { Student, useResetStudentPasswordMutation } from "@/lib/api/studentApi";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";

interface ResetPasswordDialogProps {
  student: Student | null;
  onClose: () => void;
}

const MIN_LENGTH = 8;

/** Generated default so the coordinator doesn't have to invent one. */
function suggestPassword(): string {
  return `ojt-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Issues a new password for a student who has forgotten theirs.
 *
 * This is the recovery path in place of an emailed reset link — there is no
 * mail infrastructure, and the coordinator already issues every credential by
 * hand. The password is shown in plain text so it can be read out or copied;
 * it is hashed server-side and unreadable afterwards.
 */
export default function ResetPasswordDialog({
  student,
  onClose,
}: ResetPasswordDialogProps) {
  const [password, setPassword] = useState(suggestPassword);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState(false);
  const [resetPassword, { isLoading }] = useResetStudentPasswordMutation();
  const { showSuccess } = useSnackbar();

  const close = () => {
    setPassword(suggestPassword());
    setError("");
    setCopied(false);
    setDone(false);
    onClose();
  };

  const handleCopy = async () => {
    if (!student) return;
    await navigator.clipboard.writeText(
      `Username: ${student.user.username ?? student.user.email}\nPassword: ${password}`,
    );
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }

    try {
      await resetPassword({ id: student!.id, password }).unwrap();
      setDone(true);
      showSuccess(`Password reset for ${student!.user.name}.`);
    } catch (err: unknown) {
      const data = (err as { data?: { message?: string | string[] } })?.data;
      setError(
        Array.isArray(data?.message)
          ? data.message.join(", ")
          : (data?.message ?? "Failed to reset the password."),
      );
    }
  };

  if (!student) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <KeyRound size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Reset Password
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

        <div className="p-4 md:p-6 space-y-4">
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm">
            <div className="font-semibold text-gray-900">
              {student.user.name}
            </div>
            <div className="text-gray-600 font-mono text-xs mt-0.5">
              {student.user.username ?? student.user.email}
            </div>
          </div>

          {done ? (
            <>
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Password changed. Give it to the student now — it can&apos;t be
                read back later.
              </p>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 flex items-center justify-between gap-4">
                <span className="text-sm text-gray-500">New password</span>
                <span className="font-mono font-semibold text-gray-900 break-all">
                  {password}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  icon={copied ? Check : Copy}
                  variant="secondary"
                  onClick={handleCopy}
                >
                  {copied ? "Copied" : "Copy login details"}
                </Button>
                <Button type="button" onClick={close}>
                  Done
                </Button>
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <TextField
                label="New Password"
                labelIcon={KeyRound}
                fieldIcon={KeyRound}
                type="text"
                required
                minLength={MIN_LENGTH}
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`At least ${MIN_LENGTH} characters`}
              />
              <p className="text-xs text-gray-500">
                A password has been suggested — edit it if you prefer. The
                student can change it themselves once they sign in.
              </p>

              {error && (
                <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                <button
                  type="button"
                  onClick={close}
                  className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <div className="sm:w-44">
                  <Button type="submit" icon={KeyRound} loading={isLoading}>
                    Reset password
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

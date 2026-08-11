import { useState } from "react";
import { KeyRound, Copy, Check } from "lucide-react";
import ViewDialog from "@/components/ui/ViewDialog";
import Button from "@/components/ui/Button";

interface NewCredentialsDialogProps {
  credentials: { email: string; password: string } | null;
  onClose: () => void;
}

/**
 * Shows the generated password once, right after a student is created.
 *
 * The server hashes it immediately, so this is the only moment it can be read.
 * Closing this dialog loses it for good — the coordinator would have to reset
 * the account instead.
 */
export default function NewCredentialsDialog({
  credentials,
  onClose,
}: NewCredentialsDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!credentials) return;
    await navigator.clipboard.writeText(
      `Email: ${credentials.email}\nPassword: ${credentials.password}`,
    );
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <ViewDialog
      open={!!credentials}
      title="Student Login Created"
      icon={KeyRound}
      onClose={onClose}
    >
      {credentials && (
        <div className="space-y-4">
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            This password is shown <strong>once</strong>. Copy it now and give
            it to the student — it cannot be retrieved later.
          </p>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-gray-500">Email</span>
              <span className="font-mono text-gray-900 break-all">
                {credentials.email}
              </span>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-gray-500">Temporary password</span>
              <span className="font-mono font-semibold text-gray-900 break-all">
                {credentials.password}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              icon={copied ? Check : Copy}
              variant="secondary"
              onClick={handleCopy}
            >
              {copied ? "Copied" : "Copy credentials"}
            </Button>
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      )}
    </ViewDialog>
  );
}

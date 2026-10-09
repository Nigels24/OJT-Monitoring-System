"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, ShieldAlert, UserCheck } from "lucide-react";
import Button from "@/components/ui/Button";
import Overlay from "@/components/ui/Overlay";

/**
 * Login details the server just generated: a new account, or a "Resend
 * login". `username` is null only for an account from before usernames
 * existed, which signs in with its email instead.
 */
export interface IssuedCredentials {
  /** Whose account — shown so the details are handed to the right person. */
  name: string;
  email: string;
  username: string | null;
  tempPassword: string;
  /** "created" for a new account, "resent" for a Resend login. */
  reason: "created" | "resent";
}

interface CredentialsDialogProps {
  /** `null` = closed. The caller clears it on close, and keeps no copy. */
  credentials: IssuedCredentials | null;
  onDone: () => void;
}

/**
 * Shows a generated username and temporary password exactly once.
 *
 * The password is stored hashed and can never be read back, so this dialog is
 * the only time anyone sees it. That is why it closes only on the explicit
 * "Done" button — Escape and the backdrop do nothing, since an accidental
 * dismissal would lose the password for good — and why the caller holds the
 * credentials in transient state and drops them on close: there is no list
 * action that could reopen it. A lost password means another Resend login.
 */
export default function CredentialsDialog({
  credentials,
  onDone,
}: CredentialsDialogProps) {
  const [copied, setCopied] = useState<"username" | "password" | "both" | null>(
    null,
  );

  if (!credentials) return null;

  const signInAs = credentials.username ?? credentials.email;

  const copy = async (what: "username" | "password" | "both") => {
    const text =
      what === "username"
        ? signInAs
        : what === "password"
          ? credentials.tempPassword
          : `Username: ${signInAs}\nTemporary password: ${credentials.tempPassword}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => {
        setCopied(null);
      }, 2000);
    } catch {
      // Clipboard can be refused (permissions, insecure origin). The values
      // are on screen and selectable, so there is nothing more to do.
    }
  };

  const done = () => {
    setCopied(null);
    onDone();
  };

  return (
    <Overlay
      open
      label="Login details"
      onClose={() => undefined}
      closeOnBackdrop={false}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 p-4 md:p-6 border-b border-gray-200">
          <UserCheck size={20} className="text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            {credentials.reason === "created"
              ? "Account created"
              : "New login issued"}
          </h2>
        </div>

        <div className="p-4 md:p-6 space-y-4">
          <p className="text-sm text-gray-700">
            Give these login details to{" "}
            <span className="font-semibold">{credentials.name}</span>. They
            will be asked to choose their own password the first time they sign
            in.
          </p>

          <CredentialRow
            label={credentials.username ? "Username" : "Sign in with email"}
            value={signInAs}
            copied={copied === "username"}
            onCopy={() => copy("username")}
          />
          <CredentialRow
            label="Temporary password"
            value={credentials.tempPassword}
            copied={copied === "password"}
            onCopy={() => copy("password")}
          />

          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
            <ShieldAlert size={16} className="shrink-0 mt-0.5" />
            This password will not be shown again. Copy it or write it down
            before you close this. If it is lost, use Resend login to issue a
            new one.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              variant="secondary"
              icon={copied === "both" ? Check : Copy}
              onClick={() => copy("both")}
            >
              {copied === "both" ? "Copied" : "Copy both"}
            </Button>
            <Button type="button" icon={KeyRound} onClick={done}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function CredentialRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="font-mono font-semibold text-gray-900 break-all select-all">
          {value}
        </div>
      </div>
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy ${label.toLowerCase()}`}
        title={`Copy ${label.toLowerCase()}`}
        className="shrink-0 p-2 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-200"
      >
        {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
      </button>
    </div>
  );
}

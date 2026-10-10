import StatusBadge from "@/components/ui/StatusBadge";
import type { CredentialsEmailStatus } from "@/lib/api/studentApi";

/** A real instant, so the viewer's local time (CLAUDE.md §4 dates). */
function formatSentAt(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Whether this account's last login email arrived, from the status stored on
 * the user (so it survives a reload): "Email failed" while an error is
 * recorded, "Emailed" once one was sent, and nothing at all when neither —
 * an account from before emails, or one issued while mail was in log mode.
 * The title carries the reason and the time.
 */
export default function EmailStatusBadge({
  status,
}: {
  status: Partial<CredentialsEmailStatus>;
}) {
  const { credentialsSentAt, credentialsEmailError } = status;

  if (credentialsEmailError) {
    const title =
      `Email failed: ${credentialsEmailError}` +
      (credentialsSentAt
        ? ` · last emailed ${formatSentAt(credentialsSentAt)}`
        : "");
    return (
      <span title={title} aria-label={title} className="inline-block mt-1">
        <StatusBadge label="Email failed" variant="declined" />
      </span>
    );
  }
  if (credentialsSentAt) {
    const title = `Login emailed ${formatSentAt(credentialsSentAt)}`;
    return (
      <span title={title} aria-label={title} className="inline-block mt-1">
        <StatusBadge label="Emailed" variant="neutral" />
      </span>
    );
  }
  return null;
}

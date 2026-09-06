/**
 * "2h ago" style formatting for the conversation list. No date library is
 * installed anywhere in this codebase (every other page uses plain
 * toLocaleDateString/toLocaleTimeString), so this is a small hand-rolled
 * helper rather than a new dependency.
 */
export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);

  if (diffSec < 5) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;

  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString();
}

/** Full timestamp for a message bubble — just the time if today, else date + time. */
export function formatMessageTimestamp(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const time = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) return time;
  return `${date.toLocaleDateString()} ${time}`;
}

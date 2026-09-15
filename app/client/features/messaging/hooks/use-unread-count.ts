import { useGetUnreadQuery } from "@/lib/api/messagesApi";

/**
 * The unread badge on the sidebar's Messages entry.
 *
 * Replaces the notification bell that used to sit in the sidebar footer: same
 * endpoint (`GET /messages/unread`), same cadence — a 10s poll that pauses
 * while the tab is unfocused, matching the conversation list in
 * `use-messaging.ts`. It polls from the sidebar, which is on every page, so
 * this stays a separate subscription from the Messages page's own.
 *
 * Opening a conversation invalidates the `Unread` tag (`messagesApi`), so the
 * badge clears without waiting out the interval or reloading.
 */
export function useUnreadCount() {
  const { data } = useGetUnreadQuery(undefined, {
    pollingInterval: 10000,
    skipPollingIfUnfocused: true,
  });

  return {
    /** Conversations with something unread in them — what the badge counts. */
    conversationCount: data?.conversations.length ?? 0,
    /** Unread messages across all of them. */
    totalUnread: data?.totalUnread ?? 0,
  };
}

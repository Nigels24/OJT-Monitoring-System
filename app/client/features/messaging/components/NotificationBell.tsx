"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, MessageSquareText } from "lucide-react";
import { useGetUnreadQuery } from "@/lib/api/messagesApi";

interface NotificationBellProps {
  /** The signed-in role's Messages page, taken from the sidebar's own nav so this never hardcodes a role's route. */
  messagesHref: string;
}

/** Truncates a message body for the dropdown's one-line preview. */
function snippet(content: string, max = 60): string {
  return content.length > max ? `${content.slice(0, max).trimEnd()}…` : content;
}

/**
 * Sidebar footer bell — new-message notifications for all three roles.
 *
 * Polls the same 10s cadence as the conversation list (`use-messaging.ts`),
 * `skipPollingIfUnfocused` so it doesn't run for every open tab. Visual
 * only — no sound, deliberately (CLAUDE.md-adjacent: an unexpected noise
 * during a defense is worse than none).
 *
 * The dropdown links to the Messages page generally, not to a specific
 * thread — `use-messaging.ts` keeps `activeConversationId` as plain
 * component state with no URL param to target, and wiring one up wasn't
 * worth touching that hook's pagination-reset invariants for. Opening
 * Messages and picking the conversation is one extra click.
 */
export default function NotificationBell({
  messagesHref,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data } = useGetUnreadQuery(undefined, {
    pollingInterval: 10000,
    skipPollingIfUnfocused: true,
  });
  const totalUnread = data?.totalUnread ?? 0;
  const conversations = data?.conversations ?? [];

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => {
          setOpen((v) => !v);
        }}
        aria-label={
          totalUnread > 0
            ? `Notifications, ${totalUnread} unread`
            : "Notifications"
        }
        title="Notifications"
        className="relative text-white/80 hover:text-white shrink-0"
      >
        <Bell size={18} />
        {totalUnread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 font-semibold text-center">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-72 max-h-80 overflow-y-auto rounded-lg bg-white shadow-xl border border-gray-200 text-gray-800 z-50">
          <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Unread Messages
          </div>
          {conversations.length === 0 ? (
            <p className="px-3 py-4 text-sm text-gray-400 text-center">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul>
              {conversations.map((c) => (
                <li key={c.id} className="border-b border-gray-50 last:border-0">
                  <Link
                    href={messagesHref}
                    onClick={() => {
                      setOpen(false);
                    }}
                    className="flex items-start gap-2 px-3 py-2.5 hover:bg-gray-50"
                  >
                    <MessageSquareText
                      size={16}
                      className="text-blue-600 mt-0.5 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {c.otherParticipant?.name ?? "Unknown"}
                        </span>
                        <span className="shrink-0 text-[10px] font-semibold text-white bg-blue-600 rounded-full px-1.5 py-0.5">
                          {c.unreadCount}
                        </span>
                      </div>
                      {c.lastMessage && (
                        <p className="text-xs text-gray-500 truncate">
                          {snippet(c.lastMessage.content)}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={messagesHref}
            onClick={() => {
              setOpen(false);
            }}
            className="block text-center text-xs font-medium text-blue-600 hover:bg-gray-50 px-3 py-2 border-t border-gray-100"
          >
            Go to Messages
          </Link>
        </div>
      )}
    </div>
  );
}

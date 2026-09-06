"use client";

import { useLayoutEffect, useRef } from "react";
import { ChevronLeft, MessageSquare, Send } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { ConversationSummary, MessageSummary } from "@/lib/api/messagesApi";
import { formatMessageTimestamp } from "../format";

interface MessageThreadProps {
  conversation: ConversationSummary | null;
  currentUserId: string | null;
  messages: MessageSummary[];
  hasMoreOlder: boolean;
  isLoadingOlder: boolean;
  onLoadOlder: () => void;
  draft: string;
  setDraft: (value: string) => void;
  canSend: boolean;
  isSending: boolean;
  onSend: () => void;
  maxMessageLength: number;
  onBack: () => void;
  /** Hidden on mobile until a conversation is open — see MessagingView. */
  className?: string;
}

export default function MessageThread({
  conversation,
  currentUserId,
  messages,
  hasMoreOlder,
  isLoadingOlder,
  onLoadOlder,
  draft,
  setDraft,
  canSend,
  isSending,
  onSend,
  maxMessageLength,
  onBack,
  className = "",
}: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number | null>(null);
  const prevMessageCountRef = useRef(0);

  // Keep the viewport pinned to the bottom as new messages arrive (poll or
  // send); when "Load older" was just clicked, anchor to the same spot in
  // the thread instead of jumping, using the scrollHeight delta captured in
  // handleLoadOlderClick below.
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    if (prevScrollHeightRef.current !== null) {
      container.scrollTop += container.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = null;
    } else if (messages.length !== prevMessageCountRef.current) {
      container.scrollTop = container.scrollHeight;
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  const handleLoadOlderClick = () => {
    if (scrollRef.current) {
      prevScrollHeightRef.current = scrollRef.current.scrollHeight;
    }
    onLoadOlder();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  if (!conversation) {
    return (
      <div className={`flex flex-col items-center justify-center text-center px-6 ${className}`}>
        <MessageSquare size={40} className="text-gray-300 mb-3" />
        <p className="text-gray-500 text-sm">
          Select a conversation, or start a new one.
        </p>
      </div>
    );
  }

  const other = conversation.otherParticipant;
  const nearLimit = draft.length > maxMessageLength * 0.9;
  const overLimit = draft.length > maxMessageLength;

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
        <button
          onClick={onBack}
          className="md:hidden p-1 -ml-1 text-gray-500 hover:text-gray-700"
          aria-label="Back to conversations"
        >
          <ChevronLeft size={20} />
        </button>
        <Avatar name={other?.name ?? "?"} size={36} />
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate">
            {other?.name ?? "Unknown user"}
          </p>
          {other?.role && (
            <p className="text-xs text-gray-400 capitalize">
              {other.role.toLowerCase()}
            </p>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">
            No messages in this conversation yet. Say hello!
          </p>
        ) : (
          <>
            {hasMoreOlder && (
              <div className="flex justify-center mb-3">
                <button
                  onClick={handleLoadOlderClick}
                  disabled={isLoadingOlder}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-full border border-blue-200 hover:bg-blue-50"
                >
                  {isLoadingOlder ? "Loading..." : "Load older messages"}
                </button>
              </div>
            )}

            <div className="space-y-3">
              {messages.map((message) => {
                const isMine = message.senderId === currentUserId;
                return (
                  <div
                    key={message.id}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words ${
                          isMine
                            ? "bg-blue-600 text-white rounded-br-sm"
                            : "bg-white border border-gray-200 text-gray-900 rounded-bl-sm"
                        }`}
                      >
                        {message.content}
                      </div>
                      <span className="text-xs text-gray-400 px-1">
                        {!isMine && other?.name ? `${other.name} · ` : ""}
                        {formatMessageTimestamp(message.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="border-t border-gray-100 p-3 shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1 border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full resize-none outline-none px-3 py-2.5 text-sm text-gray-900 bg-transparent max-h-32"
            />
          </div>
          <button
            onClick={onSend}
            disabled={!canSend}
            aria-label="Send message"
            className="h-10 w-10 shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
        {nearLimit && (
          <p
            className={`text-xs mt-1 text-right ${overLimit ? "text-red-600" : "text-gray-400"}`}
          >
            {draft.length}/{maxMessageLength}
          </p>
        )}
        {isSending && (
          <p className="text-xs text-gray-400 mt-1">Sending…</p>
        )}
      </div>
    </div>
  );
}

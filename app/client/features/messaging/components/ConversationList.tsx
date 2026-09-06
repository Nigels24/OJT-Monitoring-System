import { MessageSquarePlus } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { ConversationSummary } from "@/lib/api/messagesApi";
import { formatRelativeTime } from "../format";

interface ConversationListProps {
  conversations: ConversationSummary[];
  isLoading: boolean;
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onOpenPicker: () => void;
  /** Hidden on mobile once a thread is open — see MessagingView. */
  className?: string;
}

export default function ConversationList({
  conversations,
  isLoading,
  activeConversationId,
  onSelect,
  onOpenPicker,
  className = "",
}: ConversationListProps) {
  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <h2 className="font-semibold text-gray-900">Messages</h2>
        <button
          onClick={onOpenPicker}
          aria-label="New message"
          title="New message"
          className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
        >
          <MessageSquarePlus size={20} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <p className="text-gray-400 text-sm p-4">Loading...</p>
        ) : conversations.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center px-4">
            No conversations yet. Start one with the button above.
          </p>
        ) : (
          conversations.map((conversation) => {
            const other = conversation.otherParticipant;
            const active = conversation.id === activeConversationId;
            const unread = conversation.unreadCount > 0;

            return (
              <button
                key={conversation.id}
                onClick={() => onSelect(conversation.id)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-gray-50 transition-colors ${
                  active ? "bg-blue-50" : "hover:bg-gray-50"
                }`}
              >
                <Avatar name={other?.name ?? "?"} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-900 truncate">
                      {other?.name ?? "Unknown user"}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {formatRelativeTime(conversation.updatedAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p
                      className={`text-sm truncate ${unread ? "text-gray-900 font-medium" : "text-gray-500"}`}
                    >
                      {conversation.lastMessage?.content ?? "No messages yet"}
                    </p>
                    {unread && (
                      <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center">
                        {conversation.unreadCount}
                      </span>
                    )}
                  </div>
                  {other?.role && (
                    <span className="text-xs text-gray-400 capitalize">
                      {other.role.toLowerCase()}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

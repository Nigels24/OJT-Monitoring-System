import { useMessaging } from "../hooks/use-messaging";
import ConversationList from "./ConversationList";
import MessageThread from "./MessageThread";
import ContactPickerDialog from "./ContactPickerDialog";

/**
 * The whole two-pane messaging screen. Every role page renders this same
 * component with the same hook output — see CLAUDE.md §5 "Which feature
 * domain?": one domain, because all three roles read the identical shape.
 *
 * On mobile only one pane shows at a time (list, or the open thread); both
 * show side by side from the md breakpoint up.
 */
export default function MessagingView(props: ReturnType<typeof useMessaging>) {
  const {
    currentUserId,
    conversations,
    conversationsLoading,
    activeConversationId,
    activeConversation,
    onSelectConversation,
    onBackToList,
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
    pickerOpen,
    onOpenPicker,
    onClosePicker,
    contacts,
    contactsLoading,
    contactSearch,
    setContactSearch,
    onSelectContact,
    isCreatingConversation,
  } = props;

  return (
    <div className="flex-1 flex gap-4 min-h-0 h-[calc(100vh-220px)] min-h-[480px]">
      <ConversationList
        conversations={conversations}
        isLoading={conversationsLoading}
        activeConversationId={activeConversationId}
        onSelect={onSelectConversation}
        onOpenPicker={onOpenPicker}
        className={`w-full md:w-80 shrink-0 bg-white rounded-2xl shadow-sm overflow-hidden ${
          activeConversationId ? "hidden md:flex" : "flex"
        }`}
      />

      <MessageThread
        conversation={activeConversation}
        currentUserId={currentUserId}
        messages={messages}
        hasMoreOlder={hasMoreOlder}
        isLoadingOlder={isLoadingOlder}
        onLoadOlder={onLoadOlder}
        draft={draft}
        setDraft={setDraft}
        canSend={canSend}
        isSending={isSending}
        onSend={onSend}
        maxMessageLength={maxMessageLength}
        onBack={onBackToList}
        className={`flex-1 bg-white rounded-2xl shadow-sm overflow-hidden ${
          activeConversationId ? "flex" : "hidden md:flex"
        }`}
      />

      <ContactPickerDialog
        open={pickerOpen}
        contacts={contacts}
        isLoading={contactsLoading}
        isCreating={isCreatingConversation}
        search={contactSearch}
        onSearchChange={setContactSearch}
        onSelect={onSelectContact}
        onClose={onClosePicker}
      />
    </div>
  );
}

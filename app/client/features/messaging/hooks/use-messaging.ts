import { useCallback, useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query/react";
import {
  Contact,
  useCreateConversationMutation,
  useGetContactsQuery,
  useGetConversationsQuery,
  useGetMessagesQuery,
  useLazyGetMessagesQuery,
  useSendMessageMutation,
} from "@/lib/api/messagesApi";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useSnackbar } from "@/lib/contexts/SnackbarContext";

const MESSAGE_PAGE_SIZE = 50;
export const MAX_MESSAGE_LENGTH = 2000;

/**
 * One hook for all three roles — student, supervisor and coordinator all
 * hit the same bare `/messages` endpoints and see the same shapes, so there
 * is nothing role-specific here (CLAUDE.md §5 "Which feature domain?").
 */
export function useMessaging() {
  const currentUser = useCurrentUser();
  const { showError } = useSnackbar();

  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [hasPagedOlder, setHasPagedOlder] = useState(false);
  const [hasMoreOlderAfterPaging, setHasMoreOlderAfterPaging] =
    useState(true);

  // Resets the per-thread state above whenever the open conversation
  // changes. This is React's documented "adjust state when a value
  // changes" pattern (comparing against a mirrored state snapshot, not a
  // ref) — see https://react.dev/learn/you-might-not-need-an-effect. A
  // plain useEffect here would trip this repo's baseline
  // react-hooks/set-state-in-effect lint rule (CLAUDE.md §8 item 1).
  const [trackedConversationId, setTrackedConversationId] = useState<
    string | null
  >(null);
  if (activeConversationId !== trackedConversationId) {
    setTrackedConversationId(activeConversationId);
    setHasPagedOlder(false);
    setHasMoreOlderAfterPaging(true);
    setDraft("");
  }

  const { data: conversations, isLoading: conversationsLoading } =
    useGetConversationsQuery(undefined, {
      pollingInterval: 10000,
      skipPollingIfUnfocused: true,
    });

  const { data: contacts, isLoading: contactsLoading } = useGetContactsQuery(
    undefined,
    { skip: !pickerOpen },
  );

  const { data: rawMessages } = useGetMessagesQuery(
    activeConversationId
      ? { conversationId: activeConversationId, limit: MESSAGE_PAGE_SIZE }
      : skipToken,
    {
      // Deliberately NOT skipPollingIfUnfocused: a side-by-side two-window
      // demo (one window per role) needs the unfocused window to keep
      // updating too. Don't "optimise" this to true — it quietly breaks
      // that demo.
      pollingInterval: 3000,
      skipPollingIfUnfocused: false,
    },
  );

  // The endpoint's own `merge` (messagesApi.ts) already accumulates every
  // page — the live tail's polls and any "Load older" pages — into one
  // growing, deduped array per conversation. Sorting is the only thing left
  // to do at read time, since merge order doesn't track chronological order.
  const messages = useMemo(
    () =>
      [...(rawMessages ?? [])].sort((a, b) =>
        a.createdAt === b.createdAt
          ? a.id.localeCompare(b.id)
          : a.createdAt.localeCompare(b.createdAt),
      ),
    [rawMessages],
  );

  const hasMoreOlder = hasPagedOlder
    ? hasMoreOlderAfterPaging
    : messages.length === MESSAGE_PAGE_SIZE;

  const [triggerOlderMessages, { isFetching: isLoadingOlder }] =
    useLazyGetMessagesQuery();
  const [createConversationMutation, { isLoading: isCreatingConversation }] =
    useCreateConversationMutation();
  const [sendMessageMutation, { isLoading: isSending }] =
    useSendMessageMutation();

  const handleLoadOlder = useCallback(async () => {
    if (!activeConversationId || !hasMoreOlder || isLoadingOlder) return;
    const oldestId = messages[0]?.id;
    if (!oldestId) return;
    const countBefore = messages.length;
    try {
      const merged = await triggerOlderMessages({
        conversationId: activeConversationId,
        before: oldestId,
        limit: MESSAGE_PAGE_SIZE,
      }).unwrap();
      setHasPagedOlder(true);
      // The cache entry is shared per conversation (see messagesApi.ts), so
      // `merged` is the full accumulated list — the growth in its length is
      // exactly how many older, previously-unseen messages this page added.
      setHasMoreOlderAfterPaging(
        merged.length - countBefore === MESSAGE_PAGE_SIZE,
      );
    } catch (err) {
      showError(readError(err, "Couldn't load older messages."));
    }
  }, [
    activeConversationId,
    hasMoreOlder,
    isLoadingOlder,
    messages,
    triggerOlderMessages,
    showError,
  ]);

  const handleOpenPicker = useCallback(() => {
    setPickerOpen(true);
    setContactSearch("");
  }, []);

  const handleSelectContact = useCallback(
    async (contact: Contact) => {
      try {
        const conversation =
          await createConversationMutation(contact.id).unwrap();
        setActiveConversationId(conversation.id);
        setPickerOpen(false);
      } catch (err) {
        showError(readError(err, "Couldn't start that conversation."));
      }
    },
    [createConversationMutation, showError],
  );

  const trimmedDraft = draft.trim();
  const canSend =
    trimmedDraft.length > 0 &&
    draft.length <= MAX_MESSAGE_LENGTH &&
    !isSending;

  const handleSend = useCallback(async () => {
    if (!activeConversationId || !canSend) return;
    try {
      await sendMessageMutation({
        conversationId: activeConversationId,
        content: trimmedDraft,
      }).unwrap();
      setDraft("");
    } catch (err) {
      showError(readError(err, "Failed to send message."));
    }
  }, [
    activeConversationId,
    canSend,
    sendMessageMutation,
    trimmedDraft,
    showError,
  ]);

  const filteredContacts = useMemo(() => {
    const term = contactSearch.trim().toLowerCase();
    const list = contacts ?? [];
    if (!term) return list;
    return list.filter((c) =>
      [c.name, c.role, c.establishmentName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [contacts, contactSearch]);

  const activeConversation = useMemo(
    () =>
      (conversations ?? []).find((c) => c.id === activeConversationId) ??
      null,
    [conversations, activeConversationId],
  );

  return {
    currentUserId: currentUser?.id ?? null,

    conversations: conversations ?? [],
    conversationsLoading,
    activeConversationId,
    activeConversation,
    onSelectConversation: setActiveConversationId,
    onBackToList: () => setActiveConversationId(null),

    messages,
    hasMoreOlder,
    isLoadingOlder,
    onLoadOlder: handleLoadOlder,

    draft,
    setDraft,
    canSend,
    isSending,
    onSend: handleSend,
    maxMessageLength: MAX_MESSAGE_LENGTH,

    pickerOpen,
    onOpenPicker: handleOpenPicker,
    onClosePicker: () => setPickerOpen(false),
    contacts: filteredContacts,
    contactsLoading,
    contactSearch,
    setContactSearch,
    onSelectContact: handleSelectContact,
    isCreatingConversation,
  };
}

function readError(err: unknown, fallback: string): string {
  const data = (err as { data?: { message?: string | string[] } })?.data;
  if (Array.isArray(data?.message)) return data.message.join(", ");
  return data?.message ?? fallback;
}

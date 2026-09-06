import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./baseQuery";

/**
 * One domain for all three roles — student, supervisor and coordinator hit
 * the identical bare `/messages` endpoints and receive the identical shapes
 * (CLAUDE.md §5 "Which feature domain?"). There is no per-role query here,
 * unlike evaluationApi's two role-scoped URLs.
 */

export type ContactRole = "STUDENT" | "SUPERVISOR" | "COORDINATOR";

export interface Contact {
  id: string;
  name: string;
  role: ContactRole;
  establishmentName: string | null;
}

export interface MessageSummary {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  otherParticipant: { id: string; name: string; role: ContactRole } | null;
  lastMessage: MessageSummary | null;
  unreadCount: number;
  updatedAt: string;
}

export interface GetMessagesRequest {
  conversationId: string;
  before?: string;
  limit?: number;
}

export interface SendMessageRequest {
  conversationId: string;
  content: string;
}

export const messagesApi = createApi({
  reducerPath: "messagesApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: ["Conversations", "Messages", "Contacts"],
  endpoints: (builder) => ({
    getContacts: builder.query<Contact[], void>({
      query: () => "/messages/contacts",
      providesTags: ["Contacts"],
    }),
    getConversations: builder.query<ConversationSummary[], void>({
      query: () => "/messages/conversations",
      providesTags: ["Conversations"],
    }),
    createConversation: builder.mutation<ConversationSummary, string>({
      query: (userId) => ({
        url: "/messages/conversations",
        method: "POST",
        body: { userId },
      }),
      invalidatesTags: ["Conversations"],
    }),
    getMessages: builder.query<MessageSummary[], GetMessagesRequest>({
      query: ({ conversationId, before, limit }) => ({
        url: `/messages/conversations/${conversationId}`,
        params: { before, limit },
      }),
      /**
       * One shared, growing cache entry per conversation rather than one
       * per (conversationId, before) pair. The live tail (polled every 3s,
       * no `before`) and an explicit "Load older" page (`before` set) both
       * fold into the same list, so history paged in manually survives a
       * later poll of the tail instead of being dropped when the tail's own
       * "latest N" window shifts forward. This also means the merging never
       * has to happen in a React effect/ref — see CLAUDE.md §8 for why that
       * matters in this codebase.
       */
      serializeQueryArgs: ({ queryArgs }) => queryArgs.conversationId,
      merge: (currentCache, newItems, { arg }) => {
        const known = new Set(currentCache.map((m) => m.id));
        const fresh = newItems.filter((m) => !known.has(m.id));
        if (arg.before) {
          // Always strictly older than everything already cached.
          currentCache.unshift(...fresh);
        } else {
          currentCache.push(...fresh);
        }
      },
      forceRefetch: ({ currentArg, previousArg }) =>
        currentArg?.conversationId !== previousArg?.conversationId ||
        currentArg?.before !== previousArg?.before,
      providesTags: (_result, _error, { conversationId }) => [
        { type: "Messages", id: conversationId },
      ],
    }),
    sendMessage: builder.mutation<MessageSummary, SendMessageRequest>({
      query: ({ conversationId, content }) => ({
        url: `/messages/conversations/${conversationId}`,
        method: "POST",
        body: { content },
      }),
      invalidatesTags: (_result, _error, { conversationId }) => [
        { type: "Messages", id: conversationId },
        "Conversations",
      ],
    }),
  }),
});

export const {
  useGetContactsQuery,
  useGetConversationsQuery,
  useCreateConversationMutation,
  useGetMessagesQuery,
  useLazyGetMessagesQuery,
  useSendMessageMutation,
} = messagesApi;

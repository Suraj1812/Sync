import { create } from 'zustand';
import { chatApi } from '../services/api';
import type { Conversation, Message, User } from '../types';

type ChatState = {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  activeConversationId: string | null;
  typingByConversation: Record<string, string | null>;
  setActiveConversation: (id: string | null) => void;
  setConversations: (conversations: Conversation[]) => void;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  addMessage: (message: Message) => void;
  markSeen: (conversationId: string, seenBy: string) => void;
  setTyping: (conversationId: string, userId: string | null) => void;
  upsertUserPresence: (user: User) => void;
};

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: {},
  activeConversationId: null,
  typingByConversation: {},
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setConversations: (conversations) => set({ conversations }),
  loadConversations: async () => set({ conversations: await chatApi.conversations() }),
  loadMessages: async (conversationId) => {
    const messages = await chatApi.messages(conversationId);
    set({ messages: { ...get().messages, [conversationId]: messages } });
  },
  addMessage: (message) => {
    const current = get().messages[message.conversationId] ?? [];
    if (current.some((item) => item.id === message.id)) return;
    set({
      messages: { ...get().messages, [message.conversationId]: [...current, message] },
      conversations: get().conversations.map((conversation) =>
        conversation.id === message.conversationId
          ? { ...conversation, messages: [message], updatedAt: message.createdAt }
          : conversation,
      ),
    });
  },
  markSeen: (conversationId, seenBy) => {
    const messages = (get().messages[conversationId] ?? []).map((message) =>
      message.senderId !== seenBy ? { ...message, seen: true } : message,
    );
    set({ messages: { ...get().messages, [conversationId]: messages } });
  },
  setTyping: (conversationId, userId) =>
    set({ typingByConversation: { ...get().typingByConversation, [conversationId]: userId } }),
  upsertUserPresence: (user) => {
    const conversations = get().conversations.map((conversation) => ({
      ...conversation,
      participants: conversation.participants.map((participant) =>
        participant.userId === user.id ? { ...participant, user } : participant,
      ),
    }));
    set({ conversations });
  },
}));

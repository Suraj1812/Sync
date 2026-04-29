import { create } from 'zustand';
import { chatApi } from '../services/api';
import { useAuthStore } from './authStore';
import type { Conversation, Message, User } from '../types';

const CONVERSATION_TTL = 10_000;
const MESSAGE_TTL = 15_000;
let conversationsRequest: Promise<Conversation[]> | null = null;
let conversationsLoadedAt = 0;
const messageRequests = new Map<string, Promise<Message[]>>();
const messagesLoadedAt = new Map<string, number>();

type ChatState = {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  activeConversationId: string | null;
  typingByConversation: Record<string, string | null>;
  conversationsLoading: boolean;
  messagesLoading: Record<string, boolean>;
  loadError: string;
  setActiveConversation: (id: string | null) => void;
  setConversations: (conversations: Conversation[]) => void;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  addMessage: (message: Message) => void;
  markDelivered: (conversationId: string, deliveredTo: string) => void;
  markSeen: (conversationId: string, seenBy: string) => void;
  setTyping: (conversationId: string, userId: string | null) => void;
  upsertUserPresence: (user: User) => void;
};

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: {},
  activeConversationId: null,
  typingByConversation: {},
  conversationsLoading: false,
  messagesLoading: {},
  loadError: '',
  setActiveConversation: (id) =>
    set({
      activeConversationId: id,
      conversations: id
        ? get().conversations.map((conversation) =>
            conversation.id === id ? { ...conversation, unreadCount: 0 } : conversation,
          )
        : get().conversations,
    }),
  setConversations: (conversations) => {
    conversationsLoadedAt = Date.now();
    set({ conversations });
  },
  loadConversations: async () => {
    const fresh = Date.now() - conversationsLoadedAt < CONVERSATION_TTL && get().conversations.length > 0;
    if (fresh) return;

    conversationsRequest ??= chatApi.conversations().finally(() => {
      conversationsRequest = null;
    });

    set({ conversationsLoading: true, loadError: '' });
    try {
      const conversations = await conversationsRequest;
      conversationsLoadedAt = Date.now();
      set({ conversations, conversationsLoading: false });
    } catch {
      set({ conversationsLoading: false, loadError: 'Could not load conversations.' });
    }
  },
  loadMessages: async (conversationId) => {
    const loadedAt = messagesLoadedAt.get(conversationId) ?? 0;
    const hasMessages = get().messages[conversationId] !== undefined;
    if (hasMessages && Date.now() - loadedAt < MESSAGE_TTL) return;

    if (!messageRequests.has(conversationId)) {
      messageRequests.set(
        conversationId,
        chatApi.messages(conversationId).finally(() => {
          messageRequests.delete(conversationId);
        }),
      );
    }

    set({ messagesLoading: { ...get().messagesLoading, [conversationId]: true }, loadError: '' });
    try {
      const messages = await messageRequests.get(conversationId);
      if (!messages) return;
      messagesLoadedAt.set(conversationId, Date.now());
      set({
        messages: { ...get().messages, [conversationId]: messages },
        messagesLoading: { ...get().messagesLoading, [conversationId]: false },
      });
    } catch {
      set({
        messagesLoading: { ...get().messagesLoading, [conversationId]: false },
        loadError: 'Could not load messages.',
      });
    }
  },
  addMessage: (message) => {
    const current = get().messages[message.conversationId] ?? [];
    if (current.some((item) => item.id === message.id)) return;
    const currentUserId = useAuthStore.getState().user?.id;
    const isIncoming = message.senderId !== currentUserId;
    const isActive = get().activeConversationId === message.conversationId;
    const conversations = get().conversations;
    const nextConversations = conversations.map((conversation) =>
      conversation.id === message.conversationId
        ? {
            ...conversation,
            messages: [message],
            updatedAt: message.createdAt,
            unreadCount: isIncoming ? (isActive ? 0 : (conversation.unreadCount ?? 0) + 1) : (conversation.unreadCount ?? 0),
          }
        : conversation,
    );
    const touchedConversation = nextConversations.find((conversation) => conversation.id === message.conversationId);
    set({
      messages: { ...get().messages, [message.conversationId]: [...current, message] },
      conversations: touchedConversation
        ? [touchedConversation, ...nextConversations.filter((conversation) => conversation.id !== message.conversationId)]
        : conversations,
    });
    messagesLoadedAt.set(message.conversationId, Date.now());
  },
  markDelivered: (conversationId, deliveredTo) => {
    const messages = (get().messages[conversationId] ?? []).map((message) =>
      message.senderId !== deliveredTo ? { ...message, delivered: true } : message,
    );
    const conversations = get().conversations.map((conversation) => {
      if (conversation.id !== conversationId) return conversation;
      return {
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.senderId !== deliveredTo ? { ...message, delivered: true } : message,
        ),
      };
    });
    set({ messages: { ...get().messages, [conversationId]: messages }, conversations });
  },
  markSeen: (conversationId, seenBy) => {
    const currentUserId = useAuthStore.getState().user?.id;
    const messages = (get().messages[conversationId] ?? []).map((message) =>
      message.senderId !== seenBy ? { ...message, delivered: true, seen: true } : message,
    );
    const conversations = get().conversations.map((conversation) => {
      if (conversation.id !== conversationId) return conversation;
      return {
        ...conversation,
        unreadCount: seenBy === currentUserId ? 0 : (conversation.unreadCount ?? 0),
        messages: conversation.messages.map((message) =>
          message.senderId !== seenBy ? { ...message, delivered: true, seen: true } : message,
        ),
      };
    });
    set({ messages: { ...get().messages, [conversationId]: messages }, conversations });
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

function resetChatCache() {
  conversationsRequest = null;
  conversationsLoadedAt = 0;
  messageRequests.clear();
  messagesLoadedAt.clear();
  useChatStore.setState({
    conversations: [],
    messages: {},
    activeConversationId: null,
    typingByConversation: {},
    conversationsLoading: false,
    messagesLoading: {},
    loadError: '',
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('sync:logout', resetChatCache);
}

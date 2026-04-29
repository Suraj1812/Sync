import { useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '../services/socket';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import type { IncomingCall, Message } from '../types';

type UseRealtimeOptions = {
  onIncomingCall: (call: IncomingCall) => void;
  onCallAccepted: (payload: { callId: string; acceptedBy: string }) => void;
  onCallRejected: (payload: { callId: string; rejectedBy: string }) => void;
  onCallEnded: (payload: { callId: string; endedBy: string }) => void;
  onUnavailable: (payload: { receiverId: string }) => void;
};

export function useRealtime(options: UseRealtimeOptions) {
  const token = useAuthStore((state) => state.token);
  const { addMessage, markDelivered, markSeen, setTyping, upsertUserPresence } = useChatStore();

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);

    const onNewMessage = (message: Message) => {
      const knownConversation = useChatStore
        .getState()
        .conversations.some((conversation) => conversation.id === message.conversationId);
      addMessage(message);
      if (!knownConversation) void useChatStore.getState().loadConversations();
    };
    const onDelivered = (payload: { conversationId: string; deliveredTo: string }) =>
      markDelivered(payload.conversationId, payload.deliveredTo);
    const onSeen = (payload: { conversationId: string; seenBy: string }) =>
      markSeen(payload.conversationId, payload.seenBy);
    const onTypingStart = (payload: { conversationId: string; userId: string }) =>
      setTyping(payload.conversationId, payload.userId);
    const onTypingStop = (payload: { conversationId: string }) => setTyping(payload.conversationId, null);

    socket.on('message:new', onNewMessage);
    socket.on('message:delivered', onDelivered);
    socket.on('message:seen', onSeen);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('user:online', upsertUserPresence);
    socket.on('user:offline', upsertUserPresence);
    socket.on('call:incoming', options.onIncomingCall);
    socket.on('call:accept', options.onCallAccepted);
    socket.on('call:reject', options.onCallRejected);
    socket.on('call:end', options.onCallEnded);
    socket.on('call:unavailable', options.onUnavailable);

    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('message:delivered', onDelivered);
      socket.off('message:seen', onSeen);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('user:online', upsertUserPresence);
      socket.off('user:offline', upsertUserPresence);
      socket.off('call:incoming', options.onIncomingCall);
      socket.off('call:accept', options.onCallAccepted);
      socket.off('call:reject', options.onCallRejected);
      socket.off('call:end', options.onCallEnded);
      socket.off('call:unavailable', options.onUnavailable);
    };
  }, [addMessage, markDelivered, markSeen, options, setTyping, token, upsertUserPresence]);
}

export function emit(socket: Socket | null, event: string, payload: unknown) {
  socket?.emit(event, payload);
}

import { useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '../services/socket';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import type { IncomingCall, Message, User } from '../types';

type UseRealtimeOptions = {
  onIncomingCall: (call: IncomingCall) => void;
  onCallAccepted: (payload: { callId: string; acceptedBy: string }) => void;
  onCallRejected: (payload: { callId: string; rejectedBy: string }) => void;
  onCallEnded: (payload: { callId: string; endedBy: string }) => void;
  onUnavailable: (payload: { receiverId: string }) => void;
};

export function useRealtime(options: UseRealtimeOptions) {
  const token = useAuthStore((state) => state.token);
  const { addMessage, markSeen, setTyping, upsertUserPresence } = useChatStore();

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);

    socket.on('message:new', (message: Message) => addMessage(message));
    socket.on('message:seen', (payload: { conversationId: string; seenBy: string }) =>
      markSeen(payload.conversationId, payload.seenBy),
    );
    socket.on('typing:start', (payload: { conversationId: string; userId: string }) =>
      setTyping(payload.conversationId, payload.userId),
    );
    socket.on('typing:stop', (payload: { conversationId: string }) => setTyping(payload.conversationId, null));
    socket.on('user:online', (user: User) => upsertUserPresence(user));
    socket.on('user:offline', (user: User) => upsertUserPresence(user));
    socket.on('call:incoming', options.onIncomingCall);
    socket.on('call:accept', options.onCallAccepted);
    socket.on('call:reject', options.onCallRejected);
    socket.on('call:end', options.onCallEnded);
    socket.on('call:unavailable', options.onUnavailable);

    return () => {
      socket.off('message:new');
      socket.off('message:seen');
      socket.off('typing:start');
      socket.off('typing:stop');
      socket.off('user:online');
      socket.off('user:offline');
      socket.off('call:incoming');
      socket.off('call:accept');
      socket.off('call:reject');
      socket.off('call:end');
      socket.off('call:unavailable');
    };
  }, [addMessage, markSeen, options, setTyping, token, upsertUserPresence]);
}

export function emit(socket: Socket | null, event: string, payload: unknown) {
  socket?.emit(event, payload);
}

import { ChangeEvent, FormEvent, Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { EmojiClickData } from 'emoji-picker-react';
import {
  Eraser,
  LogOut,
  Menu,
  MessageCircle,
  MoreVertical,
  PhoneCall,
  Search,
  Send,
  Settings,
  Smile,
  Upload,
  UserMinus,
  UserPlus,
  Video,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { CallControls } from '../components/CallControls';
import { ChatBubble } from '../components/ChatBubble';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { useRealtime } from '../hooks/useRealtime';
import { useWebRTC } from '../hooks/useWebRTC';
import { chatApi, userApi } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import type { ActiveCall, Conversation, IncomingCall, Message, User } from '../types';
import { MAX_AVATAR_LABEL, readAvatarFile } from '../utils/avatarUpload';
import { formatMessageDay, formatPresence, formatTime, isSameCalendarDay } from '../utils/time';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

function otherParticipant(conversation: Conversation, currentUserId: string) {
  return conversation.participants.find((participant) => participant.userId !== currentUserId)?.user;
}

function findParticipantById(conversations: Conversation[], userId: string) {
  return conversations
    .flatMap((conversation) => conversation.participants.map((participant) => participant.user))
    .find((item) => item.id === userId);
}

const iconButtonClass =
  'h-10 w-10 rounded-xl border border-slate-200 bg-slate-50 px-0 text-slate-700 shadow-sm hover:border-slate-300 hover:bg-white hover:text-slate-950 focus-visible:ring-blue-100 sm:h-11 sm:w-11 [&_svg]:h-5 [&_svg]:w-5 sm:[&_svg]:h-[21px] sm:[&_svg]:w-[21px]';
const chatHeaderButtonClass =
  'h-9 w-9 rounded-xl border border-slate-200 bg-slate-50 px-0 text-slate-700 shadow-sm hover:border-slate-300 hover:bg-white hover:text-slate-950 focus-visible:ring-blue-100 sm:h-10 sm:w-10 md:h-11 md:w-11 [&_svg]:h-[18px] [&_svg]:w-[18px] sm:[&_svg]:h-5 sm:[&_svg]:w-5';

export function AppLayout() {
  const { user, token, logout, setUser } = useAuthStore();
  const {
    conversations,
    messages,
    activeConversationId,
    typingByConversation,
    conversationsLoading,
    messagesLoading,
    loadError,
    setActiveConversation,
    loadConversations,
    loadMessages,
  } = useChatStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [callNotice, setCallNotice] = useState('');
  const seenReceiptRef = useRef('');
  const socket = useMemo(() => (token ? getSocket(token) : null), [token]);
  const realtimeOptions = useMemo(
    () => ({
      onIncomingCall: setIncomingCall,
      onCallAccepted: () => setActiveCall((call) => (call ? { ...call, status: 'connecting' } : call)),
      onCallRejected: () => {
        setCallNotice('Call declined');
        setActiveCall(null);
      },
      onCallEnded: () => setActiveCall(null),
      onUnavailable: () => setCallNotice('User is unavailable'),
    }),
    [],
  );

  useRealtime(realtimeOptions);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!activeConversationId || !socket) return;
    socket.emit('conversation:join', activeConversationId);
    void loadMessages(activeConversationId);
  }, [activeConversationId, loadMessages, socket]);

  const activeMessageCount = activeConversationId ? (messages[activeConversationId]?.length ?? 0) : 0;

  useEffect(() => {
    if (!activeConversationId || !socket || activeMessageCount === 0) return;
    const receiptKey = `${activeConversationId}:${activeMessageCount}`;
    if (seenReceiptRef.current === receiptKey) return;
    seenReceiptRef.current = receiptKey;
    socket.emit('message:seen', { conversationId: activeConversationId });
  }, [activeConversationId, activeMessageCount, socket]);

  if (!user || !token) return null;

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? null;
  const activePeer = activeConversation ? otherParticipant(activeConversation, user.id) : null;

  async function startConversation(selectedUser: User) {
    const conversation = await chatApi.startConversation(selectedUser.id);
    useChatStore.setState((state) => ({
      conversations: state.conversations.some((item) => item.id === conversation.id)
        ? state.conversations
        : [conversation, ...state.conversations],
      activeConversationId: conversation.id,
    }));
    setSearchOpen(false);
    setMobileListOpen(false);
  }

  function startCall(callType: 'audio' | 'video') {
    if (!activePeer || !socket) return;
    if (!activePeer.isOnline) {
      setCallNotice(`${activePeer.name} is offline`);
      return;
    }

    setCallNotice('');
    const peer = activePeer;
    const activeSocket = socket;
    const timeout = window.setTimeout(() => {
      activeSocket.off('call:ringing', onRinging);
      activeSocket.off('call:unavailable', onUnavailable);
      setCallNotice('Call could not connect');
    }, 8000);

    function clearPendingCall() {
      window.clearTimeout(timeout);
      activeSocket.off('call:ringing', onRinging);
      activeSocket.off('call:unavailable', onUnavailable);
    }

    function onRinging(payload: { callId: string; receiverId?: string; callType?: 'audio' | 'video' }) {
      if (payload.receiverId && payload.receiverId !== peer.id) return;
      clearPendingCall();
      setActiveCall({
        callId: payload.callId,
        peerId: peer.id,
        peerName: peer.name,
        peerAvatar: peer.avatar,
        callType: payload.callType ?? callType,
        isCaller: true,
        status: 'ringing',
      });
    }

    function onUnavailable(payload: { receiverId: string }) {
      if (payload.receiverId !== peer.id) return;
      clearPendingCall();
      setCallNotice(`${peer.name} is unavailable`);
    }

    activeSocket.once('call:ringing', onRinging);
    activeSocket.once('call:unavailable', onUnavailable);
    activeSocket.emit('call:initiate', { receiverId: activePeer.id, conversationId: activeConversationId, callType });
  }

  function acceptCall() {
    if (!incomingCall || !socket) return;
    const caller = findParticipantById(conversations, incomingCall.callerId);
    setActiveCall({
      callId: incomingCall.callId,
      peerId: incomingCall.callerId,
      peerName: caller?.name ?? 'Incoming caller',
      peerAvatar: caller?.avatar,
      callType: incomingCall.callType,
      isCaller: false,
      status: 'connecting',
    });
    setIncomingCall(null);
    window.setTimeout(() => {
      socket.emit('call:accept', {
        callId: incomingCall.callId,
        receiverId: incomingCall.callerId,
      });
    }, 0);
  }

  function rejectCall() {
    if (!incomingCall || !socket) return;
    socket.emit('call:reject', {
      callId: incomingCall.callId,
      receiverId: incomingCall.callerId,
    });
    setIncomingCall(null);
  }

  function endCall() {
    if (activeCall && socket) {
      socket.emit('call:end', { callId: activeCall.callId, receiverId: activeCall.peerId });
    }
    setActiveCall(null);
  }

  return (
    <main className="h-[100svh] overflow-hidden bg-white p-0 text-ink md:h-[100dvh] md:bg-slate-100 md:p-3">
      <div className="flex h-full overflow-hidden bg-white shadow-[0_20px_70px_rgba(15,23,42,0.08)] md:rounded-[28px] md:border md:border-slate-200">
        <aside
          className={clsx(
            'absolute inset-y-0 left-0 z-30 w-full max-w-[24rem] border-r border-slate-200 bg-white shadow-2xl transition-transform md:static md:block md:w-[380px] md:max-w-[380px] md:translate-x-0 md:shadow-none lg:w-[420px] lg:max-w-[420px]',
            mobileListOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <ConversationList
            conversations={conversations}
            currentUser={user}
            activeId={activeConversationId}
            loading={conversationsLoading}
            error={loadError}
            onSelect={(id) => {
              setActiveConversation(id);
              setMobileListOpen(false);
            }}
            onSearch={() => setSearchOpen(true)}
            onProfile={() => setProfileOpen(true)}
            onLogout={logout}
            onClose={() => setMobileListOpen(false)}
          />
        </aside>
        {mobileListOpen && (
          <button
            aria-label="Close conversations"
            className="absolute inset-0 z-20 bg-slate-950/30 md:hidden"
            onClick={() => setMobileListOpen(false)}
          />
        )}

        <section className="flex min-w-0 flex-1 flex-col">
          <ConversationView
            user={user}
            conversation={activeConversation}
            peer={activePeer ?? null}
            messages={activeConversationId ? messages[activeConversationId] ?? [] : []}
            loading={activeConversationId ? Boolean(messagesLoading[activeConversationId]) : false}
            error={loadError}
            typingUserId={activeConversationId ? typingByConversation[activeConversationId] : null}
            socket={socket}
            onMenu={() => setMobileListOpen(true)}
            onStartCall={startCall}
          />
        </section>
      </div>

      <SearchUsersModal open={searchOpen} onClose={() => setSearchOpen(false)} onSelect={startConversation} />
      <ProfileModal open={profileOpen} user={user} onClose={() => setProfileOpen(false)} onSaved={setUser} />
      <IncomingCallModal
        call={incomingCall}
        callerName={
          incomingCall
            ? findParticipantById(conversations, incomingCall.callerId)?.name ?? 'Incoming caller'
            : ''
        }
        onAccept={acceptCall}
        onReject={rejectCall}
      />
      {activeCall && <ActiveCallScreen call={activeCall} socket={socket} onEnd={endCall} />}
      {callNotice && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-white shadow-soft">
          {callNotice}
          <button className="ml-3 text-white/70" onClick={() => setCallNotice('')}>
            Dismiss
          </button>
        </div>
      )}
    </main>
  );
}

function ConversationList({
  conversations,
  currentUser,
  activeId,
  loading,
  error,
  onSelect,
  onSearch,
  onProfile,
  onLogout,
  onClose,
}: {
  conversations: Conversation[];
  currentUser: User;
  activeId: string | null;
  loading: boolean;
  error: string;
  onSelect: (id: string) => void;
  onSearch: () => void;
  onProfile: () => void;
  onLogout: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 px-3 py-3 sm:px-5 sm:py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-slate-400">Sync</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-950">Messages</h1>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button
              aria-label="Search users"
              title="Search users"
              variant="soft"
              className={iconButtonClass}
              onClick={onSearch}
              icon={<Search size={21} />}
            />
            <Button
              aria-label="Profile"
              title="Profile"
              variant="soft"
              className={iconButtonClass}
              onClick={onProfile}
              icon={<Settings size={21} />}
            />
            <Button
              aria-label="Logout"
              title="Logout"
              variant="soft"
              className={clsx(iconButtonClass, 'hidden sm:inline-flex')}
              onClick={onLogout}
              icon={<LogOut size={21} />}
            />
            <Button
              aria-label="Close"
              title="Close"
              variant="soft"
              className={clsx(iconButtonClass, 'md:hidden')}
              onClick={onClose}
              icon={<X size={21} />}
            />
          </div>
        </div>
        <button
          className="mt-3 flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition hover:border-slate-300 hover:bg-white sm:mt-5 sm:rounded-2xl sm:px-4 sm:py-3"
          onClick={onProfile}
        >
          <Avatar user={currentUser} />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{currentUser.name}</h2>
            <p className="truncate text-xs text-muted">{currentUser.status || 'Available'}</p>
          </div>
        </button>
        <Button
          variant="soft"
          className="mt-3 h-10 w-full rounded-xl sm:hidden"
          onClick={onLogout}
          icon={<LogOut size={18} />}
        >
          Sign out
        </Button>
      </header>
      <div className="thin-scrollbar flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <div className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex animate-pulse items-center gap-3 rounded-2xl px-1 py-2">
                <div className="h-11 w-11 rounded-full bg-slate-200" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-1/2 rounded bg-slate-200" />
                  <div className="h-3 w-4/5 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : error && conversations.length === 0 ? (
          <div className="px-6 py-12 text-center sm:px-8 sm:py-16">
            <p className="text-sm font-medium text-ink">Could not load messages</p>
            <p className="mt-2 text-sm text-muted">{error}</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-6 py-12 text-center sm:px-8 sm:py-16">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-line bg-white text-brand shadow-sm">
              <UserPlus size={22} />
            </div>
            <p className="mt-4 text-sm font-medium text-ink">No conversations yet</p>
            <p className="mt-2 text-sm text-muted">Find a person to start a secure one-to-one chat.</p>
            <Button variant="soft" className="mt-5 rounded-xl px-4" onClick={onSearch} icon={<Search size={18} />}>
              Find people
            </Button>
          </div>
        ) : (
          conversations.map((conversation) => {
            const peer = otherParticipant(conversation, currentUser.id);
            const lastMessage = conversation.messages[0];
            const unreadCount = conversation.unreadCount ?? 0;
            if (!peer) return null;
            return (
              <button
                key={conversation.id}
                className={clsx(
                  'flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3.5 text-left transition hover:bg-slate-50 sm:px-5 sm:py-4',
                  activeId === conversation.id && 'bg-blue-50/90 ring-1 ring-inset ring-blue-100',
                )}
                onClick={() => onSelect(conversation.id)}
              >
                <Avatar user={peer} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className={clsx('truncate text-sm', unreadCount > 0 ? 'font-semibold text-slate-950' : 'font-semibold')}>
                      {peer.name}
                    </p>
                    <span className="shrink-0 text-xs text-muted">{formatTime(lastMessage?.createdAt)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <p className={clsx('truncate text-sm', unreadCount > 0 ? 'font-medium text-slate-900' : 'text-muted')}>
                      {lastMessage ? `${lastMessage.senderId === currentUser.id ? 'You: ' : ''}${lastMessage.content}` : formatPresence(peer.isOnline, peer.lastSeen)}
                    </p>
                    {unreadCount > 0 && (
                      <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function ConversationView({
  user,
  conversation,
  peer,
  messages,
  loading,
  error,
  typingUserId,
  socket,
  onMenu,
  onStartCall,
}: {
  user: User;
  conversation: Conversation | null;
  peer: User | null;
  messages: Message[];
  loading: boolean;
  error: string;
  typingUserId?: string | null;
  socket: ReturnType<typeof getSocket> | null;
  onMenu: () => void;
  onStartCall: (callType: 'audio' | 'video') => void;
}) {
  const [content, setContent] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [threadMenuOpen, setThreadMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'clear' | 'delete-contact' | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const addMessage = useChatStore((state) => state.addMessage);
  const clearConversation = useChatStore((state) => state.clearConversation);
  const removeMessage = useChatStore((state) => state.deleteMessage);
  const removeConversation = useChatStore((state) => state.removeConversation);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingRef = useRef(false);
  const typingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
      if (typingRef.current && conversation) {
        socket?.emit('typing:stop', { conversationId: conversation.id });
      }
      typingRef.current = false;
    };
  }, [conversation?.id, socket]);

  useEffect(() => {
    setContent('');
    setEditingMessage(null);
    setEmojiOpen(false);
    setThreadMenuOpen(false);
    setConfirmAction(null);
    setActionError('');
  }, [conversation?.id]);

  async function emitWithFallback<T>(event: string, payload: unknown, fallback: () => Promise<T>) {
    if (socket?.connected) return socket.timeout(5000).emitWithAck(event, payload) as Promise<T>;
    return fallback();
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!conversation || !content.trim()) return;
    const nextContent = content.trim();
    setActionError('');
    if (editingMessage) {
      setActionBusy(true);
      try {
        const updated = await emitWithFallback<Message>(
          'message:edit',
          { messageId: editingMessage.id, content: nextContent },
          () => chatApi.editMessage(editingMessage.id, nextContent),
        );
        updateMessage(updated);
        setEditingMessage(null);
        setContent('');
      } catch {
        setActionError('Could not edit that message. Try again.');
      } finally {
        setActionBusy(false);
      }
      return;
    }

    setActionBusy(true);
    try {
      const message = await emitWithFallback<Message>(
        'message:send',
        { conversationId: conversation.id, content: nextContent },
        () => chatApi.sendMessage(conversation.id, nextContent),
      );
      addMessage(message);
    } catch {
      setActionError('Could not send that message. Try again.');
      setActionBusy(false);
      return;
    }
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    if (typingRef.current) {
      socket?.emit('typing:stop', { conversationId: conversation.id });
      typingRef.current = false;
    }
    setContent('');
    setEmojiOpen(false);
    setActionBusy(false);
  }

  function startEditing(message: Message) {
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    if (typingRef.current && conversation) {
      socket?.emit('typing:stop', { conversationId: conversation.id });
      typingRef.current = false;
    }
    setEditingMessage(message);
    setContent(message.content);
    setEmojiOpen(false);
    setActionError('');
  }

  function cancelEditing() {
    setEditingMessage(null);
    setContent('');
    setActionError('');
  }

  async function deleteOwnMessage(message: Message) {
    if (!conversation || actionBusy) return;
    setActionBusy(true);
    setActionError('');
    try {
      const result = await emitWithFallback<{ conversationId: string; messageId: string }>(
        'message:delete',
        { messageId: message.id },
        () => chatApi.deleteMessage(message.id),
      );
      removeMessage(result.conversationId, result.messageId);
      if (editingMessage?.id === message.id) cancelEditing();
    } catch {
      setActionError('Could not delete that message. Try again.');
    } finally {
      setActionBusy(false);
    }
  }

  async function runConversationAction() {
    if (!conversation || !confirmAction || actionBusy) return;
    setActionBusy(true);
    setActionError('');
    try {
      if (confirmAction === 'clear') {
        await emitWithFallback(
          'conversation:clear',
          { conversationId: conversation.id },
          () => chatApi.clearConversation(conversation.id),
        );
        clearConversation(conversation.id);
      } else {
        await emitWithFallback(
          'conversation:delete',
          { conversationId: conversation.id },
          () => chatApi.deleteConversation(conversation.id),
        );
        removeConversation(conversation.id);
        setActiveConversation(null);
      }
      setConfirmAction(null);
      setThreadMenuOpen(false);
    } catch {
      setActionError(confirmAction === 'clear' ? 'Could not clear this chat. Try again.' : 'Could not delete this contact. Try again.');
    } finally {
      setActionBusy(false);
    }
  }

  function onTyping(value: string) {
    setContent(value);
    if (editingMessage) return;
    if (!conversation || !socket) return;

    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    if (!value.trim()) {
      if (typingRef.current) socket.emit('typing:stop', { conversationId: conversation.id });
      typingRef.current = false;
      return;
    }

    if (!typingRef.current) {
      socket.emit('typing:start', { conversationId: conversation.id });
      typingRef.current = true;
    }

    typingTimerRef.current = window.setTimeout(() => {
      socket.emit('typing:stop', { conversationId: conversation.id });
      typingRef.current = false;
    }, 900);
  }

  if (!conversation || !peer) {
    return (
      <div className="flex h-full flex-col">
        <header className="safe-top flex min-h-14 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 md:hidden">
          <Button aria-label="Menu" variant="soft" className={chatHeaderButtonClass} onClick={onMenu} icon={<Menu size={20} />} />
          <span className="min-w-0 truncate font-semibold">Sync</span>
        </header>
        <div className="grid flex-1 place-items-center bg-[#f6f8fb] px-5 text-center sm:px-6">
          <div>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-slate-200 bg-white text-brand shadow-soft">
              <MessageCircle size={28} />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-slate-950">Choose a conversation</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted">Select a chat or find someone new to start messaging.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="safe-top flex min-h-14 items-center justify-between gap-2 border-b border-slate-200 bg-white px-2.5 py-2 sm:min-h-16 sm:px-5 sm:py-3 md:min-h-20 md:px-8">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <Button
            aria-label="Menu"
            variant="soft"
            className={clsx(chatHeaderButtonClass, 'md:hidden')}
            onClick={onMenu}
            icon={<Menu size={20} />}
          />
          <Avatar user={peer} />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-slate-950">{peer.name}</h1>
            <p className="truncate text-xs text-muted sm:text-sm">
              {typingUserId && typingUserId !== user.id ? 'Typing...' : formatPresence(peer.isOnline, peer.lastSeen)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button
            aria-label="Start voice call"
            title="Start voice call"
            variant="soft"
            className={chatHeaderButtonClass}
            onClick={() => onStartCall('audio')}
            icon={<PhoneCall size={21} />}
          />
          <Button
            aria-label="Start video call"
            title="Start video call"
            variant="soft"
            className={chatHeaderButtonClass}
            onClick={() => onStartCall('video')}
            icon={<Video size={21} />}
          />
          <div className="relative">
            <Button
              aria-label="Chat options"
              title="Chat options"
              variant="soft"
              className={chatHeaderButtonClass}
              onClick={() => setThreadMenuOpen((open) => !open)}
              icon={<MoreVertical size={21} />}
            />
            {threadMenuOpen && (
              <div className="absolute right-0 top-12 z-20 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 text-sm shadow-soft">
                <button
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={() => {
                    setActionError('');
                    setConfirmAction('clear');
                    setThreadMenuOpen(false);
                  }}
                  type="button"
                >
                  <Eraser size={16} />
                  Clear chat
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left font-medium text-red-600 transition hover:bg-red-50"
                  onClick={() => {
                    setActionError('');
                    setConfirmAction('delete-contact');
                    setThreadMenuOpen(false);
                  }}
                  type="button"
                >
                  <UserMinus size={16} />
                  Delete contact
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="thin-scrollbar flex-1 overflow-y-auto bg-[#f6f8fb]">
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-end space-y-2.5 px-2.5 py-3 sm:space-y-3 sm:px-5 sm:py-6 md:px-8 md:py-7">
          {loading && messages.length === 0 ? (
            <MessageSkeleton />
          ) : error && messages.length === 0 ? (
            <div className="mb-8 text-center text-sm text-muted">{error}</div>
          ) : null}
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const showDay = !previous || !isSameCalendarDay(previous.createdAt, message.createdAt);
            return (
              <Fragment key={message.id}>
                {showDay && <DateSeparator label={formatMessageDay(message.createdAt)} />}
                <ChatBubble
                  message={message}
                  mine={message.senderId === user.id}
                  onEdit={message.senderId === user.id ? startEditing : undefined}
                  onDelete={message.senderId === user.id ? deleteOwnMessage : undefined}
                />
              </Fragment>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <form className="safe-bottom relative border-t border-slate-200 bg-white px-2.5 pt-2 sm:px-4 sm:pt-3 md:px-8" onSubmit={send}>
        {editingMessage && (
          <div className="mx-auto mb-2 flex max-w-4xl items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-slate-700 sm:rounded-2xl sm:px-4">
            <div className="min-w-0">
              <p className="font-semibold text-brand">Editing message</p>
              <p className="truncate text-xs text-slate-500">{editingMessage.content}</p>
            </div>
            <button
              aria-label="Cancel edit"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-white hover:text-slate-950"
              onClick={cancelEditing}
              type="button"
            >
              <X size={17} />
            </button>
          </div>
        )}
        {actionError && <p className="mx-auto mb-2 max-w-4xl text-sm text-red-600">{actionError}</p>}
        {emojiOpen && (
          <div className="absolute bottom-16 left-2.5 z-10 w-[calc(100vw-1.25rem)] max-w-80 sm:bottom-20 sm:left-4 md:left-8">
            <Suspense fallback={<div className="h-48 w-full rounded-xl border border-slate-200 bg-white shadow-soft" />}>
              <EmojiPicker
                width="100%"
                height={380}
                previewConfig={{ showPreview: false }}
                onEmojiClick={(emoji: EmojiClickData) => setContent((current) => current + emoji.emoji)}
              />
            </Suspense>
          </div>
        )}
        <div className="mx-auto flex max-w-4xl items-end gap-2 sm:gap-3">
          <Button
            type="button"
            aria-label="Emoji"
            title="Emoji"
            variant="soft"
            className={clsx(chatHeaderButtonClass, 'h-10 w-10 shrink-0 sm:h-11 sm:w-11')}
            onClick={() => setEmojiOpen((open) => !open)}
            icon={<Smile size={21} />}
          />
          <textarea
            className="max-h-32 min-h-10 min-w-0 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-base outline-none transition placeholder:text-slate-400 focus:border-brand focus:bg-white focus:ring-4 focus:ring-blue-100 sm:min-h-11 sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm"
            rows={1}
            value={content}
            placeholder={editingMessage ? 'Edit message' : 'Message'}
            onChange={(event) => onTyping(event.target.value)}
          />
          <Button
            className="h-10 w-10 shrink-0 rounded-xl px-0 shadow-[0_10px_24px_rgba(37,99,235,0.25)] sm:h-11 sm:w-11 sm:rounded-2xl [&_svg]:h-5 [&_svg]:w-5 sm:[&_svg]:h-[21px] sm:[&_svg]:w-[21px]"
            aria-label="Send"
            title="Send"
            disabled={actionBusy || !content.trim()}
            icon={<Send size={21} />}
          />
        </div>
      </form>
      <Modal
        open={Boolean(confirmAction)}
        title={confirmAction === 'clear' ? 'Clear chat' : 'Delete contact'}
        onClose={() => {
          if (!actionBusy) {
            setConfirmAction(null);
            setActionError('');
          }
        }}
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-muted">
            {confirmAction === 'clear'
              ? 'This removes the visible chat history for you. New messages will still appear here.'
              : `This removes ${peer.name} from your conversation list. New messages can restore the chat later.`}
          </p>
          {actionError && <p className="text-sm text-red-600">{actionError}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="soft"
              className="h-11 rounded-xl"
              disabled={actionBusy}
              onClick={() => {
                setConfirmAction(null);
                setActionError('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={confirmAction === 'clear' ? 'primary' : 'danger'}
              className="h-11 rounded-xl"
              disabled={actionBusy}
              onClick={runConversationAction}
            >
              {actionBusy ? 'Working...' : confirmAction === 'clear' ? 'Clear chat' : 'Delete contact'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-9 w-44 animate-pulse rounded-2xl bg-white" />
      <div className="ml-auto h-16 w-56 animate-pulse rounded-2xl bg-blue-100" />
      <div className="h-14 w-64 animate-pulse rounded-2xl bg-white" />
      <div className="ml-auto h-12 w-48 animate-pulse rounded-2xl bg-blue-100" />
    </div>
  );
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-2">
      <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
        {label}
      </span>
    </div>
  );
}

function SearchUsersModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (user: User) => void;
}) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setUsers([]);
      setLoading(false);
      setError('');
      return;
    }
    let active = true;
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const result = await userApi.search(query);
        if (active) setUsers(result);
      } catch {
        if (active) {
          setUsers([]);
          setError('Search is unavailable. Try again.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [open, query]);

  return (
    <Modal open={open} title="Find People" onClose={onClose}>
      <Input autoFocus placeholder="Search by name or email" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="mt-4 space-y-2">
        {loading && <p className="px-3 py-2 text-sm text-muted">Searching...</p>}
        {error && <p className="px-3 py-2 text-sm text-red-600">{error}</p>}
        {!loading && !error && query.trim().length >= 2 && users.length === 0 && (
          <p className="px-3 py-2 text-sm text-muted">No people found.</p>
        )}
        {users.map((item) => (
          <button
            key={item.id}
            className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition hover:border-line hover:bg-slate-50"
            onClick={() => onSelect(item)}
          >
            <Avatar user={item} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <p className="truncate text-xs text-muted">{item.email}</p>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function ProfileModal({
  open,
  user,
  onClose,
  onSaved,
}: {
  open: boolean;
  user: User;
  onClose: () => void;
  onSaved: (user: User) => void;
}) {
  const [name, setName] = useState(user.name);
  const [status, setStatus] = useState(user.status ?? '');
  const [avatar, setAvatar] = useState(user.avatar ?? '');
  const [avatarError, setAvatarError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user.name);
    setStatus(user.status ?? '');
    setAvatar(user.avatar ?? '');
    setAvatarError('');
    setSaveError('');
    setSaving(false);
  }, [open, user]);

  function onAvatarFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void readAvatarFile(file)
      .then((result) => {
        setAvatar(result);
        setAvatarError('');
      })
      .catch((error: unknown) => setAvatarError(error instanceof Error ? error.message : 'Could not read that image.'));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const updated = await userApi.updateMe({ name: name.trim(), status: status.trim(), avatar: avatar.trim() || undefined });
      onSaved(updated);
      onClose();
    } catch {
      setSaveError('Could not save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Profile" onClose={onClose}>
      <form className="space-y-4" onSubmit={save}>
        <div className="flex flex-col items-center gap-3 py-2">
          <Avatar user={{ ...user, name, avatar }} size="lg" />
          <p className="text-xs text-muted">Images up to {MAX_AVATAR_LABEL}</p>
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
            <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
              <Upload size={17} />
              Upload image
              <input accept="image/*" className="hidden" type="file" onChange={onAvatarFile} />
            </label>
            {avatar && (
              <Button type="button" variant="soft" className="h-10 rounded-xl" onClick={() => setAvatar('')}>
                Remove
              </Button>
            )}
          </div>
          {avatarError && <p className="text-sm text-red-600">{avatarError}</p>}
        </div>
        <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
        <Input label="Status" value={status} onChange={(event) => setStatus(event.target.value)} placeholder="Available" />
        {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        <Button className="h-11 w-full rounded-xl" disabled={saving || !name.trim()}>
          {saving ? 'Saving...' : 'Save changes'}
        </Button>
      </form>
    </Modal>
  );
}

function IncomingCallModal({
  call,
  callerName,
  onAccept,
  onReject,
}: {
  call: IncomingCall | null;
  callerName: string;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <Modal open={Boolean(call)} title="Incoming call" onClose={onReject}>
      <div className="text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-blue-100 bg-blue-50 text-brand shadow-sm">
          {call?.callType === 'audio' ? <PhoneCall size={24} /> : <Video size={24} />}
        </div>
        <p className="font-semibold">{callerName}</p>
        <p className="mt-1 text-sm text-muted">{call?.callType === 'audio' ? 'Voice call' : 'Video call'}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button variant="soft" className="h-11 flex-1 rounded-xl" onClick={onReject}>
            Decline
          </Button>
          <Button className="h-11 flex-1 rounded-xl" onClick={onAccept}>
            Accept
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ActiveCallScreen({
  call,
  socket,
  onEnd,
}: {
  call: ActiveCall;
  socket: ReturnType<typeof getSocket> | null;
  onEnd: () => void;
}) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [startedAt] = useState(Date.now());
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState(call.status);
  const rtc = useWebRTC({
    socket,
    callId: call.callId,
    peerId: call.peerId,
    isCaller: call.isCaller,
    enabled: call.status !== 'ringing',
    callType: call.callType,
    localVideoRef,
    remoteVideoRef,
    onConnected: () => setStatus('connected'),
  });

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  useEffect(() => {
    setStatus(call.status);
  }, [call.status]);

  useEffect(() => () => rtc.stop(), []);

  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  const remaining = String(seconds % 60).padStart(2, '0');

  return (
    <div className="fixed inset-0 z-40 flex h-[100dvh] flex-col bg-slate-950 text-white">
      <header className="safe-top flex min-h-16 items-center justify-between gap-4 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{call.peerName}</p>
          <p className="truncate text-xs text-white/60">
            {rtc.mediaError
              ? rtc.mediaError
              : status === 'connected'
                ? `${minutes}:${remaining}`
                : status === 'ringing'
                  ? 'Ringing...'
                  : 'Connecting...'}
          </p>
        </div>
        <p className="shrink-0 text-xs text-white/60">
          {status === 'connected' || rtc.connectionState === 'connected'
            ? 'Connected'
            : call.callType === 'audio'
              ? 'Voice call'
              : 'Video call'}
        </p>
      </header>
      <div className="relative min-h-0 flex-1">
        {call.callType === 'audio' && (
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            <div>
              <div className="mx-auto mb-5">
                <Avatar user={{ name: call.peerName, avatar: call.peerAvatar, isOnline: true }} size="lg" />
              </div>
              <h2 className="text-2xl font-semibold">{call.peerName}</h2>
              <p className="mt-2 text-sm text-white/60">
                {status === 'connected' ? `${minutes}:${remaining}` : status === 'ringing' ? 'Ringing...' : 'Connecting voice call...'}
              </p>
            </div>
          </div>
        )}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={call.callType === 'video' ? 'h-full w-full object-cover' : 'sr-only'}
        />
        {call.callType === 'video' && (
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="absolute right-3 top-3 h-28 w-20 rounded-xl border border-white/20 bg-gray-900 object-cover shadow-soft sm:right-4 sm:top-4 sm:h-32 sm:w-24 md:h-44 md:w-32"
          />
        )}
        <div className="safe-bottom absolute inset-x-0 bottom-0 flex justify-center px-3">
          <CallControls
            muted={rtc.muted}
            cameraOff={rtc.cameraOff}
            sharing={rtc.sharing}
            videoEnabled={call.callType === 'video'}
            onToggleMute={rtc.toggleMute}
            onToggleCamera={rtc.toggleCamera}
            onShare={rtc.shareScreen}
            onEnd={() => {
              rtc.stop();
              onEnd();
            }}
          />
        </div>
      </div>
    </div>
  );
}

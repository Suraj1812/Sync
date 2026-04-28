import { ChangeEvent, FormEvent, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { EmojiClickData } from 'emoji-picker-react';
import {
  LogOut,
  Menu,
  MessageCircle,
  PhoneCall,
  Search,
  Send,
  Settings,
  Smile,
  Upload,
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
import { formatPresence, formatTime } from '../utils/time';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

function otherParticipant(conversation: Conversation, currentUserId: string) {
  return conversation.participants.find((participant) => participant.userId !== currentUserId)?.user;
}

function findParticipantById(conversations: Conversation[], userId: string) {
  return conversations
    .flatMap((conversation) => conversation.participants.map((participant) => participant.user))
    .find((item) => item.id === userId);
}

const railButtonClass =
  'h-12 w-12 rounded-2xl px-0 text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-white/20 [&_svg]:h-[22px] [&_svg]:w-[22px]';

const iconButtonClass =
  'h-11 w-11 rounded-xl border border-slate-200 bg-slate-50 px-0 text-slate-700 shadow-sm hover:border-slate-300 hover:bg-white hover:text-slate-950 focus-visible:ring-blue-100 [&_svg]:h-[21px] [&_svg]:w-[21px]';

export function AppLayout() {
  const { user, token, logout, setUser } = useAuthStore();
  const {
    conversations,
    messages,
    activeConversationId,
    typingByConversation,
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
    socket.emit('message:seen', { conversationId: activeConversationId });
  }, [activeConversationId, loadMessages, socket]);

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
    socket.emit('call:initiate', { receiverId: activePeer.id, conversationId: activeConversationId, callType });
    socket.once('call:ringing', (payload: { callId: string; callType?: 'audio' | 'video' }) => {
      setActiveCall({
        callId: payload.callId,
        peerId: activePeer.id,
        peerName: activePeer.name,
        peerAvatar: activePeer.avatar,
        callType: payload.callType ?? callType,
        isCaller: true,
        status: 'ringing',
      });
    });
  }

  function acceptCall() {
    if (!incomingCall || !socket) return;
    const caller = findParticipantById(conversations, incomingCall.callerId);
    socket.emit('call:accept', {
      callId: incomingCall.callId,
      receiverId: incomingCall.callerId,
    });
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
    <main className="h-screen overflow-hidden bg-slate-100 p-0 text-ink md:p-3">
      <div className="flex h-full overflow-hidden bg-white shadow-[0_20px_70px_rgba(15,23,42,0.08)] md:rounded-[28px] md:border md:border-slate-200">
        <nav className="hidden w-20 shrink-0 flex-col items-center border-r border-slate-900/80 bg-slate-950 py-5 md:flex">
          <div className="flex flex-1 flex-col gap-3">
            <Button
              aria-label="Messages"
              title="Messages"
              variant="ghost"
              className={clsx(railButtonClass, '!bg-white !text-slate-950 shadow-sm hover:!bg-white hover:!text-slate-950')}
              icon={<MessageCircle size={22} />}
            />
            <Button
              aria-label="Find people"
              title="Find people"
              variant="ghost"
              className={railButtonClass}
              onClick={() => setSearchOpen(true)}
              icon={<UserPlus size={22} />}
            />
          </div>
          <Button
            aria-label="Settings"
            title="Profile settings"
            variant="ghost"
            className={railButtonClass}
            onClick={() => setProfileOpen(true)}
            icon={<Settings size={22} />}
          />
        </nav>

        <aside
          className={clsx(
            'absolute inset-y-0 left-0 z-30 w-full max-w-sm border-r border-slate-200 bg-white transition-transform md:static md:block md:w-[420px] md:max-w-[420px] md:translate-x-0',
            mobileListOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <ConversationList
            conversations={conversations}
            currentUser={user}
            activeId={activeConversationId}
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

        <section className="flex min-w-0 flex-1 flex-col">
          <ConversationView
            user={user}
            conversation={activeConversation}
            peer={activePeer ?? null}
            messages={activeConversationId ? messages[activeConversationId] ?? [] : []}
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
  onSelect,
  onSearch,
  onProfile,
  onLogout,
  onClose,
}: {
  conversations: Conversation[];
  currentUser: User;
  activeId: string | null;
  onSelect: (id: string) => void;
  onSearch: () => void;
  onProfile: () => void;
  onLogout: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 px-5 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400">Sync</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-950">Messages</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
              className={iconButtonClass}
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
          className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-white"
          onClick={onProfile}
        >
          <Avatar user={currentUser} />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{currentUser.name}</h2>
            <p className="truncate text-xs text-muted">{currentUser.status || 'Available'}</p>
          </div>
        </button>
      </header>
      <div className="thin-scrollbar flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="px-8 py-16 text-center">
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
            if (!peer) return null;
            return (
              <button
                key={conversation.id}
                className={clsx(
                  'flex w-full items-center gap-3 border-b border-slate-100 px-5 py-4 text-left transition hover:bg-slate-50',
                  activeId === conversation.id && 'bg-blue-50/90 ring-1 ring-inset ring-blue-100',
                )}
                onClick={() => onSelect(conversation.id)}
              >
                <Avatar user={peer} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold">{peer.name}</p>
                    <span className="shrink-0 text-xs text-muted">{formatTime(lastMessage?.createdAt)}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted">{lastMessage?.content ?? formatPresence(peer.isOnline, peer.lastSeen)}</p>
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
  typingUserId,
  socket,
  onMenu,
  onStartCall,
}: {
  user: User;
  conversation: Conversation | null;
  peer: User | null;
  messages: Message[];
  typingUserId?: string | null;
  socket: ReturnType<typeof getSocket> | null;
  onMenu: () => void;
  onStartCall: (callType: 'audio' | 'video') => void;
}) {
  const [content, setContent] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  function send(event: FormEvent) {
    event.preventDefault();
    if (!conversation || !content.trim()) return;
    socket?.emit('message:send', { conversationId: conversation.id, content });
    socket?.emit('typing:stop', { conversationId: conversation.id });
    setContent('');
    setEmojiOpen(false);
  }

  function onTyping(value: string) {
    setContent(value);
    if (!conversation) return;
    socket?.emit(value ? 'typing:start' : 'typing:stop', { conversationId: conversation.id });
  }

  if (!conversation || !peer) {
    return (
      <div className="flex h-full flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 md:hidden">
          <Button aria-label="Menu" variant="soft" className={iconButtonClass} onClick={onMenu} icon={<Menu size={21} />} />
          <span className="font-semibold">Sync</span>
        </header>
        <div className="grid flex-1 place-items-center bg-[#f6f8fb] px-6 text-center">
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
      <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            aria-label="Menu"
            variant="soft"
            className={clsx(iconButtonClass, 'md:hidden')}
            onClick={onMenu}
            icon={<Menu size={21} />}
          />
          <Avatar user={peer} />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-slate-950">{peer.name}</h1>
            <p className="truncate text-sm text-muted">
              {typingUserId && typingUserId !== user.id ? 'Typing...' : formatPresence(peer.isOnline, peer.lastSeen)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Start voice call"
            title="Start voice call"
            variant="soft"
            className={iconButtonClass}
            onClick={() => onStartCall('audio')}
            icon={<PhoneCall size={21} />}
          />
          <Button
            aria-label="Start video call"
            title="Start video call"
            variant="soft"
            className={iconButtonClass}
            onClick={() => onStartCall('video')}
            icon={<Video size={21} />}
          />
        </div>
      </header>

      <div className="thin-scrollbar flex-1 overflow-y-auto bg-[#f6f8fb]">
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-end space-y-3 px-5 py-7 md:px-8">
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} mine={message.senderId === user.id} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <form className="relative border-t border-slate-200 bg-white px-4 py-4 md:px-8" onSubmit={send}>
        {emojiOpen && (
          <div className="absolute bottom-20 left-4 z-10 md:left-8">
            <Suspense fallback={<div className="h-48 w-80 rounded-xl border border-slate-200 bg-white shadow-soft" />}>
              <EmojiPicker
                width={320}
                height={380}
                previewConfig={{ showPreview: false }}
                onEmojiClick={(emoji: EmojiClickData) => setContent((current) => current + emoji.emoji)}
              />
            </Suspense>
          </div>
        )}
        <div className="mx-auto flex max-w-4xl items-end gap-3">
          <Button
            type="button"
            aria-label="Emoji"
            title="Emoji"
            variant="soft"
            className={clsx(iconButtonClass, 'h-11 w-11 shrink-0')}
            onClick={() => setEmojiOpen((open) => !open)}
            icon={<Smile size={21} />}
          />
          <textarea
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:bg-white focus:ring-4 focus:ring-blue-100"
            rows={1}
            value={content}
            placeholder="Message"
            onChange={(event) => onTyping(event.target.value)}
          />
          <Button
            className="h-11 w-11 shrink-0 rounded-2xl px-0 shadow-[0_10px_24px_rgba(37,99,235,0.25)] [&_svg]:h-[21px] [&_svg]:w-[21px]"
            aria-label="Send"
            title="Send"
            icon={<Send size={21} />}
          />
        </div>
      </form>
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

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setUsers([]);
      return;
    }
    const timeout = window.setTimeout(async () => setUsers(await userApi.search(query)), 220);
    return () => window.clearTimeout(timeout);
  }, [open, query]);

  return (
    <Modal open={open} title="Find People" onClose={onClose}>
      <Input autoFocus placeholder="Search by name or email" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="mt-4 space-y-2">
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

  useEffect(() => {
    setName(user.name);
    setStatus(user.status ?? '');
    setAvatar(user.avatar ?? '');
    setAvatarError('');
  }, [user]);

  function onAvatarFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('Choose an image file.');
      return;
    }
    if (file.size > 1_200_000) {
      setAvatarError('Use an image smaller than 1.2 MB.');
      return;
    }

    const reader = new window.FileReader();
    reader.onload = () => {
      setAvatar(String(reader.result));
      setAvatarError('');
    };
    reader.onerror = () => setAvatarError('Could not read that image.');
    reader.readAsDataURL(file);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const updated = await userApi.updateMe({ name, status, avatar: avatar.trim() || undefined });
    onSaved(updated);
    onClose();
  }

  return (
    <Modal open={open} title="Profile" onClose={onClose}>
      <form className="space-y-4" onSubmit={save}>
        <div className="flex flex-col items-center gap-3 py-2">
          <Avatar user={{ ...user, name, avatar }} size="lg" />
          <div className="flex items-center gap-2">
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
        <Button className="h-11 w-full rounded-xl">Save changes</Button>
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
        <div className="mt-6 flex gap-3">
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
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-950 text-white">
      <header className="flex h-16 items-center justify-between px-5">
        <div>
          <p className="text-sm font-medium">{call.peerName}</p>
          <p className="text-xs text-white/60">
            {status === 'connected' ? `${minutes}:${remaining}` : status === 'ringing' ? 'Ringing...' : 'Connecting...'}
          </p>
        </div>
        <p className="text-xs text-white/60">
          {status === 'connected' ? 'Connected' : call.callType === 'audio' ? 'Voice call' : 'Video call'}
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
            className="absolute right-4 top-4 h-32 w-24 rounded-xl border border-white/20 bg-gray-900 object-cover shadow-soft md:h-44 md:w-32"
          />
        )}
        <div className="absolute inset-x-0 bottom-6 flex justify-center">
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

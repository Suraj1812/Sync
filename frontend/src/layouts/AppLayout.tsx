import { FormEvent, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { EmojiClickData } from 'emoji-picker-react';
import {
  LogOut,
  Menu,
  MessageCircle,
  Phone,
  Search,
  Send,
  Settings,
  Smile,
  UserPlus,
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

const railButtonClass =
  'h-11 w-11 rounded-xl px-0 text-slate-600 hover:bg-slate-100 hover:text-ink [&_svg]:h-5 [&_svg]:w-5';

const iconButtonClass =
  'h-10 w-10 rounded-xl border border-line bg-white px-0 text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-ink [&_svg]:h-5 [&_svg]:w-5';

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

  function startCall() {
    if (!activePeer || !socket) return;
    socket.emit('call:initiate', { receiverId: activePeer.id, conversationId: activeConversationId });
    socket.once('call:ringing', (payload: { callId: string }) => {
      setActiveCall({
        callId: payload.callId,
        peerId: activePeer.id,
        peerName: activePeer.name,
        isCaller: true,
        status: 'ringing',
      });
    });
  }

  function acceptCall() {
    if (!incomingCall || !socket) return;
    const caller = conversations
      .flatMap((conversation) => conversation.participants.map((participant) => participant.user))
      .find((item) => item.id === incomingCall.callerId);
    socket.emit('call:accept', {
      callId: incomingCall.callId,
      receiverId: incomingCall.callerId,
    });
    setActiveCall({
      callId: incomingCall.callId,
      peerId: incomingCall.callerId,
      peerName: caller?.name ?? 'Incoming caller',
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
    <main className="h-screen overflow-hidden bg-[#f8fafc] text-ink">
      <div className="flex h-full">
        <nav className="hidden w-[72px] shrink-0 flex-col items-center border-r border-line bg-white/95 py-4 md:flex">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-sm font-semibold text-white shadow-sm">S</div>
          <div className="mt-8 flex flex-1 flex-col gap-2">
            <Button
              aria-label="Messages"
              variant="ghost"
              className={clsx(railButtonClass, 'bg-ink text-white shadow-sm hover:bg-ink hover:text-white')}
              icon={<MessageCircle />}
            />
            <Button
              aria-label="Find people"
              variant="ghost"
              className={railButtonClass}
              onClick={() => setSearchOpen(true)}
              icon={<UserPlus />}
            />
          </div>
          <Button
            aria-label="Settings"
            variant="ghost"
            className={railButtonClass}
            onClick={() => setProfileOpen(true)}
            icon={<Settings />}
          />
        </nav>

        <aside
          className={clsx(
            'absolute inset-y-0 left-0 z-30 w-full max-w-sm border-r border-line bg-white transition-transform md:static md:block md:w-[380px] md:max-w-[380px] md:translate-x-0',
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
            ? conversations
                .flatMap((conversation) => conversation.participants.map((participant) => participant.user))
                .find((item) => item.id === incomingCall.callerId)?.name ?? 'Incoming caller'
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
      <header className="flex h-20 items-center justify-between border-b border-line px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar user={currentUser} />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{currentUser.name}</h2>
            <p className="text-xs text-muted">Available</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button aria-label="Search users" variant="soft" className={iconButtonClass} onClick={onSearch} icon={<Search />} />
          <Button aria-label="Profile" variant="soft" className={iconButtonClass} onClick={onProfile} icon={<Settings />} />
          <Button aria-label="Logout" variant="soft" className={iconButtonClass} onClick={onLogout} icon={<LogOut />} />
          <Button aria-label="Close" variant="soft" className={clsx(iconButtonClass, 'md:hidden')} onClick={onClose} icon={<X />} />
        </div>
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
                  'flex w-full items-center gap-3 border-b border-line px-5 py-4 text-left transition hover:bg-slate-50',
                  activeId === conversation.id && 'bg-blue-50/80',
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
  onStartCall: () => void;
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
        <header className="flex h-16 items-center gap-3 border-b border-line bg-white px-4 md:hidden">
          <Button aria-label="Menu" variant="soft" className={iconButtonClass} onClick={onMenu} icon={<Menu />} />
          <span className="font-semibold">Sync</span>
        </header>
        <div className="grid flex-1 place-items-center px-6 text-center">
          <div>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-line bg-white text-brand shadow-soft">
              <MessageCircle size={28} />
            </div>
            <h2 className="mt-5 text-lg font-semibold">Choose a conversation</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted">Select a chat or find someone new to start messaging.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-20 items-center justify-between border-b border-line bg-white px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Button aria-label="Menu" variant="soft" className={clsx(iconButtonClass, 'md:hidden')} onClick={onMenu} icon={<Menu />} />
          <Avatar user={peer} />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{peer.name}</h1>
            <p className="truncate text-xs text-muted">
              {typingUserId && typingUserId !== user.id ? 'Typing...' : formatPresence(peer.isOnline, peer.lastSeen)}
            </p>
          </div>
        </div>
        <Button aria-label="Start video call" variant="soft" className={iconButtonClass} onClick={onStartCall} icon={<Phone />} />
      </header>

      <div className="thin-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-5 md:px-8">
        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} mine={message.senderId === user.id} />
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="relative border-t border-line bg-white p-3 md:px-5" onSubmit={send}>
        {emojiOpen && (
          <div className="absolute bottom-16 left-3 z-10">
            <Suspense fallback={<div className="h-48 w-80 rounded-xl border border-line bg-white shadow-soft" />}>
              <EmojiPicker
                width={320}
                height={380}
                previewConfig={{ showPreview: false }}
                onEmojiClick={(emoji: EmojiClickData) => setContent((current) => current + emoji.emoji)}
              />
            </Suspense>
          </div>
        )}
        <div className="flex items-end gap-2">
          <Button
            type="button"
            aria-label="Emoji"
            variant="soft"
            className={clsx(iconButtonClass, 'h-11 w-11 shrink-0')}
            onClick={() => setEmojiOpen((open) => !open)}
            icon={<Smile />}
          />
          <textarea
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:bg-white focus:ring-4 focus:ring-blue-100"
            rows={1}
            value={content}
            placeholder="Message"
            onChange={(event) => onTyping(event.target.value)}
          />
          <Button className="h-11 w-11 shrink-0 rounded-xl px-0 [&_svg]:h-5 [&_svg]:w-5" aria-label="Send" icon={<Send />} />
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

  useEffect(() => {
    setName(user.name);
    setStatus(user.status ?? '');
    setAvatar(user.avatar ?? '');
  }, [user]);

  async function save(event: FormEvent) {
    event.preventDefault();
    const updated = await userApi.updateMe({ name, status, avatar: avatar.trim() || undefined });
    onSaved(updated);
    onClose();
  }

  return (
    <Modal open={open} title="Profile" onClose={onClose}>
      <form className="space-y-4" onSubmit={save}>
        <div className="flex justify-center py-2">
          <Avatar user={{ ...user, name, avatar }} size="lg" />
        </div>
        <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
        <Input label="Status" value={status} onChange={(event) => setStatus(event.target.value)} placeholder="Available" />
        <Input label="Avatar URL" value={avatar} onChange={(event) => setAvatar(event.target.value)} placeholder="https://..." />
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
          <Phone size={24} />
        </div>
        <p className="font-semibold">{callerName}</p>
        <p className="mt-1 text-sm text-muted">Video call</p>
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
          <p className="text-xs text-white/60">{status === 'connected' ? `${minutes}:${remaining}` : 'Connecting...'}</p>
        </div>
        <p className="text-xs text-white/60">{status === 'connected' ? 'Connected' : 'Secure WebRTC'}</p>
      </header>
      <div className="relative min-h-0 flex-1">
        <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="absolute right-4 top-4 h-32 w-24 rounded-xl border border-white/20 bg-gray-900 object-cover shadow-soft md:h-44 md:w-32"
        />
        <div className="absolute inset-x-0 bottom-6 flex justify-center">
          <CallControls
            muted={rtc.muted}
            cameraOff={rtc.cameraOff}
            sharing={rtc.sharing}
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

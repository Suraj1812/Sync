export type User = {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  status?: string | null;
  isOnline: boolean;
  lastSeen?: string | null;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  delivered: boolean;
  seen: boolean;
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  sender: User;
};

export type Conversation = {
  id: string;
  createdAt: string;
  updatedAt: string;
  participants: { id: string; userId: string; user: User; clearedAt?: string | null; deletedAt?: string | null }[];
  messages: Message[];
  unreadCount: number;
};

export type IncomingCall = {
  callId: string;
  callerId: string;
  receiverId: string;
  conversationId?: string;
  callType: 'audio' | 'video';
};

export type ActiveCall = {
  callId: string;
  peerId: string;
  peerName: string;
  peerAvatar?: string | null;
  callType: 'audio' | 'video';
  isCaller: boolean;
  status: 'ringing' | 'connecting' | 'connected' | 'ended';
};

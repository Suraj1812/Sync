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
  seen: boolean;
  createdAt: string;
  sender: User;
};

export type Conversation = {
  id: string;
  createdAt: string;
  updatedAt: string;
  participants: { id: string; userId: string; user: User }[];
  messages: Message[];
};

export type IncomingCall = {
  callId: string;
  callerId: string;
  receiverId: string;
  conversationId?: string;
};

export type ActiveCall = {
  callId: string;
  peerId: string;
  peerName: string;
  isCaller: boolean;
  status: 'ringing' | 'connecting' | 'connected' | 'ended';
};

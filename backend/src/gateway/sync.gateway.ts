import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { CallStatus } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { CallsService } from '../calls/calls.service';
import { ChatService } from '../chat/chat.service';
import { ConversationActionDto, EditMessageDto, MessageActionDto, SendMessageDto, SeenMessageDto } from '../chat/dto';
import { corsOrigin } from '../common/utils/origins';
import { RealtimeService } from '../realtime/realtime.service';
import { UsersService } from '../users/users.service';

type AuthedSocket = Socket & {
  user?: { id: string; email: string };
};

type CallPayload = {
  receiverId: string;
  conversationId?: string;
  callId?: string;
  callType?: 'audio' | 'video';
  offer?: unknown;
  answer?: unknown;
  candidate?: unknown;
};

@WebSocketGateway({
  cors: {
    origin: corsOrigin(process.env.FRONTEND_URL, process.env.NODE_ENV),
    credentials: true,
  },
})
export class SyncGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly onlineUsers = new Map<string, Set<string>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly chat: ChatService,
    private readonly calls: CallsService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtime.attach(server);
  }

  async handleConnection(client: AuthedSocket) {
    try {
      const token = this.extractToken(client);
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string }>(token);
      client.user = { id: payload.sub, email: payload.email };
      client.join(this.userRoom(payload.sub));

      const sockets = this.onlineUsers.get(payload.sub) ?? new Set<string>();
      sockets.add(client.id);
      this.onlineUsers.set(payload.sub, sockets);

      const user = await this.users.setOnline(payload.sub);
      this.server.emit('user:online', user);
      await this.emitDeliveredForUser(payload.sub);
    } catch {
      client.emit('error', { message: 'Unauthorized socket connection' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthedSocket) {
    if (!client.user) return;
    const sockets = this.onlineUsers.get(client.user.id);
    sockets?.delete(client.id);

    if (!sockets || sockets.size === 0) {
      this.onlineUsers.delete(client.user.id);
      const user = await this.users.setOffline(client.user.id);
      this.server.emit('user:offline', user);
    }
  }

  @SubscribeMessage('conversation:join')
  async joinConversation(@ConnectedSocket() client: AuthedSocket, @MessageBody() conversationId: string) {
    if (!client.user || typeof conversationId !== 'string') return;
    await this.chat.assertParticipant(client.user.id, conversationId);
    client.join(this.conversationRoom(conversationId));
  }

  @SubscribeMessage('message:send')
  async sendMessage(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: SendMessageDto) {
    if (!client.user || !dto?.conversationId) return;
    const participantIds = await this.chat.getParticipantIds(dto.conversationId);
    const receiverIds = participantIds.filter((id) => id !== client.user?.id);
    const receiverOnline = receiverIds.some((id) => this.onlineUsers.has(id));
    const message = await this.chat.sendMessage(client.user.id, dto.conversationId, dto.content);
    const outgoing = receiverOnline ? await this.chat.markDelivered(message.id) : message;
    participantIds.forEach((id) => this.server.to(this.userRoom(id)).emit('message:new', outgoing));
    return outgoing;
  }

  @SubscribeMessage('message:seen')
  async seen(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: SeenMessageDto) {
    if (!client.user || !dto?.conversationId) return;
    const result = await this.chat.markSeen(client.user.id, dto.conversationId);
    const participantIds = await this.chat.getParticipantIds(dto.conversationId);
    const payload = {
      ...result,
      seenBy: client.user.id,
    };
    participantIds.forEach((id) => this.server.to(this.userRoom(id)).emit('message:seen', payload));
  }

  @SubscribeMessage('message:edit')
  async editMessage(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: EditMessageDto) {
    if (!client.user || !dto?.messageId) return;
    const message = await this.chat.editMessage(client.user.id, dto.messageId, dto.content);
    const participantIds = await this.chat.getParticipantIds(message.conversationId);
    participantIds.forEach((id) => this.server.to(this.userRoom(id)).emit('message:updated', message));
    return message;
  }

  @SubscribeMessage('message:delete')
  async deleteMessage(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: MessageActionDto) {
    if (!client.user || !dto?.messageId) return;
    const result = await this.chat.deleteMessage(client.user.id, dto.messageId, dto.scope);
    const participantIds = await this.chat.getParticipantIds(result.conversationId);
    if (result.scope === 'me') this.server.to(this.userRoom(client.user.id)).emit('message:deleted', result);
    else participantIds.forEach((id) => this.server.to(this.userRoom(id)).emit('message:deleted', result));
    return result;
  }

  @SubscribeMessage('conversation:clear')
  async clearConversation(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: ConversationActionDto) {
    if (!client.user || !dto?.conversationId) return;
    const result = await this.chat.clearConversation(client.user.id, dto.conversationId);
    this.server.to(this.userRoom(client.user.id)).emit('conversation:cleared', result);
    return result;
  }

  @SubscribeMessage('conversation:delete')
  async deleteConversation(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: ConversationActionDto) {
    if (!client.user || !dto?.conversationId) return;
    const result = await this.chat.deleteConversation(client.user.id, dto.conversationId);
    this.server.to(this.userRoom(client.user.id)).emit('conversation:deleted', result);
    return result;
  }

  @SubscribeMessage('typing:start')
  async typingStart(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: { conversationId: string },
  ) {
    if (!client.user || !payload?.conversationId) return;
    await this.chat.assertParticipant(client.user.id, payload.conversationId);
    client.to(this.conversationRoom(payload.conversationId)).emit('typing:start', {
      conversationId: payload.conversationId,
      userId: client.user.id,
    });
  }

  @SubscribeMessage('typing:stop')
  async typingStop(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: { conversationId: string },
  ) {
    if (!client.user || !payload?.conversationId) return;
    await this.chat.assertParticipant(client.user.id, payload.conversationId);
    client.to(this.conversationRoom(payload.conversationId)).emit('typing:stop', {
      conversationId: payload.conversationId,
      userId: client.user.id,
    });
  }

  @SubscribeMessage('call:initiate')
  async initiateCall(@ConnectedSocket() client: AuthedSocket, @MessageBody() payload: CallPayload) {
    if (!client.user || !payload?.receiverId) return;
    if (!this.onlineUsers.has(payload.receiverId)) {
      client.emit('call:unavailable', { receiverId: payload.receiverId });
      return;
    }
    const call = await this.calls.create(client.user.id, payload.receiverId);
    this.server.to(this.userRoom(payload.receiverId)).emit('call:incoming', {
      callId: call.id,
      callerId: client.user.id,
      receiverId: payload.receiverId,
      conversationId: payload.conversationId,
      callType: payload.callType === 'audio' ? 'audio' : 'video',
    });
    client.emit('call:ringing', {
      callId: call.id,
      receiverId: payload.receiverId,
      callType: payload.callType === 'audio' ? 'audio' : 'video',
    });
  }

  @SubscribeMessage('call:accept')
  async acceptCall(@ConnectedSocket() client: AuthedSocket, @MessageBody() payload: CallPayload) {
    if (!client.user || !payload?.callId) return;
    const call = await this.calls.accept(payload.callId, client.user.id);
    this.server.to(this.userRoom(call.callerId)).emit('call:accept', {
      callId: payload.callId,
      acceptedBy: client.user.id,
    });
  }

  @SubscribeMessage('call:reject')
  async rejectCall(@ConnectedSocket() client: AuthedSocket, @MessageBody() payload: CallPayload) {
    if (!client.user || !payload?.callId) return;
    const call = await this.calls.reject(payload.callId, client.user.id);
    this.server.to(this.userRoom(call.callerId)).emit('call:reject', {
      callId: payload.callId,
      rejectedBy: client.user.id,
    });
  }

  @SubscribeMessage('call:end')
  async endCall(@ConnectedSocket() client: AuthedSocket, @MessageBody() payload: CallPayload) {
    if (!client.user || !payload?.callId) return;
    const call = await this.calls.end(payload.callId, client.user.id, CallStatus.ENDED);
    this.server.to(this.userRoom(this.calls.peerId(call, client.user.id))).emit('call:end', {
      callId: payload.callId,
      endedBy: client.user.id,
    });
  }

  @SubscribeMessage('webrtc:offer')
  offer(@ConnectedSocket() client: AuthedSocket, @MessageBody() payload: CallPayload) {
    if (!client.user || !payload?.receiverId) return;
    this.server.to(this.userRoom(payload.receiverId)).emit('webrtc:offer', {
      callId: payload.callId,
      senderId: client.user.id,
      offer: payload.offer,
    });
  }

  @SubscribeMessage('webrtc:answer')
  answer(@ConnectedSocket() client: AuthedSocket, @MessageBody() payload: CallPayload) {
    if (!client.user || !payload?.receiverId) return;
    this.server.to(this.userRoom(payload.receiverId)).emit('webrtc:answer', {
      callId: payload.callId,
      senderId: client.user.id,
      answer: payload.answer,
    });
  }

  @SubscribeMessage('webrtc:ice')
  ice(@ConnectedSocket() client: AuthedSocket, @MessageBody() payload: CallPayload) {
    if (!client.user || !payload?.receiverId) return;
    this.server.to(this.userRoom(payload.receiverId)).emit('webrtc:ice', {
      callId: payload.callId,
      senderId: client.user.id,
      candidate: payload.candidate,
    });
  }

  private extractToken(client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.headers.authorization?.replace('Bearer ', '');
    if (!token || Array.isArray(token)) throw new Error('Missing token');
    return token;
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }

  private conversationRoom(conversationId: string) {
    return `conversation:${conversationId}`;
  }

  private async emitDeliveredForUser(userId: string) {
    const conversationIds = await this.chat.markDeliveredForUser(userId);
    await Promise.all(
      conversationIds.map(async (conversationId) => {
        const participantIds = await this.chat.getParticipantIds(conversationId);
        const payload = { conversationId, deliveredTo: userId };
        participantIds.forEach((id) => this.server.to(this.userRoom(id)).emit('message:delivered', payload));
      }),
    );
  }
}

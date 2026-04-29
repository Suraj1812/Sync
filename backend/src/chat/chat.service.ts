import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async listConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: { include: { user: { select: this.userSelect() } } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: this.userSelect() } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return this.withUnreadCounts(userId, conversations);
  }

  async startConversation(currentUserId: string, otherUserId: string) {
    if (currentUserId === otherUserId) throw new ForbiddenException('Choose another user');

    const other = await this.prisma.user.findUnique({ where: { id: otherUserId } });
    if (!other) throw new NotFoundException('User not found');

    const existing = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: currentUserId } } },
          { participants: { some: { userId: otherUserId } } },
        ],
      },
      include: {
        participants: { include: { user: { select: this.userSelect() } } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: this.userSelect() } },
        },
      },
    });
    if (existing) return { ...existing, unreadCount: 0 };

    const conversation = await this.prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId: currentUserId }, { userId: otherUserId }],
        },
      },
      include: {
        participants: { include: { user: { select: this.userSelect() } } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: this.userSelect() } },
        },
      },
    });
    return { ...conversation, unreadCount: 0 };
  }

  async getMessages(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId);
    return this.prisma.message.findMany({
      where: { conversationId },
      include: { sender: { select: this.userSelect() } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  async sendMessage(userId: string, conversationId: string, content: string) {
    await this.assertParticipant(userId, conversationId);
    const trimmed = content.trim();
    if (!trimmed) throw new BadRequestException('Message cannot be empty');

    const message = await this.prisma.message.create({
      data: { conversationId, senderId: userId, content: trimmed },
      include: { sender: { select: this.userSelect() } },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return message;
  }

  async markSeen(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId);
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, seen: false },
      data: { seen: true, delivered: true },
    });
    return { conversationId };
  }

  async markDeliveredForUser(userId: string) {
    const pending = await this.prisma.message.findMany({
      where: {
        delivered: false,
        senderId: { not: userId },
        conversation: { participants: { some: { userId } } },
      },
      distinct: ['conversationId'],
      select: { conversationId: true },
    });

    const conversationIds = pending.map((item) => item.conversationId);
    if (conversationIds.length === 0) return [];

    await this.prisma.message.updateMany({
      where: {
        conversationId: { in: conversationIds },
        senderId: { not: userId },
        delivered: false,
      },
      data: { delivered: true },
    });

    return conversationIds;
  }

  markDelivered(messageId: string) {
    return this.prisma.message.update({
      where: { id: messageId },
      data: { delivered: true },
      include: { sender: { select: this.userSelect() } },
    });
  }

  async getParticipantIds(conversationId: string) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    return participants.map((participant) => participant.userId);
  }

  async assertParticipant(userId: string, conversationId: string) {
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { userId, conversationId },
    });
    if (!participant) throw new ForbiddenException('Conversation unavailable');
    return participant;
  }

  private userSelect() {
    return {
      id: true,
      name: true,
      email: true,
      avatar: true,
      status: true,
      isOnline: true,
      lastSeen: true,
    } as const;
  }

  private async withUnreadCounts<T extends { id: string }>(userId: string, conversations: T[]) {
    if (conversations.length === 0) return [];

    const counts = await this.prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: conversations.map((conversation) => conversation.id) },
        senderId: { not: userId },
        seen: false,
      },
      _count: { _all: true },
    });
    const unreadByConversation = new Map(
      counts.map((item) => [item.conversationId, item._count._all]),
    );

    return conversations.map((conversation) => ({
      ...conversation,
      unreadCount: unreadByConversation.get(conversation.id) ?? 0,
    }));
  }
}

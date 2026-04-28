import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async listConversations(userId: string) {
    return this.prisma.conversation.findMany({
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
    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId: currentUserId }, { userId: otherUserId }],
        },
      },
      include: {
        participants: { include: { user: { select: this.userSelect() } } },
        messages: true,
      },
    });
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
    const message = await this.prisma.message.create({
      data: { conversationId, senderId: userId, content: content.trim() },
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
      data: { seen: true },
    });
    return { conversationId };
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
}

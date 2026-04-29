import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { DeleteMessageScope } from './dto';

const MESSAGE_LIMIT = 100;

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async listConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { participants: { some: { userId, deletedAt: null } } },
      include: {
        participants: { include: { user: { select: this.userSelect() } } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const hydrated = await Promise.all(
      conversations.map((conversation) => this.withLastVisibleMessage(userId, conversation)),
    );
    return this.withUnreadCounts(userId, hydrated);
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
      select: { id: true },
    });
    if (existing) {
      await this.prisma.conversationParticipant.updateMany({
        where: { conversationId: existing.id, userId: currentUserId },
        data: { deletedAt: null },
      });
      await this.prisma.conversation.update({
        where: { id: existing.id },
        data: { updatedAt: new Date() },
      });
      const conversation = await this.getConversationForUser(currentUserId, existing.id);
      return { ...conversation, unreadCount: 0 };
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId: currentUserId }, { userId: otherUserId }],
        },
      },
      include: {
        participants: { include: { user: { select: this.userSelect() } } },
      },
    });
    return { ...conversation, messages: [], unreadCount: 0 };
  }

  async getMessages(userId: string, conversationId: string) {
    const participant = await this.assertParticipant(userId, conversationId);
    return this.prisma.message.findMany({
      where: this.visibleMessageWhere(conversationId, userId, participant.clearedAt),
      include: { sender: { select: this.userSelect() } },
      orderBy: { createdAt: 'asc' },
      take: MESSAGE_LIMIT,
    });
  }

  async sendMessage(userId: string, conversationId: string, content: string) {
    await this.assertParticipant(userId, conversationId, { allowDeleted: true });
    const trimmed = this.normalizeContent(content);

    const message = await this.prisma.message.create({
      data: { conversationId, senderId: userId, content: trimmed },
      include: { sender: { select: this.userSelect() } },
    });
    await this.prisma.conversationParticipant.updateMany({
      where: { conversationId },
      data: { deletedAt: null },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return message;
  }

  async markSeen(userId: string, conversationId: string) {
    const participant = await this.assertParticipant(userId, conversationId);
    await this.prisma.message.updateMany({
      where: {
        ...this.visibleMessageWhere(conversationId, userId, participant.clearedAt),
        senderId: { not: userId },
        seen: false,
      },
      data: { seen: true, delivered: true },
    });
    return { conversationId };
  }

  async markDeliveredForUser(userId: string) {
    const pending = await this.prisma.message.findMany({
      where: {
        delivered: false,
        deletedAt: null,
        NOT: { deletions: { some: { userId } } },
        senderId: { not: userId },
        conversation: { participants: { some: { userId, deletedAt: null } } },
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
        deletedAt: null,
        NOT: { deletions: { some: { userId } } },
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

  async editMessage(userId: string, messageId: string, content: string) {
    const trimmed = this.normalizeContent(content);
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.deletedAt) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) throw new ForbiddenException('You can only edit your own messages');

    await this.assertParticipant(userId, message.conversationId, { allowDeleted: true });
    return this.prisma.message.update({
      where: { id: messageId },
      data: { content: trimmed, editedAt: new Date() },
      include: { sender: { select: this.userSelect() } },
    });
  }

  async deleteMessage(userId: string, messageId: string, scope: DeleteMessageScope = 'everyone') {
    const nextScope = this.normalizeDeleteScope(scope);
    return nextScope === 'me'
      ? this.deleteMessageForMe(userId, messageId)
      : this.deleteMessageForEveryone(userId, messageId);
  }

  private async deleteMessageForEveryone(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.deletedAt) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) throw new ForbiddenException('You can only delete your own messages');

    await this.assertParticipant(userId, message.conversationId, { allowDeleted: true });
    const deleted = await this.prisma.message.update({
      where: { id: messageId },
      data: { content: '', deletedAt: new Date() },
      select: { id: true, conversationId: true },
    });
    await this.prisma.conversation.update({
      where: { id: deleted.conversationId },
      data: { updatedAt: new Date() },
    });
    return { messageId: deleted.id, conversationId: deleted.conversationId, deletedBy: userId, scope: 'everyone' as const };
  }

  private async deleteMessageForMe(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.deletedAt) throw new NotFoundException('Message not found');

    await this.assertParticipant(userId, message.conversationId, { allowDeleted: true });
    await this.prisma.messageDeletion.upsert({
      where: { messageId_userId: { messageId, userId } },
      update: {},
      create: { messageId, userId },
    });

    if (message.senderId !== userId && !message.seen) {
      await this.prisma.message.update({
        where: { id: messageId },
        data: { seen: true, delivered: true },
      });
    }

    return { messageId: message.id, conversationId: message.conversationId, deletedBy: userId, scope: 'me' as const };
  }

  async clearConversation(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId);
    const clearedAt = new Date();
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, seen: false, deletedAt: null },
      data: { seen: true, delivered: true },
    });
    await this.prisma.conversationParticipant.updateMany({
      where: { userId, conversationId },
      data: { clearedAt, deletedAt: null },
    });
    return { conversationId, clearedAt, userId };
  }

  async deleteConversation(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId, { allowDeleted: true });
    const deletedAt = new Date();
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, seen: false, deletedAt: null },
      data: { seen: true, delivered: true },
    });
    await this.prisma.conversationParticipant.updateMany({
      where: { userId, conversationId },
      data: { clearedAt: deletedAt, deletedAt },
    });
    return { conversationId, deletedAt, userId };
  }

  async getParticipantIds(conversationId: string) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    return participants.map((participant) => participant.userId);
  }

  async assertParticipant(userId: string, conversationId: string, options: { allowDeleted?: boolean } = {}) {
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { userId, conversationId },
    });
    if (!participant || (!options.allowDeleted && participant.deletedAt)) {
      throw new ForbiddenException('Conversation unavailable');
    }
    return participant;
  }

  private async getConversationForUser(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, participants: { some: { userId } } },
      include: {
        participants: { include: { user: { select: this.userSelect() } } },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return this.withLastVisibleMessage(userId, conversation);
  }

  private async withLastVisibleMessage<
    T extends { id: string; participants: { userId: string; clearedAt: Date | null }[] },
  >(userId: string, conversation: T) {
    const participant = conversation.participants.find((item) => item.userId === userId);
    const messages = await this.prisma.message.findMany({
      where: this.visibleMessageWhere(conversation.id, userId, participant?.clearedAt ?? null),
      orderBy: { createdAt: 'desc' },
      take: 1,
      include: { sender: { select: this.userSelect() } },
    });
    return { ...conversation, messages };
  }

  private visibleMessageWhere(conversationId: string, userId: string, clearedAt?: Date | null) {
    return {
      conversationId,
      deletedAt: null,
      NOT: { deletions: { some: { userId } } },
      ...(clearedAt ? { createdAt: { gt: clearedAt } } : {}),
    };
  }

  private normalizeContent(content: string) {
    if (typeof content !== 'string') throw new BadRequestException('Message must be text');
    const trimmed = content.trim();
    if (!trimmed) throw new BadRequestException('Message cannot be empty');
    if (trimmed.length > 4000) throw new BadRequestException('Message is too long');
    return trimmed;
  }

  private normalizeDeleteScope(scope?: string) {
    if (!scope || scope === 'everyone') return 'everyone';
    if (scope === 'me') return 'me';
    throw new BadRequestException('Invalid delete option');
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

  private async withUnreadCounts<
    T extends { id: string; participants: { userId: string; clearedAt: Date | null }[] },
  >(userId: string, conversations: T[]) {
    if (conversations.length === 0) return [];

    const visibilityFilters = conversations.map((conversation) => {
      const participant = conversation.participants.find((item) => item.userId === userId);
      return {
        conversationId: conversation.id,
        ...(participant?.clearedAt ? { createdAt: { gt: participant.clearedAt } } : {}),
      };
    });

    const counts = await this.prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        OR: visibilityFilters,
        deletedAt: null,
        NOT: { deletions: { some: { userId } } },
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

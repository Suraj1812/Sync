import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CallStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CallsService {
  constructor(private readonly prisma: PrismaService) {}

  create(callerId: string, receiverId: string) {
    return this.prisma.callLog.create({
      data: { callerId, receiverId, status: CallStatus.RINGING },
    });
  }

  async accept(id: string, userId: string) {
    const call = await this.findCall(id);
    if (call.receiverId !== userId) throw new ForbiddenException('Only the receiver can accept this call');

    return this.prisma.callLog.update({
      where: { id },
      data: { status: CallStatus.ACCEPTED },
    });
  }

  async reject(id: string, userId: string) {
    const call = await this.findCall(id);
    if (call.receiverId !== userId) throw new ForbiddenException('Only the receiver can reject this call');
    return this.finish(id, CallStatus.REJECTED, call.startedAt);
  }

  async end(id: string, userId: string, status = CallStatus.ENDED) {
    const call = await this.findCall(id);
    if (call.callerId !== userId && call.receiverId !== userId) {
      throw new ForbiddenException('Call unavailable');
    }
    return this.finish(id, status, call.startedAt);
  }

  peerId(call: { callerId: string; receiverId: string }, userId: string) {
    return call.callerId === userId ? call.receiverId : call.callerId;
  }

  private async findCall(id: string) {
    const call = await this.prisma.callLog.findUnique({ where: { id } });
    if (!call) throw new NotFoundException('Call not found');
    return call;
  }

  private finish(id: string, status: CallStatus, startedAt: Date) {
    const endedAt = new Date();
    return this.prisma.callLog.update({
      where: { id },
      data: {
        status,
        endedAt,
        duration: Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)),
      },
    });
  }
}

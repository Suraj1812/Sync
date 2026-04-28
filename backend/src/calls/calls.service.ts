import { Injectable } from '@nestjs/common';
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

  update(id: string, status: CallStatus, endedAt?: Date) {
    return this.prisma.callLog.update({
      where: { id },
      data: {
        status,
        endedAt,
      },
    });
  }

  async end(id: string, status: CallStatus) {
    const call = await this.prisma.callLog.findUnique({ where: { id } });
    const endedAt = new Date();
    return this.prisma.callLog.update({
      where: { id },
      data: {
        status,
        endedAt,
        duration: call ? Math.max(0, Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000)) : 0,
      },
    });
  }
}

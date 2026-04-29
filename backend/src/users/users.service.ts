import { Injectable, NotFoundException } from '@nestjs/common';
import { normalizeAvatar, normalizeOptionalText, normalizeText } from '../common/utils/normalizers';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.publicUserSelect(),
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  search(query: string, currentUserId: string) {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    return this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        OR: [
          { name: { contains: trimmed, mode: 'insensitive' } },
          { email: { contains: trimmed, mode: 'insensitive' } },
        ],
      },
      select: this.publicUserSelect(),
      take: 12,
      orderBy: [{ isOnline: 'desc' }, { name: 'asc' }],
    });
  }

  updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: { name?: string; status?: string | null; avatar?: string | null } = {};
    if (dto.name !== undefined) data.name = normalizeText(dto.name, 'Name');
    if (dto.status !== undefined) data.status = normalizeOptionalText(dto.status, 160);
    if (dto.avatar !== undefined) data.avatar = normalizeAvatar(dto.avatar);

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: this.publicUserSelect(),
    });
  }

  setOnline(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isOnline: true, lastSeen: null },
      select: this.publicUserSelect(),
    });
  }

  setOffline(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isOnline: false, lastSeen: new Date() },
      select: this.publicUserSelect(),
    });
  }

  publicUserSelect() {
    return {
      id: true,
      name: true,
      email: true,
      avatar: true,
      status: true,
      isOnline: true,
      lastSeen: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }
}

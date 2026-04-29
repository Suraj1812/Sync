import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { normalizeAvatar, normalizeEmail, normalizeText } from '../common/utils/normalizers';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = normalizeEmail(dto.email);
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Email is already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: normalizeText(dto.name, 'Name'),
        email,
        passwordHash,
        avatar: normalizeAvatar(dto.avatar) ?? undefined,
      },
      select: this.publicUserSelect(),
    });

    return this.withToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: normalizeEmail(dto.email) } });
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    const safeUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { isOnline: true, lastSeen: null },
      select: this.publicUserSelect(),
    });
    return this.withToken(safeUser);
  }

  private async withToken(user: { id: string; email: string; name: string }) {
    const token = await this.jwt.signAsync(
      { sub: user.id, email: user.email },
      { expiresIn: this.config.get<string>('JWT_EXPIRES_IN') ?? '7d' },
    );
    return { user, token };
  }

  private publicUserSelect() {
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

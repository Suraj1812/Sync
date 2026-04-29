import { ConfigService } from '@nestjs/config';

export function jwtSecret(config: ConfigService) {
  const secret = config.get<string>('JWT_SECRET')?.trim();
  if (secret) return secret;

  if ((config.get<string>('NODE_ENV') ?? process.env.NODE_ENV) === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }

  return 'dev-secret';
}

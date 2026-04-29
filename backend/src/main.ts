import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, static as serveStatic, urlencoded } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { rateLimit, sweepRateLimitBuckets } from './common/middleware/rate-limit.middleware';
import { requestTimeout, securityHeaders } from './common/middleware/security.middleware';
import { corsOrigin } from './common/utils/origins';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const nodeEnv = config.get<string>('NODE_ENV') ?? process.env.NODE_ENV;

  app.enableCors({
    origin: corsOrigin(config.get<string>('FRONTEND_URL'), nodeEnv),
    credentials: true,
  });
  app.use(securityHeaders);
  app.use(requestTimeout(15_000));
  app.use('/api/auth', rateLimit({ name: 'auth', windowMs: 60_000, max: 24 }));
  app.use('/api', rateLimit({ name: 'api', windowMs: 60_000, max: 420 }));
  app.use(json({ limit: '6mb' }));
  app.use(urlencoded({ extended: true, limit: '6mb' }));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const publicPath = join(process.cwd(), 'public');
  if (existsSync(publicPath)) {
    const server = app.getHttpAdapter().getInstance();
    server.use(
      serveStatic(publicPath, {
        etag: true,
        immutable: true,
        maxAge: '1y',
        setHeaders: (response: Response, path: string) => {
          if (path.endsWith('index.html')) {
            response.setHeader('Cache-Control', 'no-cache');
          }
        },
      }),
    );
    server.get('*', (request: Request, response: Response, next: NextFunction) => {
      if (request.path.startsWith('/api') || request.path.startsWith('/socket.io')) {
        return next();
      }
      return response.sendFile(join(publicPath, 'index.html'));
    });
  }

  globalThis.setInterval(() => sweepRateLimitBuckets(), 60_000).unref();
  await app.listen(config.get<number>('PORT') ?? 4000, '0.0.0.0');
}

bootstrap();

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, static as serveStatic, urlencoded } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

function corsOrigin(frontendUrl?: string) {
  const origins = (frontendUrl ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : true;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({
    origin: corsOrigin(config.get<string>('FRONTEND_URL')),
    credentials: true,
  });
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
    server.use(serveStatic(publicPath));
    server.get('*', (request: Request, response: Response, next: NextFunction) => {
      if (request.path.startsWith('/api') || request.path.startsWith('/socket.io')) {
        return next();
      }
      return response.sendFile(join(publicPath, 'index.html'));
    });
  }

  await app.listen(config.get<number>('PORT') ?? 4000, '0.0.0.0');
}

bootstrap();

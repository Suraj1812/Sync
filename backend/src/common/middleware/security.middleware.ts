import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function securityHeaders(request: Request, response: Response, next: NextFunction) {
  const requestId = request.header('x-request-id') || randomUUID();
  response.setHeader('x-request-id', requestId);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), display-capture=(self)');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  if (request.path.startsWith('/api')) {
    response.setHeader('Cache-Control', 'no-store');
  }

  next();
}

export function requestTimeout(ms: number) {
  return (_request: Request, response: Response, next: NextFunction) => {
    response.setTimeout(ms, () => {
      if (!response.headersSent) response.status(503).json({ message: 'Request timed out' });
    });
    next();
  };
}

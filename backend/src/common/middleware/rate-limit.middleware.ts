import type { NextFunction, Request, Response } from 'express';

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  windowMs: number;
  max: number;
  name: string;
};

const buckets = new Map<string, Bucket>();

function clientKey(request: Request, name: string) {
  const forwarded = request.header('x-forwarded-for')?.split(',')[0]?.trim();
  return `${name}:${forwarded || request.ip || request.socket.remoteAddress || 'unknown'}`;
}

export function rateLimit({ windowMs, max, name }: RateLimitOptions) {
  return (request: Request, response: Response, next: NextFunction) => {
    const now = Date.now();
    const key = clientKey(request, name);
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    current.count += 1;
    if (current.count > max) {
      response.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
      response.status(429).json({ message: 'Too many requests. Please slow down.' });
      return;
    }

    next();
  };
}

export function sweepRateLimitBuckets(now = Date.now()) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

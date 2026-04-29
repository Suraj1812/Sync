import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { rateLimit } from '../src/common/middleware/rate-limit.middleware';

function request(ip: string): Request {
  return {
    ip,
    socket: { remoteAddress: ip },
    header: () => undefined,
  } as unknown as Request;
}

function response() {
  const result = {
    statusCode: 200,
    body: undefined as unknown,
    headers: new Map<string, unknown>(),
  };

  const res = {
    setHeader: (key: string, value: unknown) => result.headers.set(key, value),
    status: (code: number) => {
      result.statusCode = code;
      return res;
    },
    json: (body: unknown) => {
      result.body = body;
      return res;
    },
  } as unknown as Response;

  return { res, result };
}

describe('rateLimit', () => {
  it('allows requests up to the limit and blocks the next one', () => {
    const limiter = rateLimit({ name: `test-${Date.now()}`, windowMs: 60_000, max: 2 });
    let nextCount = 0;

    limiter(request('127.0.0.10'), response().res, () => {
      nextCount += 1;
    });
    limiter(request('127.0.0.10'), response().res, () => {
      nextCount += 1;
    });

    const blocked = response();
    limiter(request('127.0.0.10'), blocked.res, () => {
      nextCount += 1;
    });

    assert.equal(nextCount, 2);
    assert.equal(blocked.result.statusCode, 429);
    assert.deepEqual(blocked.result.body, { message: 'Too many requests. Please slow down.' });
  });
});

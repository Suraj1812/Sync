import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import {
  normalizeAvatar,
  normalizeEmail,
  normalizeOptionalText,
  normalizeText,
} from '../src/common/utils/normalizers';
import { jwtSecret } from '../src/common/utils/jwt-secret';

describe('normalizers', () => {
  it('normalizes email safely', () => {
    assert.equal(normalizeEmail('  Suraj@Example.COM '), 'suraj@example.com');
  });

  it('rejects empty required text', () => {
    assert.throws(() => normalizeText('   ', 'Name'), BadRequestException);
  });

  it('preserves absent optional fields and clears explicit blanks', () => {
    assert.equal(normalizeOptionalText(undefined, 160), undefined);
    assert.equal(normalizeOptionalText('   ', 160), null);
    assert.equal(normalizeOptionalText(' Available ', 160), 'Available');
  });

  it('accepts safe avatars and blocks executable-style sources', () => {
    assert.equal(normalizeAvatar(undefined), undefined);
    assert.equal(normalizeAvatar(''), null);
    assert.equal(normalizeAvatar('https://example.com/avatar.png'), 'https://example.com/avatar.png');
    assert.equal(normalizeAvatar('data:image/png;base64,aaaa'), 'data:image/png;base64,aaaa');
    assert.throws(() => normalizeAvatar('javascript:alert(1)'), BadRequestException);
    assert.throws(() => normalizeAvatar('data:image/svg+xml;base64,aaaa'), BadRequestException);
  });

  it('requires an explicit JWT secret in production', () => {
    const productionConfig = { get: (key: string) => (key === 'NODE_ENV' ? 'production' : undefined) };
    const developmentConfig = { get: () => undefined };

    assert.throws(() => jwtSecret(productionConfig as never), /JWT_SECRET/);
    assert.equal(jwtSecret(developmentConfig as never), 'dev-secret');
  });
});

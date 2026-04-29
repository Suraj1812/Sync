import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

describe('static production audit', () => {
  it('does not use dangerous DOM injection APIs', () => {
    const frontend = read('frontend/src/layouts/AppLayout.tsx') + read('frontend/src/components/Avatar.tsx');
    assert.equal(frontend.includes('dangerouslySetInnerHTML'), false);
    assert.equal(frontend.includes('innerHTML'), false);
  });

  it('keeps production web traffic on same-origin proxy by default', () => {
    assert.match(read('docker-compose.yml'), /VITE_API_URL:\s*""/);
    assert.match(read('frontend/Dockerfile'), /ARG VITE_API_URL=\n/);
    assert.match(read('frontend/nginx.conf'), /location \/api\//);
    assert.match(read('frontend/nginx.conf'), /location \/socket\.io\//);
  });

  it('has basic production hardening in the web and API containers', () => {
    assert.match(read('frontend/nginx.conf'), /X-Content-Type-Options/);
    assert.match(read('docker-compose.yml'), /no-new-privileges:true/);
    assert.match(read('backend/Dockerfile'), /USER node/);
  });

  it('keeps chat edit, delete, clear, and contact removal wired end to end', () => {
    const schema = read('backend/prisma/schema.prisma');
    const gateway = read('backend/src/gateway/sync.gateway.ts');
    const realtime = read('backend/src/realtime/realtime.service.ts');
    const ui = read('frontend/src/layouts/AppLayout.tsx') + read('frontend/src/components/ChatBubble.tsx');
    const store = read('frontend/src/store/chatStore.ts') + read('frontend/src/hooks/useRealtime.ts');

    assert.match(schema, /editedAt\s+DateTime\?/);
    assert.match(schema, /deletedAt\s+DateTime\?/);
    assert.match(schema, /clearedAt\s+DateTime\?/);
    assert.match(schema, /model MessageDeletion/);
    assert.match(gateway, /message:edit/);
    assert.match(gateway, /message:delete/);
    assert.match(gateway, /conversation:clear/);
    assert.match(gateway, /conversation:delete/);
    assert.match(realtime, /emitToUsers/);
    assert.match(store, /force:\s*true/);
    assert.match(ui, /Edit message/);
    assert.match(ui, /Delete for me/);
    assert.match(ui, /Delete for everyone/);
    assert.match(ui, /Clear chat/);
    assert.match(ui, /Delete contact/);
  });
});

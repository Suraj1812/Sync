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
});

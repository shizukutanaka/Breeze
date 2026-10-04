// Pin: every hardening flag the Worker reads must be documented in
// .env.example — the file self-hosters copy. A flag that exists in code
// but not in the docs is silently never enabled (QUEUE_REQUIRE_AUTH and
// PREKEY_REQUIRE_AUTH were missing while the code shipped them).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const worker = readFileSync(join(root, '_worker.js'), 'utf8');
const envExample = readFileSync(join(root, '.env.example'), 'utf8');
const wrangler = readFileSync(join(root, 'wrangler.toml'), 'utf8');

const read = new Set([...worker.matchAll(/env\.([A-Z][A-Z0-9_]+)/g)].map(m => m[1]));

describe('env-var documentation contract', () => {
  it('every env.* the Worker reads is documented in .env.example or is a binding', () => {
    // Platform bindings (auto-provisioned by Pages, not secrets):
    // KV — the namespace binding; ASSETS — the static-asset fetch binding.
    const BINDINGS = new Set(['KV', 'ASSETS']);
    for (const name of read) {
      if (BINDINGS.has(name)) continue;
      expect(envExample, `${name} missing from .env.example`).toContain(name);
    }
  });

  it('the *_REQUIRE_AUTH hardening set is complete on both doc surfaces', () => {
    const flags = [...read].filter(n => n.endsWith('_REQUIRE_AUTH')).sort();
    expect(flags.length).toBeGreaterThan(0);
    for (const f of flags) {
      expect(envExample, `${f} missing from .env.example`).toContain(f);
      expect(wrangler, `${f} missing from wrangler.toml comments`).toContain(f);
    }
  });
});

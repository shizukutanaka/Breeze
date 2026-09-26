// The operator-facing contract for Worker env vars lives in wrangler.toml's
// comments ("wrangler pages secret put X", "required KV id", etc.) — it is the
// ONLY place a self-hoster learns a knob exists. A flag added to _worker.js
// without a line there is undiscoverable: QUEUE_REQUIRE_AUTH/PREKEY_REQUIRE_AUTH
// shipped their enforcement code before anyone remembered the doc side.
//
// Rule: every env.NAME the Worker reads must be mentioned in wrangler.toml —
// except ASSETS/KV (platform bindings, not secrets; KV is documented at its own
// [[kv_namespaces]] block) and names already covered by a documented family.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const worker = readFileSync(join(root, '_worker.js'), 'utf8');
const wrangler = readFileSync(join(root, 'wrangler.toml'), 'utf8');

const envReads = [...new Set([...worker.matchAll(/env\.([A-Z][A-Z0-9_]+)/g)].map((m) => m[1]))].sort();

// Platform bindings, not operator secrets.
const BINDINGS = new Set(['ASSETS', 'KV']);

describe('every env.* the Worker consults is documented in wrangler.toml', () => {
  for (const name of envReads) {
    if (BINDINGS.has(name)) continue;
    it(`env.${name} is mentioned`, () => {
      expect(
        wrangler.includes(name),
        `env.${name} is read by _worker.js but absent from wrangler.toml — self-hosters cannot discover it. Add a "# wrangler pages secret put ${name}" line.`
      ).toBe(true);
    });
  }

  it('pin the set itself — new env reads must be deliberate (update BINDINGS or docs)', () => {
    expect(envReads).toMatchInlineSnapshot(`
      [
        "ABUSE_WEBHOOK_URL",
        "ALIAS_REQUIRE_AUTH",
        "ASSETS",
        "BACKUP_REQUIRE_AUTH",
        "GROUP_REQUIRE_AUTH",
        "KV",
        "MIN_POW_DIFFICULTY",
        "PRESENCE_REQUIRE_AUTH",
        "PUSH_REQUIRE_AUTH",
        "TURN_CREDENTIAL",
        "TURN_KEY_API_TOKEN",
        "TURN_KEY_ID",
        "TURN_REQUIRE_AUTH",
        "TURN_SECRET",
        "TURN_URL",
        "TURN_USERNAME",
        "VAPID_PRIVATE_KEY",
        "VAPID_PUBLIC_KEY",
      ]
    `);
  });
});

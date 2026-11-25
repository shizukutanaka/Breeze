// Cross-host parity for /api/health: the SAME worker handler must answer
// with the SAME body shape and the SAME config-derived values whether it
// runs as a Cloudflare Worker (env = KV binding + secrets, invoked via
// worker.fetch directly) or under the self-hosted Node entry (env
// assembled by buildRelayEnv over SQLite, invoked over real HTTP).
//
// Why this test exists: clients feature-detect on /api/health (ws,
// backupStorage, capabilities, relayKey …), so a field that exists on
// one host but not the other — or silently changes meaning — breaks
// clients only for self-hosters. The stage-2 suites cover each host
// separately (worker.test.js through mock KV, node-host.test.js as a
// black-box drill); this one pins the two hosts to each other.
//
// Config is aligned deliberately: the Node host defaults mailboxes to
// its in-process core with the WS wake-up on, while a bare KV-only
// Worker env has both off. Both sides are set to the KV configuration
// here so every remaining difference is a real divergence, not a
// configuration difference. The host provisions its relay identity
// from the database; the same pair is handed to the Worker env so
// relayKey must match byte-for-byte, not just in type.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import worker from '../_worker.js';
import { makeEnv } from './helpers/mockKV.js';
import { buildRelayEnv, createRelayServer, REPO_ROOT } from '../server/node-host.js';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');

// Fields whose VALUES are per-request or per-clock by design; their
// presence and type are still compared, their values are not.
const VOLATILE = ['reqId', 'serverTime', 'ts', 'responseMs'];

let tmp;
beforeAll(() => { tmp = mkdtempSync(join(tmpdir(), 'breeze-health-parity-')); });
afterAll(() => { rmSync(tmp, { recursive: true, force: true }); });
beforeEach(() => {
  globalThis._msgDedup = new Map();
  globalThis._sealedDedup = new Map();
  globalThis._rateLimitMap = new Map();
  globalThis._queueAuthKey = new Map();
});

async function bootHost() {
  const db = new DatabaseSync(join(tmp, 'parity.db'));
  const env = buildRelayEnv({
    db, rootDir: REPO_ROOT, dbPath: join(tmp, 'parity.db'),
    source: { MAILBOX_BACKEND: 'kv', PRESENCE_BACKEND: 'kv', MAILBOX_WS_ENABLED: 'false' },
  });
  const server = createRelayServer({ env });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    env, db, server,
    base: `http://127.0.0.1:${port}`,
    async close() {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
      try { db.close(); } catch { /* already closed */ }
    },
  };
}

const stripVolatile = (body) => {
  const out = { ...body };
  for (const key of VOLATILE) delete out[key];
  return out;
};

describe('/api/health — Cloudflare Worker env vs Node host parity', () => {
  it('same status, same key set, same values under aligned config', async () => {
    const host = await bootHost();
    try {
      const hostRes = await fetch(host.base + '/api/health');
      const hostBody = await hostRes.json();

      const workerEnv = makeEnv({
        RELAY_PUBLIC_KEY: host.env.RELAY_PUBLIC_KEY,
        RELAY_PRIVATE_KEY: host.env.RELAY_PRIVATE_KEY,
      });
      const workerRes = await worker.fetch(new Request('https://breeze.test/api/health'), workerEnv);
      const workerBody = await workerRes.json();

      expect(hostRes.status).toBe(200);
      expect(workerRes.status).toBe(200);

      // Identical key set, top level and in the nested features object.
      expect(Object.keys(hostBody).sort()).toEqual(Object.keys(workerBody).sort());
      expect(Object.keys(hostBody.features).sort()).toEqual(Object.keys(workerBody.features).sort());
      for (const key of VOLATILE) {
        expect(typeof hostBody[key]).toBe(typeof workerBody[key]);
      }

      // Identical values for everything config- or code-derived:
      // version, protocol, endpoints, kv/push/turn flags, turnProvider,
      // turnIssueCap/turnIssuedThisMonth, vapidPublicKey, relayKey,
      // features, capabilities, crypto.
      expect(stripVolatile(hostBody)).toEqual(stripVolatile(workerBody));

      // The aligned configuration really is the KV one on both sides:
      // the WS wake-up must read off, or the comparison above would be
      // comparing two different deployments.
      expect(hostBody.features.ws).toBe(false);
      expect(workerBody.features.ws).toBe(false);
      // And the relay identity is genuinely shared, not both null.
      expect(hostBody.relayKey).toBeTruthy();
      expect(hostBody.relayKey).toBe(workerBody.relayKey);
    } finally {
      await host.close();
    }
  });
});

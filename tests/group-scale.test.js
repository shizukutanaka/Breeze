// SHARE_PLAN stage 5 step 3 — group scale measurements.
// The completion condition for raising the group cap is a measured
// distribution at each stage size. This drill runs the REAL relay
// handler (handleSealedSend, in-process mock KV) for one group
// message's worth of fan-out deposits at 100 / 300 / 1,000 distinct
// member mailboxes — the exact server-side shape of a group send
// with nobody online (every member gets a sealed deposit).
// Client-side shape (deposit counts, pooling, sender-key
// redistribution cadence) is covered by tests/group-scale-client.test.js.
import { describe, it, expect, beforeEach } from 'vitest';
import { handleSealedSend } from '../_worker.js';
import { makeEnv, apiRequest } from './helpers/mockKV.js';

beforeEach(() => {
  globalThis._rateLimitMap = new Map();
  globalThis._presenceCache = new Map();
  globalThis._msgDedup = new Map();
  globalThis._sealedDedup = new Map();
  globalThis._frankWebhookFired = new Map();
  globalThis._queueAuthKey = new Map();
});

const req = (b) => apiRequest('/api/sealed/send', b);
// A realistic group ciphertext: ~1.2 KB of sealed envelope.
const ENVELOPE = 'E' + 'x'.repeat(1200);
const memberId = (i) => 'm' + String(i).padStart(11, '0');

describe('stage 5 step 3 — relay fan-out drill', () => {
  for (const n of [100, 300, 1000]) {
    it(`one message fans out to ${n} mailboxes with zero failures`, async () => {
      const env = makeEnv();
      const t0 = Date.now();
      let ok = 0, failed = 0;
      // Sequential awaits = the client's pre-step-3 worst shape; the
      // relay must still admit every deposit.
      for (let i = 0; i < n; i++) {
        const res = await handleSealedSend({ to: memberId(i), envelope: ENVELOPE }, env, req({}));
        if (res.status === 200) ok++; else failed++;
      }
      const ms = Date.now() - t0;
      console.info(`[group-scale] fan-out n=${n}: ok=${ok} failed=${failed} wall=${ms}ms per-deposit=${(ms / n).toFixed(2)}ms`);
      expect(failed).toBe(0);
      expect(ok).toBe(n);
      expect(ms / n).toBeLessThan(50); // in-process bound; production KV latency is a stage-6 measurement
    }, 120000);
  }
});

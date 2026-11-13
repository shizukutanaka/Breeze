import { describe, it, expect, beforeEach } from 'vitest';
import { makeEnv, apiRequest } from './helpers/mockKV.js';
import { makeDOEnv } from './helpers/mockDO.js';
import { mailboxStore, handleSealedSend, handleSealedPoll } from '../_worker.js';

// Stage-1 step 3 (2026-11-13): per-mailbox sealed-deposit frequency limits.
// These tests pin: the checkDeposit contract on the DO backend (caps,
// windows, pruning, whole-mailbox span, recipient isolation, fail-open on
// RPC failure), the documented KV no-op (enforcement arrives with
// MAILBOX_BACKEND=do), and the handler wiring — 429 MAILBOX_RATE_LIMITED
// past the cap, other recipients unaffected, and a gated envelope NOT
// swallowed as a duplicate on retry (the dedup mark is removed on denial,
// mirroring the STORE_FAILED rule).
beforeEach(() => {
  globalThis._sealedDedup = new Map();
});

const req = (b) => apiRequest('/api/sealed/x', b);
const env_i = (i) => `E${String(i).padStart(4, '0')}-${'x'.repeat(40)}`;

describe('MailboxStore.checkDeposit (DO-backed)', () => {
  it('admits deposits under the caps and records one log per recipient', async () => {
    const env = makeDOEnv();
    const mb = mailboxStore(env, 'sealed', 'user42');
    for (let i = 0; i < 5; i++) expect(await mb.checkDeposit()).toEqual({ ok: true });
    const log = env.MAILBOX_DO.instances.get('user42').state.storage.map.get('deposits');
    expect(Array.isArray(log)).toBe(true);
    expect(log.length).toBe(5);
  });

  it('denies the 121st deposit inside a minute, with a bounded retryAfterSec', async () => {
    const env = makeDOEnv();
    const mb = mailboxStore(env, 'sealed', 'user42');
    for (let i = 0; i < 120; i++) expect((await mb.checkDeposit()).ok).toBe(true);
    const denied = await mb.checkDeposit();
    expect(denied.ok).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(denied.retryAfterSec).toBeLessThanOrEqual(60);
    // A denial does not record: the log stays at the cap.
    expect(env.MAILBOX_DO.instances.get('user42').state.storage.map.get('deposits').length).toBe(120);
  });

  it('spans the whole mailbox: sealed deposits count against the inbox handle too', async () => {
    const env = makeDOEnv();
    const sealed = mailboxStore(env, 'sealed', 'user42');
    for (let i = 0; i < 120; i++) await sealed.checkDeposit();
    expect((await mailboxStore(env, 'inbox', 'user42').checkDeposit()).ok).toBe(false);
  });

  it('is per-recipient: a saturated mailbox does not gate another', async () => {
    const env = makeDOEnv();
    const a = mailboxStore(env, 'sealed', 'user42');
    for (let i = 0; i < 120; i++) await a.checkDeposit();
    expect((await a.checkDeposit()).ok).toBe(false);
    expect(await mailboxStore(env, 'sealed', 'other99').checkDeposit()).toEqual({ ok: true });
  });

  it('slides: deposits older than the minute window stop counting', async () => {
    const env = makeDOEnv();
    const mb = mailboxStore(env, 'sealed', 'user42');
    await mb.checkDeposit(); // materialise the instance
    const storage = env.MAILBOX_DO.instances.get('user42').state.storage.map;
    const now = Date.now();
    storage.set('deposits', Array.from({ length: 120 }, (_, i) => now - 61000 + i));
    expect(await mb.checkDeposit()).toEqual({ ok: true });
  });

  it('enforces the hour cap even when the minute window is clear', async () => {
    const env = makeDOEnv();
    const mb = mailboxStore(env, 'sealed', 'user42');
    await mb.checkDeposit();
    const storage = env.MAILBOX_DO.instances.get('user42').state.storage.map;
    const now = Date.now();
    // 1200 deposits spread over the last 30 minutes: none in the last minute.
    storage.set('deposits', Array.from({ length: 1200 }, (_, i) => now - 1800000 + i * 1000));
    const denied = await mb.checkDeposit();
    expect(denied.ok).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(denied.retryAfterSec).toBeLessThanOrEqual(3600);
  });

  it('prunes deposits older than the hour window entirely', async () => {
    const env = makeDOEnv();
    const mb = mailboxStore(env, 'sealed', 'user42');
    await mb.checkDeposit();
    const storage = env.MAILBOX_DO.instances.get('user42').state.storage.map;
    const now = Date.now();
    storage.set('deposits', Array.from({ length: 1200 }, (_, i) => now - 7200000 + i * 1000));
    expect(await mb.checkDeposit()).toEqual({ ok: true });
    // The admitted call re-stored the pruned log: just the new deposit.
    expect(storage.get('deposits').length).toBe(1);
  });

  it('fails open when the DO RPC fails (gate is mitigation, not a gate on delivery)', async () => {
    const env = makeEnv({ MAILBOX_BACKEND: 'do' });
    env.MAILBOX_DO = {
      idFromName: (n) => ({ name: String(n) }),
      get: () => ({ fetch: async () => { throw new Error('do down'); } }),
    };
    expect(await mailboxStore(env, 'sealed', 'user42').checkDeposit()).toEqual({ ok: true });
    env.MAILBOX_DO = {
      idFromName: (n) => ({ name: String(n) }),
      get: () => ({ fetch: async () => new Response('nope', { status: 500 }) }),
    };
    expect(await mailboxStore(env, 'sealed', 'user42').checkDeposit()).toEqual({ ok: true });
  });
});

describe('MailboxStore.checkDeposit (KV-backed)', () => {
  it('is a documented no-op: KV cannot do per-mailbox limits', async () => {
    const mb = mailboxStore(makeEnv(), 'sealed', 'user42');
    for (let i = 0; i < 250; i++) expect(await mb.checkDeposit()).toEqual({ ok: true });
  });

  it('MAILBOX_BACKEND=do without the binding stays on the KV no-op', async () => {
    const mb = mailboxStore(makeEnv({ MAILBOX_BACKEND: 'do' }), 'sealed', 'user42');
    expect(await mb.checkDeposit()).toEqual({ ok: true });
  });
});

describe('handleSealedSend deposit gate', () => {
  it('DO backend: 120 deposits pass, the 121st is 429 MAILBOX_RATE_LIMITED', async () => {
    const env = makeDOEnv();
    for (let i = 0; i < 120; i++) {
      const res = await handleSealedSend({ to: 'floodtgt1', envelope: env_i(i) }, env, req({}));
      expect(res.status).toBe(200);
    }
    const denied = await handleSealedSend({ to: 'floodtgt1', envelope: env_i(120) }, env, req({}));
    expect(denied.status).toBe(429);
    const body = await denied.json();
    expect(body.code).toBe('MAILBOX_RATE_LIMITED');
    expect(body.retryAfter).toBeGreaterThanOrEqual(1);
    expect(body.retryAfter).toBeLessThanOrEqual(60);
    // Another recipient is unaffected, and the queue itself is intact
    // (capped at 100 entries by the pre-existing queue cap).
    const other = await handleSealedSend({ to: 'other999', envelope: env_i(0) }, env, req({}));
    expect(other.status).toBe(200);
    const poll = await handleSealedPoll({ id: 'floodtgt1' }, env, req({}));
    expect(poll.status).toBe(200);
    expect((await poll.json()).messages.length).toBe(100);
  });

  it('DO backend: a gated envelope is not swallowed as a duplicate on retry', async () => {
    const env = makeDOEnv();
    for (let i = 0; i < 120; i++) {
      await handleSealedSend({ to: 'floodtgt1', envelope: env_i(i) }, env, req({}));
    }
    const first = await handleSealedSend({ to: 'floodtgt1', envelope: env_i(500) }, env, req({}));
    expect(first.status).toBe(429);
    // Retry of the SAME envelope: the dedup mark was removed on denial,
    // so this is judged by the gate again (429), not answered dedup:true
    // for a message that was never stored.
    const retry = await handleSealedSend({ to: 'floodtgt1', envelope: env_i(500) }, env, req({}));
    expect(retry.status).toBe(429);
    expect((await retry.json()).code).toBe('MAILBOX_RATE_LIMITED');
  });

  it('KV backend: no per-mailbox gate (documented no-op)', async () => {
    const env = makeEnv();
    for (let i = 0; i < 130; i++) {
      const res = await handleSealedSend({ to: 'floodtgt1', envelope: env_i(i) }, env, req({}));
      expect(res.status).toBe(200);
    }
  });
});

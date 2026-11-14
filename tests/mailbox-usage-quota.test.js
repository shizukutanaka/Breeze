import { describe, it, expect, beforeEach } from 'vitest';
import { makeEnv, apiRequest } from './helpers/mockKV.js';
import { makeDOEnv } from './helpers/mockDO.js';
import { mailboxStore, handleSealedSend } from '../_worker.js';

// Fair-use usage quota (2026-11-14; docs/COST_MODEL.md §10, the "API
// model" cost policy): per-mailbox day/month deposit budgets on the
// default relay, enforced inside the recipient's DO by the same
// serialized 'deposit' op as the stage-1 step-3 frequency gate.
// These tests pin: counting under the caps (one 'usage' record per
// mailbox), the daily and monthly denials (explicit quotaExceeded /
// quotaScope / bounded retryAfterSec), that a denial by EITHER layer
// records nothing in the other, window resets at UTC day/month
// boundaries, operator control (USAGE_QUOTA_DAILY / _MONTHLY
// overrides, USAGE_QUOTA_ENABLED=false disables counting entirely),
// the documented KV no-op, survival of the budget across slot deletes
// (delete-and-re-register is not a reset button), and the handler
// wiring — 429 USAGE_QUOTA_EXCEEDED past the budget, distinct from
// MAILBOX_RATE_LIMITED, with a denied envelope NOT swallowed as a
// duplicate on retry.
beforeEach(() => {
  globalThis._sealedDedup = new Map();
});

const req = (b) => apiRequest('/api/sealed/x', b);
const env_i = (i) => `E${String(i).padStart(4, '0')}-${'x'.repeat(40)}`;
const dayKey = () => new Date().toISOString().slice(0, 10);
const monthKey = () => dayKey().slice(0, 7);
const usageOf = (env, id) => env.MAILBOX_DO.instances.get(id).state.storage.map.get('usage');
const storageOf = (env, id) => env.MAILBOX_DO.instances.get(id).state.storage.map;

describe('MailboxStore.checkDeposit usage quota (DO-backed)', () => {
  it('counts admitted deposits in one usage record per mailbox', async () => {
    const env = makeDOEnv();
    const mb = mailboxStore(env, 'sealed', 'user42');
    for (let i = 0; i < 3; i++) expect(await mb.checkDeposit()).toEqual({ ok: true });
    expect(usageOf(env, 'user42')).toEqual({ d: dayKey(), dc: 3, m: monthKey(), mc: 3 });
    // Recipient isolation: another mailbox has no record yet.
    expect(env.MAILBOX_DO.instances.has('other99')).toBe(false);
  });

  it('denies past the daily cap with quotaExceeded + scope, and records nothing', async () => {
    const env = makeDOEnv({ USAGE_QUOTA_DAILY: '3' });
    const mb = mailboxStore(env, 'sealed', 'user42');
    for (let i = 0; i < 3; i++) expect((await mb.checkDeposit()).ok).toBe(true);
    const denied = await mb.checkDeposit();
    expect(denied.ok).toBe(false);
    expect(denied.quotaExceeded).toBe(true);
    expect(denied.quotaScope).toBe('daily');
    expect(denied.quotaLimit).toBe(3);
    expect(denied.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(denied.retryAfterSec).toBeLessThanOrEqual(86400);
    // The denial recorded nothing: usage stays at the cap, and the
    // frequency log did not gain an entry either.
    expect(usageOf(env, 'user42').dc).toBe(3);
    expect(storageOf(env, 'user42').get('deposits').length).toBe(3);
  });

  it('denies past the monthly cap even when the daily window is clear', async () => {
    const env = makeDOEnv({ USAGE_QUOTA_DAILY: '1000', USAGE_QUOTA_MONTHLY: '2' });
    const mb = mailboxStore(env, 'sealed', 'user42');
    expect((await mb.checkDeposit()).ok).toBe(true);
    expect((await mb.checkDeposit()).ok).toBe(true);
    const denied = await mb.checkDeposit();
    expect(denied.ok).toBe(false);
    expect(denied.quotaExceeded).toBe(true);
    expect(denied.quotaScope).toBe('monthly');
    expect(denied.quotaLimit).toBe(2);
    expect(denied.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(denied.retryAfterSec).toBeLessThanOrEqual(31 * 86400);
  });

  it('honours a pre-spent budget: seeded at the daily cap denies at once', async () => {
    const env = makeDOEnv({ USAGE_QUOTA_DAILY: '5' });
    const mb = mailboxStore(env, 'sealed', 'user42');
    await mb.checkDeposit(); // materialise the instance
    storageOf(env, 'user42').set('usage', { d: dayKey(), dc: 5, m: monthKey(), mc: 5 });
    const denied = await mb.checkDeposit();
    expect(denied.ok).toBe(false);
    expect(denied.quotaScope).toBe('daily');
  });

  it('resets at the window boundary: yesterday\'s spent budget does not bind today', async () => {
    const env = makeDOEnv({ USAGE_QUOTA_DAILY: '5', USAGE_QUOTA_MONTHLY: '500' });
    const mb = mailboxStore(env, 'sealed', 'user42');
    await mb.checkDeposit(); // materialise the instance
    const y = new Date(Date.now() - 86400000);
    const yDay = y.toISOString().slice(0, 10);
    storageOf(env, 'user42').set('usage', {
      d: yDay, dc: 9999,
      m: yDay.slice(0, 7) === monthKey() ? monthKey() : yDay.slice(0, 7),
      mc: yDay.slice(0, 7) === monthKey() ? 10 : 9999,
    });
    expect(await mb.checkDeposit()).toEqual({ ok: true });
    const u = usageOf(env, 'user42');
    expect(u.d).toBe(dayKey());
    expect(u.dc).toBe(1);
    expect(u.m).toBe(monthKey());
    // Same-month yesterday carries the month count forward (+1);
    // a new month restarts it at 1.
    expect(u.mc).toBe(yDay.slice(0, 7) === monthKey() ? 11 : 1);
  });

  it('a frequency-gate denial records nothing in the usage record', async () => {
    const env = makeDOEnv();
    const mb = mailboxStore(env, 'sealed', 'user42');
    await mb.checkDeposit(); // materialise + one admitted deposit
    const now = Date.now();
    storageOf(env, 'user42').set('deposits',
      Array.from({ length: 120 }, (_, i) => now - 1000 + i));
    const denied = await mb.checkDeposit();
    expect(denied.ok).toBe(false);
    expect(denied.quotaExceeded).toBeUndefined();
    // Usage still reflects only the single admitted deposit.
    expect(usageOf(env, 'user42')).toEqual({ d: dayKey(), dc: 1, m: monthKey(), mc: 1 });
  });

  it('survives slot deletes: clearing the queues is not a budget reset', async () => {
    const env = makeDOEnv({ USAGE_QUOTA_DAILY: '2' });
    const mb = mailboxStore(env, 'sealed', 'user42');
    expect((await mb.checkDeposit()).ok).toBe(true);
    expect((await mb.checkDeposit()).ok).toBe(true);
    // Account deletion's sweep deletes slots, never the budget state.
    await mb.deleteQueue(); await mb.deleteHwm(); await mb.deleteDropped();
    const denied = await mb.checkDeposit();
    expect(denied.ok).toBe(false);
    expect(denied.quotaExceeded).toBe(true);
  });

  it('USAGE_QUOTA_ENABLED=false disables counting entirely (self-host frame)', async () => {
    const env = makeDOEnv({ USAGE_QUOTA_ENABLED: 'false', USAGE_QUOTA_DAILY: '1' });
    const mb = mailboxStore(env, 'sealed', 'user42');
    for (let i = 0; i < 5; i++) expect(await mb.checkDeposit()).toEqual({ ok: true });
    expect(usageOf(env, 'user42')).toBeUndefined();
  });

  it('an unparseable limit falls back to the defaults instead of blocking', async () => {
    const env = makeDOEnv({ USAGE_QUOTA_DAILY: 'abc' });
    const mb = mailboxStore(env, 'sealed', 'user42');
    expect(await mb.checkDeposit()).toEqual({ ok: true });
    // Counting is ON with the default budget — the record exists.
    expect(usageOf(env, 'user42').dc).toBe(1);
  });
});

describe('MailboxStore.checkDeposit usage quota (KV-backed)', () => {
  it('is a documented no-op on KV, quota env vars notwithstanding', async () => {
    const mb = mailboxStore(makeEnv({ USAGE_QUOTA_DAILY: '1' }), 'sealed', 'user42');
    for (let i = 0; i < 5; i++) expect(await mb.checkDeposit()).toEqual({ ok: true });
  });
});

describe('handleSealedSend usage quota', () => {
  it('DO backend: deposits pass up to the budget, then 429 USAGE_QUOTA_EXCEEDED', async () => {
    const env = makeDOEnv({ USAGE_QUOTA_DAILY: '2' });
    for (let i = 0; i < 2; i++) {
      const res = await handleSealedSend({ to: 'quotatgt1', envelope: env_i(i) }, env, req({}));
      expect(res.status).toBe(200);
    }
    const denied = await handleSealedSend({ to: 'quotatgt1', envelope: env_i(2) }, env, req({}));
    expect(denied.status).toBe(429);
    const body = await denied.json();
    expect(body.code).toBe('USAGE_QUOTA_EXCEEDED');
    expect(body.quotaScope).toBe('daily');
    expect(body.quotaLimit).toBe(2);
    expect(body.retryAfter).toBeGreaterThanOrEqual(1);
    expect(body.retryAfter).toBeLessThanOrEqual(86400);
    // Another recipient's frame is untouched.
    const other = await handleSealedSend({ to: 'other999', envelope: env_i(0) }, env, req({}));
    expect(other.status).toBe(200);
  });

  it('DO backend: a quota-denied envelope is not swallowed as a duplicate on retry', async () => {
    const env = makeDOEnv({ USAGE_QUOTA_DAILY: '1' });
    const first = await handleSealedSend({ to: 'quotatgt1', envelope: env_i(0) }, env, req({}));
    expect(first.status).toBe(200);
    const denied = await handleSealedSend({ to: 'quotatgt1', envelope: env_i(1) }, env, req({}));
    expect(denied.status).toBe(429);
    const retry = await handleSealedSend({ to: 'quotatgt1', envelope: env_i(1) }, env, req({}));
    expect(retry.status).toBe(429);
    expect((await retry.json()).code).toBe('USAGE_QUOTA_EXCEEDED');
  });

  it('DO backend: quota disabled leaves heavy traffic to the frequency gate alone', async () => {
    const env = makeDOEnv({ USAGE_QUOTA_ENABLED: 'false', USAGE_QUOTA_DAILY: '1' });
    for (let i = 0; i < 5; i++) {
      const res = await handleSealedSend({ to: 'quotatgt1', envelope: env_i(i) }, env, req({}));
      expect(res.status).toBe(200);
    }
  });
});

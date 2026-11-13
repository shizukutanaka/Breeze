import { describe, it, expect } from 'vitest';
import { MailboxDO } from '../_worker.js';
import { makeEnv } from './helpers/mockKV.js';
import { makeDOState } from './helpers/mockDO.js';
import { makeSqliteDb, makeSqliteCore } from './helpers/sqlite.js';

// Stage-2 step 1 (2026-11-13): the mailbox op protocol (RELAY_STAGE2_PLAN
// fact 2 / decision D1) factored into MailboxCore. The SAME scenario suite
// runs against (a) the production MailboxDO — now a thin adapter over the
// core — on mock DO storage, and (b) MailboxCore directly over the SQLite
// storage plane, and every scenario must produce the same verdict on both:
// that identity is what makes the core a portability layer instead of a
// second implementation. A driver exposes the op executor, the wake-up
// log, and raw storage access (for TTL/entry-shape pinning) behind one
// shape; everything else is shared.

const USER = 'user42';
const op = (fields) => ({ userId: USER, ...fields });

// (a) The real MailboxDO class over the mock DO state: RPC via fetch(),
// wake-up observed through a registered hibernation socket.
function makeDoDriver() {
  const env = makeEnv();
  const state = makeDOState(USER);
  const instance = new MailboxDO(state, env);
  const frames = [];
  state.acceptWebSocket({ send: (f) => frames.push(JSON.parse(f)) });
  return {
    notifyLog: frames,
    async exec(body) {
      const res = await instance.fetch(new Request('https://mailbox.internal/op', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }));
      return { status: res.status, body: await res.json() };
    },
    readRaw: (key) => state.storage.get(key),
    putRaw: (key, value) => state.storage.put(key, value),
    hasRaw: async (key) => (await state.storage.get(key)) !== undefined,
  };
}

// (b) MailboxCore over the SQLite storage plane, composed per-recipient
// exactly as the step-2 Node host will compose it.
function makeCoreDriver() {
  const db = makeSqliteDb();
  const { core, storage, frames } = makeSqliteCore(db, USER);
  return {
    notifyLog: frames,
    exec: (body) => core.execute(body),
    readRaw: (key) => storage.get(key),
    putRaw: (key, value) => storage.put(key, value),
    hasRaw: async (key) => (await storage.get(key)) !== undefined,
  };
}

function coreContract(label, makeDriver) {
  describe(`Mailbox op protocol contract (${label})`, () => {
    it('round-trips every mailbox slot in both families', async () => {
      const d = makeDriver();
      for (const family of ['inbox', 'sealed']) {
        for (const slot of ['queue', 'hwm', 'dropped']) {
          const value = `${family}-${slot}-value`;
          expect(await d.exec(op({ op: 'put', family, slot, value, ttlSec: 3600 })))
            .toEqual({ status: 200, body: { ok: true } });
          expect(await d.exec(op({ op: 'get', family, slot })))
            .toEqual({ status: 200, body: { ok: true, value } });
        }
      }
    });

    it('round-trips the presence record', async () => {
      const d = makeDriver();
      expect(await d.exec(op({ op: 'put', family: 'presence', slot: 'record', value: '{"at":1}', ttlSec: 360 })))
        .toEqual({ status: 200, body: { ok: true } });
      expect(await d.exec(op({ op: 'get', family: 'presence', slot: 'record' })))
        .toEqual({ status: 200, body: { ok: true, value: '{"at":1}' } });
      expect(await d.exec(op({ op: 'del', family: 'presence', slot: 'record' })))
        .toEqual({ status: 200, body: { ok: true } });
      expect(await d.exec(op({ op: 'get', family: 'presence', slot: 'record' })))
        .toEqual({ status: 200, body: { ok: true, value: null } });
    });

    it('reads of absent slots return value:null; deletes are idempotent', async () => {
      const d = makeDriver();
      expect(await d.exec(op({ op: 'get', family: 'inbox', slot: 'queue' })))
        .toEqual({ status: 200, body: { ok: true, value: null } });
      expect(await d.exec(op({ op: 'del', family: 'inbox', slot: 'queue' })))
        .toEqual({ status: 200, body: { ok: true } });
      expect(await d.exec(op({ op: 'del', family: 'inbox', slot: 'queue' })))
        .toEqual({ status: 200, body: { ok: true } });
    });

    it('rejects invalid family / slot / op combinations with 400', async () => {
      const d = makeDriver();
      const bad = [
        { op: 'get', family: 'bogus', slot: 'queue' },
        { op: 'get', family: 'inbox', slot: 'bogus' },
        { op: 'get', family: 'inbox' }, // slot missing
        { op: 'get', family: 'presence', slot: 'queue' }, // presence has only 'record'
        { op: 'deposit', family: 'presence' }, // deposit is mailbox-wide, never presence
        { op: 'bogus', family: 'inbox', slot: 'queue' }, // unknown op
      ];
      for (const fields of bad) {
        expect(await d.exec(op(fields))).toEqual({ status: 400, body: { ok: false } });
      }
    });

    it('honours ttlSec: an already-expired entry reads as absent and is purged', async () => {
      const d = makeDriver();
      await d.exec(op({ op: 'put', family: 'inbox', slot: 'queue', value: 'stale', ttlSec: 0 }));
      expect(await d.exec(op({ op: 'get', family: 'inbox', slot: 'queue' })))
        .toEqual({ status: 200, body: { ok: true, value: null } });
      expect(await d.hasRaw('inbox:queue')).toBe(false);
    });

    it('an entry written without ttlSec records exp:null and never expires', async () => {
      const d = makeDriver();
      await d.exec(op({ op: 'put', family: 'inbox', slot: 'queue', value: 'forever' }));
      const entry = await d.readRaw('inbox:queue');
      expect(entry).toEqual({ v: 'forever', exp: null });
      expect(await d.exec(op({ op: 'get', family: 'inbox', slot: 'queue' })))
        .toEqual({ status: 200, body: { ok: true, value: 'forever' } });
    });

    it('a stored entry whose v is not a string reads as absent', async () => {
      const d = makeDriver();
      await d.putRaw('inbox:queue', { v: 42, exp: null });
      expect(await d.exec(op({ op: 'get', family: 'inbox', slot: 'queue' })))
        .toEqual({ status: 200, body: { ok: true, value: null } });
    });

    it('wakes the mailbox on queue puts only', async () => {
      const d = makeDriver();
      await d.exec(op({ op: 'put', family: 'inbox', slot: 'queue', value: 'q', ttlSec: 60 }));
      expect(d.notifyLog).toEqual([{ type: 'mail', family: 'inbox' }]);
      await d.exec(op({ op: 'put', family: 'inbox', slot: 'hwm', value: '1', ttlSec: 60 }));
      await d.exec(op({ op: 'put', family: 'presence', slot: 'record', value: 'p', ttlSec: 60 }));
      expect(d.notifyLog).toHaveLength(1);
      await d.exec(op({ op: 'put', family: 'sealed', slot: 'queue', value: 'q', ttlSec: 60 }));
      expect(d.notifyLog).toEqual([
        { type: 'mail', family: 'inbox' },
        { type: 'mail', family: 'sealed' },
      ]);
    });

    it('deposit gate admits under the cap, denies at it, and does not record denials', async () => {
      const d = makeDriver();
      for (let i = 0; i < 3; i++) {
        expect(await d.exec(op({ op: 'deposit', family: 'sealed' })))
          .toEqual({ status: 200, body: { ok: true } });
      }
      const log = await d.readRaw('deposits');
      expect(Array.isArray(log)).toBe(true);
      expect(log).toHaveLength(3);
      for (let i = 3; i < 120; i++) await d.exec(op({ op: 'deposit', family: 'sealed' }));
      const denied = await d.exec(op({ op: 'deposit', family: 'sealed' }));
      expect(denied.status).toBe(200);
      expect(denied.body.ok).toBe(false);
      expect(denied.body.retryAfterSec).toBeGreaterThanOrEqual(1);
      expect(denied.body.retryAfterSec).toBeLessThanOrEqual(60);
      expect(await d.readRaw('deposits')).toHaveLength(120);
    });

    it('deposit gate spans both families of the one mailbox', async () => {
      const d = makeDriver();
      for (let i = 0; i < 120; i++) await d.exec(op({ op: 'deposit', family: 'sealed' }));
      const denied = await d.exec(op({ op: 'deposit', family: 'inbox' }));
      expect(denied.body.ok).toBe(false);
    });

    it('deposit gate is race-safe: 130 parallel deposits admit exactly 120', async () => {
      const d = makeDriver();
      const results = await Promise.all(
        Array.from({ length: 130 }, () => d.exec(op({ op: 'deposit', family: 'sealed' }))),
      );
      expect(results.filter((r) => r.body.ok)).toHaveLength(120);
      expect(results.filter((r) => !r.body.ok)).toHaveLength(10);
      expect(await d.readRaw('deposits')).toHaveLength(120);
    });
  });
}

coreContract('MailboxDO adapter (mock DO storage)', makeDoDriver);
coreContract('MailboxCore (SQLite storage)', makeCoreDriver);

describe('MailboxCore composition (SQLite host shape)', () => {
  it('two recipients over ONE database are fully isolated', async () => {
    const db = makeSqliteDb();
    const a = makeSqliteCore(db, 'alice');
    const b = makeSqliteCore(db, 'bob');
    await a.core.execute({ op: 'put', family: 'sealed', slot: 'queue', value: 'for-alice', ttlSec: 60, userId: 'alice' });
    expect(await b.core.execute({ op: 'get', family: 'sealed', slot: 'queue', userId: 'bob' }))
      .toEqual({ status: 200, body: { ok: true, value: null } });
    expect(await a.core.execute({ op: 'get', family: 'sealed', slot: 'queue', userId: 'alice' }))
      .toEqual({ status: 200, body: { ok: true, value: 'for-alice' } });
    // Saturating alice's deposit gate leaves bob's untouched.
    for (let i = 0; i < 120; i++) await a.core.execute({ op: 'deposit', family: 'sealed', userId: 'alice' });
    expect((await a.core.execute({ op: 'deposit', family: 'sealed', userId: 'alice' })).body.ok).toBe(false);
    expect(await b.core.execute({ op: 'deposit', family: 'sealed', userId: 'bob' }))
      .toEqual({ status: 200, body: { ok: true } });
  });
});

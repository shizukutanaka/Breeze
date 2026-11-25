import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createMessageRequests, installNotificationActions, REQUEST_LIMITS, requestTransaction } from '../src/app/message-requests.js';
import worker from '../_worker.js';
import { makeEnv } from './helpers/mockKV.js';

const MS = { DAY: 24 * 60 * 60 * 1000 };
const pub = n => Buffer.alloc(32, n).toString('base64');
const envelope = (n = 1, extra = {}) => ({ from: pub(n).slice(0, 12), fromPub: pub(n), fromName: 'Sender', ts: 100, payload: 'opaque ciphertext', ...extra });

function world() {
  let state = { v: 1, entries: [], blocked: [] }, contacts = new Map(), clock = 10 * MS.DAY, tail = Promise.resolve();
  const D = {
    MS, now: () => clock, dom: () => null, t: (k, n) => k + (n ?? ''),
    get: async (_store, id) => contacts.get(id), all: async () => [...contacts.values()],
    root: () => null, devices: async () => [], attribution: vi.fn(async () => false),
    notify: vi.fn(), render: vi.fn(), dbg: vi.fn(), toast: vi.fn(),
    lock: fn => { const next = tail.then(fn); tail = next.catch(() => {}); return next; },
    transaction: async fn => {
      const next = structuredClone(state), copy = structuredClone(contacts);
      const out = fn(next, { add: c => { if (copy.has(c.id)) throw new Error('ConstraintError'); copy.set(c.id, c); } });
      state = next; contacts = copy; return out;
    },
  };
  let requests;
  D.receive = vi.fn(async msg => { expect(await requests.admit(msg)).toBe(true); });
  requests = createMessageRequests(D);
  return { D, requests, reload() { requests = createMessageRequests(D); return requests; },
    state: () => structuredClone(state), contact: c => contacts.set(c.id, c), advance: n => { clock += n; } };
}

describe('message requests consent boundary', () => {
  it('persists ciphertext, deduplicates envelopes, and accepts/replays in order without prior processing', async () => {
    const w = world(), first = envelope(1, { fromName: '\u202eName\u200b' });
    expect(await w.requests.admit(first)).toBe(false);
    await w.requests.admit(first);
    await w.requests.admit(envelope(1, { ts: 101 }));
    expect(w.state().entries[0]).toMatchObject({ name: 'Name', messages: [{ msg: first }, { msg: { ts: 101 } }] });
    expect(w.D.receive).not.toHaveBeenCalled();
    expect(w.D.notify).toHaveBeenCalledTimes(1);
    expect(await w.D.get('contacts', first.from)).toBeUndefined();
    await w.reload().act(pub(1), 'accept');
    expect(w.D.receive.mock.calls.map(([m]) => m.ts)).toEqual([100, 101]);
    expect(await w.D.get('contacts', first.from)).toMatchObject({ pubB64: pub(1), unread: 0 });
    expect(w.state().entries).toEqual([]);
    expect(await w.requests.admit(envelope())).toBe(true);
  });

  it.each([{ isCall: true }, { isFile: true }, { isVoice: true }, { isProfile: true }, { payload: 'https://evil.example/image' }])('does not decrypt, ring, preview or reply before consent: %j', async extra => {
    const w = world();
    expect(await w.requests.admit(envelope(1, extra))).toBe(false);
    expect(w.D.receive).not.toHaveBeenCalled();
    if (extra.isCall) { expect(w.state().entries).toHaveLength(0); expect(w.D.notify).not.toHaveBeenCalled(); }
  });

  it('blocks across reloads, deletes without blocking, and permits explicit unblock', async () => {
    const w = world();
    await w.requests.admit(envelope()); await w.requests.act(pub(1), 'block');
    expect(await w.reload().admit(envelope(1, { ts: 101 }))).toBe(false);
    expect(w.state().entries).toHaveLength(0);
    expect(w.D.notify).toHaveBeenCalledTimes(1);
    await w.requests.act(pub(1), 'unblock');
    await w.requests.admit(envelope()); await w.requests.act(pub(1), 'delete');
    await w.reload().admit(envelope(1, { ts: 102 }));
    expect(w.state().entries).toHaveLength(1);
    expect(w.state().blocked).toHaveLength(0);
  });

  it('quarantines legacy P-256 identities as well as X25519 identities', async () => {
    const w = world(), legacy = Buffer.alloc(65, 8).toString('base64');
    expect(await w.requests.admit(envelope(1, { from: legacy.slice(0, 12), fromPub: legacy }))).toBe(false);
    expect(w.state().entries[0].pub).toBe(legacy);
  });

  it('allows explicit/pairing contacts, known group members and authenticated linked fan-out, not forged flags', async () => {
    const w = world();
    w.contact({ id: pub(1).slice(0, 12), pubB64: pub(1), offlinePaired: true });
    expect(await w.requests.admit(envelope())).toBe(true);
    w.contact({ id: 'g:test', isGroup: true, members: [{ id: pub(2).slice(0, 12), pubB64: pub(2) }] });
    expect(await w.requests.admit(envelope(2, { groupId: 'g:test', isGroupSK: true }))).toBe(true);
    expect(await w.requests.admit(envelope(2, { isSenderKey: true }))).toBe(true);
    expect(await w.requests.admit(envelope(3, { groupId: 'g:test', isGroupSK: true }))).toBe(false);
    expect(await w.requests.admit(envelope(3, { selfSync: true }))).toBe(false);
    await w.requests.admit(envelope(3));
    w.D.devices = async () => [pub(3)];
    expect(await w.requests.admit(envelope(3, { selfSync: true }))).toBe(true);
    w.D.attribution.mockResolvedValue(true);
    expect(await w.requests.admit(envelope(4, { acctRoot: pub(1) }))).toBe(true);
    w.D.attribution.mockResolvedValue(false);
    expect(await w.requests.admit(envelope(5, { acctRoot: pub(1) }))).toBe(false);
  });

  it('keeps existing add/group flows working without Web Locks but fails acceptance before creating a contact', async () => {
    const w = world();
    w.D.lock = async () => { throw new Error('no locks'); };
    await expect(w.requests.drain(pub(1))).resolves.toBeUndefined();
    w.contact({ id: 'g:test', isGroup: true, members: [{ id: pub(1).slice(0, 12), pubB64: pub(1) }] });
    expect(await w.requests.admit(envelope(1, { groupId: 'g:test' }))).toBe(true);
    await w.requests.admit(envelope(2));
    await expect(w.requests.act(pub(2), 'accept')).rejects.toThrow('no locks');
    expect(await w.D.get('contacts', pub(2).slice(0, 12))).toBeUndefined();
  });

  it('rejects blocked contacts, key-prefix collisions, invalid identity claims and malformed envelopes', async () => {
    const w = world();
    w.contact({ id: pub(1).slice(0, 12), pubB64: pub(1), blocked: true });
    expect(await w.requests.admit(envelope())).toBe(false);
    w.contact({ id: pub(2).slice(0, 12), pubB64: pub(9) });
    expect(await w.requests.admit(envelope(2))).toBe(false);
    for (const msg of [null, {}, envelope(3, { from: 'other' }), envelope(3, { payload: {} }), envelope(3, { ts: NaN })]) expect(await w.requests.admit(msg)).toBe(false);
    expect(w.state().entries).toHaveLength(0);
  });

  it('enforces sender/count/per-sender/envelope/byte/age bounds', async () => {
    const w = world();
    for (let n = 1; n <= REQUEST_LIMITS.senders + 1; n++) await w.requests.admit(envelope(n));
    expect(w.state().entries).toHaveLength(REQUEST_LIMITS.senders);
    for (let n = 101; n < 125; n++) await w.requests.admit(envelope(1, { ts: n }));
    expect(w.state().entries[0].messages).toHaveLength(REQUEST_LIMITS.perSender);
    for (let n = 2; n <= 6; n++) for (let ts = 101; ts <= 120; ts++) await w.requests.admit(envelope(n, { ts }));
    expect(w.state().entries.flatMap(e => e.messages)).toHaveLength(REQUEST_LIMITS.messages);
    w.advance(7 * MS.DAY); await w.requests.refresh();
    expect(w.state().entries).toHaveLength(0);
    await w.requests.admit(envelope(1, { payload: 'x'.repeat(REQUEST_LIMITS.envelope) }));
    expect(w.state().entries).toHaveLength(0);
    for (let n = 1; n <= 3; n++) for (let ts = 1; ts <= 20; ts++) await w.requests.admit(envelope(n, { ts, payload: 'x'.repeat(100 * 1024) }));
    const messages = w.state().entries.flatMap(e => e.messages);
    expect(messages.reduce((n, m) => n + m.bytes, 0)).toBeLessThanOrEqual(REQUEST_LIMITS.bytes);
    expect(messages.length).toBeLessThan(60);
  });

  it('does not evict persisted blocks when the block bound is full', async () => {
    const w = world();
    const original = w.D.transaction;
    await original(state => { state.blocked = Array.from({ length: REQUEST_LIMITS.blocked }, (_, n) => ({ pub: String(n), at: 1 })); });
    await expect(w.requests.act(pub(1), 'block')).rejects.toThrow('block limit');
    expect(w.state().blocked).toHaveLength(REQUEST_LIMITS.blocked);
  });

  it('fails closed on storage errors and resumes accepted queues after interrupted processing', async () => {
    const w = world();
    await w.requests.admit(envelope());
    w.D.receive.mockRejectedValueOnce(new Error('interrupted'));
    await expect(w.requests.act(pub(1), 'accept')).rejects.toThrow('interrupted');
    expect(w.state().entries[0].messages).toHaveLength(1);
    await w.reload().drain(pub(1));
    expect(w.state().entries).toHaveLength(0);
    w.D.transaction = async () => { throw new Error('storage'); };
    await expect(w.requests.admit(envelope(2))).rejects.toThrow('storage');
    expect(await w.D.get('contacts', pub(2).slice(0, 12))).toBeUndefined();
  });

  it('does nothing after account teardown', async () => {
    const w = world(), ac = new AbortController(); w.D.signal = ac.signal; ac.abort();
    expect(await w.requests.admit(envelope())).toBe(false);
    await w.requests.act(pub(1), 'accept');
    expect(w.state().entries).toHaveLength(0);
  });

  it('retains accepted ciphertext if account teardown interrupts replay', async () => {
    const w = world(), ac = new AbortController(); w.D.signal = ac.signal;
    await w.requests.admit(envelope());
    w.D.receive.mockImplementationOnce(async () => { ac.abort(); });
    await w.requests.act(pub(1), 'accept');
    expect(w.state().entries[0].messages).toHaveLength(1);
    w.D.signal = new AbortController().signal;
    await w.reload().drain(pub(1));
    expect(w.state().entries).toHaveLength(0);
  });
});

describe('deployed receive and notification boundaries', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const source = html.slice(html.indexOf('  async function handleIncoming(msg, ackOut) {'), html.indexOf('  // ===== P2P connection per contact ====='));
  it.each([null, { admit: async () => false }])('stops before all receive-side effects and DC ACKs when admission fails: %j', async gate => {
    const handle = new Function('_requests', source + '; return handleIncoming;')(gate);
    for (const extra of [{}, { isCall: true }, { isFile: true }, { isProfile: true }]) {
      const ack = {}; await handle(envelope(1, extra), ack); expect(ack).toEqual({});
    }
  });
  it('keeps application typing/receipt paths behind existing contacts and signs private presence', () => {
    expect(html).toContain('privatePresence: true');
    expect(html).toContain("JSON.stringify([myPubB64 || '', sanStr(myName, 64), null, inst.v, true])");
    expect(html).toMatch(/if \(!activeContact[^\n]*\) return/);
  });
  it('ignores legacy quick-reply and mark-read actions for unknown or blocked contacts', async () => {
    let listener;
    const D = { serviceWorker: { addEventListener: (_type, fn) => { listener = fn; } },
      get: vi.fn(async () => null), open: vi.fn(), dom: () => ({}), send: vi.fn(), put: vi.fn(), render: vi.fn(), dbg: vi.fn() };
    installNotificationActions(D);
    for (const contact of [null, { blocked: true }]) {
      D.get.mockResolvedValue(contact);
      listener({ data: { type: 'quick-reply', contactId: 'stranger', text: 'secret' } });
      listener({ data: { type: 'mark-read', contactId: 'stranger' } });
      await new Promise(r => setImmediate(r));
    }
    expect(D.open).not.toHaveBeenCalled(); expect(D.send).not.toHaveBeenCalled(); expect(D.put).not.toHaveBeenCalled();
    D.get.mockResolvedValue({ id: 'known' });
    listener({ data: { type: 'quick-reply', contactId: 'known', text: 'okay' } });
    await new Promise(r => setImmediate(r));
    expect(D.open).toHaveBeenCalledOnce(); expect(D.send).toHaveBeenCalledOnce();
  });
  it('denies all notification actions before storage or transport access while the vault is blocked', () => {
    let listener;
    const D = { serviceWorker: { addEventListener: (_type, fn) => { listener = fn; } },
      blocked: () => true, get: vi.fn(), flush: vi.fn() };
    installNotificationActions(D);
    for (const type of ['sync-outbox', 'quick-reply', 'mark-read']) listener({ data: { type, contactId: 'known', text: 'secret' } });
    expect(D.get).not.toHaveBeenCalled(); expect(D.flush).not.toHaveBeenCalled();
  });
});

describe('private presence reads', () => {
  it.each([false, true])('hides online state and registry timestamps on single and batch lookups (cache %s)', async cached => {
    const env = makeEnv(), id = 'privateUser1', record = JSON.stringify({ at: Date.now(), privatePresence: true, devTs: 123 });
    await env.KV.put('presence:' + id, record);
    globalThis._presenceCache = new Map(cached ? [['presence:' + id + ':data', record]] : []);
    const req = fields => new Request('https://relay.test/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ check: true, ...fields }) });
    const single = await worker.fetch(req({ id }), env, {});
    expect(await single.json()).toMatchObject({ online: false });
    const batch = await worker.fetch(req({ ids: [id] }), env, {});
    const data = await batch.json();
    expect(data.online[id]).toBe(false); expect(data.devTs?.[id]).toBeUndefined();
  });
});

describe('request IDB transaction', () => {
  it('rejects unsupported stored formats instead of replacing them or accepting messages', async () => {
    let tx;
    const db = { transaction: () => (tx = { objectStore: () => ({ get: () => { const req = { result: { v: 2 } }; queueMicrotask(() => req.onsuccess()); return req; } }), abort: () => queueMicrotask(() => tx.onabort()) }) };
    await expect(requestTransaction(db, () => { throw new Error('must not run'); })).rejects.toThrow('request format');
  });
});

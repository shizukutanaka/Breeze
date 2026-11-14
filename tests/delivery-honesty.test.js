// D4 honesty fix (P2P weakness audit 2026-11-14, wave 1): the delivery
// states and the loss paths must say what actually happened.
//
//  (1) 'delivered' (✓✓) means the RECIPIENT'S DEVICE confirmed it
//      persisted the message. A relay ack proves only that the relay
//      accepted a deposit, so relaySend / scheduleRetry now mark the
//      separate 'deposited' state (persisted as dep, never ack), and
//      updateMsgStatus keeps the two apart in DOM and IDB.
//  (2) The plain inbox was the one queue whose cap drops were NOT
//      counted: handleMsgSend now counts them (both trims) and
//      handleMsgPoll surfaces the count once, mirroring the sealed
//      queue's long-standing behaviour.
//  (3) flushOutbox discarded >7-day entries with a bare `continue`:
//      the discard now toasts, audit-logs, and marks each message
//      failed (✗, tap to retry) in its conversation.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEnv, apiRequest } from './helpers/mockKV.js';
import { handleMsgSend, handleMsgPoll, mailboxStore } from '../_worker.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');

function sliceBetween(startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  expect(start, `marker ${startMarker}`).toBeGreaterThan(-1);
  expect(end, `marker ${endMarker}`).toBeGreaterThan(start);
  return html.slice(start, end);
}

const req = (b) => apiRequest('/api/msg/x', b);
const MS = { SEC: 1000, MIN: 60000, HOUR: 3600000, DAY: 86400000, WEEK: 604800000 };

// ── (2) Worker: plain-inbox drop accounting ───────────────────────
describe('worker — plain inbox dropped counter (D4)', () => {
  beforeEach(() => { globalThis._msgDedup = new Map(); });

  it('counts cap drops and surfaces them exactly once on the next poll', async () => {
    const env = makeEnv();
    const now = Date.now();
    // 105 distinct deposits into a 100-deep queue: the 5 oldest are
    // pushed out by the cap while the recipient is away.
    for (let i = 0; i < 105; i++) {
      const res = await handleMsgSend(
        { to: 'bob00001', from: 'alice001', payload: `CT-${i}-` + 'x'.repeat(48), ts: now },
        '203.0.113.7', env, req({}));
      expect(res.status).toBe(200);
    }
    expect(await mailboxStore(env, 'inbox', 'bob00001').readDropped()).toBe('5');

    const poll1 = await handleMsgPoll({ id: 'bob00001', lastTs: 0 }, env, req({}));
    const body1 = await poll1.json();
    expect(body1.messages).toHaveLength(100);
    expect(body1.dropped).toBe(5);
    // Surfaced once: the counter is reset by the poll that reported it.
    expect(await mailboxStore(env, 'inbox', 'bob00001').readDropped()).toBeNull();

    const poll2 = await handleMsgPoll({ id: 'bob00001', lastTs: 0 }, env, req({}));
    const body2 = await poll2.json();
    expect(body2.dropped).toBeUndefined();
  });

  it('no drops → no dropped field, byte-shape unchanged', async () => {
    const env = makeEnv();
    const res = await handleMsgSend(
      { to: 'bob00001', from: 'alice001', payload: 'CT-single', ts: Date.now() },
      '203.0.113.7', env, req({}));
    expect(res.status).toBe(200);
    const poll = await handleMsgPoll({ id: 'bob00001', lastTs: 0 }, env, req({}));
    const body = await poll.json();
    expect(body.messages).toHaveLength(1);
    expect('dropped' in body).toBe(false);
  });
});

// ── (1a) updateMsgStatus: deposited ≠ delivered ───────────────────
function buildStatusWorld(record) {
  const src = sliceBetween('function updateMsgStatus', 'function renderReactions');
  const puts = [];
  const classSet = new Set(['sent']);
  const statusEl = {
    textContent: '✓', title: 'Sent',
    classList: {
      contains: (c) => classSet.has(c),
      add: (c) => classSet.add(c),
      remove: (...cs) => cs.forEach((c) => classSet.delete(c)),
    },
    setAttribute(k, v) { this['attr_' + k] = v; },
  };
  const msgEl = { querySelector: (sel) => (sel === '.msg-status' ? statusEl : { getAttribute: () => '' }) };
  const _DOM = { get: () => ({ querySelectorAll: () => [msgEl] }) };
  const dbGetByIndex = async () => [record];
  const dbPut = async (store, rec) => { puts.push(rec); return true; };
  const t = (key, ...args) => key + (args.length ? ':' + args.join(',') : '');
  const factory = new Function('_DOM', 'activeContact', 'dbGetByIndex', 'dbPut', 'MS', 't', '_dbg',
    src + '\nreturn updateMsgStatus;');
  const updateMsgStatus = factory(_DOM, { id: 'bob00001xxxx' }, dbGetByIndex, dbPut, MS, t, () => {});
  return { updateMsgStatus, puts, classSet, statusEl };
}
const flushAsync = () => new Promise((r) => setTimeout(r, 10));

describe('client — updateMsgStatus semantics (D4)', () => {
  it("'deposited' persists dep (never ack) and renders the deposited class", async () => {
    const record = { mine: true, ts: 5000 };
    const w = buildStatusWorld(record);
    w.updateMsgStatus(5000, 'deposited');
    await flushAsync();
    expect(record.dep).toBe(true);
    expect(record.ack).toBeFalsy();
    expect(w.puts).toHaveLength(1);
    expect(w.classSet.has('deposited')).toBe(true);
    expect(w.classSet.has('delivered')).toBe(false);
    expect(w.statusEl.textContent).toBe('✓'); // NOT ✓✓ — that is reserved for receipt
    expect(w.statusEl.title).toBe('deposited');
  });

  it("'delivered' upgrades a deposited message: ack set, ✓✓ rendered", async () => {
    const record = { mine: true, ts: 5000, dep: true };
    const w = buildStatusWorld(record);
    w.classSet.delete('sent'); w.classSet.add('deposited');
    w.updateMsgStatus(5000, 'delivered');
    await flushAsync();
    expect(record.ack).toBe(true);
    expect(w.classSet.has('delivered')).toBe(true);
    expect(w.classSet.has('deposited')).toBe(false);
    expect(w.statusEl.textContent).toBe('✓✓');
  });

  it("'deposited' never downgrades an already-acked record", async () => {
    const record = { mine: true, ts: 5000, ack: true };
    const w = buildStatusWorld(record);
    w.updateMsgStatus(5000, 'deposited');
    await flushAsync();
    expect(record.dep).toBeFalsy();
    expect(w.puts).toHaveLength(0);
  });
});

// ── (1b) Wiring pins: which call sites may say 'delivered' ───────
describe('client — status call-site wiring (D4)', () => {
  it("relaySend marks relay acks 'deposited' at all three ack sites", () => {
    const src = sliceBetween('async function relaySend', 'function scheduleRetry');
    expect(src).not.toContain("updateMsgStatus(msgTs, 'delivered')");
    expect(src.match(/updateMsgStatus\(msgTs, 'deposited'\)/g)).toHaveLength(3);
  });

  it("scheduleRetry's fan-out retry also marks 'deposited'", () => {
    const src = sliceBetween('function scheduleRetry', '// v3.6: Outbox badge');
    expect(src).toContain("updateMsgStatus(item.payload.ts, 'deposited')");
    expect(src).not.toContain("updateMsgStatus(item.payload.ts, 'delivered')");
  });

  it("the direct P2P ack keeps 'delivered' (1:1 and group)", () => {
    expect(html.match(/if \(directAcked\) updateMsgStatus\(ts, 'delivered'\)/g)).toHaveLength(2);
  });

  it('render mapping: dep renders deposited, ack alone renders delivered', () => {
    expect(html).toContain("meta.ack ? 'delivered' : meta.dep ? 'deposited' : 'sent'");
    expect(html).toContain("else if (isMine && meta.dep) statusTitle = t('deposited');");
  });

  it('plain poll surfaces dropped with the same toast as the sealed poll', () => {
    const src = sliceBetween('async function _pollRelayOnce', 'function schedulePoll');
    expect(src.match(/showToast\(t\('toastMsgsDropped', (data|sData)\.dropped\), 'error'\)/g)).toHaveLength(2);
  });
});

// ── (3) flushOutbox: expiry is reported, never silent ────────────
describe('client — flushOutbox expiry notification (D4)', () => {
  it('discards a >7-day entry with a toast and a failed mark; the fresh entry still sends', async () => {
    const src = sliceBetween('async function flushOutbox', '// ═══ DRY: Signal helper');
    const now = Date.now();
    const oldTs = now - 8 * MS.DAY;
    const PEER = 'PEERPUBKEY00000000000000000000000000000000000000000000000000';
    const queue = [
      { text: 'fresh one', ts: now, attempts: 0 },
      { text: 'stale one', ts: oldTs, attempts: 0 },
    ];
    const sentPayloads = [];
    const peers = { [PEER]: { connected: true, dc: { readyState: 'open', send: (s) => sentPayloads.push(s) } } };
    const records = [
      { msgId: 'm-fresh', mine: true, ts: now },
      { msgId: 'm-stale', mine: true, ts: oldTs },
    ];
    const puts = [], toasts = [], audits = [];
    const factory = new Function(
      '_outbox', '_persistOutbox', 'peers', 'encryptFor', 'CONFIG', 'MS', '_dbg',
      'auditLog', 'showToast', 't', 'dbGetByIndex', 'dbPut', 'activeContact', '_DOM',
      'myPubB64', 'myName',
      src + '\nreturn flushOutbox;');
    const flushOutbox = factory(
      new Map([[PEER, queue]]), () => {}, peers,
      async () => 'CT', { PROTOCOL_VERSION: 5 }, MS, () => {},
      (kind, msg) => audits.push(msg),
      (msg, kind) => toasts.push({ msg, kind }),
      (key, ...args) => key + (args.length ? ':' + args.join(',') : ''),
      async () => records,
      async (store, rec) => { puts.push(rec); return true; },
      null, { get: () => null }, 'MYPUB', 'Me',
    );
    await flushOutbox(PEER);
    expect(sentPayloads).toHaveLength(1);
    expect(JSON.parse(sentPayloads[0]).payload).toBe('CT');
    expect(toasts).toEqual([{ msg: 'toastOutboxExpired:1', kind: 'error' }]);
    expect(audits.some((a) => a.includes('expired undelivered'))).toBe(true);
    const stale = records.find((r) => r.msgId === 'm-stale');
    expect(stale.failed).toBe(true);
    expect(puts).toContain(stale);
    expect(records.find((r) => r.msgId === 'm-fresh').failed).toBeFalsy();
  });

  it('an unexpired queue flushes with no expiry toast', async () => {
    const src = sliceBetween('async function flushOutbox', '// ═══ DRY: Signal helper');
    const now = Date.now();
    const PEER = 'PEERPUBKEY00000000000000000000000000000000000000000000000000';
    const sentPayloads = [], toasts = [];
    const factory = new Function(
      '_outbox', '_persistOutbox', 'peers', 'encryptFor', 'CONFIG', 'MS', '_dbg',
      'auditLog', 'showToast', 't', 'dbGetByIndex', 'dbPut', 'activeContact', '_DOM',
      'myPubB64', 'myName',
      src + '\nreturn flushOutbox;');
    const flushOutbox = factory(
      new Map([[PEER, [{ text: 'hi', ts: now, attempts: 0 }]]]), () => {},
      { [PEER]: { connected: true, dc: { readyState: 'open', send: (s) => sentPayloads.push(s) } } },
      async () => 'CT', { PROTOCOL_VERSION: 5 }, MS, () => {},
      () => {}, (msg, kind) => toasts.push({ msg, kind }),
      (key) => key,
      async () => [], async () => true, null, { get: () => null }, 'MYPUB', 'Me',
    );
    await flushOutbox(PEER);
    expect(sentPayloads).toHaveLength(1);
    expect(toasts).toHaveLength(0);
  });
});

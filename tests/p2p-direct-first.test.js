// P2P_PLAN Step 2 — direct-first delivery: the mailbox deposit is
// skipped ONLY when the peer's post-persistence app-layer ack arrives.
//
// Three layers, mirroring the repo's test culture:
//  (1) the ack waiter factory (src/app/direct-ack.js) against fake
//      timers — resolve/timeout/cancel/per-peer isolation;
//  (2) the REAL sendMessage, sliced verbatim from index.html, driven
//      with spy deps — the plan's Done-when cases fixed as behaviour:
//      ack → 0 deposits, no ack → 1 deposit, offline → deposit +
//      outbox as before, module absent → legacy dual-path;
//  (3) the REAL handleIncoming, sliced the same way, proving the
//      receiver-side ack flag (ackOut.stored) is set exactly when the
//      message is persisted — and NOT when it is dropped inside.
// Plus wiring pins so the production call sites cannot silently
// unwire (deposit guards, ack resolution, fan-out independence).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDirectAckWaiter } from '../src/app/direct-ack.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
const sw = readFileSync(join(HERE, '..', 'sw.js'), 'utf8');

function sliceBetween(startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  expect(start, `marker ${startMarker}`).toBeGreaterThan(-1);
  expect(end, `marker ${endMarker}`).toBeGreaterThan(start);
  return html.slice(start, end);
}

// ── (1) The waiter ──────────────────────────────────────────────────
function fakeTimers() {
  let nextId = 1;
  const timers = new Map();
  return {
    setTimeout: (fn, ms) => { const id = nextId++; timers.set(id, { fn, ms }); return id; },
    clearTimeout: (id) => { timers.delete(id); },
    fireAll: () => { const fns = [...timers.values()].map(t => t.fn); timers.clear(); for (const fn of fns) fn(); },
    get pending() { return timers.size; },
  };
}

describe('direct-ack waiter (src/app/direct-ack.js)', () => {
  it('resolves true when the ack arrives before the timeout', async () => {
    const ft = fakeTimers();
    const w = createDirectAckWaiter({ timeoutMs: 5000, ...ft });
    const p = w.expect('PUB_A', 111);
    expect(w.size).toBe(1);
    expect(w.resolve('PUB_A', 111)).toBe(true);
    await expect(p).resolves.toBe(true);
    expect(w.size).toBe(0);
    expect(ft.pending).toBe(0); // timer cleared, nothing leaks
  });

  it('resolves false on timeout — the deposit side of the contract', async () => {
    const ft = fakeTimers();
    const w = createDirectAckWaiter({ timeoutMs: 5000, ...ft });
    const p = w.expect('PUB_A', 222);
    ft.fireAll();
    await expect(p).resolves.toBe(false);
    expect(w.size).toBe(0);
  });

  it('keys per peer: a group send sharing one ts tracks members apart', async () => {
    const ft = fakeTimers();
    const w = createDirectAckWaiter({ timeoutMs: 5000, ...ft });
    const pa = w.expect('PUB_A', 333);
    const pb = w.expect('PUB_B', 333);
    expect(w.resolve('PUB_A', '333')).toBe(true); // wire ack carries ts as a string
    await expect(pa).resolves.toBe(true);
    ft.fireAll();
    await expect(pb).resolves.toBe(false);
  });

  it('cancel settles false immediately (send threw → deposit, no hang)', async () => {
    const ft = fakeTimers();
    const w = createDirectAckWaiter({ timeoutMs: 5000, ...ft });
    const p = w.expect('PUB_A', 444);
    expect(w.cancel('PUB_A', 444)).toBe(true);
    await expect(p).resolves.toBe(false);
    expect(ft.pending).toBe(0);
  });

  it('ack for an unknown key is a no-op (late ack after timeout)', () => {
    const w = createDirectAckWaiter({ timeoutMs: 5000, ...fakeTimers() });
    expect(w.resolve('PUB_Z', 999)).toBe(false);
    expect(w.cancel('PUB_Z', 999)).toBe(false);
  });

  it('re-expecting the same key settles the earlier wait false', async () => {
    const ft = fakeTimers();
    const w = createDirectAckWaiter({ timeoutMs: 5000, ...ft });
    const first = w.expect('PUB_A', 555);
    const second = w.expect('PUB_A', 555);
    await expect(first).resolves.toBe(false);
    expect(w.resolve('PUB_A', 555)).toBe(true);
    await expect(second).resolves.toBe(true);
  });
});

// ── (2) The real sendMessage, sliced ────────────────────────────────
const TS = 1700000000000;
const PUB1 = 'PUB1PUB1PUB1';
const PUB2 = 'PUB2PUB2PUB2';

function buildSendMessage({ peers = {}, waiter = null, activeContact }) {
  const calls = { deposits: [], fanOut: 0, outbox: [], stats: [], status: [], dcSent: [], skDist: [] };
  const input = { value: 'hello world' };
  const sendBtn = { disabled: false, classList: { add() {}, remove() {} } };
  const fn = new Function(
    'activeContact', '_isSending', '_DOM', 'document', 'window', 'localStorage',
    't', 'showToast', '_dbg', '_replyTo', '_disappearTimer', '_noReplyNeeded', '_updateNrnButton',
    '_drafts', '_persistDrafts', 'appendMsg', 'playSendSound', 'haptic',
    'correctedNow', '_lastSendTs', 'myId', 'myName', 'myPubB64',
    'dbPut', 'dbGet', 'isGroupAdmin', '_isSecondaryDevice',
    'distributeSenderKey', 'encryptGroupMsg', 'encryptFor', 'API', 'postAPIRaw',
    '_signingKey', 'signMessage', '_signingPubB64', '_rateLimiter', 'timingDelay',
    'peers', 'waitForBuffer', 'queueOutbox', 'relaySend', '_fanOut', 'renderContacts',
    'CONFIG', '_directAck', '_p2pDirectStat', 'updateMsgStatus',
    `${sliceBetween('async function sendMessage()', '// File send (v3: binary chunks for P2P, sealed relay fallback)')}
     return sendMessage;`);
  const sendMessage = fn(
    activeContact, false,
    { get: (id) => (id === 'msg-input' ? input : sendBtn) },
    { querySelector: () => null },
    { _breezeReplyTo: null },
    { getItem: () => null, setItem: () => {} },
    (k) => k, () => {}, () => {},
    null, 0, false, () => {},
    {}, () => {}, () => {}, () => {}, { send() {} },
    () => TS, 0, 'meId00000001', 'Me', 'MEPUBMEPUBME',
    async () => true, async () => null, () => true, false,
    async (gid, pub) => { calls.skDist.push(pub); },
    async () => 'GROUP-CT',
    async () => 'CT-1TO1',
    'https://relay.test', async () => ({ ok: true }),
    null, async () => null, '', { consume: () => true }, async () => {},
    peers, async () => {},
    (pub, text, meta) => { calls.outbox.push({ pub, text }); },
    async (to, payload) => { calls.deposits.push({ to, ts: payload.ts }); },
    () => { calls.fanOut++; },
    () => {},
    { PROTOCOL_VERSION: 4 },
    waiter,
    (field) => { calls.stats.push(field); },
    (ts, status) => { calls.status.push({ ts, status }); },
  );
  return { sendMessage, calls, input };
}

function fakePeer(onSend) {
  return { connected: true, dc: { readyState: 'open', send(str) { onSend?.(str); } } };
}

describe('sendMessage direct-first (sliced from index.html)', () => {
  it('1:1 ack → deposit skipped (0 deposits), fan-out still runs, delivered marked', async () => {
    const waiter = createDirectAckWaiter({ timeoutMs: 50 });
    const contact = { id: 'c1c1c1c1c1c1', pubB64: PUB1, name: 'Alice' };
    const peers = { [PUB1]: fakePeer(() => waiter.resolve(PUB1, TS)) };
    const { sendMessage, calls } = buildSendMessage({ peers, waiter, activeContact: contact });
    await sendMessage();
    expect(calls.deposits).toHaveLength(0);
    expect(calls.fanOut).toBe(1); // multi-device self-sync is a separate path — never skipped
    expect(calls.status).toEqual([{ ts: TS, status: 'delivered' }]);
    expect(calls.stats).toEqual(['directAck']);
    expect(calls.outbox).toHaveLength(0);
  });

  it('1:1 no ack → exactly one deposit (the offline guarantee is intact)', async () => {
    const waiter = createDirectAckWaiter({ timeoutMs: 30 });
    const contact = { id: 'c1c1c1c1c1c1', pubB64: PUB1, name: 'Alice' };
    const peers = { [PUB1]: fakePeer(null) }; // channel open, peer app silent
    const { sendMessage, calls } = buildSendMessage({ peers, waiter, activeContact: contact });
    await sendMessage();
    expect(calls.deposits).toHaveLength(1);
    expect(calls.deposits[0].to).toBe(contact.id);
    expect(calls.fanOut).toBe(1);
    expect(calls.stats).toEqual(['directNoAck']);
  });

  it('1:1 peer offline → outbox queue + deposit, exactly as before Step 2', async () => {
    const waiter = createDirectAckWaiter({ timeoutMs: 30 });
    const contact = { id: 'c1c1c1c1c1c1', pubB64: PUB1, name: 'Alice' };
    const { sendMessage, calls } = buildSendMessage({ peers: {}, waiter, activeContact: contact });
    await sendMessage();
    expect(calls.outbox).toHaveLength(1);
    expect(calls.deposits).toHaveLength(1);
    expect(calls.stats).toEqual([]); // no direct attempt, nothing counted
  });

  it('1:1 module absent → legacy dual-path (direct send AND deposit)', async () => {
    const contact = { id: 'c1c1c1c1c1c1', pubB64: PUB1, name: 'Alice' };
    let dcSent = 0;
    const peers = { [PUB1]: fakePeer(() => { dcSent++; }) };
    const { sendMessage, calls } = buildSendMessage({ peers, waiter: null, activeContact: contact });
    await sendMessage();
    expect(dcSent).toBe(1);
    expect(calls.deposits).toHaveLength(1);
    expect(calls.stats).toEqual([]);
  });

  it('group: ack from one member, silence from another → deposit only for the silent one', async () => {
    const waiter = createDirectAckWaiter({ timeoutMs: 30 });
    const group = { id: 'grpgrpgrp1', isGroup: true, name: 'G', members: [
      { id: 'm1m1m1m1m1m1', pubB64: PUB1 }, { id: 'm2m2m2m2m2m2', pubB64: PUB2 },
    ] };
    const peers = {
      [PUB1]: fakePeer(() => waiter.resolve(PUB1, TS)),
      [PUB2]: fakePeer(null),
    };
    const { sendMessage, calls } = buildSendMessage({ peers, waiter, activeContact: group });
    await sendMessage();
    expect(calls.skDist).toHaveLength(2); // sender keys still distributed to both
    expect(calls.deposits.map(d => d.to)).toEqual(['m2m2m2m2m2m2']);
    expect(calls.stats.sort()).toEqual(['directAck', 'directNoAck']);
  });
});

// ── (3) The real handleIncoming, sliced — the ack flag ──────────────
function buildHandleIncoming({ stored = null, decrypt = 'hello text' } = {}) {
  const puts = [];
  const contact = { id: 'c1c1c1c1c1c1', pubB64: PUB1, name: 'Alice', unread: 0 };
  const fn = new Function(
    'dbGet', 'dbPut', 'dbGetAll', '_replayCache', 'decryptFrom', 'decryptGroupMsg',
    'addContact', 'verifySignature', 'showKeyChangeWarning', 'safeMsgId',
    'activeContact', '_shouldAlert', 'playNotif', 'Notification', 'announceToSR',
    'appendMsg', 'showSmartReplies', '_renderContactsThrottled', 'broadcastToTabs',
    't', '_dbg', '_myOtherDevices', '_focusActive', '_attribDevCache', 'MS',
    `${sliceBetween('async function handleIncoming(msg, ackOut) {', '// ===== P2P connection per contact =====')}
     return handleIncoming;`);
  const handleIncoming = fn(
    async (store, key) => {
      if (store === 'contacts') return key === contact.id ? contact : null;
      if (store === 'messages') return stored;
      return null;
    },
    async (store, value) => { puts.push({ store, value }); return true; },
    async () => [contact],
    { has: () => false, add: () => {} },
    async () => decrypt,
    async () => null,
    async () => {}, async () => null, async () => {}, (s) => s,
    null, () => false, () => {}, undefined, () => {},
    () => {}, () => {}, () => {}, () => {},
    (k) => k, () => {}, async () => [], () => false, new Map(),
    { SEC: 1000, MIN: 60000 },
  );
  return { handleIncoming, puts };
}

describe('handleIncoming ackOut (sliced from index.html)', () => {
  const msg = { from: 'c1c1c1c1c1c1', fromPub: PUB1, fromName: 'Alice', payload: 'CT', ts: TS };

  it('sets stored=true after the message is persisted', async () => {
    const { handleIncoming, puts } = buildHandleIncoming();
    const ackOut = {};
    await handleIncoming({ ...msg }, ackOut);
    expect(ackOut.stored).toBe(true);
    expect(puts.some(p => p.store === 'messages' && p.value.text === 'hello text')).toBe(true);
  });

  it('sets stored=true when the message was already persisted (dedup hit)', async () => {
    const existing = { msgId: msg.from + ':' + TS, contactId: msg.from, text: 'hello text', mine: false, ts: TS };
    const { handleIncoming } = buildHandleIncoming({ stored: existing });
    const ackOut = {};
    await handleIncoming({ ...msg }, ackOut);
    expect(ackOut.stored).toBe(true);
  });

  it('does NOT set stored when decryption fails — the copy is dropped, no ack may ride on it', async () => {
    const { handleIncoming, puts } = buildHandleIncoming({ decrypt: null });
    const ackOut = {};
    await handleIncoming({ ...msg }, ackOut);
    expect(ackOut.stored).toBeUndefined();
    expect(puts.some(p => p.store === 'messages')).toBe(false);
  });

  it('without ackOut (relay path) behaviour is unchanged', async () => {
    const { handleIncoming, puts } = buildHandleIncoming();
    await handleIncoming({ ...msg });
    expect(puts.some(p => p.store === 'messages')).toBe(true);
  });
});

// ── Wiring pins ─────────────────────────────────────────────────────
describe('direct-first wiring (index.html / sw.js)', () => {
  it('module is imported and bridged', () => {
    expect(html).toContain("import { createDirectAckWaiter } from './src/app/direct-ack.js';");
    expect(html).toContain('window.__breezeDirectAck = { createDirectAckWaiter };');
    expect(sw).toContain("'/src/app/direct-ack.js'");
  });

  it('sender instantiates the waiter and resolves it from the DC ack branch', () => {
    expect(html).toContain('globalThis.__breezeDirectAck?.createDirectAckWaiter(');
    expect(html).toContain('_directAck?.resolve(contact.pubB64, msg.i)');
  });

  it('both send paths register the expectation BEFORE the direct send', () => {
    const oneToOne = sliceBetween('// P2P direct (preferred)', '// Relay: Sealed Sender');
    expect(oneToOne.indexOf('_directAck?.expect(activeContact.pubB64, ts)'))
      .toBeLessThan(oneToOne.indexOf('peer.dc.send(JSON.stringify(envelope))'));
    expect(html).toContain('_directAck?.expect(m.pubB64, ts)');
  });

  it('the 1:1 deposit is guarded by the ack, and _fanOut sits OUTSIDE the guard', () => {
    const guard = sliceBetween('if (!directAcked) {', '_fanOut(activeContact, text, ts,');
    expect(guard).toContain('await relaySend(activeContact.id,');
    expect(guard).not.toContain('_fanOut(');
  });

  it('receiver acks are gated on confirmed persistence', () => {
    expect(html.match(/if \(ackOut\.stored\) \{ try \{ ch\.send/g)).toHaveLength(3); // msg, file, group_msg
    expect(html).toContain('if (ackOut) ackOut.stored = true;');
  });
});

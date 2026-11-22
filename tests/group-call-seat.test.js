// D25 wave 12 — group calls: seat-device addressing, the generation
// gate, last-wins seat takeover, and the lost-signal mitigations.
// The manager is driven with fake deps and a scripted RTCPeerConnection;
// wrap destinations are observed through the encryptFor fake (the seat
// pub a signal was encrypted to is exactly the addressing decision).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { createGroupCallManager, gcallPairRoom } from '../src/app/group-call.js';

const ME = { id: 'me000000000', pubB64: 'MEPUB', name: 'Me' };
const ANA = { id: 'ana00000000', pubB64: 'ANAPUB', name: 'Ana' };
const BOB = { id: 'bob00000000', pubB64: 'BOBPUB', name: 'Bob' };
const GROUP = { id: 'grp000000001', isGroup: true, name: 'G', members: [ME, ANA, BOB] };

let toasts = [];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function until(fn, timeout = 2500) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { if (fn()) return true; await sleep(10); }
  return fn();
}

class FakePC {
  constructor() { this.signalingState = 'stable'; this.connectionState = 'new'; this.closed = false; }
  addTrack() {}
  async createOffer() { return { type: 'offer', sdp: 'offer-sdp' }; }
  async createAnswer() { return { type: 'answer', sdp: 'answer-sdp' }; }
  async setLocalDescription(d) { this.localDescription = d; this.signalingState = d.type === 'offer' ? 'have-local-offer' : 'stable'; }
  async setRemoteDescription(d) { this.remoteDescription = d; this.signalingState = d.type === 'offer' ? 'have-remote-offer' : 'stable'; }
  async addIceCandidate() {}
  close() { this.closed = true; this.connectionState = 'closed'; }
}

function makeEl() {
  return {
    classList: { add() {}, remove() {}, toggle() {} },
    textContent: '', innerHTML: '',
    srcObject: null, remove() {},
    append() {}, appendChild() {}, setAttribute() {},
  };
}

beforeAll(() => {
  globalThis._dbg = () => {};
  globalThis.CONFIG = { CALL_E2E_SIGNAL: true, CALL_TIMEOUT_MS: 60000 };
  globalThis.MS = { SEC: 20, MIN: 600000, HOUR: 3600000, DAY: 86400000 };
  globalThis.t = (k) => k;
  globalThis.esc = (s) => String(s);
  globalThis.showToast = (msg) => { toasts.push(msg); };
  globalThis._DOM = { get: () => makeEl() };
  globalThis.document = { createElement: () => makeEl(), body: makeEl() };
  const stream = { getTracks: () => [{ kind: 'audio', enabled: true, stop() {} }], getAudioTracks: () => [] };
  Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: { getUserMedia: async () => stream } }, configurable: true, writable: true });
  globalThis.RTCPeerConnection = FakePC;
  globalThis.RTCSessionDescription = class { constructor(d) { Object.assign(this, d); } };
  globalThis.RTCIceCandidate = class { constructor(c) { Object.assign(this, c); } };
});

// Deps modelling a PRIMARY device of account ME unless overridden.
// `calls` records wrap destinations, deposits, copies and signals.
function seatDeps(over = {}) {
  const calls = { deposits: [], signals: [], copies: [], keyDev: [], ownKey: 0, encFor: [] };
  const D = {
    encryptFor: async (pt, pub) => { calls.encFor.push(pub); return 'ENC[' + pub + ']:' + pt; },
    decryptFrom: async (data, pub) => (typeof data === 'string' && data.startsWith('ENC[' + pub + ']:')) ? data.slice(('ENC[' + pub + ']:').length) : null,
    fetchCaps: async (ids) => { const out = {}; for (const id of ids) out[id] = ['call-e2e']; return out; },
    signal: (room, type, data) => { calls.signals.push({ room, type, data }); },
    signalAwait: async () => ({ ok: false, json: async () => ({ messages: [] }) }),
    distributeSenderKey: async () => {},
    encryptGroupMsg: async (g, txt) => 'CT:' + txt,
    relaySend: async (id, env) => { calls.deposits.push(env); },
    iceConfig: () => ({}),
    intervals: [],
    myId: () => 'me000000000', myPubB64: () => 'MEPUB', myName: () => 'Me',
    myAccountId: () => 'me000000000', myAccountPub: () => 'MEPUB',
    acctRoot: () => undefined,
    devicesFor: async (m) => [m.pubB64],
    depositControlCopies: async (members, ct, fields) => { calls.copies.push({ members, ct, fields }); },
    distributeKeyDevices: async (...a) => { calls.keyDev.push(a); },
    distributeOwnKeyDevices: async () => { calls.ownKey++; },
    isBusy: () => false, isSecondary: () => false,
    ...over,
  };
  return { D, calls };
}

const SECONDARY = {
  myId: () => 'dev00000000', myPubB64: () => 'DEVPUB',
  myAccountId: () => 'me000000000', myAccountPub: () => 'MEPUB',
  acctRoot: () => 'MEPUB', isSecondary: () => true,
};
const payloadOf = (env) => JSON.parse(env.payload.slice('CT:'.length));
const joinDeposits = (calls) => calls.deposits.filter(e => payloadOf(e).gctl === 'join');
const leaveDeposits = (calls) => calls.deposits.filter(e => payloadOf(e).gctl === 'leave');

describe('wave 12: seat pub decision (§4)', () => {
  it('wraps offers to a seat dev that verifies against the signed registry', async () => {
    const { D, calls } = seatDeps({ devicesFor: async (m) => m.id === ANA.id ? ['ANAPUB', 'ANADEVPUB'] : [m.pubB64] });
    const m = createGroupCallManager(D);
    m.route(GROUP, ANA, { gctl: 'invite', callId: 'c1', seat: 1, dev: 'ANADEVPUB' });
    await m.joinPending();
    expect(m.state()).toBe('in');
    expect(calls.encFor).toContain('ANADEVPUB');
    expect(calls.encFor).not.toContain('ANAPUB');
    m.endCall(false);
  });

  it('falls back to the root pub when the claimed dev is NOT on the registry', async () => {
    const { D, calls } = seatDeps({ devicesFor: async (m) => [m.pubB64] });
    const m = createGroupCallManager(D);
    m.route(GROUP, ANA, { gctl: 'invite', callId: 'c1', seat: 1, dev: 'ANADEVPUB' });
    await m.joinPending();
    expect(m.state()).toBe('in');
    expect(calls.encFor).toContain('ANAPUB');
    expect(calls.encFor).not.toContain('ANADEVPUB');
    m.endCall(false);
  });

  it('dev === root pub is exactly the legacy path (primary seat)', async () => {
    const { D, calls } = seatDeps({ devicesFor: async (m) => ['ANAPUB', 'ANADEVPUB'] });
    const m = createGroupCallManager(D);
    m.route(GROUP, ANA, { gctl: 'invite', callId: 'c1', seat: 1, dev: 'ANAPUB' });
    await m.joinPending();
    expect(calls.encFor).toContain('ANAPUB');
    expect(calls.encFor).not.toContain('ANADEVPUB');
    m.endCall(false);
  });
});

describe('wave 12: generation gate (audit decision 1)', () => {
  it('a linked device refuses to JOIN when a participant is old-generation', async () => {
    toasts = [];
    const { D, calls } = seatDeps(SECONDARY);
    const m = createGroupCallManager(D);
    m.route(GROUP, ANA, { gctl: 'invite', callId: 'c1' }); // no seat marker: old generation
    expect(m.state()).toBe('ringing');
    await m.joinPending();
    expect(m.state()).toBe('idle');
    expect(joinDeposits(calls)).toHaveLength(0);
    expect(toasts).toContain('gcallGenGate');
  });

  it('a linked device joins when every known participant is new-generation', async () => {
    const { D, calls } = seatDeps(SECONDARY);
    const m = createGroupCallManager(D);
    m.route(GROUP, ANA, { gctl: 'invite', callId: 'c1', seat: 1, dev: 'ANAPUB' });
    await m.joinPending();
    expect(m.state()).toBe('in');
    const joins = joinDeposits(calls);
    expect(joins).toHaveLength(2); // one root deposit per other member
    expect(joins[0].acctRoot).toBe('MEPUB'); // sent under the account root
    expect(payloadOf(joins[0]).dev).toBe('DEVPUB');
    expect(payloadOf(joins[0]).seat).toBe(1);
    m.endCall(false);
  });

  it('a linked device LEAVES honestly when an old-generation member joins mid-call', async () => {
    toasts = [];
    const { D, calls } = seatDeps(SECONDARY);
    const m = createGroupCallManager(D);
    await m.start(GROUP);
    expect(m.state()).toBe('in');
    const callId = payloadOf(calls.deposits[0]).callId;
    m.route(GROUP, BOB, { gctl: 'join', callId }); // old generation: no marker
    expect(m.state()).toBe('idle');
    expect(toasts).toContain('gcallGenGate');
    expect(await until(() => leaveDeposits(calls).length > 0)).toBe(true); // the leave rides out async
  });

  it('a PRIMARY seat is not gated: an old-generation join is business as usual', async () => {
    const { D, calls } = seatDeps();
    const m = createGroupCallManager(D);
    await m.start(GROUP);
    const callId = payloadOf(calls.deposits[0]).callId;
    m.route(GROUP, BOB, { gctl: 'join', callId });
    expect(m.state()).toBe('in');
    await sleep(50);
    expect(leaveDeposits(calls)).toHaveLength(0);
    m.endCall(false);
  });
});

describe('wave 12: last-wins seat rule (§3.4)', () => {
  it('my other device joining takes the seat: I stand down WITHOUT a leave', async () => {
    const { D, calls } = seatDeps();
    const m = createGroupCallManager(D);
    await m.start(GROUP);
    expect(m.state()).toBe('in');
    const callId = payloadOf(calls.deposits[0]).callId;
    m.route(GROUP, ME, { gctl: 'join', callId, seat: 1, dev: 'OTHERDEVPUB' });
    expect(m.state()).toBe('idle');
    await sleep(50);
    expect(leaveDeposits(calls)).toHaveLength(0); // the account stays seated
    expect(calls.signals.filter(s => s.type === 'gcall-end')).toHaveLength(0);
  });

  it('an own-account join elsewhere stops the ring here', async () => {
    const { D } = seatDeps();
    const m = createGroupCallManager(D);
    m.route(GROUP, ANA, { gctl: 'invite', callId: 'c9', seat: 1, dev: 'ANAPUB' });
    expect(m.state()).toBe('ringing');
    m.route(GROUP, ME, { gctl: 'join', callId: 'c9', seat: 1, dev: 'OTHERDEVPUB' });
    expect(m.state()).toBe('idle');
  });

  it('my own echo (same device pub) never disturbs my seat', async () => {
    const { D, calls } = seatDeps();
    const m = createGroupCallManager(D);
    await m.start(GROUP);
    const callId = payloadOf(calls.deposits[0]).callId;
    m.route(GROUP, ME, { gctl: 'join', callId, seat: 1, dev: 'MEPUB' }); // my own pub
    expect(m.state()).toBe('in');
    m.endCall(false);
  });
});

describe('wave 12: lost-signal mitigations (§3.4)', () => {
  it('re-sends an unanswered offer exactly once, a few seconds after entering', async () => {
    const { D, calls } = seatDeps();
    const m = createGroupCallManager(D);
    m.route(GROUP, ANA, { gctl: 'invite', callId: 'c1', seat: 1, dev: 'ANAPUB' });
    await m.joinPending();
    const room = gcallPairRoom(GROUP.id, ME.id, ANA.id);
    const offers = () => calls.signals.filter(s => s.room === room && s.type === 'gcall-offer').length;
    expect(offers()).toBe(1);
    expect(await until(() => offers() === 2)).toBe(true);
    await sleep(200);
    expect(offers()).toBe(2); // once only
    m.endCall(false);
  });

  it('re-answers a repeated offer when the leg already answered (answer was eaten)', async () => {
    const queues = new Map();
    const { D, calls } = seatDeps({
      signalAwait: async (room) => {
        const q = queues.get(room) || [];
        const msgs = q.length ? q.shift() : [];
        return { ok: true, json: async () => ({ messages: msgs }) };
      },
    });
    const m = createGroupCallManager(D);
    await m.start(GROUP);
    const callId = payloadOf(calls.deposits[0]).callId;
    m.route(GROUP, ANA, { gctl: 'join', callId, seat: 1, dev: 'ANAPUB' });
    const room = gcallPairRoom(GROUP.id, ME.id, ANA.id);
    const offerMsg = { sender: ANA.id, type: 'gcall-offer', data: JSON.stringify({ sdp: { type: 'offer', sdp: 'sdp-a' }, callId }) };
    const answers = () => calls.signals.filter(s => s.room === room && s.type === 'gcall-answer').length;
    queues.set(room, [[offerMsg]]);
    expect(await until(() => answers() === 1)).toBe(true);
    queues.set(room, [[offerMsg]]); // the same offer again: my answer never arrived
    expect(await until(() => answers() === 2)).toBe(true);
    m.endCall(false);
  });
});

describe('wave 12: control from a linked device (§3.1/§3.2)', () => {
  it('start from a secondary deposits device copies and distributes keys to devices', async () => {
    const { D, calls } = seatDeps(SECONDARY);
    const m = createGroupCallManager(D);
    await m.start(GROUP);
    expect(m.state()).toBe('in');
    expect(calls.copies).toHaveLength(1);
    expect(calls.copies[0].members.map(x => x.id)).toEqual([ANA.id, BOB.id]);
    expect(calls.copies[0].fields.groupId).toBe(GROUP.id);
    expect(calls.keyDev.map(a => a[1].id)).toEqual([ANA.id, BOB.id]); // per-member device key distribution
    expect(calls.ownKey).toBe(1); // own key to my other devices
    expect(calls.deposits).toHaveLength(2);
    expect(calls.deposits[0].acctRoot).toBe('MEPUB');
    m.endCall(false);
  });
});

describe('wave 12: host wiring pins', () => {
  it('index.html wires account identity + control copies into the manager', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).toContain('depositControlCopies: (members, ct, fields) => _groupLive?.depositCopies(members, ct, { ...fields, gctl: true })');
    expect(html).toContain('myAccountId: () => (_myAcctRoot ? _myAcctRoot.slice(0, 12) : myId)');
    expect(html).toContain('myAccountPub: () => _myAcctRoot || myPubB64');
    expect(html).toContain('gcallGenGate:');
    const mod = readFileSync(new URL('../src/app/group-call.js', import.meta.url), 'utf8');
    expect(mod).toContain("t('gcallGenGate')");
    expect(mod).not.toContain("showToast(t('groupPrimaryOnly'), 'error'); return;");
    for (const loc of ['es', 'id', 'ja', 'ko', 'pt-BR', 'th', 'zh-TW']) {
      const j = JSON.parse(readFileSync(new URL('../locales/' + loc + '.json', import.meta.url), 'utf8'));
      expect(typeof j.gcallGenGate, loc).toBe('string');
    }
  });
});

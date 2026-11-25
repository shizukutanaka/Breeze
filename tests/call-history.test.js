import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { sanitizeCallRecord, finalizeCallRecord, missedUnseenCount, formatCallDuration, createCallHistory, CALL_HISTORY_MAX } from '../src/app/call-history.js';
import { createCallManager } from '../src/app/call.js';

// Call history (2026-11-25, owner request): 1:1 calls are recorded to
// the on-device 'calls' IDB store (DB v6) by src/app/call-history.js,
// fed by lifecycle events from src/app/call.js. Records never leave
// the device: no relay send exists in the module, and the backup
// payload (identity / contacts / messages / key material) does not
// include them — the audit log / settings category, not the message
// category. The Calls bottom tab renders the store into the sidebar
// list; unseen missed calls drive its badge.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const callJs = readFileSync(new URL('../src/app/call.js', import.meta.url), 'utf8');
const backupJs = readFileSync(new URL('../src/app/backup.js', import.meta.url), 'utf8');

// ---- fake DOM (the slice of DOM the module + call UI touch) ----
class FakeEl {
  constructor(tag = 'div') {
    this.tagName = tag; this.children = []; this.className = ''; this.textContent = '';
    this.attrs = {}; this.onclick = null; this._html = '';
    this.classList = { add() {}, remove() {}, contains: () => false, toggle() {} };
  }
  setAttribute(k, v) { this.attrs[k] = v; }
  appendChild(c) { this.children.push(c); return c; }
  append(...cs) { this.children.push(...cs); }
  replaceChildren(frag) { this.children = frag ? [...frag.children] : []; this.replaced = true; }
  remove() {}
}

const saved = {};
function setGlobal(k, v) {
  if (!(k in saved)) saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
  Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
}
function restoreGlobals() {
  for (const [k, d] of Object.entries(saved)) {
    if (d === undefined) delete globalThis[k];
    else Object.defineProperty(globalThis, k, d);
    delete saved[k];
  }
}

function fakeDb() {
  let nextId = 1;
  const stores = { calls: [], contacts: [] };
  return {
    stores,
    dbPut: async (store, val) => {
      if (val.id == null) val.id = nextId++;
      const i = stores[store].findIndex(r => r.id === val.id);
      if (i >= 0) stores[store][i] = val; else stores[store].push(val);
      return true;
    },
    dbGetAll: async (store) => [...stores[store]],
    dbDel: async (store, id) => { stores[store] = stores[store].filter(r => r.id !== id); },
  };
}

describe('call history — pure record logic', () => {
  it('sanitize keeps a well-formed record and normalizes types', () => {
    const r = sanitizeCallRecord({ id: 7, contactId: 'c1', name: 'Ada', dir: 'in', video: 1, ts: 1234.7, durationSec: 65.9, seen: 0 });
    expect(r).toEqual({ id: 7, contactId: 'c1', name: 'Ada', dir: 'in', video: true, ts: 1234, durationSec: 65, seen: false });
  });
  it('sanitize drops malformed records instead of storing them', () => {
    expect(sanitizeCallRecord(null)).toBeNull();
    expect(sanitizeCallRecord({ dir: 'out', ts: 5 })).toBeNull(); // no contactId
    expect(sanitizeCallRecord({ contactId: 'c', dir: 'sideways', ts: 5 })).toBeNull();
    expect(sanitizeCallRecord({ contactId: 'c', dir: 'out', ts: 0 })).toBeNull();
    expect(sanitizeCallRecord({ contactId: 'c', dir: 'out', ts: 5, durationSec: 999999 }).durationSec).toBe(86400);
  });
  it('finalize: an answered outgoing call records its duration', () => {
    const r = finalizeCallRecord({ contactId: 'c1', name: 'Ada', dir: 'out', video: false, startTs: 1000, connectedAt: 61000 }, 121000);
    expect(r).toMatchObject({ dir: 'out', durationSec: 60, seen: true, ts: 1000 });
  });
  it('finalize: an unanswered outgoing call is out with zero duration', () => {
    const r = finalizeCallRecord({ contactId: 'c1', dir: 'out', video: false, startTs: 1000, connectedAt: 0 }, 61000);
    expect(r).toMatchObject({ dir: 'out', durationSec: 0, seen: true });
  });
  it('finalize: an answered incoming call is in, an unanswered one is missed and unseen', () => {
    expect(finalizeCallRecord({ contactId: 'c1', dir: 'in', startTs: 1000, connectedAt: 5000 }, 65000))
      .toMatchObject({ dir: 'in', durationSec: 60, seen: true });
    expect(finalizeCallRecord({ contactId: 'c1', dir: 'in', startTs: 1000, connectedAt: 0 }, 60000))
      .toMatchObject({ dir: 'missed', durationSec: 0, seen: false });
  });
  it('missedUnseenCount counts only unseen missed calls', () => {
    expect(missedUnseenCount([
      { dir: 'missed', seen: false }, { dir: 'missed', seen: true },
      { dir: 'missed', seen: false }, { dir: 'out', seen: false }, { dir: 'in', seen: false },
    ])).toBe(2);
    expect(missedUnseenCount([])).toBe(0);
    expect(missedUnseenCount(null)).toBe(0);
  });
  it('formatCallDuration renders m:ss and h:mm:ss', () => {
    expect(formatCallDuration(0)).toBe('0:00');
    expect(formatCallDuration(7)).toBe('0:07');
    expect(formatCallDuration(65)).toBe('1:05');
    expect(formatCallDuration(3600)).toBe('1:00:00');
    expect(formatCallDuration(3661)).toBe('1:01:01');
    expect(formatCallDuration(-3)).toBe('0:00');
  });
});

describe('call history — factory (events → store → badge → list)', () => {
  let db, badge, listEl, hist, opened, calledBack, confirmAnswer;
  beforeEach(() => {
    db = fakeDb();
    badge = new FakeEl(); listEl = new FakeEl();
    const selfCard = new FakeEl();
    setGlobal('_DOM', { get: (id) => ({ 'tab-badge-calls': badge, 'msg-contacts': listEl, 'msg-self-card': selfCard })[id] || null });
    setGlobal('document', { createElement: (t) => new FakeEl(t), createDocumentFragment: () => new FakeEl('frag'), addEventListener() {}, body: new FakeEl('body') });
    setGlobal('t', (k) => k);
    setGlobal('esc', (s) => String(s ?? ''));
    setGlobal('safeSetHTML', (el, h) => { el._html = h; });
    setGlobal('showToast', () => {});
    setGlobal('_dbg', () => {});
    confirmAnswer = true;
    setGlobal('showConfirm', async () => confirmAnswer);
    opened = []; calledBack = [];
    let logOn = true;
    hist = createCallHistory({
      ...db,
      openConversation: (c) => opened.push(c),
      startCall: (c, v) => calledBack.push([c, v]),
      contactDisplayName: (c) => c.name,
      listTime: () => '12:00',
      loggingEnabled: () => logOn,
      isCallsView: () => false,
    });
    hist._setLog = (v) => { logOn = v; };
  });
  afterEach(() => restoreGlobals());

  const outCall = async (h, { connect = true } = {}) => {
    await h.onCallEvent({ kind: 'start', dir: 'out', contactId: 'c1', name: 'Ada', video: false, ts: 1000 });
    if (connect) await h.onCallEvent({ kind: 'connected', ts: 11000 });
    await h.onCallEvent({ kind: 'end', ts: 71000 });
  };

  it('records an answered outgoing call with its duration', async () => {
    await outCall(hist);
    expect(db.stores.calls).toHaveLength(1);
    expect(db.stores.calls[0]).toMatchObject({ contactId: 'c1', dir: 'out', durationSec: 60, seen: true });
  });
  it('records an unanswered outgoing call with zero duration', async () => {
    await outCall(hist, { connect: false });
    expect(db.stores.calls[0]).toMatchObject({ dir: 'out', durationSec: 0 });
  });
  it('records an answered incoming call as in', async () => {
    await hist.onCallEvent({ kind: 'start', dir: 'in', contactId: 'c2', name: 'Bo', video: true, ts: 2000 });
    await hist.onCallEvent({ kind: 'connected', ts: 5000 });
    await hist.onCallEvent({ kind: 'end', ts: 35000 });
    expect(db.stores.calls[0]).toMatchObject({ dir: 'in', durationSec: 30, video: true });
  });
  it('records an unanswered incoming call as missed and raises the badge', async () => {
    await hist.onCallEvent({ kind: 'start', dir: 'in', contactId: 'c2', name: 'Bo', video: false, ts: 2000 });
    await hist.onCallEvent({ kind: 'end', ts: 62000 });
    expect(db.stores.calls[0]).toMatchObject({ dir: 'missed', seen: false });
    expect(badge.textContent).toBe(1);
  });
  it('an end with no start (mic denied before the offer) records nothing', async () => {
    await hist.onCallEvent({ kind: 'end', ts: 5000 });
    expect(db.stores.calls).toHaveLength(0);
  });
  it('recording off (Settings → Privacy) stores nothing', async () => {
    hist._setLog(false);
    await outCall(hist);
    expect(db.stores.calls).toHaveLength(0);
  });
  it('rendering the list marks missed calls seen and clears the badge', async () => {
    await hist.onCallEvent({ kind: 'start', dir: 'in', contactId: 'c2', name: 'Bo', video: false, ts: 2000 });
    await hist.onCallEvent({ kind: 'end', ts: 62000 });
    expect(badge.textContent).toBe(1);
    await hist.render();
    expect(db.stores.calls[0].seen).toBe(true);
    expect(badge.textContent).toBe('');
    expect(listEl.replaced).toBe(true);
  });
  it('rows open the conversation, and the call-back button redials with the recorded media kind', async () => {
    db.stores.contacts.push({ id: 'c1', name: 'Ada' });
    await hist.onCallEvent({ kind: 'start', dir: 'in', contactId: 'c1', name: 'Ada', video: true, ts: 2000 });
    await hist.onCallEvent({ kind: 'connected', ts: 3000 });
    await hist.onCallEvent({ kind: 'end', ts: 9000 });
    await hist.render();
    const row = listEl.children.find(c => c.className === 'contact');
    expect(row).toBeTruthy();
    expect(row._html).toContain('Ada');
    expect(row._html).toContain('callIncoming');
    row.onclick();
    expect(opened).toHaveLength(1);
    expect(opened[0].id).toBe('c1');
    const cb = row.children.find(c => c.className.includes('call-back-btn'));
    expect(cb).toBeTruthy();
    cb.onclick({ stopPropagation() {} });
    expect(calledBack).toEqual([[{ id: 'c1', name: 'Ada' }, true]]);
    expect(opened).toHaveLength(1); // stopPropagation kept the row handler out
  });
  it('clear-all empties the store after confirmation, and does nothing when declined', async () => {
    await outCall(hist);
    await outCall(hist);
    expect(db.stores.calls).toHaveLength(2);
    confirmAnswer = false;
    await hist.clearAll();
    expect(db.stores.calls).toHaveLength(2);
    confirmAnswer = true;
    await hist.clearAll();
    expect(db.stores.calls).toHaveLength(0);
  });
  it('history is pruned to the newest CALL_HISTORY_MAX records on write', async () => {
    for (let i = 0; i < CALL_HISTORY_MAX + 5; i++) {
      await db.dbPut('calls', { contactId: 'c1', name: 'Ada', dir: 'out', video: false, ts: 1000 + i, durationSec: 0, seen: true });
    }
    await outCall(hist);
    expect(db.stores.calls.length).toBe(CALL_HISTORY_MAX);
    expect(Math.min(...db.stores.calls.map(r => r.ts))).toBeGreaterThan(1000);
  });
});

describe('call manager emits the history lifecycle events (src/app/call.js)', () => {
  let events, pcs;
  beforeEach(() => {
    events = []; pcs = [];
    setGlobal('window', globalThis);
    setGlobal('_dbg', () => {});
    setGlobal('showToast', () => {});
    setGlobal('t', (k) => k);
    setGlobal('_DOM', { get: () => null });
    setGlobal('CONFIG', { CALL_E2E_SIGNAL: false, CALL_TIMEOUT_MS: 60000, ICE_CANDIDATE_POOL_SIZE: 0 });
    setGlobal('MS', { SEC: 1000 });
    setGlobal('API', null);
    setGlobal('_turnCredential', null);
    setGlobal('document', { createElement: (t) => new FakeEl(t), addEventListener() {}, body: new FakeEl('body') });
    setGlobal('navigator', { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [] }) } });
    class FakePC {
      constructor() { this.connectionState = 'new'; this.signalingState = 'stable'; pcs.push(this); }
      addTrack() {} getTransceivers() { return []; }
      async createOffer() { return { type: 'offer', sdp: 'v=0' }; }
      async createAnswer() { return { type: 'answer', sdp: 'v=0' }; }
      async setLocalDescription() {} async setRemoteDescription() {} async addIceCandidate() {}
      close() {}
    }
    setGlobal('RTCPeerConnection', FakePC);
    setGlobal('MediaStream', class { getTracks() { return []; } addTrack() {} });
    setGlobal('RTCSessionDescription', class { constructor(d) { Object.assign(this, d); } });
  });
  afterEach(() => { restoreGlobals(); vi.useRealTimers(); });

  const deps = () => ({
    encryptFor: async (pt) => pt, decryptFrom: async (d) => d, fetchCaps: async () => ({}),
    _signal: () => {}, _signalAwait: async () => ({ ok: false, json: async () => ({ messages: [] }) }),
    relaySend: async () => {}, _intervals: [], _ac: { signal: undefined }, _settings: {},
    myId: () => 'me000000000', myPubB64: () => 'PUB', myName: () => 'Me',
    onCallEvent: (e) => { events.push(e); },
  });
  const contact = { id: 'c1', name: 'Ada', pubB64: 'PEERPUB' };

  it('an incoming offer emits start(in) at ring time and end at hangup', async () => {
    const m = createCallManager(deps());
    await m.handleCallOffer(contact, JSON.stringify({ sdp: { type: 'offer', sdp: 'v=0' }, video: true }));
    expect(m.state()).toBe('ringing');
    expect(events[0]).toMatchObject({ kind: 'start', dir: 'in', contactId: 'c1', video: true });
    m.endCall();
    expect(events[1]).toMatchObject({ kind: 'end' });
    expect(m.state()).toBe('idle');
  });
  it('an outgoing call emits start(out) once the offer is sent, connected on connect, end at hangup', async () => {
    vi.useFakeTimers();
    const m = createCallManager(deps());
    await m.startCall(contact, false);
    expect(events.filter(e => e.kind === 'start')).toEqual([expect.objectContaining({ dir: 'out', contactId: 'c1', video: false })]);
    const pc = pcs[0];
    pc.connectionState = 'connected';
    pc.onconnectionstatechange();
    expect(events.map(e => e.kind)).toEqual(['start', 'connected']);
    m.endCall();
    expect(events.map(e => e.kind)).toEqual(['start', 'connected', 'end']);
  });
  it('a call that fails before the offer (no media) emits no start', async () => {
    setGlobal('navigator', { mediaDevices: { getUserMedia: async () => { throw new Error('denied'); } } });
    const m = createCallManager(deps());
    await m.startCall(contact, false);
    expect(events.filter(e => e.kind === 'start')).toHaveLength(0);
    expect(m.state()).toBe('idle');
  });
});

describe('call history wiring (index.html / sw.js / backup scope)', () => {
  it('the calls store is created by the DB v6 upgrade', () => {
    expect(html).toContain('const DB_VER = 6;');
    expect(html).toContain("d.createObjectStore('calls', { keyPath: 'id', autoIncrement: true })");
    expect(html).toContain("cs.createIndex('ts', 'ts', { unique: false })");
    expect(html).toContain("cs.createIndex('contact', 'contactId', { unique: false })");
  });
  it('the module bridge is imported and precached for offline boot', () => {
    expect(html).toContain("import { createCallHistory } from './src/app/call-history.js'; window.__breezeCallHistory = { createCallHistory };");
    expect(sw).toContain("'/src/app/call-history.js'");
  });
  it('the classic script wires events, deps and the calls list mode', () => {
    expect(html).toContain('onCallEvent: (e) => globalThis.__breezeCallHistoryUI?.onCallEvent(e)');
    expect(html).toContain("globalThis.__breezeCallHistory?.createCallHistory({");
    expect(html).toContain("loggingEnabled: () => _settings.callHistoryLog !== false");
    expect(html).toContain("if (_listTab === 'calls') { await globalThis.__breezeCallHistoryUI?.render(); return; }");
  });
  it('call.js reports exactly the four lifecycle points', () => {
    expect(callJs).toContain("_hist('start', { dir: 'out'");
    expect(callJs).toContain("_hist('start', { dir: 'in'");
    expect(callJs.match(/_hist\('connected'/g)).toHaveLength(2); // caller + callee connection handlers
    expect(callJs).toContain("_hist('end', { ts: Date.now() });");
  });
  it('call history stays out of the backup payload (device-local, like the audit log)', () => {
    expect(backupJs).not.toContain("dbGetAll('calls')");
    expect(backupJs).not.toContain('data.calls');
  });
});

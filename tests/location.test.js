// SHARE_PLAN stage 5 step 6 — location sharing: coordinate
// validation, wire payloads, live-session shapes, wiring pins,
// and the server-blindness audit.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CAPS_LOC, sanitizeLoc, buildLocationPayload, parseLocationPayload,
  groupTextForLocation, parseGroupLocationText, osmUrl, locLabel, liveRecordId,
  createLocationShare,
} from '../src/app/location.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

describe('coordinate validation', () => {
  it('accepts and rounds real coordinates', () => {
    expect(sanitizeLoc({ lat: 35.68123456, lng: 139.76712344, acc: 12.6 }))
      .toEqual({ lat: 35.681235, lng: 139.767123, acc: 13 });
    expect(sanitizeLoc({ lat: -33.86, lng: 151.21 })).toEqual({ lat: -33.86, lng: 151.21 });
  });

  it('rejects out-of-range and non-numeric input', () => {
    expect(sanitizeLoc({ lat: 91, lng: 0 })).toBeNull();
    expect(sanitizeLoc({ lat: 0, lng: -181 })).toBeNull();
    expect(sanitizeLoc({ lat: 'x', lng: 0 })).toBeNull();
    expect(sanitizeLoc({ lat: NaN, lng: 0 })).toBeNull();
    expect(sanitizeLoc(null)).toBeNull();
    // An absurd accuracy is dropped, not fatal.
    expect(sanitizeLoc({ lat: 1, lng: 2, acc: 999999 })).toEqual({ lat: 1, lng: 2 });
  });
});

describe('wire payloads', () => {
  it('one-shot round-trips', () => {
    const wire = buildLocationPayload({ loc: { lat: 35.68, lng: 139.77, acc: 10 } });
    expect(parseLocationPayload(wire)).toEqual({ loc: { lat: 35.68, lng: 139.77, acc: 10 } });
    expect(parseLocationPayload('{"type":"sticker","v":1}')).toBeNull();
  });

  it('live payloads carry the session; stopped needs no coordinates', () => {
    const wire = buildLocationPayload({ loc: { lat: 1, lng: 2 }, live: 'abc123', seq: 3, until: 9999 });
    expect(parseLocationPayload(wire)).toEqual({ loc: { lat: 1, lng: 2 }, live: 'abc123', seq: 3, until: 9999 });
    const stop = buildLocationPayload({ live: 'abc123', stopped: true });
    expect(parseLocationPayload(stop)).toEqual({ live: 'abc123', stopped: true });
    expect(buildLocationPayload({ stopped: true })).toBeNull();
  });

  it('group text round-trips; ordinary text never parses', () => {
    const wire = groupTextForLocation({ loc: { lat: 1, lng: 2 } });
    expect(wire.startsWith('{"loc":')).toBe(true);
    expect(parseGroupLocationText(wire)).toEqual({ loc: { lat: 1, lng: 2 } });
    expect(parseGroupLocationText('{"stk":{}}')).toBeNull();
    expect(parseGroupLocationText('hello')).toBeNull();
  });

  it('labels, map links and deterministic live record ids', () => {
    expect(locLabel({ lat: 35.68123, lng: 139.76712 })).toBe('📍 35.68123, 139.76712');
    expect(osmUrl({ lat: 35.68, lng: 139.77 })).toContain('openstreetmap.org/?mlat=35.68&mlon=139.77');
    expect(liveRecordId('alice1234567', 's1')).toBe('live:alice1234567:s1');
  });
});

describe('stage 5 step 6 wiring + server-blindness audit', () => {
  it('the capability is advertised and gates sending', () => {
    expect(html).toContain("const CAPS_LOC = 'loc-v1';");
    expect(html).toContain('caps.push(CAPS_LOC);');
    expect(CAPS_LOC).toBe('loc-v1');
  });

  it('the relay never sees location content (the flag alone is ferried, like isVoice)', () => {
    expect(worker).not.toContain('loc-v1');
    expect(worker).not.toContain('sanitizeLoc');
    expect(worker).not.toContain('openstreetmap');
    // Stage 6 step 2 added the opaque pass-through so the flag
    // survives the plain fallback; coordinates never leave the
    // encrypted payload.
    expect(worker).toContain('if (body.isLocation === true) msg.isLocation = true;');
  });

  it('live sessions are in-memory with a stop path that clears the timer first', () => {
    const mod = readFileSync(new URL('../src/app/location.js', import.meta.url), 'utf8');
    expect(mod).toContain('const _liveShares = new Map();');
    expect(mod).toContain('function _stopLiveShare(contactId, silent)');
    const stop = mod.slice(mod.indexOf('function _stopLiveShare'), mod.indexOf('function _stopLiveShare') + 900);
    expect(stop.indexOf('clearInterval')).toBeLessThan(stop.indexOf('stopped: true'));
  });

  it('the module is bridged and precached', () => {
    expect(html).toContain("from './src/app/location.js';");
    expect(sw).toContain("'/src/app/location.js'");
  });
});

// Round-7 re-audit: every engine function that touched the wire
// helpers opened with `const L = L;` — a self-reference inside its
// own temporal dead zone, so it threw "Cannot access 'L' before
// initialization" on entry. Sending never left the device, an
// incoming share was dropped by handleIncoming's catch, and a
// group `{"loc":…}` document threw out of the group receive path
// before it could be stored. The suite above only covers the pure
// helpers and source pins, so nothing ran the engine. These tests
// run the real factory end to end over in-memory stand-ins.
describe('location engine runs (send, receive, render)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function host({ me = 'alice', contacts = [], active = null, caps = {} } = {}) {
    const stores = { contacts: new Map(contacts.map(c => [c.id, c])), messages: new Map() };
    const sent = [], appended = [], toasts = [], errors = [];
    const replay = new Set();
    let lastSendTs = 0;
    const buttons = {};
    const dlg = { close() {}, remove() {}, querySelector: (sel) => (buttons[sel] ||= {}) };
    const ui = createLocationShare({
      dbGet: async (store, id) => stores[store].get(id),
      dbPut: async (store, rec) => { stores[store].set(store === 'messages' ? rec.msgId : rec.id, rec); },
      encryptFor: async (text) => 'enc:' + text,
      relaySend: async (to, env) => { sent.push(env); },
      sendGroupTransport: async (c, wire) => { sent.push({ group: c.id, wire }); return true; },
      fanOut: () => {}, fetchMemberCapsBatch: async (ids) => Object.fromEntries(ids.map(id => [id, caps[id] || []])),
      sendTextFallback: async (text) => { sent.push({ fallback: text }); },
      showToast: (msg, kind) => toasts.push([msg, kind]), t: (k) => k, esc: escHtml,
      safeSetHTML: () => {}, appendMsg: (...a) => appended.push(a),
      shouldAlert: () => false, renderContactsThrottled: () => {}, playNotif: () => {}, playSendSound: () => {}, hapticSend: () => {},
      makeDialog: () => [dlg, 'title'], showDialog: () => {}, wireDialogDismiss: () => {},
      domGet: () => null, correctedNow: () => 1700000000000, dbg: (e) => errors.push(e), MS: { SEC: 1000, MIN: 60000 },
      activeContact: () => active, activeId: () => active?.id,
      myId: () => me, myName: () => me, myPubB64: () => 'pub-' + me,
      isSecondary: () => false, replayCache: () => replay, intervals: () => [],
      lastSendTs: () => lastSendTs, setLastSendTs: (v) => { lastSendTs = v; },
    });
    return { ui, stores, sent, appended, toasts, errors, buttons };
  }
  const settle = () => new Promise((r) => setTimeout(r, 20));
  const stubGeo = () => vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (ok) => ok({ coords: { latitude: 35.681236, longitude: 139.767125, accuracy: 12 } }) } });

  it('renders a location card instead of throwing', () => {
    const { ui } = host();
    const card = ui.locCardInner({ loc: { lat: 35.681236, lng: 139.767125, acc: 12 } });
    expect(card).toContain('35.68124, 139.76712');
    expect(card).toContain('±12 m');
    expect(card).toContain('href="https://www.openstreetmap.org/?mlat=35.681236&amp;mlon=139.767125#map=16/35.681236/139.767125"');
    expect(ui.locCardInner({ loc: { lat: 'x', lng: 1 } })).toBe('');
  });

  it('a card built from hostile record fields carries no markup', () => {
    const { ui } = host();
    const card = ui.locCardInner({ loc: { lat: '1"><img src=x onerror=alert(1)>', lng: 2 }, liveUntil: '<script>' });
    expect(card).toBe('');
    const card2 = ui.locCardInner({ loc: { lat: 1, lng: 2, acc: '5<b>' }, liveUntil: Date.now() + 60000 });
    expect(card2).not.toContain('<b>5');
    expect(card2).not.toMatch(/onerror|<script|<img/i);
  });

  it('sends a one-shot share and the receiver stores it', async () => {
    stubGeo();
    const bob = { id: 'bob', name: 'Bob', pubB64: 'pub-bob' };
    const a = host({ me: 'alice', contacts: [bob], active: bob, caps: { bob: [CAPS_LOC] } });
    await a.ui.showPanel();
    a.buttons['.loc-once'].onclick();
    await settle();
    expect(a.errors).toEqual([]);
    expect(a.sent).toHaveLength(1);
    expect(a.sent[0]).toMatchObject({ to: 'bob', from: 'alice', isLocation: true, ts: 1700000000000 });
    expect(a.stores.messages.get('alice:1700000000000')).toMatchObject({ mine: true, loc: { lat: 35.681236, lng: 139.767125, acc: 12 } });

    const alice = { id: 'alice', name: 'Alice', pubB64: 'pub-alice' };
    const b = host({ me: 'bob', contacts: [alice] });
    const p = parseLocationPayload(a.sent[0].payload.slice(4));
    await b.ui.applyLocation('alice', 'alice', p, a.sent[0].ts, null);
    expect(b.stores.messages.get('alice:1700000000000')).toMatchObject({ contactId: 'alice', mine: false, loc: { lat: 35.681236, lng: 139.767125, acc: 12 } });
    expect(b.stores.contacts.get('alice')).toMatchObject({ unread: 1, lastMsgAt: 1700000000000 });
    // The same share delivered again (relay + direct copy) stays one message.
    await b.ui.applyLocation('alice', 'alice', p, a.sent[0].ts, null);
    expect(b.stores.messages.size).toBe(1);
    expect(b.stores.contacts.get('alice').unread).toBe(1);
  });

  it('a one-shot share to a peer without the capability degrades to a text link', async () => {
    stubGeo();
    const bob = { id: 'bob', name: 'Bob', pubB64: 'pub-bob' };
    const a = host({ contacts: [bob], active: bob });
    await a.ui.showPanel();
    a.buttons['.loc-once'].onclick();
    await settle();
    expect(a.errors).toEqual([]);
    expect(a.sent).toEqual([{ fallback: '📍 https://www.openstreetmap.org/?mlat=35.681236&mlon=139.767125#map=16/35.681236/139.767125' }]);
  });

  it('a group share goes out on the sender-key channel', async () => {
    stubGeo();
    const g = { id: 'g_1', name: 'G', isGroup: true, members: [{ id: 'alice', caps: [CAPS_LOC] }, { id: 'bob', caps: [CAPS_LOC] }] };
    const a = host({ contacts: [g], active: g });
    await a.ui.showPanel();
    a.buttons['.loc-once'].onclick();
    await settle();
    expect(a.errors).toEqual([]);
    expect(a.sent).toHaveLength(1);
    expect(parseGroupLocationText(a.sent[0].wire)).toEqual({ loc: { lat: 35.681236, lng: 139.767125, acc: 12 } });
  });

  it('live updates collapse into one record, ignore stale updates, and a stop is final', async () => {
    const alice = { id: 'alice', name: 'Alice', pubB64: 'pub-alice' };
    const b = host({ me: 'bob', contacts: [alice] });
    const upd = (lat, seq) => parseLocationPayload(buildLocationPayload({ loc: { lat, lng: 2 }, live: 'sid1', seq, until: 1700000900000 }));
    await b.ui.applyLocation('alice', 'alice', upd(1, 0), 1, null);
    await b.ui.applyLocation('alice', 'alice', upd(3, 2), 3, null);
    await b.ui.applyLocation('alice', 'alice', upd(2, 1), 2, null); // arrives late
    const id = liveRecordId('alice', 'sid1');
    expect(b.stores.messages.size).toBe(1);
    expect(b.stores.messages.get(id)).toMatchObject({ loc: { lat: 3, lng: 2 }, liveSeq: 2, liveUntil: 1700000900000 });
    expect(b.stores.contacts.get('alice').unread).toBe(1);
    await b.ui.applyLocation('alice', 'alice', parseLocationPayload(buildLocationPayload({ live: 'sid1', stopped: true })), 4, null);
    expect(b.stores.messages.get(id).liveEnded).toBe(true);
    await b.ui.applyLocation('alice', 'alice', upd(9, 9), 5, null);
    expect(b.stores.messages.get(id)).toMatchObject({ loc: { lat: 3, lng: 2 }, liveEnded: true });
    expect(b.ui.locCardInner(b.stores.messages.get(id))).toContain('locLiveEnded');
  });
});

// Local room gate (on-the-spot server, 2026-11-27 design): the
// server-required gate has two extra entries — start a server on this
// device (stage 1), and, on a 1-to-1 invite landing, join the
// inviter's room (stage 2). The room record lives in settings; an
// active room satisfies the gate exactly like a home relay does, and
// stopping/leaving re-arms the gate when no relay exists. The actions
// live in src/app/local-room.js; the settings panel shows the room as
// a row in the servers section — under the inviter's name for a
// joined room, never as the user's own server.
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { settingsPanelHtml } from '../src/app/settings-panel.js';
import { inviteHostName, createLocalRoomActions } from '../src/app/local-room.js';

const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function sliceBetween(startMarker, endMarker) {
  const start = INDEX.indexOf(startMarker);
  const end = INDEX.indexOf(endMarker, start);
  expect(start, `marker ${startMarker}`).toBeGreaterThan(-1);
  expect(end, `marker ${endMarker}`).toBeGreaterThan(start);
  return INDEX.slice(start, end);
}

const oldFlag = globalThis.__BREEZE_NO_DEFAULT_SERVER__;
const oldRoom = globalThis.__breezeLocalRoom;
afterEach(() => {
  if (oldFlag === undefined) delete globalThis.__BREEZE_NO_DEFAULT_SERVER__;
  else globalThis.__BREEZE_NO_DEFAULT_SERVER__ = oldFlag;
  if (oldRoom === undefined) delete globalThis.__breezeLocalRoom;
  else globalThis.__breezeLocalRoom = oldRoom;
});

function makeEl(hidden = false) {
  const classes = new Set(hidden ? ['hidden'] : []);
  return {
    dataset: {},
    classes,
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c, force) => {
        const on = force === undefined ? !classes.has(c) : !!force;
        if (on) classes.add(c); else classes.delete(c);
        return on;
      },
    },
    querySelectorAll: () => [],
    attrs: {},
    children: [],
    textContent: '',
    hasAttribute(name) { return name in this.attrs; },
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
  };
}

function gateHarness(settings, { setupVisible = true, mainVisible = false, params = {} } = {}) {
  const els = {
    'msg-server-gate-panel': makeEl(true),
    'msg-server-gate': makeEl(true),
    'msg-setup': makeEl(!setupVisible),
    'msg-main': makeEl(!mainVisible),
    'msg-name-random': makeEl(false),
    'msg-name': makeEl(false),
    'msg-alias': makeEl(false),
    'b-msg-setup-random': makeEl(false),
    'b-msg-setup': makeEl(false),
    'b-msg-setup-simple': makeEl(true),
    'b-msg-setup-restore-toggle': makeEl(false),
    'setup-restore-more': makeEl(true),
  };
  els['setup-restore-more'].querySelectorAll = () => [];
  els['msg-main'].children = [makeEl(false), els['msg-server-gate']];
  const joinBtn = makeEl(true);
  els['msg-server-gate-panel'].querySelector = (sel) => (sel === '.server-gate-join' ? joinBtn : null);
  const homeRelays = () => (settings.relays || []).map((r) => (typeof r === 'string' ? { url: r } : r));
  const P = { get: (k) => (k in params ? params[k] : null), has: (k) => k in params };
  const fn = new Function('homeRelays', '_DOM', 'P', '_settings', 't', 'saveSettings', 'showToast', 'shareInvite', '_dbg',
    `${sliceBetween('function _serverGateControl', "// The add-flow's probe")}
     return { _updateServerGate };`);
  const gate = fn(homeRelays, { get: (id) => els[id] || null }, P, settings, (k, a) => (a ? `${k}:${a}` : k), async () => {}, () => {}, async () => {}, () => {});
  return { ...gate, els, joinBtn };
}

describe('local room and the server gate', () => {
  it('an active local room releases the gate with zero relays; stopping it re-arms the gate', () => {
    globalThis.__BREEZE_NO_DEFAULT_SERVER__ = true;
    const settings = { relays: [], localRoom: { startedAt: 1 } };
    const h = gateHarness(settings);
    h._updateServerGate();
    expect(h.els['msg-server-gate-panel'].classes.has('hidden')).toBe(true);
    expect(h.els['msg-name'].classes.has('hidden')).toBe(false);
    delete settings.localRoom;
    h._updateServerGate();
    expect(h.els['msg-server-gate-panel'].classes.has('hidden')).toBe(false);
    expect(h.els['msg-name'].classes.has('hidden')).toBe(true);
  });

  it('both gate surfaces offer the local entry with its honest-limit copy', () => {
    const buttons = INDEX.match(/class="btn btn-o server-gate-local"/g) || [];
    expect(buttons.length).toBe(2);
    const descs = INDEX.match(/data-i18n="gateLocalDesc"/g) || [];
    expect(descs.length).toBe(2);
    expect(INDEX).toContain("document.querySelectorAll('.server-gate-local')");
    expect(INDEX).toContain("document.querySelectorAll('.server-gate-join')");
  });

  it('an invite landing turns the join button on, labelled with the inviter name', () => {
    globalThis.__BREEZE_NO_DEFAULT_SERVER__ = true;
    globalThis.__breezeLocalRoom = { inviteParam: (P, k) => (typeof P?.get === 'function' ? P.get(k) : null), inviteHostName, createLocalRoomActions };
    const h = gateHarness({ relays: [] }, { params: { add: 'PUBKEY', name: 'Alice' } });
    h._updateServerGate();
    expect(h.joinBtn.classes.has('hidden')).toBe(false);
    expect(h.joinBtn.textContent).toBe('gateJoinInvite:Alice');
    const anon = gateHarness({ relays: [] }, { params: { add: 'PUBKEY' } });
    anon._updateServerGate();
    expect(anon.joinBtn.classes.has('hidden')).toBe(false);
    expect(anon.joinBtn.textContent).toBe('gateJoinInviteAnon');
    const none = gateHarness({ relays: [] });
    none._updateServerGate();
    expect(none.joinBtn.classes.has('hidden')).toBe(true);
  });
});

describe('local room actions (src/app/local-room.js)', () => {
  function actionsFor(settings, params = {}) {
    let saves = 0;
    const toasts = [];
    const P = { get: (k) => (k in params ? params[k] : null) };
    const api = createLocalRoomActions({
      getSettings: () => settings, saveSettings: async () => { saves++; },
      updateGate: () => {}, showToast: (m) => toasts.push(m), t: (k) => k,
      shareInvite: async () => {}, getMyId: () => '', dbg: () => {}, P,
    });
    return { api, saves: () => saves, toasts };
  }

  it('start/stop persist the room record through saveSettings', async () => {
    const settings = { relays: [] };
    const { api, saves, toasts } = actionsFor(settings);
    await api.start();
    expect(settings.localRoom.startedAt).toBeTypeOf('number');
    expect(settings.localRoom.joined).toBeUndefined();
    expect(saves()).toBe(1);
    expect(toasts).toEqual(['gateLocalStarted']);
    await api.start();
    expect(saves()).toBe(1);
    await api.stop();
    expect(settings.localRoom).toBeUndefined();
    expect(saves()).toBe(2);
    expect(toasts).toEqual(['gateLocalStarted', 'gateLocalStopped']);
  });

  it('join records the room under the inviter name, never as an own server', async () => {
    const settings = { relays: [] };
    const { api, toasts } = actionsFor(settings, { add: 'PUBKEY', name: 'Alice' });
    await api.join();
    expect(settings.localRoom).toMatchObject({ joined: true, hostName: 'Alice' });
    expect(toasts).toEqual(['gateJoinedStarted']);
  });

  it('inviteHostName mirrors the landing fronting (name, then @alias, else null)', () => {
    const P = (o) => ({ get: (k) => (k in o ? o[k] : null) });
    expect(inviteHostName(P({ add: 'K', name: ' Alice ' }))).toBe('Alice');
    expect(inviteHostName(P({ add: '@alice' }))).toBe('@alice');
    expect(inviteHostName(P({ add: 'K' }))).toBe(null);
    expect(inviteHostName(P({}))).toBe(null);
  });
});

describe('local room in the settings panel', () => {
  const base = {
    t: (k, a) => (a ? `${k}:${a}` : k), esc: (s) => String(s), myName: 'Me',
    hideReadReceipts: false, readReceiptDelay: false, hideTyping: false, relayOnly: false,
    ktBlock: false, showPeerName: true, callHistoryLog: true, notifSound: true, sendSound: true,
    focus: false, focusStrict: false, autoLock: false, notifPerm: false, autoBackup: true,
    fanout: 2, powerMode: 'auto', relays: [], tabCalls: true, tabContacts: true,
    tabSelf: true, tabSettings: true, tabOrder: ['chats', 'calls', 'contacts', 'self', 'settings'],
  };
  it('renders the room row with a stop action only while a room is active', () => {
    const withRoom = settingsPanelHtml({ ...base, localRoom: { startedAt: 1 } });
    expect(withRoom).toContain('gateLocalRoomLabel');
    expect(withRoom).toContain('data-action="stop-local-room"');
    const without = settingsPanelHtml({ ...base, localRoom: null });
    expect(without).not.toContain('stop-local-room');
  });
  it('a joined room is shown under the inviter name', () => {
    const joined = settingsPanelHtml({ ...base, localRoom: { startedAt: 1, joined: true, hostName: 'Alice' } });
    expect(joined).toContain('gateJoinedRoomLabel:Alice');
    expect(joined).toContain('gateJoinedHosting');
    const joinedAnon = settingsPanelHtml({ ...base, localRoom: { startedAt: 1, joined: true, hostName: '' } });
    expect(joinedAnon).toContain('gateJoinedRoomAnon');
  });
});

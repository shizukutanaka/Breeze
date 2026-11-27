// Local room gate (on-the-spot server, 2026-11-27 design stage 1):
// the server-required gate gains a second entry — start a server on
// this device. The room record lives in settings; an active room
// satisfies the gate exactly like a home relay does, and stopping the
// room re-arms the gate when no relay exists. The settings panel shows
// the room as a row in the servers section with a stop action.
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { settingsPanelHtml } from '../src/app/settings-panel.js';

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
afterEach(() => {
  if (oldFlag === undefined) delete globalThis.__BREEZE_NO_DEFAULT_SERVER__;
  else globalThis.__BREEZE_NO_DEFAULT_SERVER__ = oldFlag;
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
    hasAttribute(name) { return name in this.attrs; },
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
  };
}

function gateHarness(settings, { setupVisible = true, mainVisible = false } = {}) {
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
  const homeRelays = () => (settings.relays || []).map((r) => (typeof r === 'string' ? { url: r } : r));
  const fn = new Function('homeRelays', '_DOM', 'P', '_settings',
    `${sliceBetween('function _serverGateControl', "// The add-flow's probe")}
     return { _updateServerGate };`);
  const gate = fn(homeRelays, { get: (id) => els[id] || null }, { has: () => false }, settings);
  return { ...gate, els };
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
  });

  it('start/stop persist the room record through saveSettings', async () => {
    const settings = { relays: [] };
    let saves = 0;
    const toasts = [];
    const slice = sliceBetween('async function _startLocalRoom()', '  function _updateServerGate');
    const fn = new Function('_settings', 'saveSettings', '_updateServerGate', 'showToast', 't', 'myId', 'shareInvite', '_dbg',
      `${slice}\n     return { _startLocalRoom, _stopLocalRoom };`);
    const api = fn(settings, async () => { saves++; }, () => {}, (m) => toasts.push(m), (k) => k, '', async () => {}, () => {});
    await api._startLocalRoom();
    expect(settings.localRoom.startedAt).toBeTypeOf('number');
    expect(saves).toBe(1);
    expect(toasts).toEqual(['gateLocalStarted']);
    await api._startLocalRoom();
    expect(saves).toBe(1);
    await api._stopLocalRoom();
    expect(settings.localRoom).toBeUndefined();
    expect(saves).toBe(2);
    expect(toasts).toEqual(['gateLocalStarted', 'gateLocalStopped']);
  });
});

describe('local room in the settings panel', () => {
  const base = {
    t: (k) => k, esc: (s) => String(s), myName: 'Me',
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
});

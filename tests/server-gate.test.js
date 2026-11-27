// Server-required gate: distribution builds with no implicit relay must hold
// both first-run and established sessions at an add-server gate until one home
// relay exists. Invite landings are gated too (an invite is not a server), while
// the showroom mock stays outside the gate.
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ORIGIN = 'https://distribution.example';
const API = ORIGIN + '/api';
const RELAY = 'https://relay-one.example';

function sliceBetween(startMarker, endMarker) {
  const start = INDEX.indexOf(startMarker);
  const end = INDEX.indexOf(endMarker, start);
  expect(start, `marker ${startMarker}`).toBeGreaterThan(-1);
  expect(end, `marker ${endMarker}`).toBeGreaterThan(start);
  return INDEX.slice(start, end);
}

function buildRelayResolvers(settings = {}) {
  const fn = new Function('_settings', 'location', 'API',
    `${sliceBetween('function _servingRelayUrl()', '// One attestation round')}
     return { homeRelays, isOriginRelay, relayApiBase };`);
  return fn(settings, { origin: ORIGIN }, API);
}

const oldFlag = globalThis.__BREEZE_NO_DEFAULT_SERVER__;
const oldMock = globalThis.__breezeMock;
afterEach(() => {
  if (oldFlag === undefined) delete globalThis.__BREEZE_NO_DEFAULT_SERVER__;
  else globalThis.__BREEZE_NO_DEFAULT_SERVER__ = oldFlag;
  if (oldMock === undefined) delete globalThis.__breezeMock;
  else globalThis.__breezeMock = oldMock;
});

function makeEl(hidden = false) {
  const classes = new Set(hidden ? ['hidden'] : []);
  const el = {
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
  return el;
}

function gateHarness(settings, { setupVisible = true, mainVisible = false, params = [] } = {}) {
  const relays = buildRelayResolvers(settings);
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
  const restoreButtons = [makeEl(false), makeEl(false), makeEl(true)];
  els['setup-restore-more'].querySelectorAll = (sel) => sel === 'button' ? restoreButtons : [];
  const mainChild = makeEl(false);
  els['msg-main'].children = [mainChild, els['msg-server-gate']];
  const paramSet = new Set(params);
  const fn = new Function('homeRelays', '_DOM', 'P',
    `${sliceBetween('function _serverGateControl', "// The add-flow's probe")}
     return { _updateServerGate };`);
  const gate = fn(relays.homeRelays, { get: (id) => els[id] || null }, { has: (k) => paramSet.has(k) });
  return { ...gate, els, restoreButtons, mainChild, settings };
}

describe('server-required gate state', () => {
  it('flag ON plus zero relays gates the setup screen, and adding a relay releases it', () => {
    globalThis.__BREEZE_NO_DEFAULT_SERVER__ = true;
    const settings = { relays: [] };
    const h = gateHarness(settings);
    h._updateServerGate();
    expect(h.els['msg-server-gate-panel'].classes.has('hidden')).toBe(false);
    expect(h.els['msg-server-gate'].classes.has('hidden')).toBe(true);
    for (const id of ['msg-name-random', 'msg-name', 'msg-alias', 'b-msg-setup-random', 'b-msg-setup', 'b-msg-setup-simple', 'b-msg-setup-restore-toggle']) {
      expect(h.els[id].classes.has('hidden'), id).toBe(true);
    }
    expect(h.restoreButtons.map(b => b.classes.has('hidden'))).toEqual([true, true, true]);

    settings.relays = [{ url: RELAY, pin: 'pin-1', label: '' }];
    h._updateServerGate();
    expect(h.els['msg-server-gate-panel'].classes.has('hidden')).toBe(true);
    expect(h.els['msg-name-random'].classes.has('hidden')).toBe(false);
    expect(h.els['msg-name'].classes.has('hidden')).toBe(false);
    expect(h.els['msg-alias'].classes.has('hidden')).toBe(false);
    expect(h.els['b-msg-setup-random'].classes.has('hidden')).toBe(false);
    expect(h.els['b-msg-setup'].classes.has('hidden')).toBe(false);
    expect(h.els['b-msg-setup-simple'].classes.has('hidden')).toBe(true);
    expect(h.els['b-msg-setup-restore-toggle'].classes.has('hidden')).toBe(false);
    expect(h.restoreButtons.map(b => b.classes.has('hidden'))).toEqual([false, false, true]);
  });

  it('flag ON plus zero relays covers the established main screen with the overlay', () => {
    globalThis.__BREEZE_NO_DEFAULT_SERVER__ = true;
    const settings = { relays: [] };
    const h = gateHarness(settings, { setupVisible: false, mainVisible: true });
    h._updateServerGate();
    expect(h.els['msg-server-gate'].classes.has('hidden')).toBe(false);
    expect(h.els['msg-server-gate-panel'].classes.has('hidden')).toBe(true);
    expect(h.mainChild.hasAttribute('inert')).toBe(true);
    expect(h.els['msg-server-gate'].hasAttribute('inert')).toBe(false);

    settings.relays = [{ url: RELAY, pin: 'pin-1', label: '' }];
    h._updateServerGate();
    expect(h.els['msg-server-gate'].classes.has('hidden')).toBe(true);
    expect(h.mainChild.hasAttribute('inert')).toBe(false);
  });

  it('flag OFF never gates', () => {
    delete globalThis.__BREEZE_NO_DEFAULT_SERVER__;
    const h = gateHarness({ relays: [] }, { mainVisible: true, setupVisible: false });
    h._updateServerGate();
    expect(h.els['msg-server-gate'].classes.has('hidden')).toBe(true);
    expect(h.els['msg-server-gate-panel'].classes.has('hidden')).toBe(true);
  });

  it('the showroom mock never gates', () => {
    globalThis.__BREEZE_NO_DEFAULT_SERVER__ = true;
    globalThis.__breezeMock = { enabled: () => true };
    const h = gateHarness({ relays: [] }, { mainVisible: true, setupVisible: false });
    h._updateServerGate();
    expect(h.els['msg-server-gate'].classes.has('hidden')).toBe(true);
  });

  it.each(['add', 'join'])('an invite landing (%s) is still gated: an invite is not a server', (param) => {
    globalThis.__BREEZE_NO_DEFAULT_SERVER__ = true;
    const h = gateHarness({ relays: [] }, { params: [param] });
    h._updateServerGate();
    expect(h.els['msg-server-gate-panel'].classes.has('hidden')).toBe(false);
    expect(h.els['b-msg-setup-random'].classes.has('hidden')).toBe(true);
    expect(h.els['b-msg-setup-restore-toggle'].classes.has('hidden')).toBe(true);
  });
});

describe('invite home is never adopted as my server', () => {
  const PUB = 'TARGETPUB000' + 't'.repeat(32);
  const existing = { id: PUB.slice(0, 12), pubB64: PUB, name: 'Target', unread: 0 };

  function buildAddContact({ relays, adoptError = null, preexisting = true } = {}) {
    const contacts = new Map(preexisting ? [[existing.id, { ...existing }]] : []);
    const adopted = [];
    const debug = [];
    const dbGet = async (store, key) => store === 'contacts' ? contacts.get(key) : undefined;
    const dbPut = async (store, value) => { if (store === 'contacts') contacts.set(value.id, value); return true; };
    const sanitizeHomeList = (list) => Array.isArray(list) ? list.filter(x => x && typeof x.url === 'string') : [];
    const homeRelays = () => relays;
    const addHomeRelay = async (entry) => {
      if (adoptError) throw adoptError;
      adopted.push(entry);
      relays.push({ ...entry });
    };
    const fn = new Function(
      'dbGet', 'dbPut', 'sanitizeHomeList', 'homeRelays', 'addHomeRelay', '_profileUI', 'auditLog', 'renderContacts', '_dbg',
      '_settings', 'dbGetAll', 'saveSettings', '_showBackupNudgeCard',
      `const _nameTools = null, _requests = null; ${sliceBetween("async function addContact(pubB64, name, homeHint, alias = '') {", '// Stage-2 step 6: the contact-settings carrier')} return addContact;`,
    );
    return {
      adopted, debug, contacts,
      addContact: fn(dbGet, dbPut, sanitizeHomeList, homeRelays, addHomeRelay, null, () => {}, async () => {}, (e, ctx) => debug.push({ e, ctx }),
        { backupNudgeShown: true }, async () => [...contacts.values()], () => {}, () => {}),
    };
  }

  it('stores the invite home on the contact only; my relays stay untouched', async () => {
    const empty = [];
    const first = buildAddContact({ relays: empty });
    await first.addContact(PUB, 'Target', [{ url: RELAY, pin: 'pin-1' }, { url: 'https://relay-two.example', pin: 'pin-2' }]);
    expect(first.adopted).toEqual([]);
    expect(empty).toEqual([]);

    const existingRelays = [{ url: 'https://mine.example', pin: 'mine-pin', label: 'mine' }];
    const second = buildAddContact({ relays: existingRelays });
    await second.addContact(PUB, 'Target', [{ url: RELAY, pin: 'pin-1' }]);
    expect(second.adopted).toEqual([]);
    expect(existingRelays).toEqual([{ url: 'https://mine.example', pin: 'mine-pin', label: 'mine' }]);
  });
});

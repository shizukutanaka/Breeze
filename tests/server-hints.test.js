// Server hints (2026-11-27): the no-default banner must agree with
// the gate about local rooms, and a message that can only sit in the
// local outbox must say so at the moment it matters. The decision
// rules are pure functions in src/app/server-hints.js; the factory is
// exercised with a minimal fake DOM; index.html wiring is pinned by
// source assertions so the hooks cannot quietly fall off.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { noDefaultBannerNeeded, deliveryStuck, hostWaiting, createServerHints } from '../src/app/server-hints.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

describe('noDefaultBannerNeeded', () => {
  const base = { flagOn: true, relayCount: 0, hasRoom: false };
  it('shows when the build is no-default, no relays, no room', () => {
    expect(noDefaultBannerNeeded(base)).toBe(true);
  });
  it('hides when a relay exists', () => {
    expect(noDefaultBannerNeeded({ ...base, relayCount: 1 })).toBe(false);
  });
  it('hides when a local room is active (the gate treats it as a server)', () => {
    expect(noDefaultBannerNeeded({ ...base, hasRoom: true })).toBe(false);
  });
  it('never shows outside the no-default build', () => {
    expect(noDefaultBannerNeeded({ ...base, flagOn: false })).toBe(false);
  });
});

describe('deliveryStuck', () => {
  const base = { isGroup: false, hasPub: true, mockOn: false, peerOpen: false, relayCount: 0, contactHomes: 0, queued: 1 };
  it('is stuck: queued, no relay anywhere, peer not connected', () => {
    expect(deliveryStuck(base)).toBe(true);
  });
  it('not stuck when nothing is queued', () => {
    expect(deliveryStuck({ ...base, queued: 0 })).toBe(false);
  });
  it('not stuck when the peer is connected (outbox flushes)', () => {
    expect(deliveryStuck({ ...base, peerOpen: true })).toBe(false);
  });
  it('not stuck when I have a relay (the deposit carries it)', () => {
    expect(deliveryStuck({ ...base, relayCount: 1 })).toBe(false);
  });
  it('not stuck when the contact has a known home relay', () => {
    expect(deliveryStuck({ ...base, contactHomes: 1 })).toBe(false);
  });
  it('not stuck for groups, mock mode, or keyless contacts', () => {
    expect(deliveryStuck({ ...base, isGroup: true })).toBe(false);
    expect(deliveryStuck({ ...base, mockOn: true })).toBe(false);
    expect(deliveryStuck({ ...base, hasPub: false })).toBe(false);
    expect(deliveryStuck(null)).toBe(false);
  });
});

function fakeEl() {
  const el = {
    children: [], dataset: {}, parentElement: null, onclick: null, textContent: '',
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); }, toggle(c, f) { f ? this._s.add(c) : this._s.delete(c); },
    },
    setAttribute() {}, addEventListener(ev, fn) { this._click = fn; },
    append(...kids) { this.children.push(...kids); },
  };
  return el;
}

describe('hostWaiting', () => {
  const base = { flagOn: true, hasRoom: true, roomJoined: false, chatOpen: false, mockOn: false, relayCount: 0 };
  it('waits: hosting, no chat open, no relay', () => {
    expect(hostWaiting(base)).toBe(true);
  });
  it('not waiting as a guest (joined), with a chat open, in mock, or with a relay', () => {
    expect(hostWaiting({ ...base, roomJoined: true })).toBe(false);
    expect(hostWaiting({ ...base, chatOpen: true })).toBe(false);
    expect(hostWaiting({ ...base, mockOn: true })).toBe(false);
    expect(hostWaiting({ ...base, relayCount: 1 })).toBe(false);
    expect(hostWaiting({ ...base, hasRoom: false })).toBe(false);
    expect(hostWaiting({ ...base, flagOn: false })).toBe(false);
    expect(hostWaiting(null)).toBe(false);
  });
});

describe('createServerHints factory', () => {
  function makeDeps(over = {}) {
    const banner = fakeEl(); banner.classList.add('hidden');
    const setup = fakeEl(); const main = fakeEl(); main.id = 'msg-main';
    banner.parentElement = main;
    setup.parentElement = main;
    const inputBar = fakeEl(); const chatCol = fakeEl();
    inputBar.parentElement = chatCol;
    chatCol.insertBefore = (el, ref) => { chatCol.children.unshift(el); el.parentElement = chatCol; };
    main.insertBefore = () => {};
    const state = { relays: 0, room: false, joined: false, contact: { pubB64: 'PUB', name: 'Alice', home: [] }, queued: 1, peerOpen: false, rvOpenedWith: null, pairingOpened: 0, bannerClicks: 0 };
    const deps = {
      dom: id => (id === 'msg-server-banner' ? banner : id === 'msg-setup' ? setup : null),
      t: (k, ...a) => k + ':' + a.join(','),
      isNoDefault: () => true,
      relayCount: () => state.relays,
      hasRoom: () => state.room,
      onBannerClick: () => { state.bannerClicks++; },
      getActiveContact: () => state.contact,
      isMock: () => false,
      contactHomes: c => (Array.isArray(c?.home) ? c.home.length : 0),
      queuedFor: () => state.queued,
      peerOpen: () => state.peerOpen,
      openRendezvous: c => { state.rvOpenedWith = c; },
      roomJoined: () => state.joined,
      openPairing: () => { state.pairingOpened++; },
      inputBar: () => inputBar,
    };
    return { deps: { ...deps, ...over }, banner, chatCol, state };
  }

  it('banner shows with no relay and no room, hides once a room starts', () => {
    const { deps, banner, state } = makeDeps();
    const hints = createServerHints(deps);
    hints.updateBanner();
    expect(banner.classList.contains('hidden')).toBe(false);
    expect(banner.dataset.noDefault).toBe('1');
    state.room = true;
    hints.updateBanner();
    expect(banner.classList.contains('hidden')).toBe(true);
    expect(banner.dataset.noDefault).toBeUndefined();
  });

  it('delivery hint appears only while stuck; unpaired contacts get the pairing entry', () => {
    const { deps, chatCol, state } = makeDeps();
    const hints = createServerHints(deps);
    globalThis.document = { createElement: () => fakeEl() };
    try {
      hints.updateDeliveryHint();
      const hint = chatCol.children[0];
      expect(hint).toBeTruthy();
      expect(hint.classList.contains('hidden')).toBe(false);
      const btn = hint.children[1];
      expect(btn.textContent).toBe('deliveryHintAction:');
      btn._click();
      // Measured: connection codes refuse for an invite contact (no pinned
      // signing key yet), so the first step offered is in-person pairing.
      expect(state.pairingOpened).toBe(1);
      expect(state.rvOpenedWith).toBeNull();
      state.peerOpen = true;
      hints.updateDeliveryHint();
      expect(hint.classList.contains('hidden')).toBe(true);
    } finally {
      delete globalThis.document;
    }
  });

  it('once paired, the delivery hint offers connection codes instead', () => {
    const { deps, chatCol, state } = makeDeps();
    state.contact = { pubB64: 'PUB', name: 'Alice', home: [], sigPub: 'SIG' };
    const hints = createServerHints(deps);
    globalThis.document = { createElement: () => fakeEl() };
    try {
      hints.updateDeliveryHint();
      const hint = chatCol.children[0];
      const btn = hint.children[1];
      expect(btn.textContent).toBe('deliveryHintConnect:');
      btn._click();
      expect(state.rvOpenedWith).toBe(state.contact);
      expect(state.pairingOpened).toBe(0);
    } finally {
      delete globalThis.document;
    }
  });

  it('host hint shows while hosting with no chat open, and offers pairing', () => {
    const { deps, chatCol, state } = makeDeps();
    state.contact = null;
    state.room = true;
    const hints = createServerHints(deps);
    globalThis.document = { createElement: () => fakeEl() };
    try {
      hints.updateDeliveryHint();
      const hint = chatCol.children[0];
      expect(hint).toBeTruthy();
      expect(hint.classList.contains('hidden')).toBe(false);
      expect(hint.children[0].textContent).toBe('hostWaitText:');
      hint.children[1]._click();
      expect(state.pairingOpened).toBe(1);
      state.joined = true; // the joined record lives on the guest's device: no waiting there
      hints.updateDeliveryHint();
      expect(hint.classList.contains('hidden')).toBe(true);
    } finally {
      delete globalThis.document;
    }
  });
});

describe('index.html wiring', () => {
  it('imports the module and exposes the bridge', () => {
    expect(html).toContain("from './src/app/server-hints.js'");
    expect(html).toContain('window.__breezeServerHints');
    expect(sw).toContain("'/src/app/server-hints.js'");
  });
  it('the banner click wiring opens Settings and scrolls to add-relay', () => {
    expect(html).toContain("onBannerClick: () => { openSettingsView(); requestAnimationFrame(() => document.querySelector('[data-action=\"add-relay\"]')?.scrollIntoView({ block: 'center' })); }");
  });
  it('the banner is a one-line delegation (no second copy of the rule)', () => {
    expect(html).toContain('function _updateNoDefaultBanner() { return _serverHints?.updateBanner(); }');
    expect(html).not.toContain("banner.dataset.noDefault = '1'; banner.classList.remove('hidden'); banner.textContent = t('serverNoDefault');\n    banner.onclick");
  });
  it('the gate refresh also refreshes the banner (room start/stop)', () => {
    const gate = html.slice(html.indexOf('function _updateServerGate()'), html.indexOf('function _preflightRelayUrl'));
    expect(gate).toContain('_updateNoDefaultBanner();');
    expect(gate).toContain('_updateDeliveryHint();');
  });
  it('delivery hint refreshes on send, on status updates, and on chat open', () => {
    expect(html).toContain('_mock?.afterSend(contact);\n    _updateDeliveryHint();');
    const status = html.slice(html.indexOf('function updateConvStatus()'), html.indexOf('function updateConvStatus()') + 200);
    expect(status).toContain('_updateDeliveryHint();');
    expect(html).toContain('refreshSignalPolls(); _updateDeliveryHint();');
  });
  it('EN keys exist in the inline English table', () => {
    expect(html).toContain("deliveryHintText: '{0} message(s) are still only on this device.");
    expect(html).toContain("deliveryHintAction: 'Pair in person'");
    expect(html).toContain("deliveryHintConnect: 'Exchange connection codes'");
    expect(html).toContain("hostWaitText: 'Your room is open.");
    expect(html).toContain("hostWaitAction: 'Pair in person'");
  });
});

describe('locale keys', () => {
  const dir = new URL('../locales/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  it('every locale carries both keys (set consistency)', () => {
    expect(files.length).toBe(107);
    for (const f of files) {
      const loc = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
      expect(loc.deliveryHintText, f).toBeTruthy();
      expect(loc.deliveryHintAction, f).toBeTruthy();
      expect(loc.deliveryHintConnect, f).toBeTruthy();
      expect(loc.hostWaitText, f).toBeTruthy();
      expect(loc.hostWaitAction, f).toBeTruthy();
    }
  });
  it('ja carries the real translation', () => {
    const ja = JSON.parse(readFileSync(new URL('ja.json', dir), 'utf8'));
    expect(ja.deliveryHintAction).toBe('対面ペアリング');
    expect(ja.deliveryHintConnect).toBe('接続コードを交換');
    expect(ja.deliveryHintText).toContain('対面ペアリングで届けられます');
    expect(ja.hostWaitAction).toBe('対面ペアリング');
  });
});

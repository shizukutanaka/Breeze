// Deployment-time no-default-server flag: release/demo builds must not treat
// the serving origin as an implicit relay, while flag-OFF keeps the exact
// legacy origin contract.
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createServerHints } from '../src/app/server-hints.js';

const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ORIGIN = 'https://distribution.example';
const API = ORIGIN + '/api';
const RELAY = 'https://relay-one.example';

function sliceBetween(startMarker, endMarker) {
  const start = INDEX.indexOf(startMarker);
  const end = INDEX.indexOf(endMarker);
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
const oldPrimaryPost = globalThis.__breezeNoDefaultPrimaryPost;
afterEach(() => {
  if (oldFlag === undefined) delete globalThis.__BREEZE_NO_DEFAULT_SERVER__;
  else globalThis.__BREEZE_NO_DEFAULT_SERVER__ = oldFlag;
  if (oldPrimaryPost === undefined) delete globalThis.__breezeNoDefaultPrimaryPost;
  else globalThis.__breezeNoDefaultPrimaryPost = oldPrimaryPost;
});

describe('no-default-server homeRelays contract', () => {
  it('flag OFF keeps the legacy serving-origin relay byte-for-byte', () => {
    delete globalThis.__BREEZE_NO_DEFAULT_SERVER__;
    const settings = { relayPin: 'origin-pin', relays: [{ url: ORIGIN, pin: 'origin-pin', label: 'mine' }, { url: RELAY, pin: 'pin-1', label: 'one' }] };
    const c = buildRelayResolvers(settings);
    expect(c.homeRelays()).toEqual([
      { url: ORIGIN, pin: 'origin-pin', label: 'mine' },
      { url: RELAY, pin: 'pin-1', label: 'one' },
    ]);
    expect(c.relayApiBase(c.homeRelays()[0])).toBe(API);
    expect(c.isOriginRelay({ url: ORIGIN })).toBe(true);
  });

  it('flag ON returns only configured relays and never prepends the serving origin', () => {
    globalThis.__BREEZE_NO_DEFAULT_SERVER__ = true;
    const settings = { relayPin: 'legacy-origin-pin', relays: [] };
    const c = buildRelayResolvers(settings);
    expect(c.homeRelays()).toEqual([]);
    expect(c.relayApiBase(null)).toBe('');
    expect(c.isOriginRelay({ url: ORIGIN })).toBe(false);

    settings.relays = [{ url: RELAY + '/path/ignored', pin: 'pin-1', label: 'one' }];
    expect(c.homeRelays()).toEqual([{ url: RELAY, pin: 'pin-1', label: 'one' }]);
    expect(c.relayApiBase(c.homeRelays()[0])).toBe(RELAY + '/api');
    expect(c.isOriginRelay({ url: RELAY })).toBe(true);
    expect(c.isOriginRelay({ url: ORIGIN })).toBe(false);
  });

  it('flag ON still permits the serving origin as an explicitly configured relay', () => {
    globalThis.__BREEZE_NO_DEFAULT_SERVER__ = true;
    const settings = { relays: [{ url: ORIGIN, pin: 'explicit-pin', label: 'self host' }] };
    const c = buildRelayResolvers(settings);
    expect(c.homeRelays()).toEqual([{ url: ORIGIN, pin: 'explicit-pin', label: 'self host' }]);
    expect(c.relayApiBase(c.homeRelays()[0])).toBe(ORIGIN + '/api');
  });
});

describe('no-default-server network funnel', () => {
  it('postAPIRaw with no configured relay returns null without any fetch', async () => {
    globalThis.__BREEZE_NO_DEFAULT_SERVER__ = true;
    delete globalThis.__breezeNoDefaultPrimaryPost;
    const calls = [];
    const fn = new Function('fetchT',
      `${sliceBetween('const _relayPinGate', '// ═══ Title helper')}
       return postAPIRaw;`);
    const postAPIRaw = fn(async (...args) => { calls.push(args); return new Response('{}'); });
    await expect(postAPIRaw('/prekey/fetch', { userId: 'u' })).resolves.toBeNull();
    expect(calls).toEqual([]);
  });

  it('postAPIRaw delegates to the configured-primary seam when one exists', async () => {
    globalThis.__BREEZE_NO_DEFAULT_SERVER__ = true;
    const seen = [];
    globalThis.__breezeNoDefaultPrimaryPost = async (path, body) => {
      seen.push({ path, body });
      return new Response('{"ok":true}');
    };
    const fn = new Function('fetchT',
      `${sliceBetween('const _relayPinGate', '// ═══ Title helper')}
       return postAPIRaw;`);
    const postAPIRaw = fn(async () => { throw new Error('legacy origin fetch must not run'); });
    const resp = await postAPIRaw('/signal', { room: 'r' });
    expect(resp.ok).toBe(true);
    expect(seen).toEqual([{ path: '/signal', body: { room: 'r' } }]);
  });
});

describe('no-default-server unconfigured banner', () => {
  function bannerHarness(settings) {
    const relays = buildRelayResolvers(settings);
    const classes = new Set(['hidden']);
    const banner = {
      dataset: {}, textContent: '', onclick: null,
      parentElement: { id: 'msg-main' },
      classList: {
        add: (c) => classes.add(c), remove: (c) => classes.delete(c),
      },
    };
    const root = { inserted: null, insertBefore(el, before) { this.inserted = { el, before }; banner.parentElement = { id: 'root' }; } };
    const setup = { parentElement: root };
    const DOM = { get: (id) => id === 'msg-server-banner' ? banner : id === 'msg-setup' ? setup : null };
    // The banner body lives in src/app/server-hints.js since 2026-11-27
    // (index.html keeps a one-line delegation); drive the real factory
    // with the same stubs this harness always used. The wiring side
    // (openSettingsView on click) is pinned in server-hints.test.js.
    const opened = [];
    const hints = createServerHints({
      dom: (id) => DOM.get(id), t: (k) => k,
      isNoDefault: () => globalThis.__BREEZE_NO_DEFAULT_SERVER__ === true,
      relayCount: () => relays.homeRelays().length,
      hasRoom: () => !!settings.localRoom,
      onBannerClick: () => opened.push(true),
      getActiveContact: () => null, isMock: () => false,
      contactHomes: () => 0, queuedFor: () => 0, peerOpen: () => false,
      openRendezvous: () => {}, inputBar: () => null,
    });
    const update = () => hints.updateBanner();
    return { update, banner, classes, root, opened };
  }

  it('shows with zero configured relays, hides after one is added, and reappears if removed', () => {
    globalThis.__BREEZE_NO_DEFAULT_SERVER__ = true;
    const settings = { relays: [] };
    const h = bannerHarness(settings);
    h.update();
    expect(h.classes.has('hidden')).toBe(false);
    expect(h.banner.textContent).toBe('serverNoDefault');
    expect(h.banner.dataset.noDefault).toBe('1');
    expect(h.root.inserted?.el).toBe(h.banner);

    settings.relays = [{ url: RELAY, pin: 'pin', label: '' }];
    h.update();
    expect(h.classes.has('hidden')).toBe(true);
    expect(h.banner.dataset.noDefault).toBeUndefined();

    settings.relays = [];
    h.update();
    expect(h.classes.has('hidden')).toBe(false);
  });

  it('clicking the banner opens Settings', () => {
    globalThis.__BREEZE_NO_DEFAULT_SERVER__ = true;
    const h = bannerHarness({ relays: [] });
    h.update();
    h.banner.onclick();
    expect(h.opened).toEqual([true]);
  });
});

describe('no-default-server distribution wiring', () => {
  it('keeps cf-proxy null rather than falling back to the serving origin when unconfigured', () => {
    expect(INDEX).toContain("proxyBase: () => globalThis.__BREEZE_NO_DEFAULT_SERVER__ === true");
    expect(INDEX).toContain("? ((globalThis.__brzApiBase?.() || '') ? (globalThis.__brzApiBase?.() || '') + '/cf-proxy' : null) : (API || (location.origin + '/api')) + '/cf-proxy'");
    const moduleSrc = fs.readFileSync(path.join(ROOT, 'src/app/cloudflare.js'), 'utf8');
    expect(moduleSrc).toContain("if (configured === null) return { errorKey: 'cfErrNoProxy' };");
  });

  it('release packaging ships the flag and injects it before the first module script exactly once', () => {
    const flag = fs.readFileSync(path.join(ROOT, 'no-default-server-flag.js'), 'utf8');
    expect(flag).toContain('window.__BREEZE_NO_DEFAULT_SERVER__ = true;');
    const pkg = fs.readFileSync(path.join(ROOT, 'tools/package-release.sh'), 'utf8');
    expect(pkg).toContain('index.html no-default-server-flag.js _worker.js');
    expect(pkg).toContain('src=\\"./no-default-server-flag.js\\"');
    expect(pkg).toContain('failed to inject no-default-server flag exactly once');
    expect(INDEX).not.toContain('no-default-server-flag.js');
  });
});

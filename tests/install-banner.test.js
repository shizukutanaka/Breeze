import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { initInstallBanner } from '../src/app/install-banner.js';
import { settingsPanelHtml } from '../src/app/settings-panel.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function makeNode() {
  const attrs = {};
  const sub = { '.dismiss': { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }, '#install-btn': {}, '#install-dl-btn': {} };
  const node = {
    className: '',
    html: '',
    removed: false,
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return attrs[k]; },
    querySelector(sel) { return sub[sel] || null; },
    remove() { node.removed = true; },
  };
  return node;
}

describe('src/app/install-banner.js — initInstallBanner', () => {
  const savedDescriptors = {};
  const setGlobal = (k, value) => {
    if (!(k in savedDescriptors)) {
      savedDescriptors[k] = Object.getOwnPropertyDescriptor(globalThis, k);
    }
    Object.defineProperty(globalThis, k, { value, configurable: true, writable: true });
  };

  afterEach(() => {
    for (const [k, desc] of Object.entries(savedDescriptors)) {
      if (desc === undefined) delete globalThis[k];
      else Object.defineProperty(globalThis, k, desc);
      delete savedDescriptors[k];
    }
  });

  function setup({ ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', standalone = false, dismissedAt = null } = {}) {
    const store = new Map();
    if (dismissedAt !== null) store.set('brz-install-dismissed', String(dismissedAt));
    const winListeners = {};
    const docListeners = {};
    const appended = [];
    const opened = [];
    const toasts = [];
    const setupClasses = new Set(['hidden']);
    const setupBtn = {
      classList: {
        add(c) { setupClasses.add(c); },
        remove(c) { setupClasses.delete(c); },
        contains(c) { return setupClasses.has(c); },
      },
      onclick: null,
    };

    setGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
    });
    setGlobal('navigator', { userAgent: ua, standalone });
    setGlobal('window', {
      navigator: { userAgent: ua, standalone },
      matchMedia: () => ({ matches: standalone }),
      addEventListener: (type, fn) => { (winListeners[type] ||= []).push(fn); },
      open: (...args) => { opened.push(args); },
    });
    setGlobal('document', {
      createElement: () => makeNode(),
      querySelector: () => appended.find(b => !b.removed) || null,
      querySelectorAll: () => [],
      addEventListener: (type, fn) => { (docListeners[type] ||= []).push(fn); },
      body: { appendChild: (el) => { appended.push(el); } },
    });

    const api = initInstallBanner({
      DOM: { get: (id) => (id === 'setup-install-btn' ? setupBtn : null) },
      MS: { SEC: 1000, WEEK: 7 * 86400 * 1000 },
      t: (k, ...args) => (args.length ? `${k}:${args.join(',')}` : k),
      esc: (s) => String(s),
      safeSetHTML: (el, markup) => { el.html = markup; },
      showToast: (msg, type) => { toasts.push({ msg, type }); },
    });

    const clickSettingsInstall = () => docListeners.click[0]({
      target: { closest: (sel) => (sel === '#settings-install-btn' ? {} : null) },
      preventDefault() {},
    });

    return { api, store, winListeners, docListeners, appended, opened, toasts, setupBtn, clickSettingsInstall };
  }

  it('increments visit count and renders desktop download banner when not standalone', () => {
    const h = setup();
    expect(h.store.get('brz-visit-count')).toBe('1');

    h.api.showInstallBanner();
    expect(h.appended).toHaveLength(1);
    expect(h.appended[0].html).toContain('installBannerDesktopTitle:macOS');

    h.appended[0].querySelector('#install-dl-btn').onclick();
    expect(h.opened[0][0]).toContain('Breeze-mac.dmg');
    expect(h.appended[0].removed).toBe(true);
  });

  it('respects 7-day dismiss cooldown and standalone suppression', () => {
    const cooled = setup({ dismissedAt: Date.now() - 1000 });
    cooled.api.showInstallBanner();
    expect(cooled.appended).toHaveLength(0);

    const standalone = setup({ standalone: true });
    standalone.api.showInstallBanner();
    expect(standalone.appended).toHaveLength(0);
  });

  it('captures beforeinstallprompt, exposes setup button, and handles appinstalled', async () => {
    const h = setup();
    let prompted = 0;
    const evt = {
      preventDefault() {},
      prompt() { prompted++; },
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    };
    h.winListeners.beforeinstallprompt[0](evt);
    expect(h.setupBtn.classList.contains('hidden')).toBe(false);

    await h.setupBtn.onclick();
    expect(prompted).toBe(1);
    expect(h.setupBtn.classList.contains('hidden')).toBe(true);
    expect(h.toasts).toEqual([{ msg: 'toastInstalling', type: 'success' }]);

    h.winListeners.appinstalled[0]();
    expect(h.toasts[1]).toEqual({ msg: 'toastInstalled', type: 'success' });
  });


  it('requestInstall forces the banner past the 7-day dismiss cooldown', async () => {
    const h = setup({ dismissedAt: Date.now() - 1000 });
    await h.api.requestInstall();
    expect(h.appended).toHaveLength(1);
    expect(h.appended[0].html).toContain('installBannerDesktopTitle:macOS');
  });

  it('settings install click uses a captured prompt instead of the fallback banner', async () => {
    const h = setup({ dismissedAt: Date.now() - 1000 });
    let prompted = 0;
    h.winListeners.beforeinstallprompt[0]({
      preventDefault() {},
      prompt() { prompted++; },
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });

    await h.clickSettingsInstall();
    expect(prompted).toBe(1);
    expect(h.appended).toHaveLength(0);
    expect(h.toasts).toEqual([{ msg: 'toastInstalling', type: 'success' }]);
  });

  it('settings install click forces the fallback banner when no prompt is captured', async () => {
    const h = setup({ dismissedAt: Date.now() - 1000 });
    await h.clickSettingsInstall();
    expect(h.appended).toHaveLength(1);
    expect(h.appended[0].html).toContain('installBannerDownload');
  });

  it('settings install row renders by default but is omitted in standalone or Electron', () => {
    const panelFor = () => settingsPanelHtml({
      t: (key) => key, esc: (x) => String(x), myName: 'Name', fanout: 2, powerMode: 'auto', relays: [],
    });

    setup();
    expect(panelFor()).toContain('id="settings-install-btn"');
    expect(panelFor()).toContain('data-action="install-app"');
    expect(panelFor()).toContain('settingsInstallApp');

    setup({ standalone: true });
    expect(panelFor()).not.toContain('settings-install-btn');

    const h = setup();
    window.process = { versions: { electron: 'test' } };
    expect(panelFor()).not.toContain('settings-install-btn');
    expect(h.appended).toHaveLength(0);
  });

  it('wiring: index.html exposes window.__breezeInstallBanner and runs it after _appModulesReady', () => {
    expect(html).toContain("import { initInstallBanner } from './src/app/install-banner.js'; window.__breezeInstallBanner = { initInstallBanner };");
    expect(html).toContain('globalThis.__breezeInstallBanner?.initInstallBanner({ DOM: _DOM, MS, t, esc, safeSetHTML, showToast, dbg: _dbg });');
  });
});

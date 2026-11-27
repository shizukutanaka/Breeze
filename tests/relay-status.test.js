import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { settingsPanelHtml } from '../src/app/settings-panel.js';

const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SETTINGS_VIEW = fs.readFileSync(path.join(ROOT, 'src/app/settings-view.js'), 'utf8');
const RELAY_URL = 'https://relay.example';

function extractFunction(name) {
  const start = INDEX.indexOf(`function ${name}(`);
  expect(start, `${name} exists in index.html`).toBeGreaterThan(-1);
  const open = INDEX.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < INDEX.length; i++) {
    if (INDEX[i] === '{') depth++;
    else if (INDEX[i] === '}') {
      depth--;
      if (depth === 0) return INDEX.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced braces');
}

function buildRelayStatus({ blocked = [], health = null, origin = false, serverFeatures = undefined } = {}) {
  const source = extractFunction('_relayStatusText');
  const make = new Function(
    '_relayBlockedUrls', '_relayHealthByUrl', 'isOriginRelay', 'window', 't',
    `${source}\nreturn _relayStatusText;`,
  );
  const healthByUrl = new Map();
  if (health) healthByUrl.set(RELAY_URL, health);
  return make(
    new Set(blocked),
    healthByUrl,
    () => origin,
    { _serverFeatures: serverFeatures },
    (key, ...args) => key + (args.length ? ':' + args.join(',') : ''),
  );
}

describe('_relayStatusText', () => {
  it('reports a blocked relay before looking at any known health', () => {
    const status = buildRelayStatus({ blocked: [RELAY_URL], health: { ok: true, version: '3.8.0' } });
    expect(status({ url: RELAY_URL })).toBe('relayStatusBlocked');
  });

  it('reports degraded storage when the last health says ok is false', () => {
    const status = buildRelayStatus({ health: { ok: false, version: '3.8.0' } });
    expect(status({ url: RELAY_URL })).toBe('relayStatusDegraded');
  });

  it('reports reachability with the server version when health carries one', () => {
    const status = buildRelayStatus({ health: { ok: true, version: '3.8.0' } });
    expect(status({ url: RELAY_URL })).toBe('relayStatusOkVersion:3.8.0');
  });

  it('reports plain reachability when health has no usable version string', () => {
    for (const health of [{ ok: true }, { ok: true, version: '' }, { ok: true, version: 38 }]) {
      const status = buildRelayStatus({ health });
      expect(status({ url: RELAY_URL })).toBe('relayStatusOk');
    }
  });

  it('treats the serving relay as reachable when server features were already learned', () => {
    const status = buildRelayStatus({ origin: true, serverFeatures: { sealed: true } });
    expect(status({ url: RELAY_URL })).toBe('relayStatusOk');
  });

  it('reports unknown when this session has no health and no serving-relay evidence', () => {
    expect(buildRelayStatus()({ url: RELAY_URL })).toBe('relayStatusUnknown');
    expect(buildRelayStatus({ origin: true })({ url: RELAY_URL })).toBe('relayStatusUnknown');
  });
});

function panelWith(relays) {
  return settingsPanelHtml({
    t: (key) => key,
    esc: (value) => String(value).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])),
    myName: 'Name',
    fanout: 2,
    powerMode: 'auto',
    relays,
  });
}

describe('settings relay status rendering', () => {
  it('renders a non-empty relay status after the fingerprint placeholder', () => {
    const html = panelWith([{ label: 'relay', url: RELAY_URL, origin: false, blocked: false, status: 'Reachable · v3.8.0' }]);
    expect(html).toContain(`data-relay-fp="${RELAY_URL}">…</span> <span class="settings-row-sub" data-relay-status="${RELAY_URL}">Reachable · v3.8.0</span>`);
  });

  it('renders no status span for a relay without a non-empty status string', () => {
    for (const relay of [
      { label: 'relay', url: RELAY_URL, origin: false, blocked: false },
      { label: 'relay', url: RELAY_URL, origin: false, blocked: false, status: '' },
    ]) {
      expect(panelWith([relay])).not.toContain('data-relay-status=');
    }
  });

  it('escapes the rendered relay status', () => {
    const html = panelWith([{ label: 'relay', url: RELAY_URL, origin: false, blocked: false, status: '<img src=x>' }]);
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).not.toContain('<img src=x>');
  });
});

describe('relay status wiring', () => {
  it('settings-view maps each relay through the guarded status dependency', () => {
    expect(SETTINGS_VIEW).toContain("status: typeof deps._relayStatusText === 'function' ? deps._relayStatusText(r) : ''");
  });

  it('index.html passes the helper into the settings view factory', () => {
    const start = INDEX.indexOf('globalThis.__breezeSettingsView?.createSettingsView({');
    expect(start).toBeGreaterThan(-1);
    const wiring = INDEX.slice(start, INDEX.indexOf('function _renderSettingsPanel(d)', start));
    expect(wiring).toContain('_relayStatusText');
  });
});

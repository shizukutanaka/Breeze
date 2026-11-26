import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { mockEnabled, createMock, createMockApi, buildSeedPlan, isMockApiPath } from '../src/app/mock.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

afterEach(() => {
  delete globalThis.__BREEZE_MOCK__;
  vi.useRealTimers();
});

describe('mock mode module', () => {
  it('is completely inert unless window.__BREEZE_MOCK__ is exactly true', () => {
    expect(mockEnabled()).toBe(false);
    expect(createMock({})).toBe(null);
    globalThis.__BREEZE_MOCK__ = 'true';
    expect(mockEnabled()).toBe(false);
    expect(createMock({})).toBe(null);
  });

  it('builds the required seed shape: 3 contacts, 2 direct conversations, history and 1 group', () => {
    const peers = [
      { id: 'aaaaaaaaaaaa', pubB64: 'pub-a', nameKey: 'mockContactAoi' },
      { id: 'bbbbbbbbbbbb', pubB64: 'pub-b', nameKey: 'mockContactHana' },
      { id: 'cccccccccccc', pubB64: 'pub-c', nameKey: 'mockContactRen' },
    ];
    const t = k => '<' + k + '>';
    const plan = buildSeedPlan(peers, t, 1_000_000_000_000, { id: 'self-self-se', pubB64: 'self-pub', name: 'Demo User' }, 60_000);
    expect(plan.contacts.filter(c => !c.isGroup)).toHaveLength(3);
    expect(plan.contacts.filter(c => c.isGroup)).toHaveLength(1);
    expect(new Set(plan.messages.filter(m => !m.contactId.startsWith('mock-group')).map(m => m.contactId)).size).toBe(2);
    expect(plan.messages.length).toBeGreaterThanOrEqual(8);
    expect(plan.messages.every(m => m.msgId && m.contactId && typeof m.text === 'string' && typeof m.mine === 'boolean' && m.ts > 0)).toBe(true);
    expect(plan.contacts.find(c => c.isGroup).members).toHaveLength(3);
  });

  it('routes API endpoints locally while fail-closing unknown API and external network paths', async () => {
    const nativeFetch = vi.fn(async () => new Response('static'));
    const api = createMockApi({ nativeFetch });
    const health = await api.fetch('/api/health');
    expect(health.status).toBe(200);
    expect((await health.json()).features.push).toBe(false);

    const poll = await api.fetch('https://relay.example/api/sealed/poll', { method: 'POST', body: '{}' });
    expect(poll.status).toBe(200);
    expect((await poll.json()).messages).toEqual([]);

    expect((await api.fetch('/api/device/list', { method: 'POST', body: '{}' })).status).toBe(200);
    expect((await api.fetch('/api/not-a-real-endpoint', { method: 'POST', body: '{}' })).status).toBe(503);
    expect((await api.fetch('https://example.com/tracker')).status).toBe(503);
    expect(nativeFetch).not.toHaveBeenCalled();

    expect((await api.fetch('/src/app/mock.js')).status).toBe(200);
    expect(nativeFetch).toHaveBeenCalledTimes(1); // same-origin static assets still load
    expect(isMockApiPath('/api/device/list')).toBe(true);
    expect(isMockApiPath('https://relay.example/api/sealed/poll')).toBe(true);
    expect(isMockApiPath('/src/app/mock.js')).toBe(false);
  });

  it('mints syntactically real prekey bundles for seeded sample contacts', async () => {
    const api = createMockApi({});
    const peers = await api.samplePeers();
    expect(peers).toHaveLength(3);
    expect(peers.every(p => p.id.length === 12 && typeof p.pubB64 === 'string' && p.bundle.identityKey === p.pubB64)).toBe(true);
    expect(peers.every(p => p.bundle.signedPreKey && p.bundle.oneTimePreKey && p.bundle.caps.includes('seal-v2'))).toBe(true);
    const fetched = await api.fetch('/api/prekey/fetch', { method: 'POST', body: JSON.stringify({ userId: peers[0].id }) });
    expect(fetched.status).toBe(200);
    expect((await fetched.json()).identityKey).toBe(peers[0].pubB64);
  });

  it('stores and renders one delayed canned reply after a send', async () => {
    globalThis.__BREEZE_MOCK__ = true;
    vi.useFakeTimers();
    const messages = [];
    const contacts = new Map([['c1', { id: 'c1', unread: 0 }]]);
    const appended = [];
    const ctrl = createMock({
      t: k => '<' + k + '>', MS: { SEC: 1000 }, dbGet: async (store, key) => store === 'contacts' ? contacts.get(key) : null,
      dbPut: async (store, rec) => { if (store === 'messages') messages.push(rec); else contacts.set(rec.id, rec); return true; },
      appendMsg: (...args) => appended.push(args), renderContacts: vi.fn(), activeContact: () => ({ id: 'c1' }),
      myId: () => 'me', myPubB64: () => 'me-pub', myName: () => 'Demo User', dom: () => null, dbg: () => {},
    });
    expect(ctrl).toBeTruthy();
    ctrl.afterSend({ id: 'c1' });
    expect(messages).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ contactId: 'c1', mine: false, text: '<mockReply>' });
    expect(appended).toHaveLength(1);
  });
});

describe('mock mode wiring', () => {
  it('runtime-imports and precaches the module, with the fetchT funnel replaced only through the bridge', () => {
    expect(html).toContain("import { createMock, createMockApi, mockEnabled, mockApi } from './src/app/mock.js'; window.__breezeMock = { createMock, createMockApi, enabled: mockEnabled, api: mockApi };");
    expect(sw).toContain("'/src/app/mock.js'");
    const hook = "const _mockApi = globalThis.__breezeMock?.api?.();\n  if (_mockApi) return _mockApi.fetch(url, opts);\n  return fetch(url, opts);";
    expect(html).toContain(hook);
  });

  it('auto-creates through the normal setup flow, seeds after identity creation, and exposes the persistent banner', () => {
    expect(html).toContain('id="mock-banner"');
    expect(html).toContain('data-i18n="mockBanner"');
    expect(html).toContain("if (!globalThis.__BREEZE_MOCK_MANUAL__) {\n        await _runSetupCreate('random');\n        return;\n      }");
    expect(html).toContain('if (_mock) await _mock.seedIfNeeded();');
    expect(html).toContain('_mock?.installBanner();');
  });

  it('blocks call actions, WebRTC connection attempts, beacon presence, push and TURN only in mock mode', () => {
    expect(html.match(/showToast\(t\('mockUnavailable'\), 'info'\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('if (globalThis.__breezeMock?.enabled?.()) return;\n    if (!contact.pubB64');
    expect(html.match(/!globalThis\.__breezeMock\?\.enabled\?\.\(\)\) try \{ navigator\.sendBeacon/g)?.length).toBe(2);
    expect(html).toContain('globalThis.__breezeMock?.enabled?.()) return;\n    _turnFetch?.fetchCredentials();');
    expect(html).toContain('async function initPushNotifications() {\n    if (!(globalThis.__brzApiReady?.() ?? !!API) || !(\'serviceWorker\' in navigator) || !(\'PushManager\' in window) || globalThis.__breezeMock?.enabled?.()) return;');
    const callJs = readFileSync(new URL('../src/app/call.js', import.meta.url), 'utf8');
    const groupCallJs = readFileSync(new URL('../src/app/group-call.js', import.meta.url), 'utf8');
    expect(callJs).toContain('if (globalThis.__breezeMock?.enabled?.()) { showToast(t(\'mockUnavailable\'), \'info\'); return; }');
    expect(groupCallJs).toContain('if (globalThis.__breezeMock?.enabled?.()) { showToast(t(\'mockUnavailable\'), \'info\'); return; }');
  });

  it('keeps index.html below the hard 16,000-line cap', () => {
    expect(html.split('\n').length).toBeLessThan(16000);
  });
});

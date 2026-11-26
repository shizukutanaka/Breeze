// Landing-link extraction: index.html keeps only the module bridge and one
// deferred call, while src/app/landing-links.js owns group-invite fronting,
// 1-to-1 invite fronting, and Web Share Target intake. The behavioural tests
// run the real module against fake DOM/storage/API deps.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { applyLandingLinks } from '../src/app/landing-links.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

const IDS = ['msg-setup-title', 'msg-setup-desc', 'b-msg-setup', 'b-msg-setup-random', 'msg-input'];

function fixture(overrides = {}) {
  const els = Object.fromEntries(IDS.map(id => [id, { textContent: '', value: '', focus: vi.fn() }]));
  const store = new Map();
  const sessionStorageFake = {
    setItem: vi.fn((k, v) => store.set(k, String(v))),
    getItem: vi.fn(k => store.has(k) ? store.get(k) : null),
  };
  const historyFake = { replaceState: vi.fn() };
  vi.stubGlobal('sessionStorage', sessionStorageFake);
  vi.stubGlobal('history', historyFake);
  const calls = [];
  const t = (key, ...args) => {
    calls.push([key, ...args]);
    return key + (args.length ? ':' + args.join(':') : '');
  };
  const deps = {
    addKey: null,
    addName: null,
    joinToken: null,
    shareText: '',
    apiReady: () => true,
    postAPIRaw: vi.fn(),
    DOM: { get: id => els[id] || null },
    t,
    dbg: vi.fn(),
    getActiveContact: () => null,
    ...overrides,
  };
  return { els, store, sessionStorageFake, historyFake, calls, deps };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('landing-links module wiring', () => {
  it('ships as a deployed module with its own bridge and precache entry', () => {
    const blocks = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(m => m[1]);
    const block = blocks.find(b => b.includes('window.__breezeLandingLinks'));
    expect(block).toBeTruthy();
    expect(block).toContain("import { applyLandingLinks } from './src/app/landing-links.js';");
    expect(block).toContain('window.__breezeLandingLinks = { applyLandingLinks };');
    expect(block).not.toContain('dialogs.js');
    expect(sw).toContain("'/src/app/landing-links.js'");
  });

  it('index.html keeps only the deferred bridge call, not the moved inline blocks', () => {
    expect(html).toContain("_appModulesReady.then(() => { try { globalThis.__breezeLandingLinks?.applyLandingLinks({");
    expect(html).toContain("addKey: P.get('add'), addName: P.get('name'), joinToken");
    expect(html).toContain("shareText: [P.get('title'), P.get('text'), P.get('url')].filter(Boolean).join('\\n')");
    expect(html).toContain('getActiveContact: () => null');
    expect(html).not.toContain('if (joinToken && (globalThis.__brzApiReady?.() ?? !!API))');
    expect(html).not.toContain("sessionStorage.setItem('brz-shared-text', sharedText);");
    expect(html).not.toContain('if (input && activeContact) { input.value = sharedText; input.focus(); }');
  });

  it('a missing landing-links bridge is included in the module-failure toast condition', () => {
    expect(html).toContain('if (!globalThis.__breezeOfflinePairing || !globalThis.__breezeDialogs || !globalThis.__breezeLandingLinks) showToast');
  });
});

describe('group invite fronting', () => {
  it('fetch ok → title, desc, and join button are set from the group data', async () => {
    const { els, deps } = fixture({ joinToken: 'tok123' });
    deps.postAPIRaw.mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'Team', creatorName: 'Alice', members: ['a', 'b', 'c'] }),
    });
    applyLandingLinks(deps);
    await flush();
    expect(deps.postAPIRaw).toHaveBeenCalledWith('/group/info', { token: 'tok123' });
    expect(els['msg-setup-title'].textContent).toBe('joinGroup:Team');
    expect(els['msg-setup-desc'].textContent).toBe('invitedBy:Alice:3');
    expect(els['b-msg-setup'].textContent).toBe('joinBtn');
    expect(deps.dbg).not.toHaveBeenCalled();
  });

  it('fetch not ok → nothing is set', async () => {
    const { els, deps } = fixture({ joinToken: 'tok123' });
    deps.postAPIRaw.mockResolvedValue({ ok: false });
    applyLandingLinks(deps);
    await flush();
    expect(deps.postAPIRaw).toHaveBeenCalledWith('/group/info', { token: 'tok123' });
    for (const id of ['msg-setup-title', 'msg-setup-desc', 'b-msg-setup']) expect(els[id].textContent).toBe('');
  });
});

describe('1-to-1 invite fronting', () => {
  it('add with a name → title uses the name, desc and the random-start button use invite copy', () => {
    const { els, deps } = fixture({ addKey: 'pubkey123', addName: '  Alice  ' });
    applyLandingLinks(deps);
    expect(els['msg-setup-title'].textContent).toBe('inviteTitle:Alice');
    expect(els['msg-setup-desc'].textContent).toBe('inviteDesc');
    expect(els['b-msg-setup-random'].textContent).toBe('inviteBtn');
    expect(deps.postAPIRaw).not.toHaveBeenCalled();
  });

  it('add with an @alias and no name → title uses the alias', () => {
    const { els, deps } = fixture({ addKey: '@alice', addName: '   ' });
    applyLandingLinks(deps);
    expect(els['msg-setup-title'].textContent).toBe('inviteTitle:@alice');
  });

  it('add with a bare pubkey and no name → anonymous invite title', () => {
    const { els, deps } = fixture({ addKey: 'pubkey123' });
    applyLandingLinks(deps);
    expect(els['msg-setup-title'].textContent).toBe('inviteTitleAnon');
    expect(els['msg-setup-desc'].textContent).toBe('inviteDesc');
    expect(els['b-msg-setup-random'].textContent).toBe('inviteBtn');
  });

  it('add + join both present → add fronting does not run', async () => {
    const { els, deps } = fixture({ addKey: '@alice', addName: 'Alice', joinToken: 'tok123' });
    deps.postAPIRaw.mockResolvedValue({ ok: false });
    applyLandingLinks(deps);
    await flush();
    expect(deps.postAPIRaw).toHaveBeenCalledWith('/group/info', { token: 'tok123' });
    expect(els['msg-setup-title'].textContent).toBe('');
    expect(els['msg-setup-desc'].textContent).toBe('');
    expect(els['b-msg-setup-random'].textContent).toBe('');
  });
});

describe('Web Share Target intake', () => {
  it('shareText present → sessionStorage receives brz-shared-text and the URL is reset', () => {
    vi.useFakeTimers();
    const { store, sessionStorageFake, historyFake, deps } = fixture({ shareText: 'title\nshared text' });
    applyLandingLinks(deps);
    expect(sessionStorageFake.setItem).toHaveBeenCalledWith('brz-shared-text', 'title\nshared text');
    expect(store.get('brz-shared-text')).toBe('title\nshared text');
    expect(historyFake.replaceState).toHaveBeenCalledWith(null, '', '/');
  });

  it('the delayed paste consults getActiveContact and fills the input only when a conversation is active', () => {
    vi.useFakeTimers();
    const active = { id: 'c1' };
    const { els, deps } = fixture({ shareText: 'shared', getActiveContact: () => active });
    applyLandingLinks(deps);
    vi.advanceTimersByTime(999);
    expect(els['msg-input'].value).toBe('');
    vi.advanceTimersByTime(1);
    expect(els['msg-input'].value).toBe('shared');
    expect(els['msg-input'].focus).toHaveBeenCalledOnce();
  });

  it('the delayed paste remains inert with no active conversation', () => {
    vi.useFakeTimers();
    const { els, deps } = fixture({ shareText: 'shared', getActiveContact: () => null });
    applyLandingLinks(deps);
    vi.advanceTimersByTime(1000);
    expect(els['msg-input'].value).toBe('');
    expect(els['msg-input'].focus).not.toHaveBeenCalled();
  });
});

describe('no landing parameters', () => {
  it('nothing changes and no fetch is made', () => {
    const { els, deps, sessionStorageFake, historyFake } = fixture();
    applyLandingLinks(deps);
    for (const id of IDS) expect(els[id].textContent).toBe('');
    expect(deps.postAPIRaw).not.toHaveBeenCalled();
    expect(sessionStorageFake.setItem).not.toHaveBeenCalled();
    expect(historyFake.replaceState).not.toHaveBeenCalled();
  });
});

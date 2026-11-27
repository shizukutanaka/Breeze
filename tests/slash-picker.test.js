import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createSlashPicker, SLASH_COMMANDS, SLASH_DESCS } from '../src/app/slash-picker.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

const COMMANDS_71 = ['/help', '/search', '/searchall', '/pins', '/bookmarks', '/reply', '/poll', '/timer', '/schedule', '/clear', '/export', '/import', '/summarize', '/reactions', '/compact', '/files', '/print', '/rendezvous', '/offlinepair', '/info', '/note', '/pin', '/mute', '/archive', '/unblock', '/members', '/admin', '/add', '/label', '/sort', '/newgroup', '/rename', '/invite', '/qr', '/share', '/contacts', '/focus', '/settings', '/theme', '/wallpaper', '/lock', '/sound', '/compress', '/alias', '/whoami', '/who', '/debug', '/online', '/security', '/verify', '/audit', '/retention', '/backup', '/keywrap', '/vault', '/sessions', '/wipe', '/gdpr', '/panic', '/devices', '/link', '/linkto', '/unlink', '/history', '/migrate', '/profile', '/stickers', '/location', '/retry', '/drop', '/room'];

const EN_DESCS = {
  cmdDescHelp: 'List all commands',
  cmdDescSearch: 'Search this chat',
  cmdDescPoll: 'Start a poll',
  cmdDescTimer: 'Disappearing messages timer',
  cmdDescSchedule: 'Schedule a message',
  cmdDescPin: 'Pin a message',
  cmdDescPins: 'List pinned messages',
  cmdDescMute: 'Mute this conversation',
  cmdDescInvite: 'Invite link for this chat',
  cmdDescQr: 'Show my QR code',
  cmdDescShare: 'Share my contact',
  cmdDescAdd: 'Add a contact',
  cmdDescNewgroup: 'Create a group',
  cmdDescExport: 'Export this chat',
  cmdDescBackup: 'Back up my data',
  cmdDescSettings: 'Open settings',
};

function installHarness() {
  let slashPicker = null;
  function makeElement(tag = 'div') {
    return {
      tagName: tag.toUpperCase(),
      id: '',
      className: '',
      value: '',
      dataset: {},
      children: [],
      parent: null,
      removed: false,
      innerHTML: '',
      focus: vi.fn(),
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
      },
      setAttribute(name, value) { this.dataset[name === 'role' ? 'role' : name] = value; },
      appendChild(child) {
        child.parent = this;
        this.children.push(child);
        if (child.id === 'slash-picker') slashPicker = child;
      },
      remove() {
        this.removed = true;
        if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
        if (this.id === 'slash-picker' && slashPicker === this) slashPicker = null;
      },
      querySelectorAll(selector) {
        return selector === '.mention-item' ? (this._items || []) : [];
      },
      click() { this.onclick?.(); },
      mouseenter() { this.onmouseenter?.(); },
    };
  }

  const input = makeElement('textarea');
  input.parentElement = makeElement('div');
  const listeners = {};
  input.addEventListener = vi.fn((type, fn) => { listeners[type] = fn; });

  vi.stubGlobal('document', {
    createElement: vi.fn((tag) => makeElement(tag)),
  });

  const safeSetHTML = vi.fn((el, markup) => {
    el.innerHTML = markup;
    el._items = [...markup.matchAll(/<div class="mention-item i-ctx-row" role="option" data-cmd="([^"]+)">([\s\S]*?)<\/div>/g)].map((m) => {
      const item = makeElement('div');
      item.dataset.cmd = m[1];
      item.innerHTML = m[2];
      return item;
    });
  });

  const deps = {
    input,
    DOM: { get: (id) => (id === 'slash-picker' ? slashPicker : null) },
    t: (key) => EN_DESCS[key] || key,
    esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    safeSetHTML,
  };

  const type = (value) => {
    input.value = value;
    listeners.input?.({ target: input });
  };
  const picker = () => slashPicker;
  return { input, listeners, deps, type, picker, safeSetHTML };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('slash-picker module wiring', () => {
  it('ships as a deployed module with its own bridge and precache entry', () => {
    const blocks = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    const block = blocks.find((b) => b.includes('window.__breezeSlashPicker'));
    expect(block).toBeTruthy();
    expect(block).toContain("import { createSlashPicker, SLASH_COMMANDS, SLASH_DESCS } from './src/app/slash-picker.js';");
    expect(block).toContain('window.__breezeSlashPicker = { createSlashPicker, SLASH_COMMANDS, SLASH_DESCS };');
    expect(block).not.toContain('p2p-stats.js');
    expect(sw).toContain("'/src/app/slash-picker.js'");
  });

  it('index.html keeps only the bridge call and reports a missing bridge in the module-failure toast condition', () => {
    expect(html).toContain("globalThis.__breezeSlashPicker?.createSlashPicker({ input: _DOM.get('msg-input'), DOM: _DOM, t, esc, safeSetHTML });");
    expect(html).not.toContain('const _SLASH_COMMANDS = [');
    expect(html).toContain('if (!globalThis.__breezeOfflinePairing || !globalThis.__breezeDialogs || !globalThis.__breezeLandingLinks || !globalThis.__breezeSlashPicker) showToast');
  });
});

describe('slash-picker behaviour', () => {
  it('typing / lists commands and shows descriptions only for the curated set', () => {
    const h = installHarness();
    createSlashPicker(h.deps);
    h.type('/');
    const items = h.picker().querySelectorAll('.mention-item');
    expect(items.length).toBeGreaterThan(0);
    const help = items.find((item) => item.dataset.cmd === '/help');
    expect(help.innerHTML).toContain('List all commands');
    expect(help.innerHTML).toContain('class="i-small-muted"');

    h.type('/keywrap');
    const keywrapItems = h.picker().querySelectorAll('.mention-item');
    expect(keywrapItems).toHaveLength(1);
    expect(keywrapItems[0].innerHTML).toBe('/keywrap');
    expect(keywrapItems[0].innerHTML).not.toContain('i-small-muted');
  });

  it('filters by prefix and caps suggestions at eight', () => {
    const h = installHarness();
    createSlashPicker(h.deps);
    h.type('/po');
    const commands = h.picker().querySelectorAll('.mention-item').map((item) => item.dataset.cmd);
    expect(commands).toContain('/poll');
    expect(commands).not.toContain('/pin');

    h.type('/');
    const all = h.picker().querySelectorAll('.mention-item').map((item) => item.dataset.cmd);
    expect(all).toHaveLength(8);
    expect(all).toEqual(COMMANDS_71.slice(0, 8));
  });

  it('clicking an item fills the input, removes the picker, and refocuses the composer', () => {
    const h = installHarness();
    createSlashPicker(h.deps);
    h.type('/he');
    const item = h.picker().querySelectorAll('.mention-item').find((el) => el.dataset.cmd === '/help');
    item.click();
    expect(h.input.value).toBe('/help ');
    expect(h.picker()).toBeNull();
    expect(h.input.focus).toHaveBeenCalledOnce();
  });

  it('non-slash input and slash prefixes with no matches remove the picker', () => {
    const h = installHarness();
    createSlashPicker(h.deps);
    h.type('/');
    expect(h.picker()).not.toBeNull();
    h.type('hello');
    expect(h.picker()).toBeNull();

    h.type('/');
    expect(h.picker()).not.toBeNull();
    h.type('/zzzzzz');
    expect(h.picker()).toBeNull();
  });
});

describe('slash-picker exported data', () => {
  it('keeps the original 71 commands in the original order', () => {
    expect(SLASH_COMMANDS).toEqual(COMMANDS_71);
    expect(SLASH_COMMANDS).toHaveLength(71);
  });

  it('describes exactly the curated first-success and everyday commands', () => {
    expect(SLASH_DESCS).toEqual({
      '/help': 'cmdDescHelp',
      '/search': 'cmdDescSearch',
      '/poll': 'cmdDescPoll',
      '/timer': 'cmdDescTimer',
      '/schedule': 'cmdDescSchedule',
      '/pin': 'cmdDescPin',
      '/pins': 'cmdDescPins',
      '/mute': 'cmdDescMute',
      '/invite': 'cmdDescInvite',
      '/qr': 'cmdDescQr',
      '/share': 'cmdDescShare',
      '/add': 'cmdDescAdd',
      '/newgroup': 'cmdDescNewgroup',
      '/export': 'cmdDescExport',
      '/backup': 'cmdDescBackup',
      '/settings': 'cmdDescSettings',
    });
  });
});

// Share / migrate surfacing (SHARE_PLAN stage 4 step 1): the invite and
// migration flows that used to exist only as slash commands (/invite, /qr,
// /newgroup, /migrate, /import) are now behind UI doors — the contacts
// empty state and the settings panel. The doors live in src/app/share.js
// as a factory over the SAME closure functions the commands call, so this
// suite pins (a) the factory's behaviour against spy deps, including the
// migrate panel's button wiring, and (b) the surfacing wiring in
// index.html / sw.js / locales, so a door cannot silently unwire.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createShareTools } from '../src/app/share.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
const sw = readFileSync(join(HERE, '..', 'sw.js'), 'utf8');
const ja = JSON.parse(readFileSync(join(HERE, '..', 'locales', 'ja.json'), 'utf8'));

// ── Fake DOM: just enough of <dialog>/<input> for the module ─────────
class FakeEl {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attrs = {};
    this.onclick = null;
    this.onchange = null;
    this.listeners = {};
    this.removed = false;
    this.closed = false;
  }
  setAttribute(k, v) { this.attrs[k] = v; }
  appendChild(c) { this.children.push(c); return c; }
  append(...cs) { this.children.push(...cs); }
  addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  querySelector(sel) {
    if (sel === '[data-guide]') return (this.__guide ||= new FakeEl('div'));
    const m = sel.match(/\[data-act="(\w+)"\]/);
    if (m) return (this.__btns ||= {})[m[1]] ||= new FakeEl('button');
    return null;
  }
  showModal() { this.open = true; }
  close() { this.closed = true; for (const fn of this.listeners.close || []) fn(); }
  remove() { this.removed = true; }
  click() { this.clicked = true; }
  getBoundingClientRect() { return { left: 0, right: 100, top: 0, bottom: 100 }; }
}

const saved = {};
let created; // elements the module asked document to create
beforeAll(() => {
  for (const k of ['t', '_dbg', 'showToast', 'showPrompt', 'safeSetHTML', 'esc', 'uid', 'document', 'navigator', 'window']) saved[k] = globalThis[k];
  globalThis.t = (k) => k;
  globalThis._dbg = () => {};
  globalThis.showToast = (msg, type) => { (globalThis.__toasts ||= []).push({ msg, type }); };
  globalThis.showPrompt = async () => globalThis.__promptValue;
  globalThis.safeSetHTML = (el, s) => { el.__html = s; };
  globalThis.esc = (s) => s;
  globalThis.uid = () => 'testuid';
  created = [];
  globalThis.document = {
    createElement: (tag) => { const el = new FakeEl(tag); created.push(el); return el; },
    body: new FakeEl('body'),
  };
  globalThis.window = globalThis;
});
afterAll(() => {
  // 'navigator' is a read-only accessor on this Node — restore it (and any
  // key a test redefined non-writable) via defineProperty, not assignment.
  for (const k of Object.keys(saved)) {
    if (saved[k] === undefined) { delete globalThis[k]; continue; }
    try { globalThis[k] = saved[k]; } catch { Object.defineProperty(globalThis, k, { value: saved[k], configurable: true, writable: true }); }
  }
});

function makeTools(overrides = {}) {
  const calls = { qr: [], group: [], imported: [] };
  const tools = createShareTools({
    generateInviteMessage: () => ({ url: 'https://breeze.example/?add=@alice', msg: 'INVITE-MSG' }),
    showQRModal: (url) => calls.qr.push(url),
    createGroupInviteLink: async (name) => { calls.group.push(name); },
    importChat: async (file) => { calls.imported.push(file); },
    ...overrides,
  });
  return { tools, calls };
}

describe('share tools factory (src/app/share.js)', () => {
  it('exposes the five doors', () => {
    const { tools } = makeTools();
    for (const k of ['shareInvite', 'showInviteQR', 'createGroupInvite', 'pickImportFile', 'showMigratePanel']) {
      expect(typeof tools[k]).toBe('function');
    }
  });

  it('shareInvite copies the SAME message /invite builds and offers the share sheet', async () => {
    const copied = []; const shared = [];
    Object.defineProperty(globalThis, 'navigator', { value: {
      clipboard: { writeText: (s) => { copied.push(s); } },
      share: async (o) => { shared.push(o); },
    }, configurable: true, writable: true });
    globalThis.__toasts = [];
    const { tools } = makeTools();
    await tools.shareInvite();
    expect(copied).toEqual(['INVITE-MSG']);
    expect(shared).toEqual([{ title: 'Breeze', text: 'INVITE-MSG' }]);
    expect(globalThis.__toasts).toEqual([{ msg: 'uiInviteCopied', type: 'success' }]);
  });

  it('shareInvite still confirms when there is no share sheet', async () => {
    Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: () => {} } }, configurable: true, writable: true });
    globalThis.__toasts = [];
    const { tools } = makeTools();
    await tools.shareInvite();
    expect(globalThis.__toasts).toHaveLength(1);
  });

  it('showInviteQR opens the QR modal over the invite URL', () => {
    const { tools, calls } = makeTools();
    tools.showInviteQR();
    expect(calls.qr).toEqual(['https://breeze.example/?add=@alice']);
  });

  it('createGroupInvite prompts for a name and hands it to the existing creation', async () => {
    globalThis.__promptValue = 'LINE Group';
    const { tools, calls } = makeTools();
    await tools.createGroupInvite();
    expect(calls.group).toEqual(['LINE Group']);
  });

  it('createGroupInvite does nothing when the prompt is cancelled', async () => {
    globalThis.__promptValue = null;
    const { tools, calls } = makeTools();
    await tools.createGroupInvite();
    expect(calls.group).toEqual([]);
  });

  it('pickImportFile hands the chosen file to importChat untouched', async () => {
    created = [];
    const { tools, calls } = makeTools();
    tools.pickImportFile();
    const input = created.find(e => e.tagName === 'INPUT');
    expect(input).toBeTruthy();
    expect(input.type).toBe('file');
    expect(input.accept).toBe('.txt,.json,.zip');
    expect(input.clicked).toBe(true);
    const file = { name: 'chat.txt' };
    await input.onchange({ target: { files: [file] } });
    expect(calls.imported).toEqual([file]);
  });

  it('the migrate panel renders the guide and wires its four flow buttons', async () => {
    created = [];
    const copied = [];
    Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: (s) => copied.push(s) } }, configurable: true, writable: true });
    globalThis.__promptValue = 'Crew';
    const { tools, calls } = makeTools();
    tools.showMigratePanel();
    const dlg = created.find(e => e.tagName === 'DIALOG');
    expect(dlg).toBeTruthy();
    expect(dlg.open).toBe(true);
    // The guide body is the /migrate content itself, not a copy.
    expect(dlg.__guide.__html).toBe('migrateHtml');
    // Invite: copies and KEEPS the panel open (more steps remain on it).
    await dlg.__btns.invite.onclick();
    expect(copied).toEqual(['INVITE-MSG']);
    expect(dlg.closed).toBe(false);
    // QR: closes the panel, opens the modal over the invite URL.
    dlg.__btns.qr.onclick();
    expect(dlg.closed).toBe(true);
    expect(calls.qr).toEqual(['https://breeze.example/?add=@alice']);
  });

  it('the migrate panel group button closes, then runs the group-invite flow', async () => {
    created = [];
    globalThis.__promptValue = 'Crew';
    const { tools, calls } = makeTools();
    tools.showMigratePanel();
    const dlg = created.find(e => e.tagName === 'DIALOG');
    await dlg.__btns.group.onclick();
    expect(dlg.closed).toBe(true);
    expect(calls.group).toEqual(['Crew']);
  });

  it('the migrate panel import button closes, then opens the file picker', async () => {
    created = [];
    const { tools, calls } = makeTools();
    tools.showMigratePanel();
    const dlg = created.find(e => e.tagName === 'DIALOG');
    dlg.__btns.import.onclick();
    expect(dlg.closed).toBe(true);
    const input = created.find(e => e.tagName === 'INPUT');
    expect(input).toBeTruthy();
    const file = { name: 'history.json' };
    await input.onchange({ target: { files: [file] } });
    expect(calls.imported).toEqual([file]);
  });
});

describe('surfacing wiring (index.html / sw.js / locales)', () => {
  const NEW_KEYS = ['btnInviteFriend', 'btnMigrateApps', 'btnCopyInvite', 'btnInviteQr', 'btnGroupInvite', 'btnImportHistory', 'settingsShare'];

  it('the module is loaded behind the __breezeShare bridge and precached', () => {
    expect(html).toContain("import { createShareTools } from './src/app/share.js'");
    expect(html).toContain('window.__breezeShare = { createShareTools }');
    expect(sw).toContain("'/src/app/share.js'");
  });

  it('the factory is instantiated with the four closure deps the commands use', () => {
    expect(html).toContain('globalThis.__breezeShare?.createShareTools({');
    expect(html).toContain('generateInviteMessage, showQRModal, createGroupInviteLink, importChat,');
  });

  it('the contacts empty state offers the invite and migrate doors', () => {
    expect(html).toContain("invBtn.textContent = t('btnInviteFriend')");
    expect(html).toContain('invBtn.onclick = () => { shareInvite(); }');
    expect(html).toContain("migBtn.textContent = t('btnMigrateApps')");
    expect(html).toContain('migBtn.onclick = () => { showMigratePanel(); }');
    // …and only in the zero-contacts state, not on every empty folder.
    expect(html).toContain('if (contacts.length === 0) {');
  });

  it('the settings panel offers the same two doors', () => {
    expect(html).toContain('data-action="invite-friend"');
    expect(html).toContain('data-action="migrate-apps"');
    expect(html).toContain("ev.target.closest('[data-action=\"invite-friend\"]')");
    expect(html).toContain("ev.target.closest('[data-action=\"migrate-apps\"]')");
  });

  it('EN keys are in index.html and JA keys in locales/ja.json', () => {
    for (const k of NEW_KEYS) {
      expect(html).toContain(k + ':');
      expect(typeof ja[k]).toBe('string');
      expect(ja[k].length).toBeGreaterThan(0);
    }
  });
});

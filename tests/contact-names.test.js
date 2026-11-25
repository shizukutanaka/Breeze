// Contact display names (feat/contact-names).
//
// What is pinned here:
//
//   Behaviour — the deployed name-tools factory supplies the real
//   resolution/write functions extracted from index.html:
//   1. The primary display name is c.name: the local nickname when
//      the user renamed the contact (nameLocked), otherwise the
//      name the contact set for themselves.
//   2. The contact's own name (c.profileName) rides alongside ONLY
//      when a nickname shadows it, it differs, and the Settings
//      toggle (showPeerName, default on) allows it. Groups never
//      get a peer name.
//   3. setContactNickname writes the SAME store the context-menu
//      rename has always used (c.name + nameLocked) — setting,
//      changing, clearing (which hands the name back to the
//      contact's own name), and the 64-char cap.
//   4. Saving a nickname for the open conversation re-renders the
//      chat header through the shared _setConvName path, peer-name
//      span included.
//
//   Wiring (source pins):
//   5. The contact list, the chat header, the profile-update path
//      and the search haystack all go through the shared
//      resolution; there is NO parallel nickname store (no
//      c.nickname field anywhere).
//   6. The Settings toggle exists with default true, and the
//      contact-info panel (nickname editor + local-only note) is
//      reachable from both the contact context menu and the
//      conversation menu.
//   7. The new i18n keys exist in EN + JA (real translation) and
//      in all 50 locale files.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createNameTools } from '../src/app/lookalike-names.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const names = readFileSync(new URL('../src/app/lookalike-names.js', import.meta.url), 'utf8');

function loadNameTools(settings, activeContact) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const state = { puts: [], headerHtml: null, renders: 0 };
  const _DOM = { get: () => ({}) };
  const t = (k) => k;
  const safeSetHTML = (el, h) => { state.headerHtml = h; };
  const dbPut = async (store, rec) => { state.puts.push([store, rec]); };
  const renderContacts = () => { state.renders++; };
  const tools = createNameTools({ esc, settings: () => settings, dom: _DOM.get, t, html: safeSetHTML, put: dbPut, render: renderContacts, active: () => activeContact });
  return { tools, state };
}

describe('contact display-name resolution', () => {
  it('an unrenamed contact shows their own name and no peer span', () => {
    const { tools } = loadNameTools({ showPeerName: true }, null);
    const c = { name: 'Alice', profileName: 'Alice' };
    expect(tools.contactDisplayName(c)).toBe('Alice');
    expect(tools.contactPeerName(c)).toBe('');
    expect(tools.contactPeerNameHtml(c)).toBe('');
  });

  it('a nickname is primary; their own name rides alongside, muted', () => {
    const { tools } = loadNameTools({ showPeerName: true }, null);
    const c = { name: 'Boss', nameLocked: true, profileName: 'Alice' };
    expect(tools.contactDisplayName(c)).toBe('Boss');
    expect(tools.contactPeerName(c)).toBe('Alice');
    expect(tools.contactPeerNameHtml(c)).toContain('(Alice)');
    expect(tools.contactPeerNameHtml(c)).toContain('i-t3-10');
  });

  it('the Settings toggle hides the peer name (and defaults are irrelevant to resolution)', () => {
    const { tools } = loadNameTools({ showPeerName: false }, null);
    const c = { name: 'Boss', nameLocked: true, profileName: 'Alice' };
    expect(tools.contactPeerName(c)).toBe('Alice'); // resolution unchanged
    expect(tools.contactPeerNameHtml(c)).toBe('');   // only the rendering obeys the toggle
  });

  it('no peer span when the names agree, when no profile arrived, or for groups', () => {
    const { tools } = loadNameTools({ showPeerName: true }, null);
    expect(tools.contactPeerName({ name: 'Alice', nameLocked: true, profileName: 'Alice' })).toBe('');
    expect(tools.contactPeerName({ name: 'Boss', nameLocked: true })).toBe('');
    expect(tools.contactPeerName({ name: 'Team', isGroup: true, nameLocked: true, profileName: 'Alice' })).toBe('');
    expect(tools.contactPeerName(null)).toBe('');
    expect(tools.contactDisplayName(null)).toBe('');
  });
});

describe('setContactNickname — the one write path', () => {
  it('setting a nickname writes c.name + nameLocked and persists the contact', async () => {
    const { tools, state } = loadNameTools({ showPeerName: true }, null);
    const c = { id: 'c1', name: 'Alice', profileName: 'Alice' };
    await tools.setContactNickname(c, '  Boss  ');
    expect(c.name).toBe('Boss');
    expect(c.nameLocked).toBe(true);
    expect(state.puts).toEqual([['contacts', c]]);
    expect(state.renders).toBe(1);
  });

  it('changing a nickname replaces it in the same fields', async () => {
    const { tools } = loadNameTools({ showPeerName: true }, null);
    const c = { id: 'c1', name: 'Boss', nameLocked: true, profileName: 'Alice' };
    await tools.setContactNickname(c, 'Chief');
    expect(c.name).toBe('Chief');
    expect(c.nameLocked).toBe(true);
  });

  it('clearing hands the display back to the contact’s own name', async () => {
    const { tools } = loadNameTools({ showPeerName: true }, null);
    const c = { id: 'c1', name: 'Boss', nameLocked: true, profileName: 'Alice' };
    await tools.setContactNickname(c, '');
    expect(c.nameLocked).toBe(false);
    expect(c.name).toBe('Alice');
  });

  it('clearing without a received profile keeps the name but unlocks it', async () => {
    const { tools } = loadNameTools({ showPeerName: true }, null);
    const c = { id: 'c1', name: 'Boss', nameLocked: true };
    await tools.setContactNickname(c, '   ');
    expect(c.nameLocked).toBe(false);
    expect(c.name).toBe('Boss'); // nothing better exists yet; future profiles may update it again
  });

  it('nicknames are capped at 64 chars, like the rename before it', async () => {
    const { tools } = loadNameTools({ showPeerName: true }, null);
    const c = { id: 'c1', name: 'Alice' };
    await tools.setContactNickname(c, 'x'.repeat(80));
    expect(c.name).toHaveLength(64);
  });

  it('saving a nickname for the open conversation re-renders its header with the peer span', async () => {
    const c = { id: 'c1', name: 'Alice', profileName: 'Alice' };
    const { tools, state } = loadNameTools({ showPeerName: true }, c);
    await tools.setContactNickname(c, 'Boss');
    expect(state.headerHtml).toContain('Boss');
    expect(state.headerHtml).toContain('(Alice)');
  });
});

describe('wiring — one shared path, no parallel store', () => {
  it('the contact list renders through the shared resolution', () => {
    expect(html).toContain('esc(contactDisplayName(c))}${contactPeerNameHtml(c)}');
  });

  it('the chat header renders through _setConvName at open, profile update, unblock and group rename', () => {
    expect(html).toContain('_setConvName(contact);');
    expect(names).toContain('if (D.active()?.id === c.id) _setConvName(c);');
    expect(html).toContain('_setConvName(activeContact);');
  });

  it('search matches BOTH the nickname and the contact’s own name', () => {
    expect(html).toContain("(c.name || ''), (c.profileName || '')");
  });

  it('there is no second nickname store on the contact record', () => {
    expect(html).not.toContain('c.nickname');
    expect(names).toContain('c.nameLocked = true;');
  });

  it('the Settings toggle exists, defaults on, and re-renders on change', () => {
    expect(html).toContain('showPeerName: true,');
    expect(html).toContain('data-setting="show-peer-name"');
    expect(html).toContain("if (s === 'show-peer-name') { _settings.showPeerName = cb.checked; saveSettings(); renderContacts(); if (activeContact) _setConvName(activeContact); return; }");
  });

  it('the contact-info panel is reachable from both menus and carries the editor + local-only note', () => {
    expect(html).toContain("{ label: t('contactInfo'), action: 'info' }");
    expect(html).toContain("else if (action === 'info') showContactInfo(activeContact);");
    expect(html).toContain('function showContactInfo(contact) {');
    expect(html).toContain("t('nicknameLocalNote')");
    expect(html).toContain("await setContactNickname(contact, '');");
  });
});

describe('i18n — the new keys land everywhere', () => {
  const KEYS = ['contactInfo', 'peerNameLabel', 'nicknameLabel', 'nicknameLocalNote', 'nicknameClear', 'toastNicknameSaved', 'toastNicknameCleared', 'showPeerNameLabel'];
  it('EN carries all of them', () => {
    for (const k of KEYS) expect(html).toContain(k + ':');
  });
  it('all 50 locale files carry all of them; JA is a real translation', () => {
    const dir = new URL('../locales/', import.meta.url);
    const files = readdirSync(dir).filter(f => f.endsWith('.json'));
    expect(files).toHaveLength(50);
    for (const f of files) {
      const loc = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
      for (const k of KEYS) expect(typeof loc[k], f + ':' + k).toBe('string');
    }
    const ja = JSON.parse(readFileSync(new URL('ja.json', dir), 'utf8'));
    expect(ja.contactInfo).toBe('連絡先の情報');
    expect(ja.showPeerNameLabel).toBe('相手が設定した名前も表示する');
    const de = JSON.parse(readFileSync(new URL('de.json', dir), 'utf8'));
    expect(de.contactInfo).toBe('Contact info'); // untranslated locales carry the English value
  });
});

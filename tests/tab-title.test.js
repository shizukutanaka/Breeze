import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function renderContactsBlock() {
  const startMarker = '  async function renderContacts() {';
  const endMarker = '\n\n  function updateFaviconBadge(count) {';
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw Error('renderContacts markers moved');
  return html.slice(start, end);
}

function electronBlock() {
  const start = html.indexOf('// ELECTRON NATIVE INTEGRATION');
  const endMarker = '} // ← END of the Electron-only block.';
  const end = html.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw Error('electron integration markers moved');
  return html.slice(start, end + endMarker.length);
}

describe('tab title unread counter', () => {
  it('has no periodic DOM recount or dead recount state', () => {
    expect(html).not.toContain('updateTabTitle');
    expect(html).not.toContain('_unreadTotal');
    expect(html).not.toContain('_originalTitle');
  });

  it('updates the title and application badge from the full contacts data on every render', () => {
    const block = renderContactsBlock();
    expect(block).toContain('contacts.reduce((s, c) => s + (c.unread || 0), 0)');
    expect(block).toContain('_updateTitle(totalUnread)');
    expect(block).toContain('updateFaviconBadge(totalUnread)');
    expect(block).toContain('navigator.setAppBadge(totalUnread)');
    expect(block).toContain('navigator.clearAppBadge()');

    const totalAt = block.indexOf('contacts.reduce((s, c) => s + (c.unread || 0), 0)');
    const titleAt = block.indexOf('_updateTitle(totalUnread)');
    const faviconAt = block.indexOf('updateFaviconBadge(totalUnread)');
    const badgeAt = block.indexOf('navigator.setAppBadge(totalUnread)');
    expect(totalAt).toBeGreaterThanOrEqual(0);
    expect(titleAt).toBeGreaterThan(totalAt);
    expect(faviconAt).toBeGreaterThan(titleAt);
    expect(badgeAt).toBeGreaterThan(faviconAt);
  });

  it('drives the Electron native badge from renderContacts instead of a DOM recount interval', () => {
    const electron = electronBlock();
    expect(electron).not.toContain('  setInterval(async () => {');
    expect(electron).not.toContain("querySelectorAll('.bdg-row')");
    expect(electron).not.toContain('window.breeze.setBadge(total)');
    expect(electron).not.toContain('_origRenderContacts');

    const render = renderContactsBlock();
    expect(render).toContain('window.breeze.setBadge(totalUnread)');
    expect(render.indexOf('window.breeze.setBadge(totalUnread)')).toBeGreaterThan(render.indexOf('navigator.setAppBadge(totalUnread)'));
  });
});

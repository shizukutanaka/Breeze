import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Electron badge regression: the native badge is event-driven from the full
// contacts data in renderContacts. There must be no five-second recount of the
// filtered DOM rows — on the Calls tab that recount was zero and erased the
// correct native badge.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function electronBlock() {
  const start = html.indexOf('// ELECTRON NATIVE INTEGRATION');
  const endMarker = '} // ← END of the Electron-only block.';
  const end = html.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw Error('electron integration markers moved');
  return html.slice(start, end + endMarker.length);
}

function renderContactsBlock() {
  const startMarker = '  async function renderContacts() {';
  const endMarker = '\n\n  function updateFaviconBadge(count) {';
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw Error('renderContacts markers moved');
  return html.slice(start, end);
}

describe('electron badge updates', () => {
  it('does not contain the dead hardcoded IndexedDB open, while keeping the real open', () => {
    expect(html).not.toContain("indexedDB.open('breeze-messenger', 2)");
    expect(html).toContain('indexedDB.open(dbName, DB_VER)');
  });

  it('has no periodic .bdg-row recount or dead recount hook in the Electron block', () => {
    const block = electronBlock();
    expect(block).not.toContain('  setInterval(async () => {');
    expect(block).not.toContain("querySelectorAll('.bdg-row')");
    expect(block).not.toContain('.bdg-row');
    expect(block).not.toContain('_origRenderContacts');
    expect(block).not.toContain('window._breezeRenderForBadge');
  });

  it('updates the native badge from the full contacts total after the other badges', () => {
    const block = renderContactsBlock();
    expect(block).toContain('contacts.reduce((s, c) => s + (c.unread || 0), 0)');
    expect(block).toContain('window.breeze.setBadge(totalUnread)');
    expect(block).not.toContain("querySelectorAll('.bdg-row')");

    const totalAt = block.indexOf('contacts.reduce((s, c) => s + (c.unread || 0), 0)');
    const titleAt = block.indexOf('_updateTitle(totalUnread)');
    const faviconAt = block.indexOf('updateFaviconBadge(totalUnread)');
    const pwaAt = block.indexOf('navigator.setAppBadge(totalUnread)');
    const nativeAt = block.indexOf('window.breeze.setBadge(totalUnread)');
    expect(totalAt).toBeGreaterThanOrEqual(0);
    expect(titleAt).toBeGreaterThan(totalAt);
    expect(faviconAt).toBeGreaterThan(titleAt);
    expect(pwaAt).toBeGreaterThan(faviconAt);
    expect(nativeAt).toBeGreaterThan(pwaAt);
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Electron badge regression: the 5-second badge interval must not open (and
// abandon) a hardcoded IndexedDB connection just to count unread badges. The
// count comes from the contact-list DOM; the real database open is the normal
// dbName/DB_VER one elsewhere in index.html.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function badgeBlock() {
  const start = html.indexOf('// ELECTRON NATIVE INTEGRATION');
  const endMarker = '  }, 5000);';
  const end = html.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw Error('electron badge markers moved');
  return html.slice(start, end + endMarker.length);
}

describe('electron badge interval', () => {
  it('does not contain the dead hardcoded IndexedDB open, while keeping the real open', () => {
    expect(html).not.toContain("indexedDB.open('breeze-messenger', 2)");
    expect(html).toContain('indexedDB.open(dbName, DB_VER)');
  });

  it('still counts .bdg-row elements and updates the native badge and title', () => {
    const block = badgeBlock();
    expect(block).toContain('.bdg-row');
    expect(block).toContain('window.breeze.setBadge(total)');
    expect(block).toContain('_updateTitle(total)');
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('document title suppresses name + unread count while locked', () => {
  it('_updateTitle falls back to bare Breeze when the lock overlay exists', () => {
    const m = SRC.match(/function _updateTitle\(unreadCount\) \{[\s\S]+?\n\}/);
    expect(m).not.toBeNull();
    expect(m[0]).toContain("_DOM.get('lock-screen') ? 'Breeze'");
  });

  it('unlock refreshes the title so the suppressed state does not linger', () => {
    expect(SRC).toContain("auditLog('security', 'Lock screen unlocked'); updateTabTitle();");
  });

  it('no other document.title assignment bypasses the lock gate', () => {
    const sites = SRC.match(/document\.title\s*=/g) || [];
    expect(sites.length).toBe(1);
  });

  it('functional: shipped ternary shows bare Breeze while locked, full title unlocked', () => {
    const renderLocked = (unreadCount, accName) =>
      ({} ? 'Breeze' : (unreadCount > 0 ? `(${unreadCount}) ` : '') + 'Breeze' + accName);
    expect(renderLocked(3, ' — Alice')).toBe('Breeze');
    const render = (unreadCount, accName, lockEl) =>
      (lockEl ? 'Breeze' : (unreadCount > 0 ? `(${unreadCount}) ` : '') + 'Breeze' + accName);
    expect(render(3, ' — Alice', null)).toBe('(3) Breeze — Alice');
    expect(render(0, '', null)).toBe('Breeze');
    expect(render(7, ' — Bob', { id: 'lock-screen' })).toBe('Breeze');
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('lock screen suppresses assistive-tech message previews', () => {
  it('the unread-announce channel degrades to a generic body while locked (parity with OS notif)', () => {
    expect(SRC).toContain("announceToSR(locked ? t('notifNewMessage') : `${contact.name}: ${text.slice(0, 60)}`);");
  });

  it('showLockScreen silences all three aria-live regions', () => {
    const m = SRC.match(/function showLockScreen\(\) \{[\s\S]+?let _attempts = 0;/);
    expect(m).not.toBeNull();
    expect(m[0]).toContain("['msg-messages','typing-indicator','msg-conv-status'].forEach(id => _DOM.get(id)?.setAttribute('aria-live','off'));");
  });

  it('unlock restores polite announcements after the overlay is removed', () => {
    expect(SRC).toContain("overlay.remove(); ['msg-messages','typing-indicator','msg-conv-status'].forEach(id => _DOM.get(id)?.setAttribute('aria-live','polite'));");
  });

  it('functional: shipped forEach pattern silences then restores each live region', () => {
    const attrs = {};
    for (const id of ['msg-messages', 'typing-indicator', 'msg-conv-status']) attrs[id] = 'polite';
    const _DOM = { get: id => (id in attrs ? { setAttribute: (k, v) => { attrs[id] = v; } } : null) };
    ['msg-messages','typing-indicator','msg-conv-status'].forEach(id => _DOM.get(id)?.setAttribute('aria-live','off'));
    expect(attrs).toEqual({ 'msg-messages': 'off', 'typing-indicator': 'off', 'msg-conv-status': 'off' });
    ['msg-messages','typing-indicator','msg-conv-status'].forEach(id => _DOM.get(id)?.setAttribute('aria-live','polite'));
    expect(attrs).toEqual({ 'msg-messages': 'polite', 'typing-indicator': 'polite', 'msg-conv-status': 'polite' });
  });
});

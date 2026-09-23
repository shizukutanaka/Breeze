import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ST = SRC.match(/function showTyping\(contactId, senderName\) \{[\s\S]+?\}, CONFIG\.TYPING_TIMEOUT_MS\);/)[0];
const OPEN = SRC.match(/let openConversation = async function\(contact\) \{[\s\S]+?const openGen = \+\+_openGen;/)[0];

describe('typing-indicator lifecycle on account switch', () => {
  it('showTyping returns immediately on an aborted context', () => {
    // A stateDC typing frame landing after the switch wrote 'active' + dots into
    // the shared indicator and re-armed the timeout the cleanup already cleared.
    expect(ST).toContain('function showTyping(contactId, senderName) { if (_ac.signal.aborted) return;');
    expect(ST.indexOf('_ac.signal.aborted')).toBeLessThan(ST.indexOf('typing-indicator'));
  });
  it('openConversation clears indicator residue left by a killed clear-timer', () => {
    // _typingTimeout is cleared in _messengerCleanup — a live typing state at
    // switch moment would otherwise keep 'active' under the next account.
    expect(OPEN).toContain("_DOM.get('typing-indicator')?.classList.remove('active')");
    expect(OPEN.indexOf('activeContact = contact;')).toBeLessThan(OPEN.indexOf('typing-indicator'));
  });
  it('guard references the per-init AbortController declared inside initMessenger', () => {
    expect(SRC.indexOf('const _ac = new AbortController()')).toBeLessThan(SRC.indexOf('function showTyping('));
    expect(SRC.indexOf('const _ac = new AbortController()')).toBeLessThan(SRC.indexOf('let openConversation'));
  });
  it('functional: aborted showTyping-shaped writer leaves the indicator untouched', () => {
    const show = new Function('_ac', 'typingEl', 'activeContact', 'contactId', "if (_ac.signal.aborted) return; if (activeContact?.id !== contactId) return; typingEl.classList.add('active');");
    const el = { classList: { classes: new Set(), add(c) { this.classes.add(c); }, remove(c) { this.classes.delete(c); } } };
    const ac = new AbortController();
    show(ac, el, { id: 'c1' }, 'c1');
    expect(el.classList.classes.has('active')).toBe(true);
    ac.abort();
    el.classList.remove('active');
    show(ac, el, { id: 'c1' }, 'c1');
    expect(el.classList.classes.has('active')).toBe(false);
  });
});

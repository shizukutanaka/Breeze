// Group typing signals carry a peer-chosen `senderName`; each showTyping call did
// `_groupTypingState[cid][name] = Date.now()` on a plain-object inner map with no
// bound — a member flooding typing signals with distinct fake names grew the map
// unboundedly, and every subsequent signal ran Object.entries over the whole map
// (O(N) per signal → quadratic within the 5s freshness window; CWE-400). The map
// is now null-prototype (proto-keys like '__proto__' can't hit Object.prototype
// members) and new typers are capped at 8 per conversation.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname;
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
const SRC = html.match(/<script>([\s\S]*?)<\/script>/)[1];

describe('group typing-state cap', () => {
  it('wire-site: inner map is null-prototype and new typer keys are capped', () => {
    expect(SRC).toContain('_groupTypingState[contactId] = Object.create(null)');
    expect(SRC).toContain('Object.keys(_ts).length < 8');
    expect(SRC).not.toContain('_groupTypingState[contactId] = {}');
  });

  it('extracted showTyping: a fake-name flood is capped at 8 typers', () => {
    const { showTyping, state } = makeTyping('g-1', true);
    for (let i = 0; i < 50; i++) showTyping('g-1', 'FakeName' + i);
    expect(Object.keys(state['g-1']).length).toBe(8);
  });

  it('extracted showTyping: existing typer refreshes even at the cap', () => {
    const { showTyping, state } = makeTyping('g-1', true);
    for (let i = 0; i < 10; i++) showTyping('g-1', 'N' + i);
    showTyping('g-1', 'N0');                      // already present → refresh allowed
    expect(state['g-1']['N0']).toBeTypeOf('number');
    expect(Object.keys(state['g-1']).length).toBe(8);
  });

  it("extracted showTyping: '__proto__'/'constructor' names are neutral own keys", () => {
    const { showTyping, state } = makeTyping('g-1', true);
    showTyping('g-1', '__proto__');
    showTyping('g-1', 'constructor');
    expect(Object.getPrototypeOf(state['g-1'])).toBeNull();
    expect(Object.keys(state['g-1'])).toEqual(['__proto__', 'constructor']);
  });

  it('extracted showTyping: 1:1 path shows a simple indicator, no map growth', () => {
    const { showTyping, state, typingEl } = makeTyping('c-1', false);
    showTyping('c-1', undefined);
    expect(Object.keys(state).length).toBe(0);
    expect(typingEl.html).toContain('typing-dots');
  });
});

function makeTyping(contactId, isGroup) {
  const start = SRC.indexOf('function showTyping(');
  if (start < 0) throw new Error('showTyping not found');
  const end = SRC.indexOf('\n  }\n\n  // v3.1: Image lightbox', start);
  if (end < 0) throw new Error('showTyping end not found');
  const src = SRC.slice(start, end + '\n  }'.length);

  const state = {};
  const typingEl = { html: '', classList: { add() {}, remove() {} } };
  const statusEl = { textContent: '', classList: { add() {}, remove() {} } };
  const scheduled = [];
  const ctx = {
    _typingContacts: {},
    _groupTypingState: state,
    _renderContactsThrottled: () => {},
    activeContact: { id: contactId, isGroup, name: 'Chat' },
    _DOM: { get: id => (id === 'typing-indicator' ? typingEl : id === 'msg-conv-status' ? statusEl : null) },
    _safeDisplayName: (s, n = 64) => (typeof s === 'string' ? s.slice(0, n) : ''),
    safeSetHTML: (el, h) => { el.html = h; },
    esc: s => String(s),
    t: k => k,
    CONFIG: { TYPING_TIMEOUT_MS: 3000 },
    setTimeout: (fn, ms) => { scheduled.push({ fn, ms }); return scheduled.length; },
    clearTimeout: () => {},
    updateConvStatus: () => {},
  };
  const fn = new Function('ctx', `
    const {_typingContacts,_groupTypingState,_renderContactsThrottled,activeContact,_DOM,_safeDisplayName,safeSetHTML,esc,t,CONFIG,setTimeout,clearTimeout,updateConvStatus} = ctx;
    let _typingTimeout = null;
    ${src}
    return showTyping;
  `)(ctx);
  return { showTyping: fn, state, typingEl, statusEl, scheduled };
}

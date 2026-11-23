import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createEmojiPicker, EMOJI_CATEGORIES } from '../src/app/emoji-picker.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function makeNode(tag = 'div') {
  const classes = new Set();
  const attrs = {};
  const children = [];
  const node = {
    tagName: tag.toUpperCase(),
    className: '',
    textContent: '',
    value: '',
    placeholder: '',
    title: '',
    selectionStart: 0,
    selectionEnd: 0,
    children,
    classList: {
      add(...cs) { cs.forEach(c => classes.add(c)); },
      remove(...cs) { cs.forEach(c => classes.delete(c)); },
      contains(c) { return classes.has(c); },
    },
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return attrs[k]; },
    appendChild(child) { children.push(child); return child; },
    append(...nodes) { children.push(...nodes); },
    replaceChildren() { children.length = 0; },
    querySelectorAll(sel) {
      if (sel === 'button') return children.filter(c => c.tagName === 'BUTTON');
      return [];
    },
    contains(target) { return target === node || children.some(c => c.contains?.(target)); },
    focus() { node._focused = true; },
    remove() { node._removed = true; },
  };
  return node;
}

describe('src/app/emoji-picker.js — createEmojiPicker', () => {
  const savedDescriptors = {};
  const setGlobal = (k, value) => {
    if (!(k in savedDescriptors)) {
      savedDescriptors[k] = Object.getOwnPropertyDescriptor(globalThis, k);
    }
    Object.defineProperty(globalThis, k, { value, configurable: true, writable: true });
  };

  afterEach(() => {
    for (const [k, desc] of Object.entries(savedDescriptors)) {
      if (desc === undefined) delete globalThis[k];
      else Object.defineProperty(globalThis, k, desc);
      delete savedDescriptors[k];
    }
  });

  function setup(initialRecents = null) {
    const store = new Map();
    if (initialRecents) store.set('brz-recent-emoji', JSON.stringify(initialRecents));
    const docListeners = {};
    setGlobal('window', {});
    setGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
    });
    setGlobal('document', {
      createElement: (tag) => makeNode(tag),
      addEventListener: (type, fn) => { (docListeners[type] ||= []).push(fn); },
      removeEventListener: (type, fn) => {
        docListeners[type] = (docListeners[type] || []).filter(f => f !== fn);
      },
    });

    const emojiBtn = makeNode('button');
    const input = makeNode('textarea');
    const bar = makeNode('div');
    const elems = { 'b-msg-emoji': emojiBtn, 'msg-input': input, 'msg-input-bar': bar };
    const api = createEmojiPicker({ DOM: { get: (id) => elems[id] || null }, t: (k) => k });
    return { api, emojiBtn, input, bar, store, docListeners };
  }

  it('opens and closes the picker on toggle and exposes window.togglePicker', () => {
    const { api, emojiBtn, bar } = setup();
    expect(globalThis.window.togglePicker).toBe(api.togglePicker);

    api.togglePicker();
    expect(bar.children).toHaveLength(1);
    expect(bar.children[0].className).toBe('emoji-picker');
    expect(emojiBtn.getAttribute('aria-expanded')).toBe('true');

    api.togglePicker();
    expect(bar.children[0]._removed).toBe(true);
    expect(emojiBtn.getAttribute('aria-expanded')).toBe('false');
  });

  it('inserts an emoji at cursor and updates frequency-weighted recents in localStorage', () => {
    const { api, input, bar, store } = setup([{ em: '🔥', count: 1 }]);
    input.value = 'hi !';
    input.selectionStart = 3;
    input.selectionEnd = 3;

    api.togglePicker();
    const picker = bar.children[0];
    const grid = picker.children[2];
    expect(grid.children.length).toBe(EMOJI_CATEGORIES['😀'].length);

    // Click the first emoji twice so its count (2) outranks '🔥' (1)
    const firstBtn = grid.children[0];
    firstBtn.onclick();
    firstBtn.onclick();

    expect(input.value).toBe(`hi ${firstBtn.textContent}${firstBtn.textContent}!`);
    const saved = JSON.parse(store.get('brz-recent-emoji'));
    expect(saved[0]).toEqual({ em: firstBtn.textContent, count: 2 });
    expect(saved[1]).toEqual({ em: '🔥', count: 1 });
  });

  it('wiring: index.html exposes window.__breezeEmojiPicker and delegates to createEmojiPicker', () => {
    expect(html).toContain("import { createEmojiPicker } from './src/app/emoji-picker.js'; window.__breezeEmojiPicker = { createEmojiPicker };");
    expect(html).toContain('globalThis.__breezeEmojiPicker?.createEmojiPicker({ DOM: _DOM, t, signal: _ac.signal });');
  });
});

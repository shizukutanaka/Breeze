import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createChatSearch } from '../src/app/chat-search.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function makeEl() {
  const classes = new Set();
  const listeners = {};
  const el = {
    className: '',
    value: '',
    textContent: '',
    focused: false,
    scrolled: 0,
    classList: {
      add(...cs) { cs.forEach(c => classes.add(c)); },
      remove(...cs) { cs.forEach(c => classes.delete(c)); },
      contains(c) { return classes.has(c); },
    },
    focus() { el.focused = true; },
    scrollIntoView() { el.scrolled++; },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    emit(type, ev = {}) { (listeners[type] || []).forEach(fn => fn(ev)); },
  };
  return el;
}

describe('src/app/chat-search.js — createChatSearch', () => {
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

  function setup(messages = ['hello world', 'say hello again']) {
    const els = {
      'search-bar': makeEl(),
      'search-chat-input': makeEl(),
      'search-match-count': makeEl(),
      'search-chat-next': makeEl(),
      'search-chat-prev': makeEl(),
      'search-chat-close': makeEl(),
    };
    const msgNodes = messages.map((text) => ({ textContent: text }));
    setGlobal('NodeFilter', { SHOW_TEXT: 4 });
    setGlobal('document', {
      createElement: () => makeEl(),
      createTextNode: (t) => ({ textContent: t }),
      createTreeWalker: (el) => {
        let done = false;
        return {
          currentNode: null,
          nextNode() {
            if (done) return false;
            done = true;
            this.currentNode = el;
            return true;
          },
        };
      },
      createRange: () => ({
        setStart() {},
        setEnd() {},
        surroundContents() {},
      }),
      querySelectorAll: (sel) => (sel === '.msg' ? msgNodes : []),
    });
    return { els, DOM: { get: (id) => els[id] || null } };
  }

  it('opens only when an active contact exists, focuses input, and closes cleanly', () => {
    const { els, DOM } = setup();
    let active = null;
    const cs = createChatSearch({ DOM, getActiveContact: () => active });

    cs.openSearchBar();
    expect(els['search-bar'].classList.contains('show')).toBe(false);

    active = { id: 'alice' };
    els['search-chat-input'].value = 'stale';
    cs.openSearchBar();
    expect(els['search-bar'].classList.contains('show')).toBe(true);
    expect(els['search-chat-input'].value).toBe('');
    expect(els['search-chat-input'].focused).toBe(true);

    els['search-chat-close'].emit('click');
    expect(els['search-bar'].classList.contains('show')).toBe(false);
  });

  it('finds matches, updates count, and cycles forward/backward via buttons and keyboard', () => {
    const { els, DOM } = setup(['hello world', 'goodbye', 'hello again']);
    createChatSearch({ DOM, getActiveContact: () => ({ id: 'alice' }) });

    els['search-chat-input'].emit('input', { target: { value: 'h' } });
    expect(els['search-match-count'].textContent).toBe('');

    els['search-chat-input'].emit('input', { target: { value: 'hello' } });
    expect(els['search-match-count'].textContent).toBe('1/2');

    els['search-chat-next'].emit('click');
    expect(els['search-match-count'].textContent).toBe('2/2');

    els['search-chat-prev'].emit('click');
    expect(els['search-match-count'].textContent).toBe('1/2');

    els['search-chat-input'].emit('keydown', { key: 'Enter', shiftKey: false, preventDefault() {} });
    expect(els['search-match-count'].textContent).toBe('2/2');
  });

  it('wiring: index.html exposes window.__breezeChatSearch and delegates openSearchBar via _appModulesReady', () => {
    expect(html).toContain("import { createChatSearch } from './src/app/chat-search.js'; window.__breezeChatSearch = { createChatSearch };");
    expect(html).toContain('globalThis.__breezeChatSearch?.createChatSearch');
  });
});

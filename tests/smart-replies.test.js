import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { generateSmartReplies, summarizeMessages, createSmartReplies } from '../src/app/smart-replies.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function makeNode() {
  const classes = new Set(['hidden']);
  const children = [];
  return {
    className: '',
    textContent: '',
    value: '',
    children,
    classList: {
      add(...cs) { cs.forEach(c => classes.add(c)); },
      remove(...cs) { cs.forEach(c => classes.delete(c)); },
      contains(c) { return classes.has(c); },
    },
    replaceChildren() { children.length = 0; },
    appendChild(child) { children.push(child); return child; },
    click() { this.onclick?.(); },
  };
}

describe('src/app/smart-replies.js', () => {
  const savedDoc = Object.getOwnPropertyDescriptor(globalThis, 'document');

  afterEach(() => {
    vi.useRealTimers();
    if (savedDoc === undefined) delete globalThis.document;
    else Object.defineProperty(globalThis, 'document', savedDoc);
  });

  it('generateSmartReplies returns contextual EN and JA replies', () => {
    expect(generateSmartReplies('')).toEqual([]);
    expect(generateSmartReplies('How are you?', 'en')).toEqual(['Good, thanks!', "I'm doing well, you?", 'Not bad!']);
    expect(generateSmartReplies('元気？', 'en')).toEqual(['元気です！', '元気ですよ！そちらは？', 'まあまあです']);
    expect(generateSmartReplies('hello there', 'en')).toEqual(['Hey!', 'Hi there!', "What's up?"]);
    expect(generateSmartReplies('thanks!', 'ja')).toEqual(['どういたしまして！', 'いえいえ！', 'いつでも！']);
    expect(generateSmartReplies('bye', 'en')).toEqual(['See you!', 'Take care!', 'Bye!']);
  });

  it('summarizeMessages handles empty, filtered, and extractive summaries', () => {
    const t = (k, ...args) => args.length ? `${k}:${args.join(',')}` : k;
    expect(summarizeMessages([], { t })).toBe('aiSummarizeEmpty');
    expect(summarizeMessages([{ text: 'hi' }, { text: 'deleted msg', deleted: true }], { t })).toBe('aiSummarizeNoText');

    const out = summarizeMessages([
      { text: 'Should we deploy the release tomorrow?', mine: false },
      { text: 'Yes, deploy looks ready for tomorrow!', mine: true },
    ], { t, activeContactName: 'Alice' });
    expect(out).toContain('aiSummarizeMsgCount:2');
    expect(out).toContain('aiSummarizeTopics:');
    expect(out).toContain('Alice: "Should we deploy the release tomorrow?"');
    expect(out).toContain('you: "Yes, deploy looks ready for tomorrow!"');
  });

  it('showSmartReplies renders chips, sends on click, and auto-hides after SMART_REPLY_HIDE_MS', () => {
    vi.useFakeTimers();
    const bar = makeNode();
    const input = makeNode();
    let sent = 0;
    Object.defineProperty(globalThis, 'document', {
      value: { createElement: () => makeNode() },
      configurable: true,
      writable: true,
    });
    const DOM = { get: (id) => (id === 'smart-reply-bar' ? bar : id === 'msg-input' ? input : null) };
    const sr = createSmartReplies({
      DOM,
      config: { SMART_REPLY_HIDE_MS: 5000 },
      t: (k) => k,
      getLang: () => 'en',
      getActiveContact: () => ({ name: 'Bob' }),
      sendMessage: () => { sent++; },
    });

    sr.showSmartReplies('When are we meeting?');
    expect(bar.classList.contains('hidden')).toBe(false);
    expect(bar.children).toHaveLength(3);

    bar.children[1].click();
    expect(input.value).toBe('Tomorrow works');
    expect(sent).toBe(1);
    expect(bar.classList.contains('hidden')).toBe(true);

    sr.showSmartReplies('Hello!');
    expect(bar.classList.contains('hidden')).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(bar.classList.contains('hidden')).toBe(true);
  });

  it('wiring: index.html exposes window.__breezeSmartReplies and delegates summarizeMessages/showSmartReplies', () => {
    expect(html).toContain("import { createSmartReplies } from './src/app/smart-replies.js'; window.__breezeSmartReplies = { createSmartReplies };");
    expect(html).toContain('globalThis.__breezeSmartReplies?.createSmartReplies');
  });
});

// A5: the first-conversation notification permission request must be explained
// in-app BEFORE the one-shot browser prompt. If the browser prompt is dismissed
// or denied without context, permission cannot be requested again from the app.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

const TEXT = {
  notifAskTitle: 'Turn on notifications?',
  notifAskDesc: 'Breeze can let you know when a new message or call arrives, even when you are looking at another app. Nothing about your conversations leaves this device to do this, and you can turn notifications off again any time in Settings.',
  notifAskAllow: 'Turn on',
};
const JA_TEXT = {
  notifAskTitle: '通知をオンにしますか？',
  notifAskDesc: '新しいメッセージや着信が届いたとき、別のアプリを見ていてもお知らせできます。そのために会話の内容がこの端末の外へ出ることはありません。設定でいつでもオフにできます。',
  notifAskAllow: 'オンにする',
};

function inlineTables() {
  const start = html.indexOf('const _I = {');
  let depth = 0;
  for (let i = html.indexOf('{', start); i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) return (0, eval)('(' + html.slice(html.indexOf('{', start), i + 1) + ')'); }
  }
  throw new Error('unbalanced inline i18n table');
}

function firstConversationBlock() {
  const start = html.indexOf('// v3.1: Request notification permission on first conversation');
  const end = html.indexOf('activeContact = contact;', start);
  expect(start, 'first-conversation permission block marker').toBeGreaterThan(-1);
  expect(end, 'end of first-conversation permission block').toBeGreaterThan(start);
  return html.slice(start, end);
}

describe('first-conversation notification permission explanation (A5)', () => {
  it('shows the in-app explanation before asking the browser', () => {
    const block = firstConversationBlock();
    expect(block).toContain("showConfirm(t('notifAskTitle')");
    expect(block).toContain("desc: t('notifAskDesc')");
    expect(block).toContain("okText: t('notifAskAllow')");
  });

  it('calls Notification.requestPermission only after the confirm resolves true', () => {
    const block = firstConversationBlock();
    expect(block).toContain('.then(ok => { if (ok) Notification.requestPermission().catch(e => _dbg(e)); })');
    const occurrences = block.match(/Notification\.requestPermission\(\)/g) || [];
    expect(occurrences).toHaveLength(1);
    expect(block.indexOf('Notification.requestPermission()')).toBeGreaterThan(block.indexOf('.then(ok => { if (ok)'));
  });

  it('sets the one-shot guard before starting the async ask', () => {
    const block = firstConversationBlock();
    const guard = block.indexOf('_notifRequested = true');
    const ask = block.indexOf('showConfirm(');
    expect(guard).toBeGreaterThan(-1);
    expect(ask).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(ask);
  });

  it('defines the exact copy in the inline EN and JA tables', () => {
    const I = inlineTables();
    for (const key of Object.keys(TEXT)) {
      expect(I.en[key], `inline en.${key}`).toBe(TEXT[key]);
      expect(I.ja?.[key], `inline ja.${key}`).toBe(JA_TEXT[key]);
    }
  });

  it('ships all three keys in every locale with an identical 1175-key set', () => {
    const I = inlineTables();
    const referenceKeys = Object.keys(I.en).sort();
    expect(referenceKeys).toHaveLength(1175);
    const files = readdirSync(join(root, 'locales')).filter(f => f.endsWith('.json')).sort();
    expect(files).toHaveLength(107);
    for (const file of files) {
      const table = JSON.parse(readFileSync(join(root, 'locales', file), 'utf8'));
      expect(Object.keys(table).sort(), `${file} key set`).toEqual(referenceKeys);
      for (const key of Object.keys(TEXT)) {
        expect(table[key], `${file}.${key}`).toBe(file === 'ja.json' ? JA_TEXT[key] : TEXT[key]);
      }
    }
  });
});

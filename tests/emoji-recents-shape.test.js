// tests/emoji-recents-shape.test.js — Breeze deep-behavior test: brz-recent-emoji is
// shape-normalized at load, not trusted. Same class as the getAccounts (#157) and
// brz-cross-unread (#160) guards: JSON.parse yields ANY value — a non-array payload
// ('null', '5', {}) makes recentEmojis.length/.findIndex/.splice throw, and even a
// real array can carry garbage entries (null → `typeof null === 'object'` → item.em
// throws inside renderGrid's forEach, killing the whole emoji picker render).
// The funnel normalizes: array gate + per-entry filter (string | {em: string}).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// The shipped load line — evaluate it verbatim against injected localStorage.
const LOAD_RE = /try \{ const r = JSON\.parse\(localStorage\.getItem\('brz-recent-emoji'\) \|\| '\[\]'\); if \(Array\.isArray\(r\)\) recentEmojis = r\.filter\(e => typeof e === 'string' \|\| typeof e\?\.em === 'string'\); \} catch \{\}/;
const line = SRC.match(LOAD_RE)?.[0];
function runLoad(stored) {
  const localStorage = { getItem: () => stored };
  return new Function('localStorage', 'let recentEmojis = [];\n' + line + '\nreturn recentEmojis;')(localStorage);
}

describe('brz-recent-emoji shape normalization', () => {
  it('ships the guarded load line', () => { expect(line).toBeTruthy(); });
  it('no bare JSON.parse → recentEmojis remains', () => {
    expect(SRC.match(/recentEmojis = JSON\.parse/)).toBeNull();
  });
  it.each([['null'], ['5'], ['{}'], ['"abc"'], ['true']])('non-array payload %s → []', (s) => {
    expect(runLoad(s)).toEqual([]);
  });
  it('malformed JSON → [] (catch)', () => { expect(runLoad('{oops')).toEqual([]); });
  it('missing key → []', () => { expect(runLoad(null)).toEqual([]); });
  it('filters garbage entries; keeps strings and {em:string}', () => {
    const stored = JSON.stringify(['🙂', { em: '❤', count: 3 }, null, 5, { em: 7 }, {}, 'x']);
    expect(runLoad(stored)).toEqual(['🙂', { em: '❤', count: 3 }, 'x']);
  });
  it('a clean array passes through whole', () => {
    expect(runLoad(JSON.stringify(['😀', { em: '😎', count: 1 }]))).toEqual(['😀', { em: '😎', count: 1 }]);
  });
  it('post-filter, renderGrid\'s `typeof item === \'object\'` path can never hit null', () => {
    // renderGrid does `typeof item === 'object' ? item.em : item` — null entries were the
    // crash class (typeof null === 'object' → null.em throws). Funnel drops them all.
    const survivors = runLoad(JSON.stringify([null, { em: '🔥' }]));
    expect(survivors).toEqual([{ em: '🔥' }]);
    expect(survivors.every(e => typeof e !== 'object' || e === null || typeof e.em === 'string')).toBe(true);
  });
});

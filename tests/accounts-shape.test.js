// getAccounts() shape guard: the parsed localStorage payload was returned unchecked,
// so a non-array value ({}, "x", 42, null-literal string) reached callers that run
// .find()/.length/.forEach — a TypeError at BOOT means a white screen that only a
// manual localStorage clear could fix. The function now returns [] for anything
// that isn't an array. These tests drive the REAL function extracted from index.html.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname;
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');

function loadGetAccounts() {
  const start = html.indexOf('function getAccounts()');
  const end = html.indexOf('function saveAccounts', start);
  if (start < 0 || end < 0) throw new Error('getAccounts not found');
  const fn = new Function('localStorage', 'return ' + html.slice(start, end).trim());
  return (stored) => fn({ getItem: () => stored })();
}

describe('getAccounts() shape guard', () => {
  it('wire-site: parsed value is filtered through Array.isArray', () => {
    expect(html).toContain('Array.isArray(a) ? a : []');
  });

  it('returns [] for a non-array object payload', () => {
    const getAccounts = loadGetAccounts();
    expect(getAccounts('{}')).toEqual([]);
    expect(getAccounts('"x"')).toEqual([]);
    expect(getAccounts('42')).toEqual([]);
    expect(getAccounts('true')).toEqual([]);
    expect(getAccounts('null')).toEqual([]);
  });

  it('returns [] for unparseable garbage and missing key', () => {
    const getAccounts = loadGetAccounts();
    expect(getAccounts('not json {')).toEqual([]);
    expect(getAccounts(null)).toEqual([]); // getItem null → '[]' default
  });

  it('returns real arrays unchanged (entries may be malformed — callers handle)', () => {
    const getAccounts = loadGetAccounts();
    const accs = [{ id: '0', name: 'Account 1', dbName: 'breeze-messenger' }];
    expect(getAccounts(JSON.stringify(accs))).toEqual(accs);
  });

  it('the returned value is always safe for .find/.length/.forEach/.map', () => {
    const getAccounts = loadGetAccounts();
    for (const stored of ['{}', '"x"', '42', 'true', 'null', 'bad{', null]) {
      const r = getAccounts(stored);
      expect(() => { r.find(() => true); r.length; r.forEach(() => {}); r.map(() => {}); }, stored).not.toThrow();
    }
  });
});

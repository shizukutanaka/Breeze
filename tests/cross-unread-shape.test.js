// _crossAccountUnread JSON.parse'd brz-cross-unread unchecked: JSON.parse('null')
// returns null (no throw), so member access _crossAccountUnread[acc.id] inside
// renderAccountTabs threw TypeError at boot — same class as the getAccounts fix.
// The IIFE now requires a real object. Tests evaluate the REAL expression from
// index.html against a stub localStorage.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname;
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');

function loadUnread() {
  const start = html.indexOf('const _crossAccountUnread = (() => {');
  const end = html.indexOf('})();', start) + 5;
  if (start < 0 || end < 0) throw new Error('unread IIFE not found');
  const factory = new Function('localStorage', html.slice(start, end).trim() + '; return _crossAccountUnread;');
  return (stored) => factory({ getItem: () => stored });
}

describe('_crossAccountUnread shape guard', () => {
  it('wire-site: parsed value must be a truthy object', () => {
    expect(html).toContain("(v && typeof v === 'object') ? v : {}");
  });

  it('returns {} for null/non-object JSON payloads', () => {
    const load = loadUnread();
    for (const stored of ['null', '42', '"x"', 'true']) {
      expect(load(stored), stored).toEqual({});
    }
  });

  it('returns {} for unparseable garbage and missing key', () => {
    const load = loadUnread();
    expect(load('not json {')).toEqual({});
    expect(load(null)).toEqual({}); // getItem null → '{}' default
  });

  it('member access on the result is always safe (the crash site)', () => {
    const load = loadUnread();
    for (const stored of ['null', '42', '"x"', 'true', 'bad{', null]) {
      expect(() => { const n = load(stored); n['some-id']; delete n['x']; }, stored).not.toThrow();
    }
  });

  it('real objects pass through unchanged', () => {
    const load = loadUnread();
    expect(load('{"acc-1": 3, "acc-2": 0}')).toEqual({ 'acc-1': 3, 'acc-2': 0 });
  });
});

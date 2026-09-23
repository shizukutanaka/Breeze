import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const LSGET = SRC.match(/const _lsGet = \(k\) => [^\n]+/)[0];
const drive = (storage) => new Function('localStorage', `${LSGET} return _lsGet;`)(storage);

describe('_lsGet safe localStorage read', () => {
  it('returns the stored value on normal storage', () => {
    expect(drive({ getItem: () => 'v' })('k')).toBe('v');
  });
  it('returns null when getItem throws (SecurityError / quota)', () => {
    const throwing = { getItem() { throw new Error('SecurityError'); } };
    expect(drive(throwing)('k')).toBe(null);
  });
  it('returns null on missing key', () => {
    expect(drive({ getItem: () => null })('k')).toBe(null);
  });
  it('helper is declared before its first use (no TDZ)', () => {
    const decl = SRC.indexOf('const _lsGet');
    const firstUse = SRC.indexOf("_lsGet('brz-theme')");
    expect(decl).toBeGreaterThan(0);
    expect(firstUse).toBeGreaterThan(decl);
  });
  it('all boot-critical reads route through _lsGet', () => {
    // Top-level auto-theme + consent + theme-restore + account-id reads must not
    // call localStorage.getItem directly.
    expect(SRC).not.toContain("if (localStorage.getItem('brz-theme') === 'auto'");
    expect(SRC).not.toContain("if (localStorage.getItem('brz-consent')) return;");
    expect(SRC).not.toContain("const saved = localStorage.getItem('brz-theme');");
    expect(SRC).not.toContain("return localStorage.getItem('brz-active') || '0';");
    expect(SRC).toContain("_lsGet('brz-consent')");
    expect(SRC).toContain("_lsGet('brz-lock-hash')");
    expect(SRC).toContain("_lsGet('brz-autolock')");
  });
});

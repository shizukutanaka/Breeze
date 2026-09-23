import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Top-level visit-count block: localStorage access must be inside try/catch so a
// SecurityError/quota throw can't abort the whole module script (initMessenger never runs).
describe('storage-throw safety at top level', () => {
  it('visit-count read+write are inside try', () => {
    const block = SRC.match(/\/\/ v3\.6: Engagement gate[\s\S]+?_isEngagedVisitor = [^\n]+/)[0];
    expect(block).toContain('try {');
    expect(block).toContain('localStorage.getItem');
    expect(block).toContain('localStorage.setItem');
    expect(block).toContain('catch');
  });
  it('storage-disabled (throws) still yields a usable engaged flag', () => {
    const BLOCK = SRC.match(/let _visitCount = 0, _msgsSent = 0;[\s\S]+?const _isEngagedVisitor = _visitCount >= 2 \|\| _msgsSent >= 3;/)[0];
    const throwing = new Proxy({}, { get() { throw new Error('SecurityError'); }, set() { throw new Error('Quota'); } });
    const res = new Function('localStorage', '_dbg', `${BLOCK} return { _isEngagedVisitor, _visitCount };`)(throwing, () => {});
    expect(res._isEngagedVisitor).toBe(false);
    expect(res._visitCount).toBe(0);
  });
  it('normal storage still counts visits + msgs', () => {
    const BLOCK = SRC.match(/let _visitCount = 0, _msgsSent = 0;[\s\S]+?const _isEngagedVisitor = _visitCount >= 2 \|\| _msgsSent >= 3;/)[0];
    const store = { 'brz-visit-count': '3', 'brz-msgs-sent': '1' };
    const ls = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
    const res = new Function('localStorage', '_dbg', `${BLOCK} return { _isEngagedVisitor, _visitCount };`)(ls, () => {});
    expect(res._visitCount).toBe(4);
    expect(res._isEngagedVisitor).toBe(true);
  });
  it('consent accept still removes banner when setItem throws', () => {
    expect(SRC).toContain("localStorage.setItem('brz-consent', Date.now()); } catch");
    expect(SRC).toContain('} banner.remove(); };');
  });
  it('tripwire: old unguarded pattern is gone', () => {
    expect(SRC).not.toContain("const _visits = parseInt(localStorage.getItem('brz-visit-count'");
    expect(SRC).not.toContain("localStorage.setItem('brz-visit-count', String(_visits));");
  });
});

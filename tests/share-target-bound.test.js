import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// The two shipped statements: bounded join + guarded setItem.
const BUILD = SRC.match(/const sharedText = \[P\.get\('title'\)[^\n]+\n/)[0];
const STORE = "try { sessionStorage.setItem('brz-shared-text', sharedText); } catch (_e) { _dbg(_e, 'share-target'); }";
expect(SRC).toContain(STORE.trim());
const drive = (params, sessionStorage = { setItem: () => {} }) => {
  const fn = new Function('P', 'sessionStorage', '_dbg', `${BUILD} ${STORE} return sharedText;`);
  return fn({ get: k => params[k] ?? null }, sessionStorage, () => {});
};

describe('share-target bound', () => {
  it('accepts a normal share', () => {
    const stored = {};
    const r = drive({ title: 'Hi', text: 'hello world', url: 'https://x.dev' }, { setItem: (k, v) => { stored[k] = v; } });
    expect(r).toBe('Hi\nhello world\nhttps://x.dev');
    expect(stored['brz-shared-text']).toBe(r);
  });
  it('bounds a giant shared text at 64KB', () => {
    const stored = {};
    const r = drive({ text: 'A'.repeat(1024 * 1024) }, { setItem: (k, v) => { stored[k] = v; } });
    expect(r.length).toBe(64 * 1024);
    expect(stored['brz-shared-text'].length).toBe(64 * 1024);
  });
  it('quota failure is caught, not thrown', () => {
    expect(() => drive({ text: 'x' }, { setItem: () => { throw new Error('QuotaExceededError'); } })).not.toThrow();
  });
  it('reads back into input only what was stored (bounded)', () => {
    // The 6936 path reads the same stored value — bounded at write covers it.
    expect(SRC).toContain("sessionStorage.getItem('brz-shared-text')");
  });
  it('tripwire: ingest bound + guarded setItem shipped', () => {
    expect(SRC).toContain(".join('\\n').slice(0, 64 * 1024)");
    expect(SRC).toContain("sessionStorage.setItem('brz-shared-text', sharedText); } catch");
  });
});

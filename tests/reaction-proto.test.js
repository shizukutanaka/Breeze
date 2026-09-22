// Reaction emoji came from the wire (`signal.emoji`/`msg.emoji`) and was used as a
// POJO object key: `reactions['__proto__']`/`['constructor']`/`['toString']` hit
// Object.prototype members — truthy, so the `|| []` init was skipped, then
// `.includes`/`.push`/`filter` on a non-array threw TypeError EVERY time, and an
// absent '__proto__' write would silently replace the map's prototype. A peer
// could permanently break the reaction feature on any chosen message and poison
// the stored record (CWE-915 / CWE-1321-adjacent). reactions is now rebuilt as a
// null-prototype map via _ownArrayMap so wire strings are own keys only.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname;
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
const SRC = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function extractOwnArrayMap() {
  const i = SRC.indexOf('const _ownArrayMap = ');
  if (i < 0) throw new Error('_ownArrayMap not found');
  const expr = SRC.slice(i + 'const _ownArrayMap = '.length, SRC.indexOf('};', i) + 1);
  return new Function('return ' + expr)();
}
const _ownArrayMap = extractOwnArrayMap();

describe('reactions map hardening (prototype-poison keys)', () => {
  it('wire-site: all reaction containers are rebuilt via _ownArrayMap', () => {
    expect(SRC.match(/stored\.reactions = _ownArrayMap\(stored\.reactions\);/g)?.length).toBe(5);
    expect(SRC).not.toContain('stored.reactions = {}');
  });

  it("'__proto__' emoji is a plain own key — no prototype trap, push works", () => {
    const r = _ownArrayMap({});
    expect(Object.getPrototypeOf(r)).toBeNull();
    if (!r['__proto__']) r['__proto__'] = [];      // same write idiom as the handlers
    expect(Object.hasOwn(r, '__proto__')).toBe(true);
    r['__proto__'].push('reactor-1');
    expect(r['__proto__']).toEqual(['reactor-1']);
    expect(Object.keys(r)).toEqual(['__proto__']); // counts toward the 20-emoji cap
  });

  it("'constructor'/'toString'/'hasOwnProperty' keys don't resolve to prototype members", () => {
    const r = _ownArrayMap({});
    for (const k of ['constructor', 'toString', 'hasOwnProperty']) {
      expect(r[k]).toBeUndefined();               // own-only: no inherited truthy trap
      if (!r[k]) r[k] = [];
      r[k].push('u');
      expect(r[k]).toEqual(['u']);
    }
  });

  it('non-array values from a tampered/imported record are dropped', () => {
    const dirty = { '👍': ['a', 'b'], evil: 'string', num: 5, nested: { x: 1 }, ok: [] };
    const r = _ownArrayMap(dirty);
    expect(r['👍']).toEqual(['a', 'b']);
    expect(r.ok).toEqual([]);
    expect(r.evil).toBeUndefined();
    expect(r.num).toBeUndefined();
    expect(r.nested).toBeUndefined();
  });

  it('non-object input degrades to an empty map; JSON.parse own __proto__ survives', () => {
    expect(Object.keys(_ownArrayMap(null)).length).toBe(0);
    expect(Object.keys(_ownArrayMap('junk')).length).toBe(0);
    expect(Object.keys(_ownArrayMap(42)).length).toBe(0);
    const parsed = JSON.parse('{"__proto__":["x"]}');   // JSON.parse creates own __proto__
    const r = _ownArrayMap(parsed);
    expect(r['__proto__']).toEqual(['x']);
    expect(Object.hasOwn(r, '__proto__')).toBe(true);
  });

  it('record shape is structured-clone safe (IDB dbPut round-trip)', () => {
    // structuredClone drops the null prototype — the stored record comes back a POJO.
    // That's the design: every handler re-wraps via _ownArrayMap right after dbGet,
    // so proto-keys are neutral at every access even though the stored form is plain.
    const r = _ownArrayMap({ '🔥': ['u1'] });
    const clone = structuredClone(r);
    expect(clone['🔥']).toEqual(['u1']);
    const rewrapped = _ownArrayMap(clone);        // the post-dbGet path
    expect(Object.getPrototypeOf(rewrapped)).toBeNull();
  });
});

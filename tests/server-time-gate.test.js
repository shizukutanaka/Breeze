import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Extract the shipped `if (typeof health.serverTime === 'number') { ... }` block by brace counting.
const START = SRC.indexOf("if (typeof health.serverTime === 'number') {");
let depth = 0, end = -1;
for (let i = START; i < SRC.length; i++) {
  if (SRC[i] === '{') depth++;
  else if (SRC[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
}
const BLOCK = SRC.slice(START, end);

describe('_clockOffset only ingests plausible serverTime', () => {
  it('extracted the whole gate block + finite/day guards inside', () => {
    expect(BLOCK).toContain('Number.isFinite(rawDrift)');
    expect(BLOCK).toContain('Math.abs(rawDrift) > MS.DAY');
    expect(BLOCK).toContain('_clockOffset = Math.max(-3600000, Math.min(3600000, rawDrift))');
  });
  it('functional: poisoned serverTime never writes _clockOffset; sane drift applies', () => {
    const run = (serverTime) => new Function('health', 'MS', 'Date', '_dbg', 'showToast', 't',
      `let _clockOffset = 0;
      ${BLOCK}
      return _clockOffset;`)(
      { serverTime }, { DAY: 86400000 }, Date, () => {}, () => {}, (k) => k);
    const now = Date.now();
    expect(run('abc')).toBe(0);                 // non-number → untouched
    expect(run('2026-01-01')).toBe(0);
    expect(run(NaN)).toBe(0);                   // finite check
    expect(run(Infinity)).toBe(0);
    expect(run(0)).toBe(0);                     // epoch-claim → >1day drift → skipped
    expect(run(now + 2 * 86400000)).toBe(0);    // +2d → absurd, no clamp applied
    expect(run(now + 30000)).toBeGreaterThan(29000);  // plausible drift → applied
    expect(run(now - 4000)).toBeGreaterThan(-4100);   // (ms skew between test and fn clocks)
    expect(run(now + 3700000)).toBe(3600000);   // +1h+ → inside day bound, capped at ±1h
    expect(run(now + 23 * 3600000)).toBe(3600000); // +23h → clamps to +1h (pre-existing cap)
  });
  it('correctedNow stays finite for every hostile health payload', () => {
    for (const bad of ['x', null, NaN, Infinity, 0, Date.now() + 1e11]) {
      const off = new Function('health', 'MS', 'Date', '_dbg', 'showToast', 't',
        `let _clockOffset = 0; ${BLOCK} return _clockOffset;`)(
        { serverTime: bad }, { DAY: 86400000 }, Date, () => {}, () => {}, (k) => k);
      expect(Number.isFinite(Date.now() + off)).toBe(true);
    }
  });
});

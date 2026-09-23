import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Extract the shipped checkRemoteWipe loop line.
const LINE = SRC.match(/for \(const msg of \(Array\.isArray\(data\.messages\) \? data\.messages : \[\]\)\) \{/);

describe('checkRemoteWipe messages iteration is shape-gated', () => {
  it('uses Array.isArray ternary (no bare data.messages || [])', () => {
    expect(LINE).not.toBeNull();
    const fn = SRC.match(/async function checkRemoteWipe[\s\S]+?catch\(e\) \{ _dbg\(e, 'remote-wipe-check'\); \}/)[0];
    expect(fn).not.toContain('(data.messages || [])');
  });
  it('functional: hostile shapes iterate zero times, arrays iterate all', () => {
    const drive = (messages) => new Function('data',
      `let n = 0;
      for (const msg of (Array.isArray(data.messages) ? data.messages : [])) n++;
      return n;`)({ messages });
    expect(drive('x'.repeat(1000000))).toBe(0);  // giant string: 0 iters (was 1M char iters)
    expect(drive({ a: 1 })).toBe(0);             // object: no throw
    expect(drive(42)).toBe(0);
    expect(drive(null)).toBe(0);
    expect(drive(undefined)).toBe(0);
    expect(drive([{ type: 'x' }, { type: 'y' }, { type: 'z' }])).toBe(3);
  });
});

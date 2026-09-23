import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('showReadReceipt clamps peer-controlled ts', () => {
  const GUARD = `if (typeof ts !== 'number' || !Number.isFinite(ts) || ts < 0) return;
    ts = Math.min(ts, Date.now() + 5 * MS.MIN);`;

  it('guard present at funnel head, before the watermark write', () => {
    const fn = SRC.match(/function showReadReceipt\(contactId, ts\) \{[\s\S]+?_lastReadTs\[contactId\] = ts;/)[0];
    expect(fn).toContain('Number.isFinite(ts)');
    expect(fn).toContain('Math.min(ts, Date.now() + 5 * MS.MIN)');
    expect(fn.indexOf('Number.isFinite')).toBeLessThan(fn.indexOf('_lastReadTs[contactId]'));
    expect(SRC.match(/_lastReadTs\[contactId\] = ts;/g).length).toBe(1);
  });

  it('functional: forged far-future ts clamps, NaN/negatives drop', () => {
    const run = new Function('ts', 'MS',
      `const out = [];
      ${GUARD}
      out.push(ts); return out[0];`);
    const MS = { MIN: 60000 };
    const now = Date.now();
    expect(run(NaN, MS)).toBeUndefined();
    expect(run(Infinity, MS)).toBeUndefined();
    expect(run(-5, MS)).toBeUndefined();
    expect(run('12345', MS)).toBeUndefined();
    expect(run(now + 365 * 86400000, MS)).toBeLessThanOrEqual(now + 5 * MS.MIN + 1000);
    expect(run(now - 60000, MS)).toBe(now - 60000); // sane past ts untouched
  });
});

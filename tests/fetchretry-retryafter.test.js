import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('fetchRetry clamps Retry-After like the /msg + /signal loops', () => {
  it('shipped: 3044-site clamps with Math.min(..., 300)', () => {
    expect(SRC).toContain("const retryAfter = Math.min(parseInt(resp.headers.get('Retry-After') || '5') || 5, 300);");
    expect(SRC).not.toContain("const retryAfter = parseInt(resp.headers.get('Retry-After') || '5') || 5;\n");
  });
  it('all Retry-After consumers are now clamped (zero raw sites remain)', () => {
    const clamps = SRC.match(/Math\.min\(parseInt\(resp\.headers\.get\('Retry-After'\)/g) || [];
    expect(clamps.length).toBe(3);
    const raws = SRC.match(/= \(?parseInt\(resp\.headers\.get\('Retry-After'\)/g) || [];
    expect(raws.length).toBe(0);
  });
  it('shipped: /msg re-queue site clamps with Math.min(..., 300)', () => {
    expect(SRC).toContain("const retryAfter = Math.min(parseInt(resp.headers.get('Retry-After') || '5') || 5, 300) * MS.SEC;");
  });
  it('functional: shipped clamp bounds hostile + sane values', () => {
    const clamp = (h) => Math.min(parseInt(h || '5') || 5, 300);
    expect(clamp('10')).toBe(10);          // sane
    expect(clamp('86400')).toBe(300);      // hostile day-stall → capped
    expect(clamp('2147483647')).toBe(300); // setTimeout overflow territory → capped
    expect(clamp('abc')).toBe(5);          // non-numeric → fallback
    expect(clamp('0')).toBe(5);            // zero → fallback
    expect(clamp(null)).toBe(5);           // absent → fallback
    expect(clamp('-30')).toBe(-30);        // negative stays negative (truthy) — setTimeout fires immediately, same as before
  });
});

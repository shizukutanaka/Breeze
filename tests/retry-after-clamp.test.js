import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Drive the shipped _retryAfterSec with fake Response objects.
const FN = SRC.match(/const _retryAfterSec = \(resp, fallback = 5, max = 300\) => [^\n]+\n/)[0];
const _retryAfterSec = new Function(`${FN} return _retryAfterSec;`)();
const resp = h => ({ headers: { get: () => h } });

describe('_retryAfterSec — clamps server-supplied Retry-After', () => {
  it('caps unbounded values at 300s (a huge header no longer parks the poll for days)', () => {
    expect(_retryAfterSec(resp('999999999'))).toBe(300);
    expect(_retryAfterSec(resp('86400'))).toBe(300);
    expect(_retryAfterSec(resp('301'))).toBe(300);
  });

  it('floors non-positive values (a ≤0 header no longer makes a tight hammer loop)', () => {
    expect(_retryAfterSec(resp('0'))).toBe(5); // '0' parses falsy → fallback, never "retry now"
    expect(_retryAfterSec(resp('-30'))).toBe(1); // negatives are truthy → floored to 1s
  });

  it('passes through legit worker values (1-60s window)', () => {
    expect(_retryAfterSec(resp('1'))).toBe(1);
    expect(_retryAfterSec(resp('30'))).toBe(30);
    expect(_retryAfterSec(resp('60'))).toBe(60);
    expect(_retryAfterSec(resp('120'))).toBe(120);
  });

  it('falls back on missing/malformed headers', () => {
    expect(_retryAfterSec(resp(null))).toBe(5);
    expect(_retryAfterSec(resp(''))).toBe(5);
    expect(_retryAfterSec(resp('later'))).toBe(5);
    expect(_retryAfterSec(resp(null), 10)).toBe(10);
  });

  it('honours a site-specific max (signal resend keeps its 15s cap)', () => {
    expect(_retryAfterSec(resp('300'), 5, 15)).toBe(15);
    expect(_retryAfterSec(resp('-5'), 5, 15)).toBe(1);
  });
});

describe('wiring — every Retry-After consumer goes through the clamp', () => {
  it('fetchRetry / sealed retry-queue / signal resend all use _retryAfterSec', () => {
    expect(SRC).toContain('const retryAfter = _retryAfterSec(resp);');
    expect(SRC).toContain('const retryAfter = _retryAfterSec(resp) * MS.SEC;');
    expect(SRC).toContain('_retryAfterSec(resp, 5, 15) * MS.SEC');
  });

  it('no raw parseInt(Retry-After) remains outside the helper', () => {
    const raw = SRC.match(/parseInt\(resp\.headers\.get\('Retry-After'\)/g) || [];
    expect(raw.length).toBe(1); // only inside _retryAfterSec itself
  });
});

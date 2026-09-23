import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Round 41: /codeverify reads the served bundle + GitHub raw copies to diff them — a
// tampered host (the very thing the command detects) could answer with a huge stream
// and OOM the detector itself. _boundedText cancels the reader at the cap.

function fn() {
  const start = SRC.indexOf('async function _boundedText(resp, maxBytes)');
  expect(start).toBeGreaterThan(-1);
  const end = SRC.indexOf('\n}', start) + 2;
  return new Function(`${SRC.slice(start, end)}; return _boundedText;`)();
}

// Minimal ReadableStream-compatible fake: chunks + cancel tracking.
function fakeResp(chunks) {
  let i = 0, cancelled = false;
  return {
    cancelled: () => cancelled,
    body: { getReader: () => ({
      read: async () => i < chunks.length ? { done: false, value: chunks[i++] } : { done: true, value: undefined },
      cancel: async () => { cancelled = true; },
    }) },
  };
}
const enc = s => new TextEncoder().encode(s);

describe('_boundedText', () => {
  it('reassembles multi-chunk bodies in order', async () => {
    const r = fakeResp([enc('he'), enc('llo '), enc('world')]);
    expect(await fn()(r, 1024)).toBe('hello world');
  });
  it('accepts a body exactly at the cap', async () => {
    const r = fakeResp([enc('x'.repeat(1024))]);
    expect(await fn()(r, 1024)).toBe('x'.repeat(1024));
  });
  it('cancels the stream at the cap instead of reading to the end', async () => {
    const chunks = [enc('a'.repeat(600)), enc('b'.repeat(600)), enc('c'.repeat(600))];
    const r = fakeResp(chunks);
    await expect(fn()(r, 1024)).rejects.toThrow('too large');
    expect(r.cancelled()).toBe(true);
  });
  it('handles an empty body', async () => {
    expect(await fn()(fakeResp([]), 1024)).toBe('');
  });
});

describe('/codeverify sites are bounded', () => {
  it('served bundle read is capped', () => {
    expect(SRC).toContain('await sha(await _boundedText(servedResp, 4 * 1024 * 1024))');
  });
  it('github raw reads are capped', () => {
    expect(SRC).toContain("r.ok ? _boundedText(r, 4 * 1024 * 1024) : null");
  });
});

// tests/safe-json.test.js — Breeze deep-behavior test: recurring poll loops bound
// response bodies via _safeJson. A hostile or compromised relay (the threat model
// sw.js safeAppUrl already acknowledges) can answer every 5s poll with a huge body —
// resp.json() materializes all of it, per cycle, forever. _safeJson rejects when
// Content-Length exceeds the cap (early, before reading) and when the text itself
// does (covers chunked responses with no CL header). Caps sit just above the honest
// queue limits: inbox ≤100×64KB→8MB, sealed ≤100×256KB→32MB, sig rooms ≤50×64KB→4MB.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const start = SRC.indexOf('async function _safeJson');
const fnSrc = SRC.slice(start, SRC.indexOf('\n}', start) + 2);
const safeJson = new Function('return ' + fnSrc)();

function fakeResp({ cl, body }) {
  return { headers: { get: k => (k === 'Content-Length' ? cl : null) }, text: async () => body };
}
const CAP = 8 * 1024 * 1024;

describe('_safeJson response bound', () => {
  it('extracts the shipped helper', () => { expect(typeof safeJson).toBe('function'); });
  it('rejects oversized Content-Length before reading the body', async () => {
    let read = false;
    const resp = { headers: { get: () => String(CAP + 1) }, text: async () => { read = true; return '{}'; } };
    await expect(safeJson(resp, CAP)).rejects.toThrow('response too large');
    expect(read).toBe(false); // early CL check — body never materialized
  });
  it('rejects oversized body when Content-Length is absent or small', async () => {
    await expect(safeJson(fakeResp({ cl: null, body: ' '.repeat(CAP + 1) }), CAP)).rejects.toThrow('response too large');
    await expect(safeJson(fakeResp({ cl: '10', body: ' '.repeat(CAP + 1) }), CAP)).rejects.toThrow('response too large');
  });
  it('parses bodies at or under the cap', async () => {
    expect(await safeJson(fakeResp({ cl: '8', body: '{"a":1}' }), CAP)).toEqual({ a: 1 });
    expect(await safeJson(fakeResp({ cl: null, body: '[]' }), CAP)).toEqual([]);
  });
});

describe('poll sites use bounded parsing', () => {
  const sites = SRC.match(/await _safeJson\(\w+, [^\)]+\)/g) || [];
  it('all seven recurring poll loops are converted', () => { expect(sites.length).toBe(7); });
  it('per-site caps match each queue\'s honest maximum', () => {
    expect(SRC.match(/_safeJson\(sResp, 32 \* 1024 \* 1024\)/)).not.toBeNull(); // sealed ≤100×256KB
    expect((SRC.match(/_safeJson\(resp, 8 \* 1024 \* 1024\)/g) || []).length).toBe(2); // /msg/poll ×2 (inbox ≤100×64KB)
    expect((SRC.match(/_safeJson\(resp, 4 \* 1024 \* 1024\)/g) || []).length).toBe(3); // 2 sig polls + group member poll
    expect(SRC.match(/_safeJson\(r, 1024 \* 1024\)/)).not.toBeNull();              // presence check
  });
});

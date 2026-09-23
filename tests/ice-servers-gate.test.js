import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const FN = SRC.match(/function _safeIceServers\(list\) \{[\s\S]+?\n  \}/)[0];
const safeIce = new Function(`${FN} return _safeIceServers;`)();

describe('_safeIceServers — relay-supplied ICE config gating', () => {
  it('non-array → empty (built-ins stay in effect)', () => {
    expect(safeIce(null)).toEqual([]);
    expect(safeIce('turn:x:3478')).toEqual([]);
    expect(safeIce(42)).toEqual([]);
  });
  it('valid entries pass through (string + array urls)', () => {
    const out = safeIce([
      { urls: 'turn:t.example:3478', username: 'u', credential: 'c' },
      { urls: ['stun:s.example:3478', 'stun:s2.example:3478'] },
    ]);
    expect(out).toEqual([
      { urls: 'turn:t.example:3478', username: 'u', credential: 'c' },
      { urls: ['stun:s.example:3478', 'stun:s2.example:3478'] },
    ]);
  });
  it('drops non-ICE schemes and malformed entries — the constructor-throw class', () => {
    const out = safeIce([
      { urls: 'javascript:alert(1)' },
      { urls: 'http://x.example' },
      { urls: null },
      'turn:not-an-object',
      null,
      { urls: 'turn:ok.example:3478' },
    ]);
    expect(out).toEqual([{ urls: 'turn:ok.example:3478' }]);
  });
  it('bounds entry count, urls-per-entry, url/username/credential length', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ urls: 'turn:t' + i + '.e:1', username: 'x'.repeat(900), credential: 'y'.repeat(900) }));
    const out = safeIce(many);
    expect(out.length).toBe(10);
    expect(out[0].username.length).toBe(512);
    expect(out[0].credential.length).toBe(512);
    const urls = safeIce([{ urls: ['turn:a:1', 'turn:b:1', 'turn:c:1', 'turn:d:1', 'turn:e:1', 'turn:f:1'] }])[0].urls;
    expect(urls.length).toBe(4);
    expect(safeIce([{ urls: 'turn:' + 'h'.repeat(300) }])).toEqual([]);
  });
  it('mixed url arrays keep only ICE-scheme urls', () => {
    const out = safeIce([{ urls: ['turn:good:1', 'ftp://bad', 'stun:also-good:2'] }]);
    expect(out).toEqual([{ urls: ['turn:good:1', 'stun:also-good:2'] }]);
  });
  it('strips foreign fields (no prototype-polluting keys carried)', () => {
    const out = safeIce([{ urls: 'turn:t:1', evil: 1, __proto__: { polluted: true } }]);
    expect(out[0]).toEqual({ urls: 'turn:t:1' });
    expect(Object.keys(out[0])).toEqual(['urls']);
  });
  it('tripwire: call config uses the gated list and scheme-checked legacy path', () => {
    expect(SRC).toContain('const _relayIce = _safeIceServers(_turnCredential?.iceServers);');
    expect(SRC).toContain('cfg.iceServers = _relayIce;');
    expect(SRC).not.toContain('cfg.iceServers = _turnCredential.iceServers;');
  });
});

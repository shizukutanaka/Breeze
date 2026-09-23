// updateFromRTT feeds on peer-reported pong.ts — a forged pong can claim ANY RTT,
// and a single bad sample used to flip the whole app to the worst tier instantly
// (pollInterval → 20s for ALL contacts' delivery + imageQuality → 0.4 on every send).
// Now: implausible values are dropped and the rest are smoothed (RFC 6298 SRTT,
// α=1/8), so degradation needs sustained bad samples — exactly like TCP's RTT
// estimator. Tests drive the REAL _adaptiveConfig extracted from index.html.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname;
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');

function loadConfig() {
  const start = html.indexOf('const _adaptiveConfig = {');
  const end = html.indexOf('\n};', start) + 3;
  if (start < 0 || end < 0) throw new Error('config not found');
  return new Function('CONFIG', '_dbg', html.slice(start, end).trim() + '; return _adaptiveConfig;')(
    { POLL_UNREAD_MS: 3000 }, () => {});
}

describe('updateFromRTT — peer-controlled RTT smoothing (RFC 6298)', () => {
  it('wire-site: implausible values dropped, samples smoothed via _srtt', () => {
    expect(html).toContain('if (!Number.isFinite(rttMs) || rttMs < 0 || rttMs > 10000) return;');
    expect(html).toContain('this._srtt = this._srtt == null ? rttMs : 0.96875 * this._srtt + 0.03125 * rttMs;');
  });

  it('one forged max-plausible pong does NOT degrade the tier', () => {
    const c = loadConfig();
    c.updateFromRTT(50);      // establish a good baseline
    c.updateFromRTT(10000);   // max forged plausible value — srtt moves only 1/8 → ~1294
    expect(c.pollInterval).toBe(3000);
    expect(c.imageQuality).toBe(0.85);
  });

  it('implausible values are ignored entirely', () => {
    const c = loadConfig();
    c.updateFromRTT(50);
    for (const bad of [-1, NaN, Infinity, -Infinity, 10001, 60000, 1e9, 'x', undefined]) {
      c.updateFromRTT(bad);
      expect(c.pollInterval, String(bad)).toBe(3000);
      expect(c.imageQuality, String(bad)).toBe(0.85);
      expect(c._srtt, String(bad)).toBe(50);
    }
  });

  it('sustained bad samples DO degrade (legit poor link still adapts)', () => {
    const c = loadConfig();
    for (let i = 0; i < 60; i++) c.updateFromRTT(5000);
    expect(c.pollInterval).toBe(20000);
    expect(c.imageQuality).toBe(0.4);
  });

  it('recovers to defaults when the link improves', () => {
    const c = loadConfig();
    for (let i = 0; i < 60; i++) c.updateFromRTT(5000);
    for (let i = 0; i < 100; i++) c.updateFromRTT(50);
    expect(c.pollInterval).toBe(3000);
    expect(c.imageQuality).toBe(0.85);
  });

  it('first sample seeds the estimator directly', () => {
    const c = loadConfig();
    c.updateFromRTT(5000);
    expect(c._srtt).toBe(5000); // no fake baseline lag
    expect(c.pollInterval).toBe(20000);
  });
});

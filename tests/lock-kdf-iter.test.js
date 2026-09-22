import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const html = readFileSync('index.html', 'utf8');

// The lock-screen hash sits in localStorage (brz-lock-hash): readable by anything with
// device access, so it is offline-brute-forceable. OWASP Password Storage Cheat Sheet
// (2023) puts PBKDF2-HMAC-SHA256 at >=600k — the same bar the codebase already applies
// to at-rest identity key wrapping (PBKDF2_AT_REST_ITERATIONS).
describe('lock-screen PBKDF2 iteration strength', () => {
  it('uses the OWASP-floor constant for NEW lock hashes', () => {
    const setSite = html.indexOf("localStorage.setItem('brz-lock-hash'");
    expect(setSite).toBeGreaterThan(-1);
    const block = html.slice(setSite - 2000, setSite + 400);
    expect(block).toContain('iterations: CONFIG.PBKDF2_AT_REST_ITERATIONS');
    // The record persists its iter so future raises never lock users out.
    expect(block).toContain('iter: CONFIG.PBKDF2_AT_REST_ITERATIONS');
  });

  it('verifies pre-raise records at their own iteration count', () => {
    // Old records carry no iter field — they must verify at the legacy 100k, not 600k.
    expect(html).toContain('iterations: stored.iter || CONFIG.PBKDF2_ITERATIONS');
  });

  it('upgrades weaker records on successful unlock (no downgrade)', () => {
    // isLegacy (bare SHA-256) OR a stored iter below the current target triggers the
    // transparent re-derive; a hypothetical future higher iter is left alone.
    expect(html).toContain('isLegacy || (stored.iter || 0) < CONFIG.PBKDF2_AT_REST_ITERATIONS');
  });

  it('keeps the shared constant at its legacy value (no accidental regressions)', () => {
    const m = html.match(/PBKDF2_ITERATIONS:\s*(\d+)/);
    expect(m).not.toBeNull();
    expect(Number(m[1])).toBe(100000);
    const m2 = html.match(/PBKDF2_AT_REST_ITERATIONS:\s*(\d+)/);
    expect(Number(m2[1])).toBe(600000);
  });

  it('600k and 100k PBKDF2 produce different bits (the raise is real)', async () => {
    const salt = new Uint8Array(16).fill(7);
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode('pass1234'), 'PBKDF2', false, ['deriveBits']);
    const a = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, km, 256);
    const b = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' }, km, 256);
    expect(Buffer.from(a).toString('base64')).not.toBe(Buffer.from(b).toString('base64'));
  });

  it('600k derive completes fast enough for an unlock path (<3s)', async () => {
    const salt = new Uint8Array(16).fill(1);
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode('x'), 'PBKDF2', false, ['deriveBits']);
    const t0 = Date.now();
    await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' }, km, 256);
    expect(Date.now() - t0).toBeLessThan(3000);
  });
});

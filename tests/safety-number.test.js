import { describe, it, expect } from 'vitest';
import { createFingerprint } from '../src/crypto/fingerprint.js';
import { SAFETY_NUMBER_CAP, negotiatedSafetyNumber, legacySafetyNumber, comparisonQR, compareQR } from '../src/app/safety-number.js';
import { contactBinding, contactSafetyNumber, createContactVerify } from '../src/app/contact-verify.js';

const key = n => Buffer.alloc(32, n).toString('base64');
const a = { pubB64: key(1), sigPub: key(2) }, b = { id: key(3).slice(0, 12), pubB64: key(3), sigPub: key(4) };
const caps = [SAFETY_NUMBER_CAP];
const v2 = (x, y) => negotiatedSafetyNumber(x, y, { localCaps: caps, remoteCaps: caps });

describe('deployed safety-number negotiation', () => {
  it('uses the unchanged 96-bit number on both sides of every mixed/empty capability combination', async () => {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode([a.pubB64, b.pubB64].sort().join(''))));
    const expected = Array.from({ length: 6 }, (_, i) => String((digest[i * 2] << 8) | digest[i * 2 + 1]).padStart(5, '0')).join(' ');
    for (const [localCaps, remoteCaps] of [[[], []], [caps, []], [[], caps]]) {
      expect(await negotiatedSafetyNumber(a.pubB64, b.pubB64, { localCaps, remoteCaps })).toBe(expected);
      expect(await negotiatedSafetyNumber(b.pubB64, a.pubB64, { localCaps: remoteCaps, remoteCaps: localCaps })).toBe(expected);
    }
    expect(await negotiatedSafetyNumber(a.pubB64, b.pubB64)).toBe(expected);
  });
  it('matches the single-sourced reference at 5200 rounds with stable identifiers and symmetric 60-digit display', async () => {
    const [number, reference, reverse, unbound] = await Promise.all([
      v2(a.pubB64, b.pubB64),
      createFingerprint().safetyNumber(a.pubB64, b.pubB64, { localId: a.pubB64.slice(0, 12), remoteId: b.pubB64.slice(0, 12) }),
      v2(b.pubB64, a.pubB64),
      createFingerprint().safetyNumber(a.pubB64, b.pubB64),
    ]);
    expect(number).toMatch(/^(?:\d{5} ){11}\d{5}$/);
    expect(number).toBe(reference);
    expect(reverse).toBe(number);
    expect(unbound).not.toBe(number);
  });
  it('versioned QR comparison binds both keys; version mismatch is not a key-change alarm', async () => {
    const [number, both, reverseNumber, reverseBoth, legacyNumber, mismatchBoth] = await Promise.all([
      v2(a.pubB64, b.pubB64),
      contactSafetyNumber(a, b),
      v2(b.pubB64, a.pubB64),
      contactSafetyNumber(b, a),
      legacySafetyNumber(a.pubB64, b.pubB64),
      contactSafetyNumber(a, { ...b, sigPub: key(5) }),
    ]);
    const qr = comparisonQR(number, both);
    expect(JSON.parse(qr.slice(14)).v).toBe(2);
    expect(compareQR(comparisonQR(reverseNumber, reverseBoth), qr)).toBe('match');
    expect(compareQR(comparisonQR(legacyNumber, both), qr)).toBe('version');
    expect(compareQR(comparisonQR(number, mismatchBoth), qr)).toBe('mismatch');
    for (const value of ['', 'breeze-verify:{}', 'breeze-verify:' + 'x'.repeat(600), qr.replace('"v":2', '"v":3')]) expect(compareQR(value, qr)).toBe('invalid');
    expect(() => comparisonQR('', both)).toThrow();
  });
  it('keeps prior verification bound to both keys, not capabilities or display version', async () => {
    const records = new Map([['contacts:' + b.id, b]]);
    const api = createContactVerify({ account: 'test', get: async (s, k) => records.get(s + ':' + k), put: async (s, v, k) => { records.set(s + ':' + (k || v.id), v); return true; }, audit: async () => {}, t: k => k });
    await api.verify(b, 'safety-number');
    const saved = structuredClone(records.get('identity:verify:' + b.id));
    await v2(a.pubB64, b.pubB64);
    expect((await api.state({ ...b, caps })).verified).toBe(true);
    expect(records.get('identity:verify:' + b.id)).toEqual(saved);
    expect(await contactBinding({ ...b, caps })).toBe(await contactBinding(b));
    expect(await contactBinding({ ...b, sigPub: key(5) })).not.toBe(saved.binding);
  });
});

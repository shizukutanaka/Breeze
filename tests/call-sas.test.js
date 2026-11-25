// D26 / ROADMAP C5 (SAS half): the 1:1 call screen shows a short
// authentication string derived from the two DTLS fingerprints in the
// exchanged SDPs. Both sides must derive the IDENTICAL string from
// their mirrored local/remote views (the fingerprints are sorted
// before hashing), a different fingerprint pair — the DTLS-terminating
// MITM case — must yield a different string, and a missing fingerprint
// must yield no string at all (never a made-up code).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { computeCallSAS, extractDtlsFingerprint } from '../src/app/call.js';

const sdp = (fp) => `v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\na=fingerprint:sha-256 ${fp}\r\na=setup:actpass\r\n`;
const FP_A = '12:34:56:78:9A:BC:DE:F0:12:34:56:78:9A:BC:DE:F0:12:34:56:78:9A:BC:DE:F0:12:34:56:78:9A:BC:DE:F0';
const FP_B = 'FF:EE:DD:CC:BB:AA:99:88:77:66:55:44:33:22:11:00:FF:EE:DD:CC:BB:AA:99:88:77:66:55:44:33:22:11:00';
const FP_MITM = '00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF';

describe('call SAS derivation (src/app/call.js)', () => {
  it('extracts and normalises the DTLS fingerprint', () => {
    expect(extractDtlsFingerprint(sdp(FP_A))).toBe(FP_A.replace(/:/g, ''));
    expect(extractDtlsFingerprint(sdp(FP_A.toLowerCase()))).toBe(FP_A.replace(/:/g, ''));
    expect(extractDtlsFingerprint('v=0\r\n')).toBeNull();
    expect(extractDtlsFingerprint(null)).toBeNull();
    expect(extractDtlsFingerprint(undefined)).toBeNull();
  });

  it('matches the pinned known-answer vector', async () => {
    expect(await computeCallSAS(sdp(FP_A), sdp(FP_B))).toBe('77PT-G3FS');
  });

  it('is symmetric: caller and callee derive the same string', async () => {
    expect(await computeCallSAS(sdp(FP_A), sdp(FP_B))).toBe(await computeCallSAS(sdp(FP_B), sdp(FP_A)));
  });

  it('changes when either leg\'s fingerprint changes (the MITM case)', async () => {
    const honest = await computeCallSAS(sdp(FP_A), sdp(FP_B));
    expect(await computeCallSAS(sdp(FP_A), sdp(FP_MITM))).not.toBe(honest);
    expect(await computeCallSAS(sdp(FP_MITM), sdp(FP_B))).not.toBe(honest);
  });

  it('uses the unambiguous Crockford alphabet in XXXX-XXXX shape', async () => {
    const sas = await computeCallSAS(sdp(FP_A), sdp(FP_B));
    expect(sas).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  });

  it('returns null rather than a code when a fingerprint is missing', async () => {
    expect(await computeCallSAS('v=0\r\n', sdp(FP_B))).toBeNull();
    expect(await computeCallSAS(sdp(FP_A), '')).toBeNull();
    expect(await computeCallSAS(null, null)).toBeNull();
  });
});

describe('call SAS wiring', () => {
  const callSrc = readFileSync(new URL('../src/app/call.js', import.meta.url), 'utf8');
  it('shows the SAS from both connected transitions (caller and callee)', () => {
    expect(callSrc.match(/showCallSAS\(\);/g)).toHaveLength(2);
    expect(callSrc).toContain("sasEl.id = 'call-sas'");
    expect(callSrc).toContain("t('callSasLabel')");
  });
});

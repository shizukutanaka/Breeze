// Protocol version negotiation tests (N3)
import { describe, it, expect } from 'vitest';
import { CAPS, ALL_V5, advertise, parsePeerCaps, negotiate } from '../src/crypto/negotiate.js';

describe('advertise', () => {
  it('includes all v5 caps and the x3dh:v5 compat field by default', () => {
    const ad = advertise();
    expect(ad.caps).toEqual(expect.arrayContaining(Object.values(CAPS)));
    expect(ad.x3dh).toBe('v5');
  });

  it('sets x3dh:v4 when X3DH_V5 is not in the local cap set', () => {
    const ad = advertise([CAPS.GROUP_V5]);
    expect(ad.x3dh).toBe('v4');
    expect(ad.caps).not.toContain(CAPS.X3DH_V5);
  });

  it('includes custom subset of caps', () => {
    const ad = advertise([CAPS.FRANKING]);
    expect(ad.caps).toContain(CAPS.FRANKING);
    expect(ad.caps).not.toContain(CAPS.GROUP_V5);
  });
});

describe('parsePeerCaps', () => {
  it('returns empty array for a null/undefined peer', () => {
    expect(parsePeerCaps(null)).toEqual([]);
    expect(parsePeerCaps(undefined)).toEqual([]);
  });

  it('returns the caps array when present', () => {
    expect(parsePeerCaps({ caps: ALL_V5 })).toEqual(ALL_V5);
  });

  it('falls back to inferring X3DH_V5 from legacy x3dh field', () => {
    expect(parsePeerCaps({ x3dh: 'v5' })).toContain(CAPS.X3DH_V5);
  });

  it('returns empty array for a legacy v4 peer with no caps', () => {
    expect(parsePeerCaps({ identityKey: 'IK', signedPreKey: 'SPK' })).toEqual([]);
  });
});

describe('negotiate', () => {
  it('enables a feature when both sides support it', () => {
    const res = negotiate(ALL_V5, ALL_V5);
    expect(res.useX3dhV5).toBe(true);
    expect(res.useGroupV5).toBe(true);
    expect(res.useFranking).toBe(true);
  });

  it('disables X3DH v5 when the peer does not support it', () => {
    const res = negotiate(ALL_V5, [CAPS.GROUP_V5]);
    expect(res.useX3dhV5).toBe(false);
    expect(res.useGroupV5).toBe(true);
  });

  it('all features off for a legacy peer (empty caps)', () => {
    const res = negotiate(ALL_V5, []);
    expect(res.useX3dhV5).toBe(false);
    expect(res.useGroupV5).toBe(false);
    expect(res.useFranking).toBe(false);
  });

  it('all features off for a legacy local client (no v5 caps emitted)', () => {
    const res = negotiate([], ALL_V5);
    expect(res.useX3dhV5).toBe(false);
    expect(res.useGroupV5).toBe(false);
  });

  it('round-trip: advertise → parsePeerCaps → negotiate', () => {
    const localAd = advertise(ALL_V5);
    const peerAd  = advertise([CAPS.X3DH_V5]); // peer only supports X3DH
    const res = negotiate(parsePeerCaps(localAd), parsePeerCaps(peerAd));
    expect(res.useX3dhV5).toBe(true);
    expect(res.useGroupV5).toBe(false); // peer doesn't support it
    expect(res.useFranking).toBe(false);
  });
});

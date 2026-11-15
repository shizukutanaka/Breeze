// P2P_PLAN Step 1 — on-device P2P statistics (src/app/p2p-stats.js).
// The counters are the ONLY measurement of the direct rate the product
// will ever have (no telemetry), so their math is pinned here: delivery
// rate from the Step 2 seed counters, route classification of the
// selected ICE candidate, and honest nulls when nothing is measured.
import { describe, it, expect } from 'vitest';
import { createP2pStats, classifyCandidateType } from '../src/app/p2p-stats.js';

function fakeStore(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    load: (k) => (map.has(k) ? JSON.parse(JSON.stringify(map.get(k))) : null),
    save: (k, v) => { map.set(k, v); },
  };
}

describe('classifyCandidateType', () => {
  it('maps ICE candidate types to route buckets', () => {
    expect(classifyCandidateType('host')).toBe('direct');
    expect(classifyCandidateType('srflx')).toBe('srflx');
    expect(classifyCandidateType('prflx')).toBe('srflx');
    expect(classifyCandidateType('relay')).toBe('turn');
  });

  it('returns null for unknown types (ignored, never miscounted)', () => {
    expect(classifyCandidateType('bogus')).toBe(null);
    expect(classifyCandidateType('')).toBe(null);
    expect(classifyCandidateType(undefined)).toBe(null);
  });
});

describe('createP2pStats — delivery counters', () => {
  it('starts empty: directRate is null, not a fabricated 0%', () => {
    const s = createP2pStats(fakeStore()).snapshot();
    expect(s.directTotal).toBe(0);
    expect(s.directRate).toBe(null);
    expect(s.connTotal).toBe(0);
  });

  it('direct rate = acked / all direct attempts', () => {
    const store = fakeStore();
    const stats = createP2pStats(store);
    stats.noteDelivery(true);
    stats.noteDelivery(true);
    stats.noteDelivery(true);
    stats.noteDelivery(false);
    const s = stats.snapshot();
    expect(s.directAck).toBe(3);
    expect(s.directNoAck).toBe(1);
    expect(s.directRate).toBeCloseTo(0.75);
  });

  it('preserves the pre-module brz-p2p-direct shape (Step 2 seed counts carry over)', () => {
    const store = fakeStore({ 'brz-p2p-direct': { directAck: 5, directNoAck: 5 } });
    const stats = createP2pStats(store);
    stats.noteDelivery(true);
    const s = stats.snapshot();
    expect(s.directAck).toBe(6);
    expect(s.directRate).toBeCloseTo(6 / 11);
    // Written back under the same key/shape the inline fallback uses.
    expect(store.map.get('brz-p2p-direct')).toEqual({ directAck: 6, directNoAck: 5 });
  });

  it('tolerates corrupt stored values instead of poisoning the rate', () => {
    const store = fakeStore({ 'brz-p2p-direct': { directAck: 'lots', directNoAck: -3 } });
    const s = createP2pStats(store).snapshot();
    expect(s.directAck).toBe(0);
    expect(s.directNoAck).toBe(0);
    expect(s.directRate).toBe(null);
  });
});

describe('createP2pStats — connection routes', () => {
  it('counts established sessions by route and timeouts as failed', () => {
    const stats = createP2pStats(fakeStore());
    stats.noteConnection('host');
    stats.noteConnection('srflx');
    stats.noteConnection('relay');
    stats.noteConnection('relay');
    stats.noteConnectionFailed();
    const s = stats.snapshot();
    expect(s.conn).toEqual({ direct: 1, srflx: 1, turn: 2, failed: 1 });
    expect(s.connTotal).toBe(4); // established only — failures are separate
    expect(s.connFailed).toBe(1);
  });

  it('ignores unknown candidate types', () => {
    const stats = createP2pStats(fakeStore());
    stats.noteConnection('bogus');
    expect(stats.snapshot().connTotal).toBe(0);
  });

  it('a throwing store degrades to a no-op, never an exception', () => {
    const stats = createP2pStats({
      load: () => { throw new Error('storage unavailable'); },
      save: () => { throw new Error('storage unavailable'); },
    });
    expect(() => {
      stats.noteDelivery(true);
      stats.noteConnection('host');
      stats.noteConnectionFailed();
    }).not.toThrow();
    expect(stats.snapshot().directRate).toBe(null);
  });
});

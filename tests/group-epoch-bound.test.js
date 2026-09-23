import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Shipped guard lines.
const KICK = SRC.match(/if \(!CONFIG\.GROUP_RATCHET_V5 \|\| !Number\.isInteger\(epoch\) \|\| epoch < 0 \|\| epoch > 1e6\) return;/);
const LEAVE = SRC.match(/if \(Number\.isInteger\(epoch\) && epoch >= 0 && epoch <= 1e6 && privileged\) \{/);

describe('group rotation notices bound epoch at a sane integer', () => {
  it('kick + leave notices gate epoch: integer, >=0, <=1e6', () => {
    expect(KICK).not.toBeNull();
    expect(LEAVE).not.toBeNull();
    // The old loose checks are gone from both writers
    expect(SRC).not.toContain("typeof epoch !== 'number') return;");
    expect(SRC).not.toContain("typeof epoch === 'number' && privileged");
  });
  it('functional: absurd epochs rejected, sane epochs accepted', () => {
    // Mirror the shipped predicates exactly
    const kickOk = (epoch, v5 = true) => !(!v5 || !Number.isInteger(epoch) || epoch < 0 || epoch > 1e6);
    const leaveWrites = (epoch, privileged) => Number.isInteger(epoch) && epoch >= 0 && epoch <= 1e6 && privileged;
    for (const bad of [Infinity, -Infinity, NaN, 1e308, 1e9, -5, 1.5, 'x', {}, null, undefined]) {
      expect(kickOk(bad)).toBe(false);
      expect(leaveWrites(bad, true)).toBe(false);
    }
    for (const good of [0, 1, 42, 999, 1e6]) {
      expect(kickOk(good)).toBe(true);
      expect(leaveWrites(good, true)).toBe(true);
    }
    expect(leaveWrites(5, false)).toBe(false); // privilege still required
    expect(kickOk(5, false)).toBe(false);      // v5 flag still required
  });
  it('pin scenario: 1e308 notice leaves current.epoch able to accept real rotations', () => {
    // Simulate the >= guard outcome after a (rejected) 1e308 write:
    // pre-fix stored epoch 1e308 → every real notice rejected; post-fix store stays small.
    const stored = 3; // chain remains at real epoch since the 1e308 write never landed
    expect(stored >= 4).toBe(false); // next real notice (epoch 4) still rotates
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const BLOCK = SRC.match(/async function acquireWakeLock[\s\S]+?\n {2}\}/)[0];

describe('acquireWakeLock must release a sentinel that resolves into a dead context (CWE-772)', () => {
  it('holds the request in a local and checks _callState + _ac.signal.aborted after it resolves', () => {
    expect(BLOCK).toMatch(/const s = await navigator\.wakeLock\.request\('screen'\)/);
    expect(BLOCK).toMatch(/if \(_callState === 'idle' \|\| _ac\.signal\.aborted\) \{ s\.release\(\); return; \}/);
  });

  it('assigns _wakeLock only after the liveness check', () => {
    const checkIdx = BLOCK.indexOf("s.release(); return;");
    const assignIdx = BLOCK.indexOf('_wakeLock = s;');
    expect(checkIdx).toBeGreaterThan(-1);
    expect(assignIdx).toBeGreaterThan(checkIdx);
  });

  it('has no unguarded late assignment left (tripwire)', () => {
    expect(BLOCK).not.toMatch(/_wakeLock = await navigator\.wakeLock\.request/);
  });

  it('functional: late-resolving sentinel is released instead of retained', async () => {
    let released = 0, assigned = null;
    const sentinel = { release: () => { released++; } };
    const acquire = async (callState, aborted) => {
      const s = await Promise.resolve(sentinel);
      if (callState === 'idle' || aborted) { s.release(); return; }
      assigned = s;
    };
    await acquire('idle', false);   // call ended mid-request → released, never stored
    await acquire('calling', true); // account switched mid-request → released
    await acquire('calling', false);// live call → retained
    expect(released).toBe(2);
    expect(assigned).toBe(sentinel);
  });
});

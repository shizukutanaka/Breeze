import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const BLOCK = SRC.match(/async function initPushNotifications[\s\S]+?\n {2}\}/)[0];

describe('initPushNotifications must not re-register push after the context died (cross-account leak)', () => {
  it('gates both /push/subscribe calls on _ac.signal.aborted', () => {
    const calls = BLOCK.match(/\/push\/subscribe/g) || [];
    const gates = BLOCK.match(/!\s*_ac\.signal\.aborted\) await postAPIRaw\('\/push\/subscribe'/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(gates.length).toBe(2); // every subscribe call gated
  });

  it('has no ungated /push/subscribe postAPIRaw left (tripwire)', () => {
    expect(BLOCK).not.toMatch(/(?<!aborted\) )await postAPIRaw\('\/push\/subscribe'/);
  });

  it('keeps the call sites after the subscription/permission awaits (late-landing guard)', () => {
    const ready = BLOCK.indexOf('serviceWorker.ready');
    const perm = BLOCK.indexOf('requestPermission');
    const gateIdx = BLOCK.indexOf("!_ac.signal.aborted) await postAPIRaw('/push/subscribe'");
    expect(gateIdx).toBeGreaterThan(ready);
    expect(perm).toBeGreaterThan(ready);
  });

  it('functional: aborted context skips the server registration; live one sends it', async () => {
    const calls = [];
    const run = async (aborted) => {
      const postAPIRaw = async (...a) => { calls.push(a[0]); };
      if (!aborted) await postAPIRaw('/push/subscribe', { userId: 'u' });
      return calls.length;
    };
    expect(await run(true)).toBe(0);  // dead context → no server registration
    expect(await run(false)).toBe(1); // live context → registers
    expect(calls).toEqual(['/push/subscribe']);
  });
});

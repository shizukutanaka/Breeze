// SHARE_PLAN stage 5 step 3 — client-side group scale.
// (1) poolMap: the bounded-concurrency fan-out the group send path
//     now uses. (2) The deployed distributeSenderKey, sliced out of
//     index.html and run against stubs: the redistribution cadence
//     that replaced per-message redistribution to everyone.
// (3) Wiring pins for the raised cap.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { poolMap } from '../src/app/group-call.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('poolMap', () => {
  it('never runs more than n workers at once and preserves order', async () => {
    let inFlight = 0, maxInFlight = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);
    const out = await poolMap(items, 4, async (x) => {
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(r => setTimeout(r, 5));
      inFlight--;
      return x * 2;
    });
    expect(maxInFlight).toBeLessThanOrEqual(4);
    expect(out).toEqual(items.map(x => x * 2));
  });

  it('handles empty input', async () => {
    expect(await poolMap([], 8, async () => 1)).toEqual([]);
  });
});

describe('distributeSenderKey cadence (deployed inline code, sliced)', () => {
  const start = html.indexOf('const _skDist = new Map();');
  const end = html.indexOf('// v5 kick completeness', start);
  const src = html.slice(start, end).trimEnd();
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

  async function harness() {
    const deposits = [];
    let epoch = 7;
    const state = { get epoch() { return epoch; }, setEpoch(e) { epoch = e; } };
    const run = new AsyncFunction('CONFIG', 'getGroupSenderKey', 'encryptFor', 'relaySend', 'myId', 'myPubB64', 'myName', '_dbg',
      src + '\nreturn distributeSenderKey;');
    const fn = await run(
      { GROUP_RATCHET_V5: true, SK_REDIST_EVERY: 25 },
      async () => ({ v: 5, chainKey: 'CK', epoch: state.epoch }),
      async (pt) => 'ENC[' + pt + ']',
      async (to, payload) => { deposits.push({ to, payload }); },
      'me000000000', 'MEPUBKEY0001', 'Me', () => {},
    );
    return { fn, deposits, state };
  }
  const PUB = 'MEMBERPUB001'; // memberId = first 12 chars

  it('distributes on first sight, then skips until the cadence window closes', async () => {
    const { fn, deposits } = await harness();
    await fn('g1', PUB, false, 3);
    expect(deposits).toHaveLength(1);
    for (let i = 0; i < 25; i++) await fn('g1', PUB, false, 3);
    expect(deposits).toHaveLength(1); // 25 sends ride on the one distribution
    await fn('g1', PUB, false, 3); // the next send refreshes the key state
    expect(deposits).toHaveLength(2);
  });

  it('an epoch change (kick / rotation) redistributes immediately', async () => {
    const { fn, deposits, state } = await harness();
    await fn('g1', PUB, false, 3);
    await fn('g1', PUB, false, 3);
    expect(deposits).toHaveLength(1);
    state.setEpoch(8);
    await fn('g1', PUB, false, 3);
    expect(deposits).toHaveLength(2);
  });

  it('a roster change redistributes; force always does', async () => {
    const { fn, deposits } = await harness();
    await fn('g1', PUB, false, 3);
    await fn('g1', PUB, false, 4); // group grew: the new roster needs the key state
    expect(deposits).toHaveLength(2);
    await fn('g1', PUB, true, 4);
    expect(deposits).toHaveLength(3);
  });

  it('the cadence is per member: a second member starts fresh', async () => {
    const { fn, deposits } = await harness();
    await fn('g1', PUB, false, 3);
    await fn('g1', 'OTHERPUB0002', false, 3);
    expect(deposits).toHaveLength(2);
    expect(deposits[1].to).toBe('OTHERPUB0002');
  });
});

describe('stage 5 step 3 wiring', () => {
  it('the cap is 1,000 and the cadence constant sits below the skip window', () => {
    expect(html).toContain('GROUP_MAX: 1000,');
    expect(html).toContain('SK_REDIST_EVERY: 25,');
    expect(html).toContain('GROUP_MAX_SKIP: 50,');
  });

  it('group deposits fan out through the pool', () => {
    expect(html).toContain('await _poolMap(owed, 8, async (m) => {');
    expect(html).toContain('globalThis.__breezeGCall.poolMap(items, n, fn)');
    expect(html).toContain("import { createGroupCallManager, poolMap } from './src/app/group-call.js';");
  });
});

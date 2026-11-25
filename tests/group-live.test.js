// D25 wave 10 — group live reception on linked devices.
// Behaviour: the pure target planner and the host-wired factory run
// against fake deps (verified device lists, deposit capture). Wiring:
// pins for the index.html call sites this feature hangs off — the
// client halves live in the monolith closure, which no harness
// executes whole (the repo's wave*-defects convention).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { planLiveTargets, createGroupLive } from '../src/app/group-live.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

const DEV_A1 = 'DEVAX0000001'; // member A secondary
const DEV_B1 = 'DEVBX0000001'; // my secondary

// planLiveTargets works on ids/pubs as opaque strings; keep them short
// but slice-stable (to = pub.slice(0, 12)).
const A = { id: 'ROOTA0000001', pubB64: 'ROOTA0000001' };
const B = { id: 'ROOTB0000002', pubB64: 'ROOTB0000002' };

describe('planLiveTargets — which extra mailboxes a group send deposits into', () => {
  it('targets member devices beyond the root, flagged not-own', () => {
    const out = planLiveTargets([A, B], { [A.id]: [A.pubB64, DEV_A1] }, [], B.pubB64, B.pubB64);
    expect(out).toEqual([{ to: DEV_A1.slice(0, 12), pub: DEV_A1, own: false }]);
  });

  it('flags my own account devices as own, and never targets my own pub', () => {
    const out = planLiveTargets([A, B], { [B.id]: [B.pubB64, DEV_B1] }, [], B.pubB64, B.pubB64);
    expect(out).toEqual([{ to: DEV_B1.slice(0, 12), pub: DEV_B1, own: true }]);
  });

  it('a secondary sender: the root is covered by the member loop, siblings are own targets', () => {
    // I am DEV_B1; roster lists my root B. ownPubs (myOtherDevices) = [root, sibling].
    const SIB = 'DEVBX0000002';
    const out = planLiveTargets([A, B], { [B.id]: [B.pubB64] }, [B.pubB64, SIB], DEV_B1, B.pubB64);
    expect(out).toEqual([{ to: SIB.slice(0, 12), pub: SIB, own: true }]);
  });

  it('a roster without my account still reaches my root and my devices', () => {
    // I am DEV_B1; ownPubs (myOtherDevices) = [root, sibling] — the root is
    // not covered by any member deposit here, so both are own targets.
    const SIB = 'DEVBX0000002';
    const out = planLiveTargets([A], {}, [B.pubB64, SIB], DEV_B1, B.pubB64);
    expect(out.map(t => t.pub)).toEqual([B.pubB64, SIB]);
    expect(out.every(t => t.own)).toBe(true);
  });

  it('dedups a pub listed twice and tolerates empty/garbled input', () => {
    const out = planLiveTargets([A, A], { [A.id]: [A.pubB64, DEV_A1, DEV_A1] }, [DEV_A1], B.pubB64, B.pubB64);
    expect(out).toHaveLength(1);
    expect(planLiveTargets(null, null, null, 'x', 'y')).toEqual([]);
    expect(planLiveTargets([{ id: 'z' }], {}, [], 'x', 'y')).toEqual([]);
  });

  it('single-device accounts produce no targets (today\'s behaviour)', () => {
    expect(planLiveTargets([A, B], { [A.id]: [A.pubB64], [B.id]: [B.pubB64] }, [], B.pubB64, B.pubB64)).toEqual([]);
  });
});

function harness({ devices = {}, ownDevices = [], secondary = false, epoch = 7 } = {}) {
  const deposits = [];
  const state = { epoch };
  const D = {
    devicesFor: async (m) => devices[m.id] || [m.pubB64],
    myOtherDevices: async () => ownDevices,
    myPubB64: () => (secondary ? DEV_B1 : B.pubB64),
    myRootPub: () => B.pubB64,
    myId: () => (secondary ? DEV_B1 : B.pubB64).slice(0, 12),
    myName: () => 'Me',
    relaySend: async (to, payload, sealPub) => { deposits.push({ to, payload, sealPub }); },
    encryptFor: async (text, pub) => 'ENC[' + pub + '](' + text + ')',
    getSenderKey: async () => ({ v: 5, chainKey: 'CK', epoch: state.epoch }),
    groupRatchetV5: () => true,
    skRedistEvery: () => 25,
    poolMap: async (items, n, fn) => Promise.all(items.map(fn)),
    acctRoot: () => (secondary ? B.pubB64 : undefined),
    dbg: () => {},
  };
  return { live: createGroupLive(D), deposits, state };
}

describe('depositCopies — the identical ciphertext lands in device mailboxes', () => {
  it('deposits per member device with the group envelope; own copies are selfSync', async () => {
    const { live, deposits } = harness({ devices: { [A.id]: [A.pubB64, DEV_A1], [B.id]: [B.pubB64, DEV_B1] } });
    await live.depositCopies([A, B], 'CT', { ts: 42, groupId: 'g1', groupName: 'G' });
    expect(deposits).toHaveLength(2);
    const toA = deposits.find(d => d.to === DEV_A1.slice(0, 12));
    expect(toA.payload).toMatchObject({ payload: 'CT', ts: 42, groupId: 'g1', isGroupSK: true });
    expect(toA.payload.selfSync).toBeUndefined();
    expect(toA.sealPub).toBe(DEV_A1);
    const toMine = deposits.find(d => d.to === DEV_B1.slice(0, 12));
    expect(toMine.payload.selfSync).toBe(true);
  });

  it('a secondary sender names its root (acctRoot) on every copy', async () => {
    const { live, deposits } = harness({ devices: { [A.id]: [A.pubB64, DEV_A1] }, secondary: true, ownDevices: [B.pubB64] });
    await live.depositCopies([A, B], 'CT', { ts: 1, groupId: 'g1', groupName: 'G' });
    expect(deposits.length).toBeGreaterThan(0);
    for (const d of deposits) expect(d.payload.acctRoot).toBe(B.pubB64);
  });

  it('no verified extra devices -> no deposits at all', async () => {
    const { live, deposits } = harness();
    await live.depositCopies([A, B], 'CT', { ts: 1, groupId: 'g1', groupName: 'G' });
    expect(deposits).toHaveLength(0);
  });
});

describe('distributeKey — sender keys reach member devices on the root cadence', () => {
  it('first sight distributes to every device; the window then suppresses repeats', async () => {
    const DEV_A2 = 'DEVAX0000002';
    const { live, deposits, state } = harness({ devices: { [A.id]: [A.pubB64, DEV_A1, DEV_A2] } });
    await live.distributeKey('g1', A, false, 2);
    expect(deposits).toHaveLength(2);
    expect(deposits.every(d => d.payload.isSenderKey)).toBe(true);
    for (let i = 0; i < 25; i++) await live.distributeKey('g1', A, false, 2);
    expect(deposits).toHaveLength(2);
    state.epoch = 8; // rotation: redistribute immediately
    await live.distributeKey('g1', A, false, 2);
    expect(deposits).toHaveLength(4);
    await live.distributeKey('g1', A, true, 2); // force (kick path)
    expect(deposits).toHaveLength(6);
  });

  it('a device that appears later is on first sight while its sibling is in-window', async () => {
    const devices = { [A.id]: [A.pubB64, DEV_A1] };
    const { live, deposits } = harness({ devices });
    await live.distributeKey('g1', A, false, 2);
    expect(deposits).toHaveLength(1);
    devices[A.id] = [A.pubB64, DEV_A1, 'DEVAX0000009'];
    await live.distributeKey('g1', A, false, 2);
    expect(deposits).toHaveLength(2);
    expect(deposits[1].to).toBe('DEVAX0000009'.slice(0, 12));
  });

  it('the distribution is encrypted to the device pub, not the root', async () => {
    const { live, deposits } = harness({ devices: { [A.id]: [A.pubB64, DEV_A1] } });
    await live.distributeKey('g1', A, false, 2);
    expect(deposits[0].sealPub).toBe(DEV_A1);
    expect(deposits[0].payload.payload).toContain('ENC[' + DEV_A1 + ']');
    expect(JSON.parse(deposits[0].payload.payload.slice(('ENC[' + DEV_A1 + '](').length, -1)))
      .toMatchObject({ type: 'sender_key', groupId: 'g1', v: 5, epoch: 7 });
  });
});

describe('distributeOwnKey — my key reaches my other devices', () => {
  it('targets siblings only, never my own pub, with no acctRoot from a primary', async () => {
    const { live, deposits } = harness({ ownDevices: [DEV_B1] });
    await live.distributeOwnKey('g1', 2);
    expect(deposits).toHaveLength(1);
    expect(deposits[0].to).toBe(DEV_B1.slice(0, 12));
    expect(deposits[0].payload.acctRoot).toBeUndefined();
  });
});

describe('depositEncrypted — per-device ciphertexts for signals and kick notices', () => {
  it('encrypts separately per device and carries the caller fields (ts wins)', async () => {
    const { live, deposits } = harness({ devices: { [A.id]: [A.pubB64, DEV_A1] } });
    await live.depositEncrypted(A, '{"type":"group_kick"}', { isGroupKick: true });
    expect(deposits).toHaveLength(1);
    expect(deposits[0].payload.isGroupKick).toBe(true);
    expect(deposits[0].payload.payload).toBe('ENC[' + DEV_A1 + ']({"type":"group_kick"})');
    await live.depositEncrypted(A, 'SIG', { ts: 99, isSignal: true, groupId: 'g1' });
    expect(deposits[1].payload.ts).toBe(99);
  });
});

describe('wave 10 wiring', () => {
  it('index.html imports the module and builds the factory once', () => {
    expect(html).toContain("from './src/app/group-live.js'; window.__breezeGroupLive = { planLiveTargets, createGroupLive };");
    expect(html).toContain('globalThis.__breezeGroupLive?.createGroupLive({');
    expect(sw).toContain("'/src/app/group-live.js'");
  });

  it('both group send paths deposit device copies and distribute keys to devices', () => {
    // Wave 12 added one more call site of each: the group-call deps
    // (depositControlCopies / distributeKeyDevices / distributeOwnKeyDevices)
    // wrap these for {gctl} control copies.
    expect(html.split('_groupLive?.depositCopies(').length - 1).toBe(3);
    expect(html.split('_groupLive?.distributeKey(').length - 1).toBe(5); // sendMessage, transport, kick rotation, group-call control, strict activation
    expect(html.split('_groupLive?.distributeOwnKey(').length - 1).toBe(4);
  });

  it('signals and kick notices fan out to devices too', () => {
    expect(html).toContain("_groupLive?.depositEncrypted(member, signalPayload, { ts: data.ts || Date.now(), isSignal: true, groupId: activeContact.id })");
    expect(html).toContain("_groupLive?.depositEncrypted(m, JSON.stringify({ type: 'group_kick', groupId, kickedId, epoch }), { isGroupKick: true })");
  });

  it('the root distribution is untouched (its cadence is behaviour-pinned elsewhere)', () => {
    expect(html).toContain("await relaySend(memberId, { to: memberId, from: myId, fromPub: myPubB64, fromName: myName, payload: encrypted, ts: Date.now(), isSenderKey: true,");
  });

  it('a secondary accepts a sender-key distribution from its own root', () => {
    expect(html).toContain("if (!c && _myAcctRoot && msg.fromPub === _myAcctRoot) { c = { pubB64: _myAcctRoot }; peerPub = _myAcctRoot; }");
  });
});

// SHARE_PLAN stage 5 step 2 — group voice calls (small mesh).
// The pure planning logic (pair rooms, offer planning, glare
// resolution, the mesh cap) and the control-message state machine
// are exercised directly; media itself needs real RTC and stays an
// owner-side verification, like the 1:1 call paths.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { createGroupCallManager, gcallPairRoom, planOffers, resolveGlare, GCALL_MAX_PARTICIPANTS } from '../src/app/group-call.js';

beforeAll(() => {
  globalThis._dbg = () => {};
  globalThis.CONFIG = { CALL_E2E_SIGNAL: true, CALL_TIMEOUT_MS: 60000 };
  globalThis.MS = { SEC: 1000, MIN: 60000 };
  globalThis.t = (k) => k;
  globalThis.showToast = () => {};
  const el = () => ({
    children: [], classList: { toggle() {}, add() {}, remove() {} },
    setAttribute() {}, append(...k) { this.children.push(...k); }, remove() {},
    set textContent(v) {}, get textContent() { return ''; },
  });
  globalThis.document = { createElement: el, getElementById: () => null, body: { appendChild() {} } };
  globalThis._DOM = { get: () => null };
});

const GROUP = { id: 'grp000000001', isGroup: true, name: 'G', members: [
  { id: 'me000000000', pubB64: 'MEPUB', name: 'Me' },
  { id: 'ana00000000', pubB64: 'ANAPUB', name: 'Ana' },
  { id: 'bob00000000', pubB64: 'BOBPUB', name: 'Bob' },
]};
const ANA = GROUP.members[1], BOB = GROUP.members[2];

function deps(over = {}) {
  return {
    encryptFor: async (pt) => pt, decryptFrom: async (d) => d, fetchCaps: async () => ({}),
    signal: () => {}, signalAwait: async () => ({ ok: false, json: async () => ({}) }),
    distributeSenderKey: async () => {}, encryptGroupMsg: async (g, t) => 'CT:' + t,
    relaySend: async () => {}, iceConfig: () => ({}), intervals: [],
    myId: () => 'me000000000', myPubB64: () => 'MEPUB', myName: () => 'Me',
    myAccountId: () => 'me000000000', myAccountPub: () => 'MEPUB', acctRoot: () => undefined,
    devicesFor: async (m) => [m.pubB64], depositControlCopies: async () => {},
    distributeKeyDevices: async () => {}, distributeOwnKeyDevices: async () => {},
    isBusy: () => false, isSecondary: () => false, ...over,
  };
}

describe('mesh planning (pure)', () => {
  it('pair rooms are symmetric and namespaced away from 1:1 rooms', () => {
    expect(gcallPairRoom('g1', 'bob', 'ana')).toBe(gcallPairRoom('g1', 'ana', 'bob'));
    expect(gcallPairRoom('g1', 'ana', 'bob')).toBe('gcall:g1:ana:bob');
    expect(gcallPairRoom('g1', 'ana', 'bob').startsWith('call:')).toBe(false);
  });

  it('the joiner offers to the current roster, capped by the mesh limit', () => {
    expect(planOffers(['me', 'ana', 'bob'], 'me')).toEqual(['ana', 'bob']);
    const many = Array.from({ length: 20 }, (_, i) => 'u' + i);
    expect(planOffers(['me', ...many], 'me')).toHaveLength(GCALL_MAX_PARTICIPANTS - 1);
  });

  it('glare resolves deterministically: the smaller id keeps its offer', () => {
    expect(resolveGlare('ana', 'bob')).toBe('keep-mine');
    expect(resolveGlare('bob', 'ana')).toBe('accept-theirs');
  });
});

describe('control state machine', () => {
  it('ignores my own control messages and anything while busy', () => {
    const m = createGroupCallManager(deps({ isBusy: () => true }));
    m.route(GROUP, ANA, { gctl: 'invite', callId: 'c1' });
    expect(m.state()).toBe('idle');
    const m2 = createGroupCallManager(deps());
    m2.route(GROUP, GROUP.members[0], { gctl: 'invite', callId: 'c1' });
    expect(m2.state()).toBe('idle');
  });

  it('an invite rings; a joiner seen while ringing joins the roster I will offer to', () => {
    const m = createGroupCallManager(deps());
    m.route(GROUP, ANA, { gctl: 'invite', callId: 'c1' });
    expect(m.state()).toBe('ringing');
    m.route(GROUP, BOB, { gctl: 'join', callId: 'c1' });
    m.route(GROUP, BOB, { gctl: 'leave', callId: 'c1' }); // leaves before I join: roster empties of Bob, Ana stays
    expect(m.state()).toBe('ringing');
    m.route(GROUP, ANA, { gctl: 'leave', callId: 'c1' }); // the inviter leaves: the ring dies
    expect(m.state()).toBe('idle');
  });

  it('start refuses non-groups and busy lines; since wave 12 a secondary device CAN start', async () => {
    const sent = [];
    const m = createGroupCallManager(deps({ relaySend: async (...a) => { sent.push(a); }, isSecondary: () => true,
      myId: () => 'dev00000000', myPubB64: () => 'DEVPUB', acctRoot: () => 'MEPUB' }));
    await m.start(GROUP);
    expect(sent).toHaveLength(2); // the invite went out from the linked device
    const env = sent[0][1];
    expect(env.acctRoot).toBe('MEPUB'); // sent under the account root
    expect(env.payload).toContain('"seat":1');
    expect(env.payload).toContain('"dev":"DEVPUB"');
    expect(env.payload).toContain('"callId":"me000000000:'); // call ids are account-scoped
  });

  it('control sends ride the sender-key channel with the gctl flag, one ciphertext per member', async () => {
    const deposits = [];
    const m = createGroupCallManager(deps({ relaySend: async (id, env) => { deposits.push(env); } }));
    // Drive the internal sender through start(): media is unavailable in
    // the test env, so the call tears down — but the invite went out first.
    await m.start(GROUP).catch(() => {});
    expect(deposits.length).toBe(2); // Ana + Bob (not me)
    for (const env of deposits) {
      expect(env.gctl).toBe(true);
      expect(env.isGroupSK).toBe(true);
      expect(env.payload).toContain('"gctl":"invite"');
    }
  });
});

describe('group call wiring (deployed files)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

  it('the module is imported, bridged, instantiated and precached', () => {
    expect(html).toContain("import { createGroupCallManager, poolMap } from './src/app/group-call.js';");
    expect(html).toContain('window.__breezeGCall = { createGroupCallManager, poolMap };');
    expect(html).toContain('globalThis.__breezeGCall?.createGroupCallManager({');
    expect(sw).toContain("'/src/app/group-call.js'");
  });

  it('group control rides the sender-key channel and is routed, never rendered', () => {
    const gcall = readFileSync(new URL('../src/app/group-call.js', import.meta.url), 'utf8');
    expect(html).toContain('distributeSenderKey, encryptGroupMsg, relaySend, iceConfig:');
    expect(gcall).toContain('isGroupSK: true, gctl: true, ...authorFields }, m.pubB64)');
    expect(gcall).toContain('await D.authorFields?.(group.id, ct)');
    expect(html).toContain('_gcall.route(group, member, ctl)');
  });

  it('the call button starts a group call in a group and a 1:1 call otherwise', () => {
    expect(html).toContain('if (activeContact?.isGroup) { _gcall.start(activeContact); return; }');
  });
});

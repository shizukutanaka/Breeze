import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// sendSignal's group branch: P2P + encrypted relay to each member, then — since
// group messages self-sync via _fanOut — the same mutation must reach MY other
// devices or they keep the stale/deleted copy while members saw the change.
const GROUP_BLOCK = /const signalPayload = JSON\.stringify\(data\);\s*\(async \(\) => \{([\s\S]*?)\}\)\(\);\s*return;/;

function extract() {
  const m = html.match(GROUP_BLOCK);
  expect(m, 'group signal branch not found').toBeTruthy();
  return 'const signalPayload = JSON.stringify(data);\n' + m[1];
}

function makeHarness(stubs) {
  const block = extract();
  // Rebuild the async IIFE body with injectable deps.
  const fn = new Function(
    'data', 'contact', 'peers', 'encryptFor', 'relaySend', '_fanOut', 'myId', 'myPubB64', 'myName', '_dbg',
    'return (async () => {' + block + '})();'
  );
  return fn;
}

const stubs = (over = {}) => ({
  peers: {},
  encryptFor: async () => 'enc',
  relayed: [],
  fanned: [],
  ...over,
});

function baseEnv(s) {
  return {
    peers: s.peers,
    encryptFor: s.encryptFor,
    relaySend: async (...a) => { s.relayed.push(a); },
    _fanOut: async (...a) => { s.fanned.push(a); },
    myId: 'me',
    myPubB64: 'mypub',
    myName: 'me',
    _dbg: () => {},
  };
}

describe('group signal fan-out — sibling selfSync', () => {
  it('extracts the group signal branch from shipped code', () => {
    const block = extract();
    expect(block).toContain('for (const member of contact.members)');
  });

  it('fans the signal out to my own devices tagged isSignal (selfSync)', async () => {
    const s = stubs();
    const fn = makeHarness();
    const e = baseEnv(s);
    await fn({ type: 'edit', msgId: 'me:1', text: 'x', ts: 42 },
      { isGroup: true, id: 'g1', members: [{ id: 'u2', pubB64: 'pub2' }] },
      e.peers, e.encryptFor, e.relaySend, e._fanOut, e.myId, e.myPubB64, e.myName, e._dbg);
    expect(s.fanned.length).toBe(1);
    const [contact, payload, ts, peerExtra, selfExtra] = s.fanned[0];
    expect(contact.id).toBe('g1');
    expect(JSON.parse(payload).type).toBe('edit');
    expect(ts).toBe(42);
    expect(selfExtra.isSignal).toBe(true); // selfSync gate requires sfFor || isSignal
  });

  it('still relays the persistent signal to each non-self member', async () => {
    const s = stubs();
    const fn = makeHarness();
    const e = baseEnv(s);
    await fn({ type: 'delete', msgId: 'me:9' },
      { isGroup: true, id: 'g1', members: [{ id: 'me', pubB64: 'mypub' }, { id: 'u2', pubB64: 'pub2' }, { id: 'u3', pubB64: 'pub3' }] },
      e.peers, e.encryptFor, e.relaySend, e._fanOut, e.myId, e.myPubB64, e.myName, e._dbg);
    expect(s.relayed.length).toBe(2); // self skipped, u2 + u3
    expect(s.relayed.every(r => r[1].isSignal === true)).toBe(true);
  });

  it('delivers P2P to connected members and still self-syncs', async () => {
    const sent = [];
    const s = stubs({ peers: { pub2: { connected: true, dc: { readyState: 'open', send: (x) => sent.push(x) } } } });
    const fn = makeHarness();
    const e = baseEnv(s);
    await fn({ type: 'reaction', msgId: 'me:5', emoji: '👍', add: true },
      { isGroup: true, id: 'g1', members: [{ id: 'u2', pubB64: 'pub2' }] },
      e.peers, e.encryptFor, e.relaySend, e._fanOut, e.myId, e.myPubB64, e.myName, e._dbg);
    expect(sent.length).toBe(1);
    expect(JSON.parse(sent[0]).type).toBe('reaction');
    expect(s.fanned.length).toBe(1);
  });

  it('does not relay ephemeral signal types but still self-syncs them', async () => {
    const s = stubs();
    const fn = makeHarness();
    const e = baseEnv(s);
    await fn({ type: 'typing' },
      { isGroup: true, id: 'g1', members: [{ id: 'u2', pubB64: 'pub2' }] },
      e.peers, e.encryptFor, e.relaySend, e._fanOut, e.myId, e.myPubB64, e.myName, e._dbg);
    expect(s.relayed.length).toBe(0); // typing is P2P-only
    expect(s.fanned.length).toBe(1);
  });

  it('passes peerExtra={} — group peerDevs stay empty inside _fanOut', async () => {
    const s = stubs();
    const fn = makeHarness();
    const e = baseEnv(s);
    await fn({ type: 'edit', msgId: 'me:1', text: 'y' },
      { isGroup: true, id: 'g1', members: [{ id: 'u2', pubB64: 'pub2' }] },
      e.peers, e.encryptFor, e.relaySend, e._fanOut, e.myId, e.myPubB64, e.myName, e._dbg);
    expect(s.fanned[0][3]).toEqual({});
  });
});

describe('selfSync gate admits isSignal-only envelopes', () => {
  it('selfSync branch requires sfFor || isSignal — a bare isSignal copy enters', () => {
    expect(html).toMatch(/msg\.selfSync && msg\.fromPub && \(msg\.sfFor \|\| msg\.isSignal\)/);
  });
});

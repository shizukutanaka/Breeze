import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const html = readFileSync('index.html', 'utf8');

function extract(re) {
  const m = html.match(re);
  if (!m) throw new Error('marker not found: ' + re);
  return m[0];
}

const SENDER = 'peer87654321';
const GID = 'g_tok';
const PEER_KEY = `gsk-peer:${GID}:${SENDER}`;
const CK_A = [1, 2, 3, 4];
const CK_B = [9, 9, 9, 9];

const v5 = (chainKey, epoch, extra = {}) => ({ type: 'sender_key', groupId: GID, chainKey, epoch, v: 5, ...extra });
const v3 = (key, epoch, extra = {}) => ({ type: 'sender_key', groupId: GID, key, epoch, ...extra });

// Run the shipped isSenderKey block once against a stub env.
function makeRunner(store, skMsg, { members = [SENDER] } = {}) {
  const env = {
    msg: { isSenderKey: true, from: SENDER, payload: JSON.stringify(skMsg) },
    dbGet: async (s, k) => store[`${s}:${k}`],
    dbPut: async (s, v, k) => { store[`${s}:${k}`] = v; },
    decryptFrom: async (payload) => payload, // stub: payload already carries the plaintext JSON
    _dbg: () => {},
  };
  store[`contacts:${SENDER}`] = { id: SENDER, pubB64: SENDER + 'X'.repeat(76) };
  if (members) store[`contacts:${GID}`] = { id: GID, isGroup: true, members: members.map(id => ({ id })) };
  const block = extract(/    if \(msg\.isSenderKey\) \{[\s\S]*?_dbg\(e, 'sender-key'\); \}\n      return;\n    \}/);
  const runner = new Function('env', 'const {' + Object.keys(env).join(',') + '} = env; return (async () => {\n' + block + '\n})();');
  return () => runner(env);
}

describe('sender_key receive — epoch guard + identical-key replay dedup', () => {
  it('stores a first-time v5 sender key', async () => {
    const store = {};
    await makeRunner(store, v5(CK_A, 1))();
    const e = store[`identity:${PEER_KEY}`];
    expect(e.v).toBe(5);
    expect(e.chainKey).toEqual(CK_A);
    expect(e.epoch).toBe(1);
    expect(e.counter).toBe(0);
    expect(e.skipped).toEqual({});
  });

  it('identical-key replay preserves counter + skipped-key cache (at-least-once redelivery)', async () => {
    const store = {};
    store[`identity:${PEER_KEY}`] = { chainKey: CK_A, counter: 5, epoch: 1, v: 5, skipped: { 3: { k: CK_B, t: 1 } }, sigPub: 'sg' };
    await makeRunner(store, v5(CK_A, 1))();
    expect(store[`identity:${PEER_KEY}`]).toEqual({ chainKey: CK_A, counter: 5, epoch: 1, v: 5, skipped: { 3: { k: CK_B, t: 1 } }, sigPub: 'sg' });
  });

  it('same-epoch NEW chainKey still overwrites (a genuine member re-key)', async () => {
    const store = {};
    store[`identity:${PEER_KEY}`] = { chainKey: CK_A, counter: 5, epoch: 1, v: 5, skipped: { 3: { k: [0], t: 1 } } };
    await makeRunner(store, v5(CK_B, 1))();
    const e = store[`identity:${PEER_KEY}`];
    expect(e.chainKey).toEqual(CK_B);
    expect(e.counter).toBe(0);
    expect(e.skipped).toEqual({});
  });

  it('drops a stale lower-epoch key (monotonic epoch guard)', async () => {
    const store = {};
    store[`identity:${PEER_KEY}`] = { chainKey: CK_A, counter: 5, epoch: 2, v: 5, skipped: {} };
    await makeRunner(store, v5(CK_B, 1))();
    expect(store[`identity:${PEER_KEY}`].epoch).toBe(2);
    expect(store[`identity:${PEER_KEY}`].chainKey).toEqual(CK_A);
  });

  it('accepts a higher-epoch key (kick rotation)', async () => {
    const store = {};
    store[`identity:${PEER_KEY}`] = { chainKey: CK_A, counter: 5, epoch: 1, v: 5, skipped: {} };
    await makeRunner(store, v5(CK_B, 3))();
    const e = store[`identity:${PEER_KEY}`];
    expect(e.epoch).toBe(3);
    expect(e.chainKey).toEqual(CK_B);
  });

  it('identical v3 key replay is also deduplicated', async () => {
    const store = {};
    store[`identity:${PEER_KEY}`] = { raw: CK_A, counter: 7, epoch: 1 };
    await makeRunner(store, v3(CK_A, 1))();
    expect(store[`identity:${PEER_KEY}`]).toEqual({ raw: CK_A, counter: 7, epoch: 1 });
  });

  it('same-epoch v3→v5 upgrade overwrites (different key material)', async () => {
    const store = {};
    store[`identity:${PEER_KEY}`] = { raw: CK_A, counter: 7, epoch: 1 };
    await makeRunner(store, v5(CK_B, 1))();
    const e = store[`identity:${PEER_KEY}`];
    expect(e.v).toBe(5);
    expect(e.chainKey).toEqual(CK_B);
    expect(e.raw).toBeUndefined();
  });

  it('non-member distributor is still rejected (roster gate unchanged)', async () => {
    const store = {};
    await makeRunner(store, v5(CK_A, 1), { members: ['someoneelse00'] })();
    expect(store[`identity:${PEER_KEY}`]).toBeUndefined();
  });

  it('records sigPub on key accept', async () => {
    const store = {};
    await makeRunner(store, v5(CK_A, 1, { sigPub: 'signingpub' }))();
    expect(store[`identity:${PEER_KEY}`].sigPub).toBe('signingpub');
  });
});

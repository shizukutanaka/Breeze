// Regression test (round 126): the group sender-key lifecycle ran without any lock —
// the 1:1 path already serializes through _withPeerLock, but encryptGroupMsg,
// decryptGroupMsg and getGroupSenderKey did not. Two interleaved encrypts read the same
// stored {chainKey, counter}, derived the SAME msgKeyBits and emitted the SAME counter
// c — the receiver consumes one and replay-drops the other: a guaranteed silent message
// loss (v5 AND v3). Same for two interleaved decrypts against one peerSK record.
// Fix: 'grp:'-scoped _withPeerLock wrappers, with the raw bodies callable under the lock.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync('index.html', 'utf8');
const grab = (re) => { const m = src.match(re); return m ? m[0] : ''; };

// Extract every candidate shape (pre-fix single async fns, post-fix wrapper+raw).
const FNS = [
  grab(/function _withPeerLock\(peerId, fn\) \{[\s\S]*?\n  \}\n  function encryptFor/)
    .replace(/\n  function encryptFor$/, ''),
  grab(/function getGroupSenderKey\(groupId\) \{ return _withPeerLock[^}]*\}/),
  grab(/async function (?:_getGroupSenderKeyRaw|getGroupSenderKey)\(groupId\) \{[\s\S]*?\n  \}\n/),
  grab(/function encryptGroupMsg\(groupId, text\) \{ return _withPeerLock[^}]*\}/),
  grab(/async function (?:_encryptGroupMsgRaw|encryptGroupMsg)\(groupId, text\) \{[\s\S]*?\n  \}\n/),
].filter(Boolean).join('\n');

function loadEnv(store) {
  let k = 0;
  return {
    _peerLocks: new Map(),
    dbGet: async (s, key) => store[key],
    dbPut: async (s, v, key) => { store[key] = JSON.parse(JSON.stringify(v)); },
    _computeGroupV5: () => true,
    CONFIG: { GROUP_RATCHET_V5: true, MSG_PAD_BOUNDARY: 128, IV_BYTES: 12 },
    _dbg: () => {},
    crypto, // node webcrypto
    hkdf: async (key, salt, info, len) => Uint8Array.from({ length: len }, () => (k = (k + 17) & 0xff)),
    arr: (u) => Array.from(u),
    _keyCommit: async () => 'cm',
    _signingKey: null,
    signMessage: async () => 'sg',
    TextEncoder,
    DataView,
    Uint8Array,
    Uint32Array,
    JSON,
    Math,
  };
}
function load(env) {
  return new Function('env', `const {${Object.keys(env).join(',')}} = env;\n${FNS}\nreturn { encryptGroupMsg, getGroupSenderKey };`)(env);
}

describe('group sender-key concurrency lock', () => {
  it('two interleaved encrypts emit distinct counters (no chain desync)', async () => {
    const store = {};
    const { encryptGroupMsg } = load(loadEnv(store));
    const [a, b] = await Promise.all([encryptGroupMsg('g1', 'one'), encryptGroupMsg('g1', 'two')]);
    const ca = JSON.parse(a).c, cb = JSON.parse(b).c;
    expect(new Set([ca, cb]).size).toBe(2); // pre-fix: both derived counter 0 → duplicate c
  });

  it('sequential encrypts still advance the chain', async () => {
    const store = {};
    const { encryptGroupMsg } = load(loadEnv(store));
    const a = JSON.parse(await encryptGroupMsg('g1', 'one'));
    const b = JSON.parse(await encryptGroupMsg('g1', 'two'));
    expect(b.c).toBe(a.c + 1);
  });

  it('first-send init is serialized — two racy first encrypts share ONE key', async () => {
    const store = {};
    const { encryptGroupMsg } = load(loadEnv(store));
    await Promise.all([encryptGroupMsg('g1', 'x'), encryptGroupMsg('g1', 'y')]);
    expect(store['gsk:g1'].counter).toBe(2); // pre-fix: init ran twice, last-write-wins
  });

  it('pins: grp-scoped locks on all three lifecycle fns + deadlock guard', () => {
    expect(src).toContain("_withPeerLock('grp:' + groupId, () => _getGroupSenderKeyRaw(groupId))");
    expect(src).toContain("_withPeerLock('grp:' + groupId, () => _encryptGroupMsgRaw(groupId, text))");
    expect(src).toContain("_withPeerLock('grp:' + groupId + ':' + senderId, () => _decryptGroupMsgRaw(groupId, senderId, payload))");
    // _encryptGroupMsgRaw holds the lock already — it must call the RAW getter,
    // not the locked wrapper (self-deadlock: prev.then(guarded) waits on itself).
    const encBody = src.match(/async function _encryptGroupMsgRaw[\s\S]*?\n  \}/)[0];
    expect(encBody).toContain('await _getGroupSenderKeyRaw(groupId)');
    expect(encBody).not.toContain('await getGroupSenderKey(groupId)');
  });
});

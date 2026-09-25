// Regression test (round 128): /prekey/status caps are relay-asserted AND UNSIGNED — the
// upload signature covers only userId+ts. Two-tier design:
//   - asserted caps union into the SESSION cache only: a relay that strips 'seal-v2' can't
//     downgrade in-flight sends this session (sticky), but a forged response must NOT
//     persist — one injected 'seal-v2' on a legacy peer's contact would otherwise break
//     every send forever (they can't unseal → ACK+skip → silent loss).
//   - PROVEN caps (contact.caps) persist — written only by _markPeerCapProven from
//     sender-authenticated traffic (decryptable sealed env / decryptable dm-sig call wrap /
//     signed SDP inside a dm-sig env).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync('index.html', 'utf8');
const mPeer = src.match(/async function _peerCaps\(peerId\) \{[\s\S]*?\n  \}\n  async function _peerSealV2/);
const FN_PEER = mPeer ? mPeer[0].replace(/\n  async function _peerSealV2$/, '') : '';
const mMark = src.match(/async function _markPeerCapProven\(peerId, cap\) \{[\s\S]*?\n  \}/);
const FN_MARK = mMark ? mMark[0] : '';
const mDec = src.match(/async function decryptFrom\(payload, peerPubB64, frank\) \{[\s\S]*?\n  \}/);
const FN_DEC = mDec ? mDec[0] : '';

function loadPeer(env) {
  return new Function('env', `const {postAPIRaw, dbGet, dbPut, MS, _peerCapsCache, _dbg} = env; return (${FN_PEER});`)(env);
}
function loadMark(env) {
  return new Function('env', `const {dbGet, dbPut, _peerCapsCache, _dbg} = env; return (${FN_MARK});`)(env);
}
function loadDec(env) {
  return new Function('env', `const {_withPeerLock, _decryptFromRaw, _markPeerCapProven, CAPS_SEAL_V2, _sv2Ctx, getSession, JSON, Uint8Array, bufToB64, CAPS_X3DH_V5} = env; return (${FN_DEC});`)(env);
}

function mkEnv({ caps, contact }) {
  const calls = { fetches: 0, puts: [] };
  const env = {
    postAPIRaw: async () => { calls.fetches++; return { ok: true, json: async () => ({ caps: env._caps ?? caps }) }; },
    dbGet: async (s, k) => (s === 'contacts' ? contact : null),
    dbPut: async (s, r) => { calls.puts.push(r); },
    MS: { MIN: 60000 },
    _peerCapsCache: new Map(),
    _dbg: () => {},
  };
  return { env, calls };
}

describe('asserted caps are session-sticky but never persisted', () => {
  it('returns advertised caps WITHOUT writing them to the contact', async () => {
    const contact = { id: 'peer', name: 'P' };
    const { env, calls } = mkEnv({ caps: ['seal-v2', 'dm-sig-v1'], contact });
    const got = await loadPeer(env)('peer');
    expect(got).toContain('seal-v2');
    expect(got).toContain('dm-sig-v1');
    expect(calls.puts.length).toBe(0); // forged 'seal-v2' must not become permanent
    expect(contact.caps).toBeUndefined();
  });

  it('a forged cap dies at restart: only the session cache carries it', async () => {
    const contact = { id: 'peer', name: 'P' };
    const { env, calls } = mkEnv({ caps: ['seal-v2'], contact });
    const f = loadPeer(env);
    expect(await f('peer')).toEqual(['seal-v2']);
    // Session ends → fresh cache, fresh fetch reporting the real (empty) set: nothing stuck.
    env._peerCapsCache.clear(); env._caps = [];
    expect(await f('peer')).toEqual([]);
    expect(calls.puts.length).toBe(0);
  });

  it('strip defense within the session: a cap once seen cannot be removed', async () => {
    const contact = { id: 'peer', caps: [] };
    const { env } = mkEnv({ caps: ['seal-v2'], contact });
    const f = loadPeer(env);
    expect(await f('peer')).toEqual(['seal-v2']); // sees seal-v2 asserted
    env._caps = [];                                // relay now strips it
    expect(await f('peer')).toEqual(['seal-v2']);  // cache hit → strip is a no-op
    // Even past the cache TTL the previously-seen union merges the cap back in —
    // the assertion survives for the whole session, not just the TTL window.
    env._peerCapsCache.get('peer').ts = Date.now() - 6 * 60000;
    expect(await f('peer')).toEqual(['seal-v2']);
  });

  it('proven ∪ asserted: contact caps survive a stripped fetch', async () => {
    const contact = { id: 'peer', caps: ['seal-v2', 'dm-sig-v1'] };
    const { env } = mkEnv({ caps: [], contact }); // relay reports NOTHING
    const got = await loadPeer(env)('peer');
    expect(got).toContain('seal-v2');
    expect(got).toContain('dm-sig-v1');
  });

  it('unknown peers get the raw set with no write', async () => {
    const { env, calls } = mkEnv({ caps: ['x3dh-v5'], contact: null });
    expect(await loadPeer(env)('ghost')).toEqual(['x3dh-v5']);
    expect(calls.puts.length).toBe(0);
  });

  it('cache hit serves without refetching', async () => {
    const contact = { id: 'peer', caps: ['seal-v2'] };
    const { env, calls } = mkEnv({ caps: [], contact });
    env._peerCapsCache.set('peer', { caps: ['seal-v2', 'dm-sig-v1'], ts: Date.now() });
    expect(await loadPeer(env)('peer')).toEqual(['seal-v2', 'dm-sig-v1']);
    expect(calls.fetches).toBe(0);
  });
});

describe('_markPeerCapProven — the only persistence path', () => {
  it('persists a proven cap onto the contact record', async () => {
    const contact = { id: 'peer', caps: ['dm-sig-v1'] };
    const { env, calls } = mkEnv({ caps: [], contact });
    await loadMark(env)('peer', 'seal-v2');
    expect(calls.puts.length).toBe(1);
    expect(calls.puts[0].caps.sort()).toEqual(['dm-sig-v1', 'seal-v2']);
    expect(contact.caps).toContain('seal-v2');
  });

  it('is idempotent — an already-proven cap writes nothing', async () => {
    const contact = { id: 'peer', caps: ['seal-v2'] };
    const { env, calls } = mkEnv({ caps: [], contact });
    await loadMark(env)('peer', 'seal-v2');
    expect(calls.puts.length).toBe(0);
  });

  it('refuses to mark a non-contact (self/ghost)', async () => {
    const { env, calls } = mkEnv({ caps: [], contact: null });
    await loadMark(env)('me', 'seal-v2');
    expect(calls.puts.length).toBe(0);
  });

  it('updates the live cache entry so the cap is sticky this session too', async () => {
    const contact = { id: 'peer', caps: [] };
    const { env } = mkEnv({ caps: [], contact });
    env._peerCapsCache.set('peer', { caps: [], ts: Date.now() });
    await loadMark(env)('peer', 'seal-v2');
    expect(env._peerCapsCache.get('peer').caps).toEqual(['seal-v2']);
  });
});

describe('decryptFrom marks seal-v2 only under a sealed-envelope window', () => {
  it('marks on decrypt success while _sv2Ctx names the sender', async () => {
    const marked = [];
    const env = {
      _withPeerLock: async (id, fn) => fn(),
      _decryptFromRaw: async () => 'plaintext',
      _markPeerCapProven: async (id, cap) => marked.push([id, cap]),
      CAPS_SEAL_V2: 'seal-v2',
      _sv2Ctx: 'alice00000x1',
      getSession: async () => ({}), // established session — pkm path unreachable
    };
    const f = loadDec(env);
    expect(await f('payload', 'alice00000x1pub')).toBe('plaintext');
    expect(marked).toEqual([['alice00000x1', 'seal-v2']]);
  });

  it('does NOT mark without _sv2Ctx (raw-path decrypt proves nothing about sealing)', async () => {
    const marked = [];
    const env = {
      _withPeerLock: async (id, fn) => fn(),
      _decryptFromRaw: async () => 'plaintext',
      _markPeerCapProven: async (id, cap) => marked.push([id, cap]),
      CAPS_SEAL_V2: 'seal-v2',
      _sv2Ctx: null,
      getSession: async () => ({}),
    };
    expect(await loadDec(env)('payload', 'x'.repeat(12))).toBe('plaintext');
    expect(marked).toEqual([]);
  });

  it('does NOT mark on decrypt failure (a forged env stays unproven)', async () => {
    const marked = [];
    const env = {
      _withPeerLock: async (id, fn) => fn(),
      _decryptFromRaw: async () => null,
      _markPeerCapProven: async (id, cap) => marked.push([id, cap]),
      CAPS_SEAL_V2: 'seal-v2',
      _sv2Ctx: 'alice00000x1',
      getSession: async () => ({}),
    };
    expect(await loadDec(env)('payload', 'x'.repeat(12))).toBe(null);
    expect(marked).toEqual([]);
  });
});

describe('pins', () => {
  it('_peerCaps no longer persists anything', () => {
    expect(FN_PEER).not.toContain('dbPut');
    expect(FN_PEER).not.toContain('ct.caps = caps');
  });
  it('provenance flags exist and the unseal ctx is success-gated', () => {
    expect(src).toContain('let _sv2Ctx = null, _dmSigCtx = null;');
    expect(src).toContain('if (pt) _dmSigCtx = room.replace');
    expect(src).toContain('_dmSigCtx = null; // provenance is per-envelope');
  });
  it('mark sites: sealed decrypt, call wrap, signed SDP', () => {
    expect(src).toContain('if (r && _sv2Ctx) _markPeerCapProven(_sv2Ctx, CAPS_SEAL_V2)');
    expect(src).toContain("if (_dmSigCtx === peerPub.slice(0, 12)) _markPeerCapProven(_dmSigCtx, CAPS_DM_SIG)");
    expect(src).toContain("if (_dmSigCtx === contact.id) _markPeerCapProven(contact.id, CAPS_DM_SIG)");
  });
  it('v5 bundle caps are relay-asserted — the gate merges in PROVEN caps', () => {
    expect(src).toContain('!(await _peerCaps(ktPeerId)).includes(CAPS_X3DH_V5)');
    expect(src).toContain('if (bundle.identityKey === peerPubB64) _markPeerCapProven(ktPeerId, CAPS_X3DH_V5)');
  });
  it('pkm mark is gated on decrypt success AND ik === session peer', () => {
    expect(src).toContain("pk?.v === 5 && pk?.t === 'pkm' && bufToB64(new Uint8Array(pk.ik)) === peerPubB64");
    expect(src).toMatch(/if \(r && !hadSess\)/);
  });
});

describe('x3dh-v5 provenance (decryptFrom)', () => {
  const b64 = u8 => Buffer.from(u8).toString('base64');
  const PEER = b64([7,7,7]);
  const peerId = PEER.slice(0, 12);

  async function run(payload, { hadSess = false, result = 'ok', sv2 = null } = {}) {
    const marked = [];
    const env = {
      _withPeerLock: (_id, fn) => fn(),
      getSession: async () => hadSess ? {} : null,
      _decryptFromRaw: async () => result,
      _sv2Ctx: sv2,
      _markPeerCapProven: (id, cap) => { marked.push([id, cap]); },
      bufToB64: b => Buffer.from(b).toString('base64'),
      Uint8Array, JSON, payload, peerPubB64: PEER, frank: undefined,
      CAPS_X3DH_V5: 'x3dh-v5', CAPS_SEAL_V2: 'seal-v2',
    };
    const fn = new Function('env', 'const {' + Object.keys(env).join(',') + '} = env; return (async () => {' + FN_DEC + '  return decryptFrom(payload, peerPubB64, frank);})();');
    return { r: await fn(env), marked };
  }

  it('decryptable inner on a fresh pkm session marks x3dh-v5 proven', async () => {
    const { marked } = await run(JSON.stringify({ v: 5, t: 'pkm', ik: [7,7,7], ek: [1], msg: '{}' }));
    expect(marked).toEqual([[peerId, 'x3dh-v5']]);
  });
  it('a forged pkm naming another identity does not self-plant', async () => {
    const { marked } = await run(JSON.stringify({ v: 5, t: 'pkm', ik: [9,9,9], ek: [1], msg: '{}' }));
    expect(marked).toEqual([]);
  });
  it('no mark when the session pre-existed (not a pkm bootstrap)', async () => {
    const { marked } = await run(JSON.stringify({ v: 4 }), { hadSess: true });
    expect(marked).toEqual([]);
  });
  it('no mark on decrypt failure', async () => {
    const { marked } = await run(JSON.stringify({ v: 5, t: 'pkm', ik: [7,7,7], ek: [1] }), { result: null });
    expect(marked).toEqual([]);
  });
  it('seal-v2 proven mark still fires alongside', async () => {
    const { marked } = await run(JSON.stringify({ v: 4 }), { hadSess: true, sv2: 'peerB' });
    expect(marked).toEqual([['peerB', 'seal-v2']]);
  });
});

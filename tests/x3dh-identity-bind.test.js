// Regression test (round 125): X3DH v5 lacked identity binding in BOTH directions.
// (a) initSessionV5Initiator fetched /prekey/fetch for peerPubB64.slice(0,12) and never
//     compared bundle.identityKey to peerPubB64 — a relay serving its own complete
//     (self-consistent) bundle passed the SPK signature check and MITM'd the session
//     silently, and the KT audit even pinned the attacker's ik as the baseline.
// (b) _decryptFromRaw bootstrapped a responder session from a pkm envelope whose `ik`
//     is sender-claimed — a forged envelope made us X3DH with the attacker and decrypt
//     THEIR wrap. Both must bind the served/claimed identity to the pinned peer key.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync('index.html', 'utf8');
const B64 = (n, f = 7) => btoa(String.fromCharCode(...new Uint8Array(n).fill(f)));

const mInit = src.match(/async function initSessionV5Initiator\(peerPubB64\) \{[\s\S]*?\n  \}\n\n  \/\/ Derive the X3DH/);
const INIT = mInit ? mInit[0].replace(/\n\n  \/\/ Derive the X3DH$/, '') : '';
const mGate = src.match(/if \(!sess && p\.v === 5 && p\.t === 'pkm'[\s\S]*?\n      \}\n      if \(!sess\) \{ sess = await initSessionResponder/);
const GATE = mGate ? mGate[0].replace(/\n      if \(!sess\) \{ sess = await initSessionResponder$/, '') : '';

function loadInit(env) {
  return new Function('env', `
    const {CONFIG, API, postAPIRaw, _peerSupportsX3dhV5, _hasEd25519, _auditKeyHistory,
           dbGet, dbPut, showKeyChangeWarning, crypto, genRatchetKey, _x3dhInitiator,
           ecdhBits, hkdf, myKeys, myPubB64, _dbg} = env;
    return (${INIT});
  `)(env);
}
function mkInitEnv(bundle, calls) {
  return {
    CONFIG: { X3DH_V5_ENABLED: true }, API: 'https://x',
    postAPIRaw: async () => ({ ok: true, json: async () => bundle }),
    _peerSupportsX3dhV5: () => true, _hasEd25519: true,
    crypto: { subtle: {
      importKey: async () => { calls.imports++; return {}; },
      verify: async () => { calls.verifies++; return true; },
    } },
    _auditKeyHistory: async () => ({ verdict: 'ok' }),
    dbGet: async () => null, dbPut: async () => {},
    showKeyChangeWarning: async () => {},
    genRatchetKey: async () => ({ privateKey: {}, pub: new Uint8Array(32) }),
    _x3dhInitiator: async () => new Uint8Array(32),
    ecdhBits: async () => new Uint8Array(32),
    hkdf: async () => new Uint8Array(64),
    myKeys: { privateKey: {} }, myPubB64: B64(32, 1), _dbg: () => {},
  };
}

describe('X3DH v5 identity binding', () => {
  const peerPub = B64(32, 9);

  it('refuses a forged bundle whose identityKey is not the pinned peer key', async () => {
    const calls = { imports: 0, verifies: 0 };
    const forged = { identityKey: B64(32, 8), edIdentityKey: B64(32, 2), signedPreKey: B64(32, 3), signedPreKeySig: B64(64, 4), oneTimePreKey: B64(32, 5), oneTimePreKeyId: 1 };
    const f = loadInit(mkInitEnv(forged, calls));
    expect(await f(peerPub)).toBeNull();
    // The bind must fire BEFORE any crypto: reaching SPK verification = attacker bundle accepted.
    expect(calls.imports).toBe(0);   // pre-fix: importKey runs on the attacker's edIdentityKey
    expect(calls.verifies).toBe(0);  // pre-fix: SPK self-check passes and the MITM proceeds
  });

  it('establishes a session when identityKey matches the pinned peer', async () => {
    const calls = { imports: 0, verifies: 0 };
    const good = { identityKey: peerPub, edIdentityKey: B64(32, 2), signedPreKey: B64(32, 3), signedPreKeySig: B64(64, 4), oneTimePreKey: B64(32, 5), oneTimePreKeyId: 1 };
    const f = loadInit(mkInitEnv(good, calls));
    const sess = await f(peerPub);
    expect(calls.imports).toBe(1);
    expect(sess).toBeTruthy();
    expect(sess._pkm).toBeTruthy();
    expect(sess.rootKey.length).toBe(32);
  });

  it('refuses a pkm envelope whose claimed ik is not the pinned peer key', async () => {
    const env = {
      sess: null, peerPubB64: peerPub, u8: (a) => new Uint8Array(a), _dbg: () => {},
      _bootstrapResponderSessionV5: async () => ({ rootKey: 'x' }), btoa,
      p: { v: 5, t: 'pkm', ik: Array.from(new Uint8Array(32).fill(8)), ek: Array.from(new Uint8Array(32).fill(1)), opkId: 1, msg: '{}' },
    };
    const out = await new Function('env', `
      let {sess, p, peerPubB64, u8, _dbg, _bootstrapResponderSessionV5, btoa} = env;
      return (async () => { ${GATE} return 'gate-passed'; })();
    `)(env);
    expect(out).toBeNull(); // pre-fix: bootstrap ran on the attacker's ik → gate passed
  });

  it('accepts a pkm envelope whose ik matches the pinned peer key', async () => {
    let bootstrapped = false;
    const env = {
      sess: null, peerPubB64: peerPub, u8: (a) => new Uint8Array(a), _dbg: () => {},
      _bootstrapResponderSessionV5: async () => { bootstrapped = true; return { rootKey: 'x' }; }, btoa,
      p: { v: 5, t: 'pkm', ik: Array.from(new Uint8Array(32).fill(9)), ek: Array.from(new Uint8Array(32).fill(1)), opkId: 1, msg: '{}' },
    };
    const out = await new Function('env', `
      let {sess, p, peerPubB64, u8, _dbg, _bootstrapResponderSessionV5, btoa} = env;
      return (async () => { ${GATE} return 'gate-passed'; })();
    `)(env);
    expect(bootstrapped).toBe(true);
    expect(out).toBe('gate-passed');
  });

  it('pins: both binds exist in the shipped source', () => {
    expect(src).toContain('bundle.identityKey !== peerPubB64');
    expect(src).toContain('u8(p.ik))) !== peerPubB64');
  });
});

// Regression test (round 124): /prekey/status caps are relay-asserted — a relay that
// strips 'seal-v2' (or 'dm-sig') silently downgrades the peer's sends to the
// metadata-leaking legacy /msg path (from/fromPub/fromName plaintext to the relay)
// AND re-enables forged plaintext typing/read signals (the wasSealed gates key off the
// same cap list). _mergeStickyGroupCaps already made this exact tamper a no-op for group
// member caps; the 1:1 fetch had no equivalent — caps must only ever GROW.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync('index.html', 'utf8');
const m = src.match(/async function _peerCaps\(peerId\) \{[\s\S]*?\n  \}\n  async function _peerSealV2/);
const FN = m ? m[0].replace(/\n  async function _peerSealV2$/, '') : '';

function load(env) {
  return new Function('env', `
    const {postAPIRaw, dbGet, dbPut, MS, _peerCapsCache, _dbg} = env;
    return (${FN});
  `)(env);
}

function mkEnv({ caps, contact }) {
  const calls = { fetches: 0, puts: [] };
  const env = {
    postAPIRaw: async () => ({ ok: true, json: async () => ({ caps }) }),
    dbGet: async (s, k) => (s === 'contacts' ? contact : null),
    dbPut: async (s, r) => { calls.puts.push(r); },
    MS: { MIN: 60000 },
    _peerCapsCache: new Map(),
    _dbg: () => {},
  };
  calls.bump = () => env.postAPIRaw = (() => { calls.fetches++; return async () => ({ ok: true, json: async () => ({ caps: env._caps }) }); })();
  return { env, calls };
}

describe('peer caps are sticky — a relay cannot strip them', () => {
  it('persists advertised caps on the contact record', async () => {
    const contact = { id: 'peer', name: 'P' };
    const { env, calls } = mkEnv({ caps: ['seal-v2', 'dm-sig'], contact });
    const f = load(env);
    const got = await f('peer');
    expect(got).toContain('seal-v2');
    expect(got).toContain('dm-sig');
    expect(calls.puts.length).toBe(1);
    expect(calls.puts[0].caps).toEqual(['seal-v2', 'dm-sig']);
  });

  it('keeps caps when a later fetch returns a stripped set', async () => {
    const contact = { id: 'peer', caps: ['seal-v2', 'dm-sig'] };
    const { env } = mkEnv({ caps: [], contact }); // relay now reports NOTHING
    const f = load(env);
    const got = await f('peer');
    expect(got).toContain('seal-v2');   // pre-fix: strip → [] → legacy downgrade
    expect(got).toContain('dm-sig');    // pre-fix: strip → plaintext typing/read forgeable
  });

  it('merges a partial strip, not just an empty one', async () => {
    const contact = { id: 'peer', caps: ['seal-v2', 'dm-sig'] };
    const { env } = mkEnv({ caps: ['dm-sig'], contact }); // relay keeps one, drops seal-v2
    const f = load(env);
    expect(await f('peer')).toContain('seal-v2');
  });

  it('a genuinely new cap still gets added (caps grow)', async () => {
    const contact = { id: 'peer', caps: ['dm-sig'] };
    const { env } = mkEnv({ caps: ['dm-sig', 'seal-v2'], contact });
    const f = load(env);
    const got = await f('peer');
    expect(got.sort()).toEqual(['dm-sig', 'seal-v2']);
  });

  it('unknown peers get the raw set with no sticky write', async () => {
    const { env, calls } = mkEnv({ caps: ['x3dh-v5'], contact: null });
    const f = load(env);
    expect(await f('ghost')).toEqual(['x3dh-v5']);
    expect(calls.puts.length).toBe(0);
  });

  it('cache hit serves the merged set without refetching', async () => {
    const contact = { id: 'peer', caps: ['seal-v2'] };
    const { env, calls } = mkEnv({ caps: [], contact });
    env._peerCapsCache.set('peer', { caps: ['seal-v2'], ts: Date.now() });
    const f = load(env);
    expect(await f('peer')).toEqual(['seal-v2']);
    expect(calls.fetches ?? 0).toBe(0);
  });

  it('pins: the status fetch is unioned with the contact record', () => {
    expect(src).toContain("await dbGet('contacts', peerId)");
    expect(src).toContain('ct.caps = caps');
    expect(src).toContain('new Set(');
  });
});

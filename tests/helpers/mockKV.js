// Minimal in-memory stand-in for a Cloudflare KV namespace, sufficient for the
// worker handlers under test. Values are stored as strings (the worker always
// JSON.stringify's before put), matching real KV semantics closely enough for
// unit tests. TTLs ARE enforced (expirationTtl / absolute expiration, both in
// seconds like real KV) — lazily, on read/list — so expiry-dependent code paths
// (health's `sig:` sweeper, TTL-refreshed registries) behave like production.
// Direct `store.set` writes bypass expiry bookkeeping by design: use them to
// plant fixtures, use `put` for TTL coverage.
export function makeKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  const expires = new Map(); // key -> absolute expiry in ms
  const live = (key) => {
    const exp = expires.get(key);
    if (exp !== undefined && exp <= Date.now()) { store.delete(key); expires.delete(key); return false; }
    return true;
  };
  return {
    store,
    async get(key) {
      return live(key) && store.has(key) ? store.get(key) : null;
    },
    async put(key, value, opts = {}) {
      store.set(key, String(value));
      // A rewrite resets TTL in real KV — an overwrite without expiry clears it.
      if (opts?.expirationTtl) expires.set(key, Date.now() + opts.expirationTtl * 1000);
      else if (opts?.expiration) expires.set(key, opts.expiration * 1000);
      else expires.delete(key);
    },
    async delete(key) {
      store.delete(key);
      expires.delete(key);
    },
    async list({ prefix = '', limit = 1000 } = {}) {
      const keys = [];
      for (const k of store.keys()) {
        if (!live(k)) continue;
        if (k.startsWith(prefix)) {
          const exp = expires.get(k);
          keys.push(exp !== undefined ? { name: k, expiration: exp / 1000 } : { name: k });
        }
        if (keys.length >= limit) break;
      }
      return { keys, list_complete: true };
    },
  };
}

// Build an `env` with a fresh KV plus any extra bindings (Stripe secrets, etc.).
export function makeEnv(extra = {}) {
  // Difficulty 8, not production's 20 (or the old test value of 16). PoW is brute force:
  // difficulty 16 averages ~65k SHA-256 solves PER CALL and 20 call sites made single tests
  // take 6-16 seconds each — over a minute of the suite spent proving nothing but that
  // hashing is slow. Every property these tests actually verify (challenge embeds the pub,
  // freshness window, replay, the floor itself) is independent of the bit count, and the
  // floor test overrides this explicitly so it still proves too-easy tokens are rejected.
  return { KV: makeKV(), MIN_POW_DIFFICULTY: '8', ...extra };
}

// Helper to build a POST Request to an /api/* path with a JSON body.
export function apiRequest(path, body, headers = {}) {
  return new Request('https://breeze.test' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7', ...headers },
    body: JSON.stringify(body),
  });
}


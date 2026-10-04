// Minimal in-memory stand-in for a Cloudflare KV namespace, sufficient for the
// worker handlers under test. Values are stored as strings (the worker always
// JSON.stringify's before put), matching real KV semantics closely enough for
// unit tests.
//
// TTLs ARE enforced (unlike the original mock): puts record the absolute expiry
// in `exp`, and expired keys behave exactly like real KV — invisible to get(),
// absent from list(), and lazily purged. `store` values stay raw strings so
// tests can keep seeding/inspecting fixtures directly; tests advance the clock
// by writing a past timestamp into `exp` rather than sleeping. list() entries
// carry real-KV `expiration` metadata (unix seconds) so TTL-aware code paths
// like the /api/health sig: cleanup are exercisable.
export function makeKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  const exp = new Map(); // key → absolute expiry ms; absent = no expiry
  const purge = (k) => {
    const e = exp.get(k);
    if (e !== undefined && Date.now() >= e) { store.delete(k); exp.delete(k); return true; }
    return false;
  };
  return {
    store, exp,
    async get(key) {
      if (!store.has(key)) return null;
      if (purge(key)) return null;
      return store.get(key);
    },
    async put(key, value, opts) {
      store.set(key, String(value));
      const ttl = opts && Number.isFinite(opts.expirationTtl) ? opts.expirationTtl
        : opts && Number.isFinite(opts.expiration) ? opts.expiration - Date.now() / 1000
        : null;
      // An overwrite WITHOUT a TTL clears any prior expiry — real KV semantics.
      // A past/zero expiry is stored as already-expired (purged on next access).
      if (ttl !== null) exp.set(key, Date.now() + Math.max(ttl, 0) * 1000);
      else exp.delete(key);
    },
    async delete(key) {
      exp.delete(key);
      store.delete(key);
    },
    async list({ prefix = '', limit = 1000 } = {}) {
      const keys = [];
      for (const k of store.keys()) {
        if (purge(k)) continue;
        if (k.startsWith(prefix)) {
          const e = exp.get(k);
          keys.push(e !== undefined ? { name: k, expiration: Math.floor(e / 1000) } : { name: k });
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

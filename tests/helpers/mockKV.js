// Minimal in-memory stand-in for a Cloudflare KV namespace, sufficient for the
// worker handlers under test. Values are stored as strings (the worker always
// JSON.stringify's before put), matching real KV semantics closely enough for
// unit tests. TTLs are accepted but not enforced.
export function makeKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value, _opts) {
      store.set(key, String(value));
    },
    async delete(key) {
      store.delete(key);
    },
    async list({ prefix = '', limit = 1000 } = {}) {
      const keys = [];
      for (const k of store.keys()) {
        if (k.startsWith(prefix)) keys.push({ name: k });
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

// Compute a valid Stripe-style signature header for a raw payload + secret.
export async function stripeSigHeader(payload, secret, ts = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ts + '.' + payload));
  const hex = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `t=${ts},v1=${hex}`;
}

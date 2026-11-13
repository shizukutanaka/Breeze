// SQLite-backed implementation of the exact Cloudflare KV namespace
// surface the worker uses (stage-2 plan, docs/RELAY_STAGE2_PLAN.md fact 1):
//   get(key)                          → string | null
//   put(key, value, { expirationTtl } | { expiration })
//   delete(key)
//   list({ prefix, limit, cursor })   → { keys: [{ name, expiration? }],
//                                        list_complete, cursor? }
//
// Server-side library for the self-hosted relay: step 2 wires this in as
// env.KV for the Node host. Nothing in the Cloudflare deployment imports
// it, and the storage driver is Node's built-in node:sqlite (zero
// dependencies — see the stage-2 step-1 outcome for the pinned baseline).
//
// Semantics mirror the real binding (and tests/helpers/mockKV.js, which
// the contract suite in tests/sqlite-kv-contract.test.js diffs against):
//   - expirationTtl is relative seconds, expiration absolute unix
//     seconds; an overwrite WITHOUT a TTL clears any prior expiry;
//   - expired keys are invisible to get/list and lazily purged on
//     access (the stored exp is absolute milliseconds, like mockKV);
//   - list returns matching keys in lexicographic order (as real KV
//     does); entries carry `expiration` (unix seconds) only when the
//     key has one. The cursor is opaque to callers — it is simply the
//     last key name of the previous page.

export function makeSqliteKV(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    exp INTEGER
  )`);
  const qGet = db.prepare('SELECT value, exp FROM kv WHERE key = ?');
  const qPut = db.prepare(
    'INSERT INTO kv (key, value, exp) VALUES (?, ?, ?) ' +
    'ON CONFLICT(key) DO UPDATE SET value = excluded.value, exp = excluded.exp',
  );
  const qDel = db.prepare('DELETE FROM kv WHERE key = ?');
  // Prefix membership by substr() comparison: exact for arbitrary key
  // bytes, unlike LIKE (whose %/_ would need escaping). Relay key counts
  // make the unindexed scan a non-issue at this layer.
  const qList = db.prepare(
    'SELECT key, exp FROM kv WHERE substr(key, 1, ?) = ? ORDER BY key',
  );

  const expired = (exp) => exp !== null && Date.now() >= exp;

  return {
    async get(key) {
      const row = qGet.get(key);
      if (!row) return null;
      if (expired(row.exp)) { qDel.run(key); return null; }
      return row.value;
    },

    async put(key, value, opts) {
      const ttl = opts && Number.isFinite(opts.expirationTtl) ? opts.expirationTtl
        : opts && Number.isFinite(opts.expiration) ? opts.expiration - Date.now() / 1000
        : null;
      // A past/zero TTL stores as already-expired (purged on access),
      // matching mockKV / real KV behaviour for the sig: cleanup path.
      const exp = ttl !== null ? Date.now() + Math.max(ttl, 0) * 1000 : null;
      qPut.run(key, String(value), exp);
    },

    async delete(key) {
      qDel.run(key);
    },

    async list({ prefix = '', limit = 1000, cursor } = {}) {
      const lim = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 1000;
      const rows = qList.all(prefix.length, prefix);
      const live = [];
      for (const row of rows) {
        if (expired(row.exp)) { qDel.run(row.key); continue; }
        live.push(row);
      }
      let start = 0;
      if (cursor) {
        start = live.findIndex((r) => r.key > cursor);
        if (start === -1) start = live.length;
      }
      const page = live.slice(start, start + lim);
      const complete = start + page.length >= live.length;
      const keys = page.map((r) => (r.exp !== null
        ? { name: r.key, expiration: Math.floor(r.exp / 1000) }
        : { name: r.key }));
      return complete
        ? { keys, list_complete: true }
        : { keys, list_complete: false, cursor: page[page.length - 1].key };
    },
  };
}

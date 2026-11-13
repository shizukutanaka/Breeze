// The MailboxCore storage plane over SQLite (stage-2 step 1): a
// single-key get/put/delete with the same shape and value semantics as
// DurableObjectState.storage, which is all MailboxCore injects.
//
// One adapter serves ONE recipient: `prefix` namespaces the core's raw
// keys ('sealed:queue', 'deposits', 'presence', …) inside the shared
// table, so a host keeps one core per userId over one database — the
// DO namespace's one-instance-per-recipient registry, in process (the
// step-2 Node host builds exactly this; see tests/helpers/sqlite.js).
//
// Values are JSON-serialized. DO storage structured-clones arbitrary
// values, but everything the mailbox core stores is JSON-shaped by
// construction ({ v, exp } entries, the deposits timestamp array), so
// the round-trip is lossless for the protocol's own data; a host must
// not store non-JSON values through this adapter.

export function makeSqliteMailboxStorage(db, prefix = '') {
  db.exec(`CREATE TABLE IF NOT EXISTS mailbox_kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`);
  const qGet = db.prepare('SELECT value FROM mailbox_kv WHERE key = ?');
  const qPut = db.prepare(
    'INSERT INTO mailbox_kv (key, value) VALUES (?, ?) ' +
    'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  const qDel = db.prepare('DELETE FROM mailbox_kv WHERE key = ?');
  return {
    async get(key) {
      const row = qGet.get(prefix + key);
      return row ? JSON.parse(row.value) : undefined;
    },
    async put(key, value) {
      qPut.run(prefix + key, JSON.stringify(value));
    },
    async delete(key) {
      return qDel.run(prefix + key).changes > 0;
    },
  };
}

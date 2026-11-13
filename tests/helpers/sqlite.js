// Fixtures for the stage-2 step-1 contract tests: the SQLite storage plane
// (server/sqlite-*.js) on a throwaway in-memory database, plus a MailboxCore
// composed the way the step-2 Node host will compose it — one core per
// recipient over a per-user-prefixed storage view of ONE shared database,
// mirroring the DO namespace's one-instance-per-recipient registry.
// node:sqlite is loaded through createRequire, not a static import:
// vite's builtin-module list (vitest 2 / vite 5) predates node:sqlite
// and fails to resolve the specifier in transformed test modules.
// Plain `node` (the step-2 host) resolves the static import fine —
// this indirection is a test-harness accommodation only, and the
// server/*.js library modules never import the driver themselves
// (they receive an open DatabaseSync from their host).
import { createRequire } from 'node:module';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
import { makeSqliteKV } from '../../server/sqlite-kv.js';
import { makeSqliteMailboxStorage } from '../../server/sqlite-mailbox-storage.js';
import { MailboxCore } from '../../_worker.js';

export function makeSqliteDb() {
  return new DatabaseSync(':memory:');
}

// A KV namespace backed by the SQLite shim (a fresh in-memory database).
export function makeSqliteKVFixture() {
  const db = makeSqliteDb();
  return { kv: makeSqliteKV(db), db };
}

// One recipient's mailbox core over SQLite storage. `frames` records the
// wake-up callbacks the core emits (the SQLite host's analogue of the DO's
// socket fan-out). The storage adapter is exposed so tests can inspect or
// seed raw entries exactly as the DO driver's mock storage allows.
export function makeSqliteCore(db, userId) {
  const storage = makeSqliteMailboxStorage(db, `${userId}:`);
  const frames = [];
  const core = new MailboxCore({
    storage,
    onQueueChanged: (family) => frames.push({ type: 'mail', family }),
  });
  return { core, storage, frames };
}

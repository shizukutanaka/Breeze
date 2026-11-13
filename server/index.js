#!/usr/bin/env node
// Breeze relay — Node entrypoint (stage-2 step 2).
//
//   node server/index.js
//
// Starts the self-hosted relay: the worker's handler code served by
// one Node process on one origin (static app + API + WebSocket
// wake-up), with all state in one SQLite file. Configuration comes
// from environment variables only — see server/README.md for the
// full list. Requires Node ≥ 24 (the storage plane uses the built-in
// node:sqlite; zero npm dependencies).

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildRelayEnv, createRelayServer, REPO_ROOT } from './node-host.js';

const TRUTHY = /^(1|true|yes)$/i;

const port = Number(process.env.PORT) || 8787;
const host = process.env.HOST || '127.0.0.1';
const dbPath = resolve(process.env.BREEZE_DB_PATH || 'breeze-relay.db');
const trustProxy = TRUTHY.test(process.env.TRUST_PROXY || '');

mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
const env = buildRelayEnv({ db, rootDir: REPO_ROOT, dbPath });
const server = createRelayServer({ env, trustProxy });

server.listen(port, host, () => {
  console.log(`Breeze relay listening on http://${host}:${port}/`);
  console.log(`  state: ${dbPath} (SQLite, single process — see server/README.md)`);
  console.log(`  mailbox backend: ${env.MAILBOX_BACKEND}, presence: ${env.PRESENCE_BACKEND}, ws wake-up: ${env.MAILBOX_WS_ENABLED === 'true' && env.MAILBOX_BACKEND === 'do' ? 'on' : 'off'}, trust proxy: ${trustProxy ? 'on' : 'off'}`);
});

let closing = false;
function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`\n${signal} — shutting down`);
  server.close(() => {
    try { db.close(); } catch { /* already closed */ }
    process.exit(0);
  });
  // Long-lived sockets (WebSocket wake-ups) would otherwise hold the
  // process open; they are safe to drop — clients reconnect and poll.
  server.closeAllConnections?.();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

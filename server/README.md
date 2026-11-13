# Breeze relay — Node host (stage-2 step 2)

A self-host entry for the identical handler code that runs on
Cloudflare: one Node process on one origin serving the static app,
the API and the WebSocket wake-up, with all relay state (key/value
directory, mailboxes, presence) in **one SQLite file**. From the
client's same-origin API derivation, a self-hosted install behaves
exactly like the official deployment.

Docker packaging and the closed-by-default operator surface are
stage-2 step 3 (see `docs/RELAY_STAGE2_PLAN.md`); this directory is
the runnable entry that step packages.

## Run

```bash
node server/index.js
# → Breeze relay listening on http://127.0.0.1:8787/
```

- **Requires Node ≥ 24** (storage uses the built-in `node:sqlite`).
  There are no npm dependencies to install.
- Configuration is environment variables only — no code edits.

## Supported topology: single process

Run exactly **one** process against one database file. That is what
makes two of the relay's properties true: the worker's rate limiter
is in-memory per process, and each mailbox's operations are
serialized inside that process (the Durable Object's per-instance
serialization, reproduced by MailboxCore). A second process — even
on the same file — would hold neither property. Scale by running a
bigger single process, not more of them.

For production exposure, terminate TLS at a reverse proxy in front
of the entry (browsers will only use the relay over HTTPS/WSS) and
set `TRUST_PROXY=true` so rate limiting keys on the forwarded client
address. **Never set `TRUST_PROXY` without such a proxy**: it makes
the host believe the `X-Forwarded-For` header, which anyone can
forge when they can reach the entry directly.

Backups are the database file (plus its `-wal`/`-shm` sidecars if
present while running): stop the process, copy the file, restart.

## Configuration

Host settings:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | Listen port |
| `HOST` | `127.0.0.1` | Listen address (`0.0.0.0` to serve other machines directly) |
| `BREEZE_DB_PATH` | `./breeze-relay.db` | SQLite state file (created if absent) |
| `TRUST_PROXY` | off | Trust `X-Forwarded-For` for the rate limiter's client IP (see above) |

Worker settings — the same names (and semantics) as the Cloudflare
deployment; see `wrangler.toml` and `.env.example` for the full list.
The ones this host gives defaults to, because a self-host's
mailboxes are meant to run on the SQLite-backed core:

| Variable | Host default | Cloudflare default |
|---|---|---|
| `MAILBOX_BACKEND` | `do` (the in-process core) | `kv` |
| `PRESENCE_BACKEND` | `do` | `kv` |
| `MAILBOX_WS_ENABLED` | `true` | off |

Each remains overridable from the environment (e.g.
`MAILBOX_WS_ENABLED=false node server/index.js`). Secrets such as
`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (Web Push) and the TURN
variables pass through the same way; without them those features
report themselves off in `/api/health`, exactly as on Cloudflare.

## Files

| File | Role |
|---|---|
| `index.js` | Entrypoint: opens the database, builds the environment, listens |
| `node-host.js` | `env` assembly + the `node:http` ↔ worker `fetch` adapter + upgrade dispatch |
| `mailbox-namespace.js` | The `MAILBOX_DO` binding in process: one MailboxCore per recipient + the socket registry |
| `static-assets.js` | The `ASSETS` binding: static files with the `_headers` rules applied |
| `ws-server.js` | Minimal RFC 6455 server (handshake + framing), zero-dependency |
| `sqlite-kv.js` | The `KV` binding over SQLite (stage-2 step 1) |
| `sqlite-mailbox-storage.js` | MailboxCore's storage plane over SQLite (stage-2 step 1) |

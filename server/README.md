# Breeze relay — Node host (stage-2 steps 2–3)

A self-host entry for the identical handler code that runs on
Cloudflare: one Node process on one origin serving the static app,
the API and the WebSocket wake-up, with all relay state (key/value
directory, mailboxes, presence — and the relay identity key) in
**one SQLite file**. From the client's same-origin API derivation, a
self-hosted install behaves exactly like the official deployment.

## Run

With Docker (the packaged path — registration closed by default,
data in a volume):

```bash
BREEZE_ALLOWLIST=<your Breeze ID> docker compose up -d
```

Bare:

```bash
node server/index.js
# → Breeze relay listening on http://127.0.0.1:8787/
```

- **Requires Node ≥ 24** (storage uses the built-in `node:sqlite`).
  There are no npm dependencies to install.
- Configuration is environment variables only — no code edits.
- The full operator guide (TLS, registration admission, relay
  identity, backup/restore) is `docs/SELF_HOSTING.md`.

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
The relay identity key lives inside that same file (a dedicated
`relay_meta` table the worker's KV surface cannot reach), so a
restored relay keeps its fingerprint.

## Configuration

Host settings:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | Listen port |
| `HOST` | `127.0.0.1` | Listen address (`0.0.0.0` to serve other machines directly) |
| `BREEZE_DB_PATH` | `./breeze-relay.db` | SQLite state file (created if absent) |
| `TRUST_PROXY` | off | Trust `X-Forwarded-For` for the rate limiter's client IP (see above) |
| `REGISTRATION_ALLOWLIST` | unset (open) | Comma-separated Breeze IDs allowed to *create accounts*; set-but-empty closes registration to everyone. Existing accounts are never gated |
| `REGISTRATION_OPEN` | off | `1`/`true` re-opens registration, winning over an allowlist (so a Docker operator can re-open without editing the compose file) |

The Docker packaging sets `REGISTRATION_ALLOWLIST` (possibly empty)
so a packaged relay is **closed by default**; a bare entry sets
neither variable and keeps registration open unless the operator
closes it. On first boot the entry also generates the relay's
persistent Ed25519 identity key into the database (if absent) and
prints its fingerprint in the boot log — see
`docs/SELF_HOSTING.md` §"Relay identity".

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
| `index.js` | Entrypoint: opens the database, provisions the relay identity, builds the environment, listens |
| `relay-identity.js` | The relay's persistent Ed25519 identity: generate-on-first-run into the database's `relay_meta` table, fingerprint for the boot log |
| `node-host.js` | `env` assembly + the `node:http` ↔ worker `fetch` adapter + upgrade dispatch |
| `mailbox-namespace.js` | The `MAILBOX_DO` binding in process: one MailboxCore per recipient + the socket registry |
| `static-assets.js` | The `ASSETS` binding: static files with the `_headers` rules applied |
| `ws-server.js` | Minimal RFC 6455 server (handshake + framing), zero-dependency |
| `sqlite-kv.js` | The `KV` binding over SQLite (stage-2 step 1) |
| `sqlite-mailbox-storage.js` | MailboxCore's storage plane over SQLite (stage-2 step 1) |

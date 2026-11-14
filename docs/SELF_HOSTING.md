# Self-Hosting Guide

There are two ways to run a Breeze relay:

1. **Self-hosted (Node + Docker)** — the relay on your own machine or
   VPS: one container, one data volume, registration closed by
   default. Start here if the relay is for you and your people.
2. **Cloudflare** — the official-style deployment on Cloudflare's
   free tier (the relay Breeze itself runs). Start there if you want
   a public relay with no server to maintain.

Both run the identical handler code; a relay is a dumb,
interchangeable mailbox either way, and every client works with
every relay.

## Self-Hosted with Docker

```bash
# 1. Get the code
git clone https://github.com/shizukutanaka/Breeze.git && cd Breeze

# 2. Start it, with your own Breeze ID admitted (see "Registration"
#    below for how to find it — you can also start closed-to-everyone
#    and add IDs later)
BREEZE_ALLOWLIST=<your Breeze ID> docker compose up -d

# 3. Watch the first-boot log — it prints your relay identity
#    fingerprint; write it down (see "Relay identity")
docker compose logs breeze
```

The relay serves plain HTTP on port 8787 inside the container.
**Terminate TLS at a reverse proxy in front of it** (Caddy, nginx,
Traefik, a Cloudflare Tunnel, …): browsers will only use a relay
over HTTPS/WSS. When you do, set `TRUST_PROXY: "true"` in
`docker-compose.yml` so rate limiting keys on the real client
address — and never set it without such a proxy, because the header
it trusts is forgeable by anyone who can reach the entry directly.

Run exactly **one** container against the data volume: the rate
limiter is in-memory per process and each mailbox's operations are
serialized inside that process, so a second replica would hold
neither property. Scale by giving the one process a bigger machine.

### Registration: closed by default

A self-hosted relay that anyone on the internet could register on
would recreate the spam/abuse economics the official relay's limits
exist to control, so **the Docker packaging ships closed**: the
compose file passes a `REGISTRATION_ALLOWLIST` (possibly empty) and
only the Breeze IDs on it may *create accounts* (a first prekey
upload). Closing registration never affects people already homed on
the relay — their uploads, deposits, rendezvous and polls are not
gated — and opening registration is an explicit choice, never the
default.

- **Your Breeze ID** is the 12-character identifier in your invite
  link (the first 12 characters of its `pub` value). Ask each person
  you invite for theirs the same way — the ID is a public identifier
  contacts already exchange, not a secret.
- **Admit people** by listing their IDs: set
  `BREEZE_ALLOWLIST=id1,id2,…` in your shell or a `.env` file next to
  `docker-compose.yml`, then `docker compose up -d` again.
- **Start now, admit later**: with no `BREEZE_ALLOWLIST` set, the
  relay runs closed to everyone — the boot log says so — and nobody
  can register until you add IDs.
- **Open relay** (anyone may register): uncomment
  `REGISTRATION_OPEN: "1"` in `docker-compose.yml`. You own the
  abuse economics if you do.

### Usage quota: turn it off on your own relay

The worker ships with a **fair-use usage quota** enabled: per
mailbox, at most 10,000 deposits/day and 200,000/month (a deposit is
one full delivery cycle — see `docs/COST_MODEL.md` §10 for the
policy and the numbers). That frame exists for the *shared default
relay*, which is run as a free entrance whose variable costs the
operator would otherwise carry for everyone. **On a relay you run
for yourself and your people, the frame is pointless — disable
it**:

```bash
USAGE_QUOTA_ENABLED=false
```

Set it wherever your relay reads its environment (the shell or
`.env` next to `docker-compose.yml`, the Node process environment,
or Cloudflare Pages secrets). Two neighbouring knobs exist if you
run a community relay and *do* want a frame:
`USAGE_QUOTA_DAILY` and `USAGE_QUOTA_MONTHLY` retune the caps.
Notes that matter:

- The quota is enforced only when mailboxes live in Durable
  Objects (`MAILBOX_BACKEND=do`, the default on this host); on the
  KV backend it is a documented no-op.
- Past the cap, senders get an explicit `429 USAGE_QUOTA_EXCEEDED`
  (with the window and its limit) instead of a silent drop — the
  message stays in the sender's outbox, and the recipient remains
  reachable over P2P and via any other home relay.

### Relay identity

On first boot the relay generates a persistent Ed25519 identity key
*inside the data volume* and prints its fingerprint in the log:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

The fingerprint identifies *your* relay: give it to your users
out-of-band (in person, over another channel) so they can recognize
the relay they were handed as the one you run. The same fingerprint
prints on every boot; if it ever changes, the data volume was
replaced — investigate before telling users to trust the new one.

Clients verify and pin this key automatically (stage-2 step 4): on
first contact a client challenges the relay to sign with the key
(`/api/relay/attest`), stores the verified key with the account, and
re-verifies on every later session. The fingerprint the client shows
(under `/security`, and in the toast on first pin) is derived from
the same key — compare it with the boot-log line above. If the key
ever changes, clients **stop talking to the relay** and warn the
user; they never re-pin silently. Treat a fingerprint change as a
breaking event: there is no in-app "trust the new key" button in
step 4, so after a genuine volume loss your users must clear the
app's stored data for their account and re-pin on first contact —
announce the new fingerprint out-of-band first, or they cannot tell
your new key from an attacker's.

### Backup & restore

**The data volume is the entire relay state**: one SQLite file
holding the directory, the mailboxes, and the relay identity key.
There is nothing else to back up.

```bash
# Back up: copy the database out of the (stopped) container
docker compose stop
docker cp "$(docker compose ps -aq breeze)":/data/breeze-relay.db ./breeze-relay-backup.db
docker compose start

# Restore: copy the backup back in as /data/breeze-relay.db before
# starting, and the relay serves identically — same fingerprint.
docker compose stop
docker cp ./breeze-relay-backup.db "$(docker compose ps -aq breeze)":/data/breeze-relay.db
docker compose start
```

### Updating

```bash
git pull origin main
docker compose up -d --build
```

State lives in the volume, not the image, so updating never touches
your users' data.

## Self-Hosted with Bare Node (no Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Configuration is environment variables only — `server/README.md`
lists them all. Two differences from the Docker path:

- The **data file** defaults to `./breeze-relay.db` (override with
  `BREEZE_DB_PATH`); it is the same single-file state, relay identity
  included. Back it up the same way: stop, copy, restart.
- **Registration is open unless you close it**: the closed default
  is a property of the Docker packaging. To close a bare entry, set
  `REGISTRATION_ALLOWLIST=id1,id2` (or an empty value for
  closed-to-everyone); `REGISTRATION_OPEN=1` re-opens explicitly.

## Cloudflare Deployment

### Minimum Deployment ($0/month, 5 minutes)

```bash
# 1. Install Wrangler CLI
npm install -g wrangler

# 2. Login to Cloudflare
wrangler login

# 3. Deploy
wrangler pages deploy . --project-name=breeze

# 4. Create KV namespace and bind it
wrangler kv:namespace create KV
# Copy the ID, then go to:
# Dashboard > Pages > breeze > Settings > Functions > KV namespace bindings
# Variable name: KV → Select the namespace you created

# 5. Visit https://breeze.pages.dev
```

**That's it.** All features work except push notifications. Note
that registration on a Cloudflare deployment is **open** unless you
set `REGISTRATION_ALLOWLIST` yourself (see `.env.example`); the
closed-by-default packaging is the Docker path above.

### What Works at $0

| Feature | Status | Notes |
|---------|--------|-------|
| E2E encrypted chat | ✓ | Full Double Ratchet |
| P2P messaging | ✓ | WebRTC DataChannel |
| Voice/video calls | ✓ | WebRTC + free STUN |
| TURN relay | ✓ | Open Relay (20GB/month free) |
| Groups (100 members) | ✓ | Sender Key O(1) |
| File transfer | ✓ | Up to 50MB via P2P |
| 8 languages | ✓ | EN + 7 full locales, auto-detected |
| Offline/PWA | ✓ | Service Worker |
| Push notifications | ✗ | Needs VAPID keys |

Multi-account billing (Lite/Plus/Pro) is not available — see
[SECURITY.md](../SECURITY.md)'s "Removed: multi-account billing" section. Every account gets
unlimited local sub-accounts for free with no plan gating.

### Free Tier Limits

| Resource | Free Tier | Usage per Active User |
|----------|-----------|----------------------|
| Worker requests | 100,000/day | ~500/day (polling + signaling) |
| KV reads | 100,000/day | ~200/day |
| KV writes | 1,000/day | ~350/day (optimized) |
| KV storage | 1 GB | ~10 KB/user |
| Static assets | Unlimited | ~400 KB (single HTML) |

**Supports ~3 concurrent active users on free tier.**

### Adding Optional Features

#### Push Notifications (free)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### TURN Server (for restrictive networks)

```bash
# Option A: Cloudflare Calls ($0.05/GB)
wrangler pages secret put TURN_KEY_ID
wrangler pages secret put TURN_KEY_API_TOKEN

# Option B: No config → free Open Relay (20GB/month)
# (This is the default — no action needed)
```

#### Auth Hardening & the Plain Relay Path

Presence writes and TURN credential issuance already require a *registered*
account (prekey bundle present) by default — no signature is involved, and
every client registers automatically. The stricter Ed25519-signature flags
stay opt-in; `wrangler.toml` documents each one and why (clients on runtimes
without WebCrypto Ed25519 cannot sign at all).

The legacy plain relay (`/api/msg/send`, `/api/msg/poll`) is deprecated: its
responses carry a `Deprecation: true` header, and the sealed path is the
default route for every current client. Once you have confirmed no live
client still needs the fallback, disable it outright:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Custom Domain

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Scaling Beyond Free Tier

When you outgrow the free tier ($5/month Workers Paid plan):

| Resource | Paid Plan |
|----------|-----------|
| Worker requests | 10 million/month |
| KV writes | 1 million/month |
| KV storage | 1 GB included |
| CPU time | 30 seconds/request |

This supports **thousands of concurrent users**.

### Updating

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

No build step. No dependencies to install. Just deploy.

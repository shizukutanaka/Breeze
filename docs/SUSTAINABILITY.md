# Sustainability — why Breeze does not need a company to survive

Most messengers are a service: a company or foundation operates the
servers, and the product lives exactly as long as that operator can
keep paying. Breeze is built the other way around. It is software —
one HTML file plus an interchangeable relay — whose default relay is
deliberately kept too small to matter, whose heavy use is billed to
the user's own placement by design, and which anyone can redeploy
verbatim. If donations stopped tomorrow, or the project changed
hands, nothing about your ability to use Breeze would change, because
there is no central bill whose non-payment could switch it off.

This page is the evidence, stated with its assumptions attached. Every
figure comes from [COST_MODEL.md](COST_MODEL.md), which recomputes the
cost of the default Cloudflare deployment from the shipped code's
actual request shapes and Cloudflare's official price list (retrieved
2026-11-14). Where the model is still an estimate, this page says so.

## 1. What the default relay actually costs, by scale

The honest curve first — including the part that does not flatter us.
These are monthly totals for one relay serving the stated number of
monthly active users (MAU), on Workers Paid (US$5/month minimum),
under COST_MODEL §1.2's two usage profiles: *light* (20 online
hours/month, 300 sent messages) and *heavy* (60 hours, 2,000
messages).

| MAU | Light | Heavy |
|---:|---:|---:|
| 100 | $5 | $18 |
| 1,000 | $34 | $222 |
| 10,000 | $382 | $2,679 |
| 100,000 | $4,218 | $27,825 |
| 1,000,000 | $43,216 | $279,317 |

(COST_MODEL §4.1 / §4.2. Included quotas are already subtracted; past
them, billing is metered with no cliff — the marginal cost is about
**$0.043 per MAU/month** light and **$0.279** heavy, §4.3.)

Read it in three bands:

- **Free tier.** On Workers Free, the relay runs for a few dozen
  daily users at most (roughly 20–40 light-use DAU, under 10 heavy):
  the free quotas are hard caps and the polling traffic reaches them
  first (COST_MODEL §5.1). "Runs at $0" is true at personal scale —
  which is exactly the scale a self-hoster needs.
- **The $5 band.** The Paid plan's included quotas cover roughly the
  first ~96 light-use MAU (~11 heavy). Past that the meter runs, but
  smoothly — $5 becomes $6, then $7 (COST_MODEL §5.3).
- **The million-user band, stated plainly.** If a single operator
  tried to serve a million MAU from one default relay *with today's
  code*, it would cost about $43,000–$279,000 per month. About 80% of
  the light-profile total at that scale is two line items — KV reads
  ($18,270) and Worker requests ($15,687) — and both are driven by
  the same thing: the 2-second signal polling each connected peer
  performs (1,800 requests + 1,800 KV reads per room-hour, §2.4). In
  other words the dominant cost is the cost of *being online*, not of
  messages sent. That makes it an implementation coefficient, not a
  structural fate: confining signal rooms to conversations that are
  actually open cuts the million-user figures to roughly
  $16,000 / $107,000 (§7). Section 2 below is why no single operator
  ever has to carry even that bill.

## 2. Why the bill never lands on one operator

### A fair-use quota, not a paywall

The default relay caps *deposits* — one deposit is one full delivery
cycle — per recipient identity at **10,000 per day** and **200,000
per month** (COST_MODEL §10; server-side, `USAGE_QUOTA`). A heavy
user receives about 6,000 deposits a month, so the caps sit at
roughly 50× a heavy day and 33× a heavy month: ordinary personal use
never touches them, by construction. One identity that does max out
its quota costs the operator only a few dollars a month at list
prices — the cap fixes the worst case per identity, and what remains
(mass identity creation) is a registration problem, handled separately
by allowlists and proof-of-work.

Hitting the cap is a signpost, not a lockout. The relay answers
`429 USAGE_QUOTA_EXCEEDED` with the time the window reopens; the
envelope is not stored and not lost — the sender's outbox keeps it
and retries later. Deliveries that arrive peer-to-peer, or via the
recipient's own home relay, are not subject to the default relay's
quota at all: the default relay's budget does not govern other
routes. And on a relay you run for yourself, the quota can be
switched off entirely — it exists to protect a *shared* entrance,
not to meter anyone's own infrastructure.

### Federation turns one metered bill into many small flat fees

Since relay federation shipped, a user's polling, presence and
deposits all execute on their *home* relay — so the default relay's
cost is proportional not to Breeze's total users, but to the users
who call it home (COST_MODEL §9). A community of 1,000 MAU that would
meter $34 (light) to $222 (heavy) per month on Cloudflare runs as a
Node host on a flat-fee VPS of the €5.49/month class (20 TB transfer
included, public list pricing) instead — with the caveat, noted in
§9, that a single box's connection and CPU limits are unmeasured. As communities take their
traffic home, the default relay shrinks back to what it is designed
to be: an entrance and a discovery point, not the network's engine
room.

### The expensive bytes never touch the relay

Message files (up to 50 MB) travel peer-to-peer over the WebRTC
DataChannel at zero relay cost; only envelopes of 192 KB or less fall
back to the relay at all (COST_MODEL §2.3). Storage is likewise
bounded by design — an undelivered envelope expires after at most
7 days — and never becomes a cost driver at any scale in the model
(§6: about $100/month even in the heavy million-user case).

## 3. No phone number: an entire cost category that does not exist

Breeze identity is a key pair on your device. There is no phone
number, so there is no registration SMS and no voice-call fallback —
not "a cheaper provider", none. For messengers built on phone
numbers this is a permanent, per-user operating cost: Signal's own
published breakdown (official blog, November 2023) puts registration
SMS and voice verification at about **$6 million per year**, inside
about $14 million of infrastructure and a projected **~$50 million
per year** total operating budget, funded by donations that have to
be raised again every year. Breeze's design deletes that line item
structurally, along with the account database that makes phone
numbers worth collecting: there is no server-side account database
at all (see "What Breeze will never do" in the
[README](../README.md)).

The same shape repeats everywhere in the model. There is no
per-user anything for an operator to pay: no registration, no
storage of readable content, no bandwidth bill for files. What is
left is the polling fixed cost of §1 — real, measured, and reducible
by the levers in COST_MODEL §7 — and §2's design ensures it is shared
out to the placements that cause it.

## 4. If the operator disappears — or changes

Continuity does not rest on anyone's goodwill:

- The code is MIT-licensed and the client is a single HTML file.
  Anyone can redeploy the identical relay in about 60 seconds
  ([SELF_HOSTING.md](SELF_HOSTING.md)) — on their own Cloudflare
  account, or as one Docker container on a VPS.
- A relay is an interchangeable mailbox. Identities and keys live on
  users' devices, contacts carry each other's home-relay information
  in invite links, and every client works with every relay. An
  operator — including a future owner of this project — can stop
  running *a* relay, but cannot take the network with it, because
  there is no central account database to own.
- Money given to the project funds development. There is no central
  traffic bill for it to be diverted to, and none whose non-payment
  stops the service.

One honest status note: the reference instance at breeze.pages.dev
is currently offline (it returns 404), pending an owner-side restore.
That is an operations gap, and we state it rather than hide it — but
it is also this page's argument in miniature. While it is down, every
self-hosted copy keeps working, because no copy depends on it.

## 5. Verify it yourself

- **The full model.** [COST_MODEL.md](COST_MODEL.md) shows every
  meter (Worker requests, CPU, Durable Objects requests/rows/duration,
  KV reads/writes, TURN egress), the per-message and per-hour request
  shapes counted from the code, and the price table used. Its §11
  lists what is still unmeasured — most importantly the
  simultaneous-signal-room coefficient — and the model is written to
  have its coefficients replaced by production measurements.
- **The identical relay, running under your own account.** Follow
  [SELF_HOSTING.md](SELF_HOSTING.md). The strongest form of the claim
  on this page is that you do not have to trust it: stand the relay
  up, watch your own Cloudflare bill, and check it against §1's
  table.

What this page does not claim: that one server can serve everyone for
free (the curve in §1 is the real one), or anything about
cryptographic assurance — for the security model and its current
limits, see [SECURITY.md](../SECURITY.md).

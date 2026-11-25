# Transparency reports — what, where from, and how to publish

*Standing procedure (SHARE_PLAN stage 7 step 3). One report per
month, committed to this directory as `YYYY-MM.md`.*

## What a report contains

Aggregates only. A report NEVER contains message content,
contact graphs, per-user records, IP addresses, or anything that
identifies a person — the relay is built so the operator does
not hold those in the first place (see `docs/AUDIT.md`).

| Field | Source of truth |
|---|---|
| Operating status & incidents | The operator's own log for the month (outages, deploys, quota events) |
| Requests by class (deposits, collects, signalling, registrations) | The hosting platform's analytics for the worker (Cloudflare dashboard → Workers → Analytics), read at month end. The worker deliberately does **not** keep its own per-request counters: counting every poll would add a KV write to the single most frequent operation and roughly double its cost (see `docs/COST_MODEL.md`) |
| Registered identities (count) | Count of prekey records in the relay's KV namespace at month end (`wrangler kv key list` on the deployment, counted, keys never published) |
| TURN issuance this month | The health endpoint's `turnIssuedThisMonth` / `turnIssueCap` fields |
| Fair-use quota events | Count of deposits refused with a quota scope (daily/monthly) in the platform analytics / operator log |
| Cost for the month | The platform bill, interpreted with `docs/COST_MODEL.md`; state the actual figure, not the model, when a bill exists |
| Release downloads | GitHub Releases asset download counts for tags cut in the month |

## How to publish (the whole procedure)

1. Scaffold the file: `node tools/transparency-report.mjs YYYY-MM`
   (optionally `--health https://<relay>/api/health` to prefill
   the machine-readable fields).
2. Fill every remaining field from the sources above. A field
   that could not be measured says so — an honest blank beats an
   invented zero.
3. Commit the report to this directory and link it from the
   repository README's transparency line if this is the first
   report of a new year.
4. Self-hosted relays are run by their own operators; this
   procedure binds only the default relay. Other operators are
   encouraged, not required, to publish the same fields.

## Cadence

Monthly, within the first week of the following month. If the
default relay is not operating, the report still publishes and
says exactly that — silence is the only failure mode this
procedure exists to prevent.

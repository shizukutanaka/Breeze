#!/usr/bin/env node
// Scaffold the monthly transparency report (SHARE_PLAN stage 7
// step 3). Usage:
//   node tools/transparency-report.mjs YYYY-MM [--health URL]
// Fills the machine-readable fields from the relay's health
// endpoint when one is given; every other field is left as an
// explicit TO MEASURE marker — this tool never invents a number.
// The procedure lives in docs/transparency/README.md.
import { writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const month = process.argv[2];
if (!/^\d{4}-\d{2}$/.test(month || '')) {
  console.error('usage: node tools/transparency-report.mjs YYYY-MM [--health https://relay/api/health]');
  process.exit(2);
}
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'transparency', `${month}.md`);
if (existsSync(out)) { console.error(`transparency-report: ${month}.md already exists — refusing to overwrite a published report`); process.exit(2); }

let health = null;
const hi = process.argv.indexOf('--health');
if (hi > 0 && process.argv[hi + 1]) {
  try { health = await (await fetch(process.argv[hi + 1])).json(); } catch { health = null; }
}
const tm = (v) => (v === undefined || v === null ? 'TO MEASURE' : String(v));

writeFileSync(out, `# Transparency report — ${month}

*Published under the standing procedure in \`docs/transparency/README.md\`.
Aggregates only — never content, contacts, or per-user data.*

## Operating status

TO MEASURE — incidents, outages, deploys, quota events for the month, from the operator's log.

| Field | ${month} |
|---|---|
| Requests by class (deposits / collects / signalling / registrations) | TO MEASURE — platform analytics (see procedure) |
| Registered identities (count, month end) | TO MEASURE — KV record count (see procedure) |
| TURN issuance this month | ${health ? `${tm(health.turnIssuedThisMonth)} issued, cap ${tm(health.turnIssueCap)}` : 'TO MEASURE — health endpoint'} |
| App version on the default relay | ${health ? tm(health.version) : 'TO MEASURE — health endpoint'} |
| Fair-use quota events | TO MEASURE — platform analytics / operator log |
| Cost for the month | TO MEASURE — platform bill, interpreted with docs/COST_MODEL.md |
| Release downloads | TO MEASURE — GitHub Releases asset counts |

## What changed this month that affects operators

TO MEASURE — releases, parameter changes, incidents carried over.
`);
console.log(`transparency-report: scaffolded docs/transparency/${month}.md${health ? ' (health fields prefilled)' : ''}`);

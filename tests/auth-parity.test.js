// Auth-challenge parity: every *_REQUIRE_AUTH family verifies an Ed25519
// signature over a `breeze-<op>:…` challenge the client produces. The contract
// is byte-for-byte template parity between index.html (signer) and _worker.js
// (verifier) — a drift on either side is silently green tests + SIG_INVALID in
// production. This gate extracts every `breeze-…` template literal from both
// files, normalizes ${…} slots, and asserts the verified ops produce identical
// skeletons.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const WORKER = fs.readFileSync(path.join(ROOT, '_worker.js'), 'utf8');

// `breeze-…` template literals with slots normalized to {}. A trailing ':' is
// an empty-bind slot (client writes `…:${ts}:` where the worker appends '').
function skeletons(src) {
  const out = [];
  for (const m of src.matchAll(/`breeze[^`]*`/g)) {
    const raw = m[0].slice(1, -1);
    if (!raw.includes('${')) continue; // doc comments/deep-links, not challenges
    const skel = raw.replace(/\$\{[^}]*\}/g, '{}').replace(/:$/, ':{}');
    out.push(skel);
  }
  return out;
}

const clientSkels = skeletons(INDEX);
const workerSkels = skeletons(WORKER);

// Ops whose verification lives on main — exact skeleton parity required.
const MAIN_VERIFIED = [
  'breeze-alias-set:{}:{}',
  'breeze-alias-delete:{}:{}',
  'breeze-push-unsubscribe:{}:{}:{}',
  'breeze-backup-upload:{}:{}',
  'breeze-backup-download:{}:{}',
  'breeze-device-set:{}:{}:{}',
  'breeze-account-delete:{}:{}',
  'breeze-inst:{}:{}',
  'breeze-sig:{}:{}:{}',
];

// push/subscribe: the worker composes the last slot from a subBind variable —
// `subBind = `${endpoint}:${p256dh}:${auth}`` — so its template skeleton is
// 3-field while the produced string (and the client's literal) is 6-field.
it('push/subscribe: client 6-field literal == worker skeleton + 3-field subBind', () => {
  expect(clientSkels).toContain('breeze-push-subscribe:{}:{}:{}:{}:{}');
  expect(workerSkels).toContain('breeze-push-subscribe:{}:{}:{}');
  expect(WORKER).toMatch(/subBind\s*=\s*`\$\{[^`]+\}:\$\{[^`]+\}:\$\{[^`]+\}`/);
});

describe('auth-challenge parity (index.html ↔ _worker.js)', () => {
  it.each(MAIN_VERIFIED)('challenge %s is byte-identical on both sides', (skel) => {
    expect(clientSkels, `client missing ${skel}`).toContain(skel);
    expect(workerSkels, `worker missing ${skel}`).toContain(skel);
  });

  it('worker has the generic group template breeze-group-{action}:{token}:{actorId}:{ts}:{bind}', () => {
    expect(workerSkels).toContain('breeze-group-{}:{}:{}:{}:{}');
  });

  it('every client group template fits the worker shape (action slot may be literal)', () => {
    const group = clientSkels.filter(s => /^breeze-group-(?!create)/.test(s));
    expect(group.length).toBeGreaterThan(0);
    for (const g of group) {
      const fields = g.split(':');
      // breeze-group-<action>:<token>:<actorId>:<ts>:<bind…> — ≥5 colon fields
      expect(fields.length, g).toBeGreaterThanOrEqual(5);
      // action field is a literal or the {} slot; token/actorId/ts are slots
      expect(fields[1], g).toBe('{}');
      expect(fields[2], g).toBe('{}');
      expect(fields[3], g).toBe('{}');
      // bind may be a slot or a literal compound ('promote:{id}') — must exist
      expect(fields.slice(4).join(':'), g).toBeTruthy();
    }
  });

  // Challenges the client signs but whose verifier lives on an unmerged Worker
  // branch — move each into MAIN_VERIFIED parity when its branch lands.
  const PENDING = [
    'breeze-{}:{}:{}',               // queue ops: breeze-<op>:<id>:<ts> (#283)
    'breeze-prekey-upload:{}:{}:{}', // #284
    'breeze-group-create::{}:{}:{}', // #285 (empty token slot)
  ];

  it('client signs no challenge shape the worker can never verify', () => {
    for (const skel of clientSkels) {
      if (!skel.includes(':')) continue; // filenames etc., not challenges
      if (workerSkels.includes(skel)) continue;
      // push-subscribe's worker side is the composed-subBind form (see above).
      if (skel === 'breeze-push-subscribe:{}:{}:{}:{}:{}') continue;
      // Group mutations are verified via the worker's generic ${action}
      // template (structure asserted above); group-create stays PENDING.
      if (/^breeze-group-(?!create)/.test(skel)) continue;
      expect(PENDING, `unverified client challenge: ${skel}`).toContain(skel);
    }
  });

  it('alias/delete signs the sanitized alias (worker hashes clean, not raw)', () => {
    // clean = toLowerCase + charset strip + slice(0,20) — the client must apply
    // the same transform inside the slot or a mixed-case alias never verifies.
    expect(INDEX).toMatch(/breeze-alias-delete:\$\{[^`]*\.toLowerCase\(\)\.replace\(\/\[\^a-z0-9_\]\/g, ''\)\.slice\(0, 20\)\}/);
  });

  it('alias/set signs the worker-sanitized alias (no 20-cap — worker rejects >20)', () => {
    const sets = INDEX.match(/breeze-alias-set:\$\{[^`]*\}:\$\{[^}]*\}/g) || [];
    expect(sets.length).toBeGreaterThan(0);
    for (const s of sets) {
      expect(s, s).toMatch(/toLowerCase\(\)\.replace\(\/\[\^a-z0-9_\]\/g, ''\)/);
      expect(s, 'alias/set clean has no slice(0,20) — do not add one').not.toMatch(/slice\(0, 20\)/);
    }
  });
});

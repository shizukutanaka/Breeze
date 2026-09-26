// Erasure completeness gate for /api/account/delete.
//
// The handler erases a hardcoded list of user-keyed KV families. The per-family
// tests in worker.test.js pin each deletion — but a NEW family added later
// (say `revoke:${userId}`) silently survives erasure until someone notices the
// residual data months later. This file pins the two halves of that drift:
//
//  1. DYNAMIC — seed every user-keyed family, delete the account with a valid
//     signature, then assert NO remaining KV key names the userId (catch-all —
//     not a per-key list, so any family in the seeded store that was missed
//     fails, including the ones future authors forgot to erase).
//  2. STATIC — snapshot the set of ALL KV key prefixes _worker.js touches, so
//     adding a new family produces a diff a reviewer must acknowledge, and the
//     snapshot sits next to the USER_KEYED list that decides whether it must
//     also be erased.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import worker, { handleAccountDelete } from '../_worker.js';
import { makeKV, makeEnv, apiRequest } from './helpers/mockKV.js';

const toB64 = (b) => Buffer.from(b).toString('base64');
const enc = (s) => new TextEncoder().encode(s);

// Every KV family keyed by the account's own id — add entries here when a new
// per-user family is introduced, and add the erasure to handleAccountDelete in
// the same change (the dynamic test enforces it end to end).
const USER_KEYED = [
  'inbox', 'sealed', 'prekey', 'ktlog',
  'push', 'backup', 'presence', 'slots', 'devices',
];
// Suffix-keyed families (the id is not the whole suffix): sealed:{id}:hwm,
// sealed:{id}:dropped, prekey:otp:{id}:{i} + :count.
const OTP_COUNT = 3;

async function registerUser(env, userId) {
  const ed = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const edPub = toB64(new Uint8Array(await crypto.subtle.exportKey('raw', ed.publicKey)));
  await env.KV.put(`prekey:${userId}`, JSON.stringify({ identityKey: 'IK-' + userId, edIdentityKey: edPub }));
  return ed;
}

const signDelete = async (ed, userId, ts) =>
  toB64(new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, ed.privateKey, enc(`breeze-account-delete:${userId}:${ts}`))));

describe('account/delete erasure completeness', () => {
  it('leaves NO KV key naming the userId after a signed delete (catch-all)', async () => {
    const env = makeEnv();
    const userId = 'wipeall001';
    for (const fam of USER_KEYED) await env.KV.put(`${fam}:${userId}`, 'x');
    const ed = await registerUser(env, userId); // after seeds — registerUser writes prekey:{userId}
    await env.KV.put(`sealed:${userId}:hwm`, 'x');
    await env.KV.put(`sealed:${userId}:dropped`, 'x');
    for (let i = 0; i < OTP_COUNT; i++) await env.KV.put(`prekey:otp:${userId}:${i}`, 'k');
    await env.KV.put(`prekey:otp:${userId}:count`, String(OTP_COUNT));
    await env.KV.put(`slots:${userId}`, JSON.stringify({ slots: 1, customerId: 'cus_wipe1' }));
    await env.KV.put('cust:cus_wipe1', userId);
    // A co-tenant's records must survive untouched.
    await env.KV.put('inbox:otheruser', 'keep');
    await env.KV.put('devices:otheruser', 'keep');

    const ts = Date.now();
    const res = await handleAccountDelete(
      { userId, ts, sig: await signDelete(ed, userId, ts) },
      env, apiRequest('/api/account/delete', {}));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);

    const remaining = [...env.KV.store.keys()].filter((k) => k.includes(userId));
    expect(remaining, `user-linked keys survived erasure: ${remaining.join(', ')}`).toEqual([]);
    expect(await env.KV.get('cust:cus_wipe1')).toBeNull();
    expect(await env.KV.get('inbox:otheruser')).toBe('keep');
    expect(await env.KV.get('devices:otheruser')).toBe('keep');
  });

  it('the erased[] response admits every family the dynamic check covers', async () => {
    const env = makeEnv();
    const userId = 'wipeall002';
    const ed = await registerUser(env, userId);
    await env.KV.put(`slots:${userId}`, JSON.stringify({ customerId: 'cus_wipe2' }));
    const ts = Date.now();
    const res = await handleAccountDelete(
      { userId, ts, sig: await signDelete(ed, userId, ts) },
      env, apiRequest('/api/account/delete', {}));
    const erased = new Set((await res.json()).erased);
    // Reported erasures must cover the static list (cust is conditional on a
    // customerId existing — provided above — so it must appear).
    for (const fam of ['inbox', 'sealed', 'prekey', 'ktlog', 'push', 'backup', 'presence', 'slots', 'devices', 'cust']) {
      expect(erased.has(fam) || erased.has(fam + 's'), `erased[] omits ${fam} — response should enumerate every wiped family`).toBe(true);
    }
  });

  it('snapshot: every KV key prefix in _worker.js (a new family trips review)', () => {
    const src = readFileSync(join(import.meta.dirname, '..', '_worker.js'), 'utf8');
    const prefixes = [...new Set([...src.matchAll(/kv(?:Get|Put|Del)\(env, `([a-z]+):/g)].map((m) => m[1]))].sort();
    expect(prefixes).toMatchInlineSnapshot(`
      [
        "alias",
        "backup",
        "cust",
        "devices",
        "frank",
        "grp",
        "inbox",
        "ktlog",
        "prekey",
        "presence",
        "push",
        "report",
        "sealed",
        "sig",
        "slots",
      ]
    `);
  });
});

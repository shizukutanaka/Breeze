// Recovery plan step 5 — alias signature-mandatory registration +
// activity-linked renewal (docs/IDENTITY_RECOVERY_PLAN.md §4 step 5).
//
// What this pins:
//   1. A signature-verified registration (the default — no flag) writes
//      BOTH the alias record and the reverse record alias-owner:{userId}
//      that renewal and account deletion rely on, each with a ~90-day TTL.
//   2. Verified ordinary activity renews the alias TTL: a presence
//      heartbeat carrying a verified install signature, and a
//      signature-verified prekey upload. UNverified activity (unsigned
//      heartbeat, unsigned upload) never renews.
//   3. Renewal is conservative: it never resurrects an expired record,
//      never extends someone else's handle, drops a stale reverse record
//      whose pub no longer matches, preserves the record content
//      byte-for-byte (setAt included), and is throttled.
//   4. Alias delete and account delete both erase the reverse record;
//      account delete also releases the alias it names even when the
//      client did not pass `alias`.
import { describe, it, expect } from 'vitest';
import {
  handleAliasSet, handleAliasGet, handleAliasDelete, handlePreKeyUpload,
  handlePresence, handleAccountDelete, renewAliasForActivity,
} from '../_worker.js';
import { makeEnv, apiRequest } from './helpers/mockKV.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const toB64 = (bytes) => Buffer.from(bytes).toString('base64');

async function solvePoW(pub, difficulty = 8, challenge) {
  const ch = challenge ?? `${pub}:breeze-test`;
  const target = (2 ** (32 - difficulty)) >>> 0;
  for (let nonce = 0; nonce < 10_000_000; nonce++) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ch}:${nonce}`));
    if (new DataView(d).getUint32(0, false) < target) return { challenge: ch, nonce, difficulty };
  }
  throw new Error('PoW unsolved');
}

async function makeEd() {
  const ed = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const edPub = new Uint8Array(await crypto.subtle.exportKey('raw', ed.publicKey));
  return { ed, edIdentityKey: toB64(edPub) };
}

const signText = async (ed, text) => toB64(new Uint8Array(
  await crypto.subtle.sign({ name: 'Ed25519' }, ed.privateKey, new TextEncoder().encode(text))));

// Seed a registered bundle whose identityKey is `pub` (startsWith(userId),
// as handlePreKeyUpload requires).
async function seedBundle(env, userId, pub, edIdentityKey) {
  await env.KV.put(`prekey:${userId}`, JSON.stringify({ identityKey: pub, edIdentityKey, signedPreKey: 'x' }));
}

// Seed the post-registration state directly: alias record + reverse
// record, both aged so renewal is due (renewedAt 48h ago, alias expiry
// 1h from now).
async function seedAgedAlias(env, userId, pub, alias) {
  const setAt = Date.now() - 89 * DAY_MS;
  await env.KV.put(`alias:${alias}`, JSON.stringify({ pub, name: 'Me', setAt }), { expirationTtl: 3600 });
  await env.KV.put(`alias-owner:${userId}`, JSON.stringify({ alias, pub, renewedAt: Date.now() - 48 * 60 * 60 * 1000 }), { expirationTtl: 3600 });
  return setAt;
}

describe('step 5 — signed registration writes the reverse record', () => {
  it('default env: signed registration stores alias + reverse, both ~90-day TTL', async () => {
    const env = makeEnv();
    const userId = 'step5usr1';
    const pub = userId + '-IK';
    const { ed, edIdentityKey } = await makeEd();
    await seedBundle(env, userId, pub, edIdentityKey);
    const ts = Date.now();
    const res = await handleAliasSet(
      { alias: 'stepfive', pub, userId, ts, sig: await signText(ed, `breeze-alias-set:stepfive:${ts}`), pow: await solvePoW(pub) },
      env, apiRequest('/api/alias/set', {}));
    expect(res.status).toBe(200);
    const before = Date.now();
    const aliasExp = env.KV.exp.get('alias:stepfive');
    expect(aliasExp).toBeGreaterThan(before + 89 * DAY_MS);
    expect(aliasExp).toBeLessThan(before + 91 * DAY_MS);
    const reverse = JSON.parse(await env.KV.get(`alias-owner:${userId}`));
    expect(reverse.alias).toBe('stepfive');
    expect(reverse.pub).toBe(pub);
    expect(typeof reverse.renewedAt).toBe('number');
    const reverseExp = env.KV.exp.get(`alias-owner:${userId}`);
    expect(reverseExp).toBeGreaterThan(before + 89 * DAY_MS);
    expect(reverseExp).toBeLessThan(before + 91 * DAY_MS);
  }, 30000);
});

describe('step 5 — activity-linked renewal', () => {
  it('a presence heartbeat with a VERIFIED install signature renews the alias TTL', async () => {
    const env = makeEnv();
    const userId = 'step5usr2';
    const pub = userId + '-IK';
    const { ed, edIdentityKey } = await makeEd();
    await seedBundle(env, userId, pub, edIdentityKey);
    const setAt = await seedAgedAlias(env, userId, pub, 'presalias');
    const inst = 'install-abc';
    const instSig = await signText(ed, `breeze-inst:${userId}:${inst}`);
    const res = await handlePresence(
      { id: userId, pub, name: 'Me', inst, instSig },
      env, apiRequest('/api/presence', {}));
    expect(res.status).toBe(200);
    // TTL extended back out to ~90 days…
    expect(env.KV.exp.get('alias:presalias')).toBeGreaterThan(Date.now() + 89 * DAY_MS);
    // …with the record content untouched (setAt is NOT laundered).
    const rec = JSON.parse(await env.KV.get('alias:presalias'));
    expect(rec.setAt).toBe(setAt);
    expect(rec.pub).toBe(pub);
    // And the reverse record's renewedAt moved to now.
    const reverse = JSON.parse(await env.KV.get(`alias-owner:${userId}`));
    expect(Date.now() - reverse.renewedAt).toBeLessThan(60 * 1000);
  });

  it('an UNSIGNED presence heartbeat does not renew', async () => {
    const env = makeEnv();
    const userId = 'step5usr3';
    const pub = userId + '-IK';
    const { edIdentityKey } = await makeEd();
    await seedBundle(env, userId, pub, edIdentityKey);
    await seedAgedAlias(env, userId, pub, 'quietalias');
    const expBefore = env.KV.exp.get('alias:quietalias');
    const res = await handlePresence(
      { id: userId, pub, name: 'Me' },
      env, apiRequest('/api/presence', {}));
    expect(res.status).toBe(200);
    expect(env.KV.exp.get('alias:quietalias')).toBe(expBefore);
  });

  it('a presence heartbeat with a FORGED install signature does not renew', async () => {
    const env = makeEnv();
    const userId = 'step5usr4';
    const pub = userId + '-IK';
    const { edIdentityKey } = await makeEd();
    const stranger = await makeEd();
    await seedBundle(env, userId, pub, edIdentityKey);
    await seedAgedAlias(env, userId, pub, 'forgedalias');
    const expBefore = env.KV.exp.get('alias:forgedalias');
    const inst = 'install-xyz';
    const instSig = await signText(stranger.ed, `breeze-inst:${userId}:${inst}`);
    const res = await handlePresence(
      { id: userId, pub, name: 'Me', inst, instSig },
      env, apiRequest('/api/presence', {}));
    expect(res.status).toBe(200); // heartbeat itself still lands; only renewal is withheld
    expect(env.KV.exp.get('alias:forgedalias')).toBe(expBefore);
  });

  // Replicates the Worker's sha256Short (16-byte hex of SHA-256).
  async function digestFields(...fields) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(fields)));
    return Array.from(new Uint8Array(buf)).slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function signedUpload(env, userId, pub, ed, edIdentityKey) {
    const spk = crypto.getRandomValues(new Uint8Array(32));
    const signedPreKey = toB64(spk);
    const signedPreKeySig = toB64(new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, ed.privateKey, spk)));
    const body = { userId, identityKey: pub, edIdentityKey, signedPreKey, signedPreKeySig, oneTimePreKeys: [] };
    const ts = Date.now();
    const digest = await digestFields(pub, edIdentityKey, signedPreKey, signedPreKeySig, [], [], '');
    body.ts = ts;
    body.sig = await signText(ed, `breeze-prekey-upload:${userId}:${ts}:${digest}`);
    return handlePreKeyUpload(body, env, apiRequest('/api/prekey/upload', {}));
  }

  it('a signature-verified prekey upload renews the alias TTL', async () => {
    const env = makeEnv();
    const userId = 'step5usr5';
    const pub = userId + '-IK';
    const { ed, edIdentityKey } = await makeEd();
    await seedBundle(env, userId, pub, edIdentityKey);
    await seedAgedAlias(env, userId, pub, 'upalias');
    const res = await signedUpload(env, userId, pub, ed, edIdentityKey);
    expect(res.status).toBe(200);
    expect(env.KV.exp.get('alias:upalias')).toBeGreaterThan(Date.now() + 89 * DAY_MS);
  });

  it('an UNSIGNED prekey upload does not renew', async () => {
    const env = makeEnv();
    const userId = 'step5usr6';
    const pub = userId + '-IK';
    const { edIdentityKey } = await makeEd();
    await seedBundle(env, userId, pub, edIdentityKey);
    await seedAgedAlias(env, userId, pub, 'noupalias');
    const expBefore = env.KV.exp.get('alias:noupalias');
    const spk = crypto.getRandomValues(new Uint8Array(32));
    const res = await handlePreKeyUpload(
      { userId, identityKey: pub, edIdentityKey, signedPreKey: toB64(spk), oneTimePreKeys: [] },
      env, apiRequest('/api/prekey/upload', {}));
    expect(res.status).toBe(200);
    expect(env.KV.exp.get('alias:noupalias')).toBe(expBefore);
  });
});

describe('step 5 — renewAliasForActivity guard rails', () => {
  it('never resurrects an expired alias record', async () => {
    const env = makeEnv();
    const userId = 'step5usr7';
    const pub = userId + '-IK';
    await env.KV.put(`alias-owner:${userId}`, JSON.stringify({ alias: 'gonealias', pub, renewedAt: Date.now() - 48 * 60 * 60 * 1000 }));
    expect(await renewAliasForActivity(env, userId, pub)).toBe(false);
    expect(await env.KV.get('alias:gonealias')).toBeNull();
  });

  it("never extends someone else's handle (alias record pub differs)", async () => {
    const env = makeEnv();
    const userId = 'step5usr8';
    const pub = userId + '-IK';
    await env.KV.put('alias:otheralias', JSON.stringify({ pub: 'SOMEONE-ELSE', name: 'X', setAt: 1 }), { expirationTtl: 3600 });
    await env.KV.put(`alias-owner:${userId}`, JSON.stringify({ alias: 'otheralias', pub, renewedAt: Date.now() - 48 * 60 * 60 * 1000 }));
    const expBefore = env.KV.exp.get('alias:otheralias');
    expect(await renewAliasForActivity(env, userId, pub)).toBe(false);
    expect(env.KV.exp.get('alias:otheralias')).toBe(expBefore);
  });

  it('drops a stale reverse record whose pub no longer matches the activity', async () => {
    const env = makeEnv();
    const userId = 'step5usr9';
    await env.KV.put(`alias-owner:${userId}`, JSON.stringify({ alias: 'stalealias', pub: 'OLD-PUB', renewedAt: 0 }));
    expect(await renewAliasForActivity(env, userId, 'NEW-PUB')).toBe(false);
    expect(await env.KV.get(`alias-owner:${userId}`)).toBeNull();
  });

  it('is throttled: a second renewal inside the interval is a no-op', async () => {
    const env = makeEnv();
    const userId = 'step5usra';
    const pub = userId + '-IK';
    await seedAgedAlias(env, userId, pub, 'throttled');
    expect(await renewAliasForActivity(env, userId, pub)).toBe(true);
    // Age the alias again; a fresh renewal is still inside the 24h
    // persisted interval (and the isolate check cache), so nothing moves.
    await env.KV.put('alias:throttled', JSON.stringify({ pub, name: 'Me', setAt: 1 }), { expirationTtl: 3600 });
    const expBefore = env.KV.exp.get('alias:throttled');
    expect(await renewAliasForActivity(env, userId, pub)).toBe(false);
    expect(env.KV.exp.get('alias:throttled')).toBe(expBefore);
  });
});

describe('step 5 — reverse record cleanup on delete paths', () => {
  it('alias delete erases the reverse record', async () => {
    const env = makeEnv();
    const userId = 'step5usrb';
    const pub = userId + '-IK';
    const { ed, edIdentityKey } = await makeEd();
    await seedBundle(env, userId, pub, edIdentityKey);
    await env.KV.put('alias:delalias', JSON.stringify({ pub, name: 'Me', setAt: Date.now() }));
    await env.KV.put(`alias-owner:${userId}`, JSON.stringify({ alias: 'delalias', pub, renewedAt: Date.now() }));
    const ts = Date.now();
    const res = await handleAliasDelete(
      { alias: 'delalias', userId, ts, sig: await signText(ed, `breeze-alias-delete:delalias:${ts}`) },
      env, apiRequest('/api/alias/delete', {}));
    expect(res.status).toBe(200);
    expect((await res.json()).removed).toBe(true);
    expect(await env.KV.get('alias:delalias')).toBeNull();
    expect(await env.KV.get(`alias-owner:${userId}`)).toBeNull();
  });

  it('account delete releases the reverse-named alias and erases the reverse record (no `alias` param)', async () => {
    const env = makeEnv();
    const userId = 'step5usrc';
    const pub = userId + '-IK';
    const { ed, edIdentityKey } = await makeEd();
    await seedBundle(env, userId, pub, edIdentityKey);
    await env.KV.put('alias:acctalias', JSON.stringify({ pub, name: 'Me', setAt: Date.now() }));
    await env.KV.put(`alias-owner:${userId}`, JSON.stringify({ alias: 'acctalias', pub, renewedAt: Date.now() }));
    const ts = Date.now();
    const res = await handleAccountDelete(
      { userId, ts, sig: await signText(ed, `breeze-account-delete:${userId}:${ts}`) },
      env, apiRequest('/api/account/delete', {}));
    expect(res.status).toBe(200);
    expect(await env.KV.get('alias:acctalias')).toBeNull();
    expect(await env.KV.get(`alias-owner:${userId}`)).toBeNull();
  });
});

// Data principle (owner decision, 2026-11-14): the creator holds no user
// data. The estate-wide data inventory (データ台帳) found Breeze's default
// relay in breach on the operator side; this file pins the corrections:
//
//   Worker (the real _worker.js handlers, mock KV):
//   1. Cloud backup storage is OFF by default: /api/backup/upload and
//      /api/backup/download refuse with BACKUP_DISABLED — nothing is
//      stored, and an already-stored blob is not served — unless the
//      operator explicitly opts in with BACKUP_STORAGE_ENABLED=true
//      (a relay run for the operator's own accounts). Only the exact
//      string 'true' opts in.
//   2. @alias records carry a 90-day TTL: a lapsed handle no longer
//      resolves and can be claimed by someone else; the owner's own
//      re-registration refreshes the TTL; an unlapsed handle still
//      refuses a different claimant (ALIAS_TAKEN).
//
//   Client (the real index.html functions, sliced):
//   3. A disposable identity (recoveryMode 'none') is refused BOTH
//      backup producers (file + cloud) with the dedicated toast —
//      the recovery-kit guard's doctrine extended to backups, which
//      settles the open question the disposable-mode outcome left.
//   4. A relay's BACKUP_DISABLED refusal is surfaced with its own
//      message on both cloud paths (upload + restore), never folded
//      into the generic "backup failed".
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleBackupUpload, handleBackupDownload, handleAliasSet, handleAliasGet } from '../_worker.js';
import { makeEnv, apiRequest } from './helpers/mockKV.js';

// Solve a difficulty-N PoW puzzle (the worker.test.js helper; tests run
// at difficulty 8 via makeEnv's MIN_POW_DIFFICULTY).
async function solvePoW(pub, difficulty = 8, challenge) {
  const ch = challenge ?? `${pub}:breeze-test`;
  const target = (2 ** (32 - difficulty)) >>> 0;
  for (let nonce = 0; nonce < 10_000_000; nonce++) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ch}:${nonce}`));
    if (new DataView(d).getUint32(0, false) < target) return { challenge: ch, nonce, difficulty };
  }
  throw new Error('PoW unsolved');
}

const upReq = (b) => apiRequest('/api/backup/upload', b);
const dlReq = (b) => apiRequest('/api/backup/download', b);
const DAY_MS = 86400 * 1000;

describe('cloud backup storage gate (BACKUP_STORAGE_ENABLED, default off)', () => {
  it('upload is refused by default and stores nothing', async () => {
    const e = makeEnv();
    const res = await handleBackupUpload({ userId: 'user00001', backup: 'blob' }, e, upReq({}));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('BACKUP_DISABLED');
    expect(await e.KV.get('backup:user00001')).toBeNull();
  });

  it('download is refused by default even when a blob is already stored', async () => {
    const e = makeEnv();
    await e.KV.put('backup:user00001', 'preexisting-blob');
    const res = await handleBackupDownload({ userId: 'user00001' }, e, dlReq({}));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('BACKUP_DISABLED');
  });

  it("only the exact string 'true' opts in ('false' and '1' still refuse)", async () => {
    for (const v of ['false', '1']) {
      const e = makeEnv({ BACKUP_STORAGE_ENABLED: v });
      const res = await handleBackupUpload({ userId: 'user00001', backup: 'blob' }, e, upReq({}));
      expect(res.status, `value ${v}`).toBe(403);
      expect((await res.json()).code).toBe('BACKUP_DISABLED');
    }
  });

  it('opt-in restores the round trip, with the 90-day retention on the record', async () => {
    const e = makeEnv({ BACKUP_STORAGE_ENABLED: 'true' });
    const before = Date.now();
    const up = await handleBackupUpload({ userId: 'user00001', backup: 'blob' }, e, upReq({}));
    expect(up.status).toBe(200);
    const exp = e.KV.exp.get('backup:user00001');
    expect(exp, 'stored backup carries an expiry').toBeGreaterThan(before + 89 * DAY_MS);
    expect(exp).toBeLessThan(Date.now() + 91 * DAY_MS);
    const dl = await handleBackupDownload({ userId: 'user00001' }, e, dlReq({}));
    expect(dl.status).toBe(200);
    expect((await dl.json()).backup).toBe('blob');
  });
});

describe('@alias TTL (90 days — dead handles recycle)', () => {
  const req = (b) => apiRequest('/api/alias/set', b);
  const PUB_A = 'PUBKEY_OWNER_A';
  const PUB_B = 'PUBKEY_OTHER_B';

  it('registration stores the record WITH a ~90-day expiry', async () => {
    const e = makeEnv();
    const before = Date.now();
    const pow = await solvePoW(PUB_A);
    const res = await handleAliasSet({ alias: 'alice', pub: PUB_A, name: 'Alice', pow }, e, req({}));
    expect(res.status).toBe(200);
    const exp = e.KV.exp.get('alias:alice');
    expect(exp, 'alias record must expire (was: no TTL, permanent)').toBeTypeOf('number');
    expect(exp).toBeGreaterThan(before + 89 * DAY_MS);
    expect(exp).toBeLessThan(Date.now() + 91 * DAY_MS);
  });

  it('an unlapsed handle still refuses a different claimant', async () => {
    const e = makeEnv();
    const powA = await solvePoW(PUB_A);
    await handleAliasSet({ alias: 'alice', pub: PUB_A, pow: powA }, e, req({}));
    const powB = await solvePoW(PUB_B);
    const res = await handleAliasSet({ alias: 'alice', pub: PUB_B, pow: powB }, e, req({}));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('ALIAS_TAKEN');
  });

  it('the owner re-registering refreshes the TTL', async () => {
    const e = makeEnv();
    const pow = await solvePoW(PUB_A);
    await handleAliasSet({ alias: 'alice', pub: PUB_A, pow }, e, req({}));
    const first = e.KV.exp.get('alias:alice');
    e.KV.exp.set('alias:alice', Date.now() + 1000); // nearly lapsed
    const pow2 = await solvePoW(PUB_A);
    const res = await handleAliasSet({ alias: 'alice', pub: PUB_A, pow: pow2 }, e, req({}));
    expect(res.status).toBe(200);
    expect(e.KV.exp.get('alias:alice')).toBeGreaterThan(first);
  });

  it('after expiry the handle stops resolving and someone else can claim it', async () => {
    const e = makeEnv();
    const powA = await solvePoW(PUB_A);
    await handleAliasSet({ alias: 'alice', pub: PUB_A, pow: powA }, e, req({}));
    // Advance the clock the mock way: write a past expiry.
    e.KV.exp.set('alias:alice', Date.now() - 1);
    expect(await e.KV.get('alias:alice')).toBeNull();
    const get = await handleAliasGet({ alias: 'alice' }, e, apiRequest('/api/alias/get', {}));
    expect((await get.json()).pub ?? null).toBeNull();
    const powB = await solvePoW(PUB_B);
    const res = await handleAliasSet({ alias: 'alice', pub: PUB_B, pow: powB }, e, req({}));
    expect(res.status).toBe(200);
    const rec = JSON.parse(await e.KV.get('alias:alice'));
    expect(rec.pub).toBe(PUB_B);
  });
});

// ── Client: sliced real functions from index.html ─────────────────────
const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
const ja = JSON.parse(readFileSync(join(HERE, '..', 'locales', 'ja.json'), 'utf8'));

function slice(from, to) {
  const a = html.indexOf(from);
  const b = html.indexOf(to);
  expect(a, `anchor not found: ${from}`).toBeGreaterThan(-1);
  expect(b, `anchor not found: ${to}`).toBeGreaterThan(a);
  return html.slice(a, b);
}
const backupMod = readFileSync(join(HERE, '..', 'src', 'app', 'backup.js'), 'utf8');
function sliceBackup(from, to) {
  const a = backupMod.indexOf(from);
  const b = backupMod.indexOf(to);
  expect(a, `anchor not found in src/app/backup.js: ${from}`).toBeGreaterThan(-1);
  expect(b, `anchor not found in src/app/backup.js: ${to}`).toBeGreaterThan(a);
  return backupMod.slice(a, b);
}


describe("disposable ('none') identities are refused both backup producers", () => {
  function buildBackupToFile(identity) {
    const calls = { toasts: [], prompts: 0, downloads: 0 };
    const src = sliceBackup('async function backupToFile()', 'function restoreFromFilePicker()');
    const factory = new Function('dbGet', 'dbGetAll', 'showToast', 't', 'showPrompt',
      '_collectBackupKeyMaterial', 'encrypt', 'downloadBlob', 'BACKUP_FORMAT_V',
      src + '; return { backupToFile };');
    const api = factory(
      async () => identity, async () => [],
      (msg, type) => calls.toasts.push({ msg, type }), (k) => k,
      async () => { calls.prompts++; return null; },
      async () => null, async () => ({}), () => { calls.downloads++; }, 2,
    );
    return { ...api, calls };
  }

  it('file backup: refused with the dedicated toast, before any prompt', async () => {
    const { backupToFile, calls } = buildBackupToFile({ pubB64: 'x', recoveryMode: 'none' });
    await backupToFile();
    expect(calls.toasts).toEqual([{ msg: 'toastRecoveryNoneBackup', type: 'error' }]);
    expect(calls.prompts).toBe(0);
    expect(calls.downloads).toBe(0);
  });

  it('file backup: a phrase identity still reaches the passphrase prompt (control)', async () => {
    const { backupToFile, calls } = buildBackupToFile({ pubB64: 'x', recoveryMode: 'phrase' });
    await backupToFile();
    expect(calls.prompts).toBe(1);
    expect(calls.toasts.map(x => x.msg)).not.toContain('toastRecoveryNoneBackup');
  });

  function buildCreateCloudBackup(identity, relayResp) {
    const calls = { toasts: [], prompts: 0 };
    const src = sliceBackup('async function createCloudBackup()', 'async function restoreCloudBackup()');
    const factory = new Function('dbGet', 'dbGetAll', 'showToast', 't', 'showPrompt',
      '_collectBackupKeyMaterial', 'CONFIG', 'arr', 'signMessage', 'postAPIRelay', 'homeRelays', 'D', '_dbg', 'API', 'BACKUP_FORMAT_V',
      src + '; return { createCloudBackup };');
    const api = factory(
      async () => identity, async () => [],
      (msg, type) => calls.toasts.push({ msg, type }), (k) => k,
      async () => { calls.prompts++; return 'passphrase-1'; },
      async () => null,
      { PROTOCOL_VERSION: 3, IV_BYTES: 12, PBKDF2_AT_REST_ITERATIONS: 1000, AES_KEY_BITS: 256 },
      (u8a) => [...u8a], async () => 'sig', async () => relayResp,
      () => [{ url: 'https://relay.test' }], { myId: () => 'user00001' }, () => {}, 'https://api.test', 2,
    );
    return { ...api, calls };
  }

  it('cloud backup: refused with the dedicated toast, before any prompt', async () => {
    const { createCloudBackup, calls } = buildCreateCloudBackup({ recoveryMode: 'none' }, null);
    await createCloudBackup();
    expect(calls.toasts).toEqual([{ msg: 'toastRecoveryNoneBackup', type: 'error' }]);
    expect(calls.prompts).toBe(0);
  });

  it('cloud backup: a BACKUP_DISABLED relay is named, not folded into "backup failed"', async () => {
    const relayResp = { ok: false, json: async () => ({ code: 'BACKUP_DISABLED' }) };
    const { createCloudBackup, calls } = buildCreateCloudBackup({ recoveryMode: 'phrase' }, relayResp);
    await createCloudBackup();
    expect(calls.toasts.map(x => x.msg)).toContain('backupRelayDisabled');
    expect(calls.toasts.map(x => x.msg)).not.toContain('backupFailed');
  });

  it('cloud backup: any other relay failure stays the generic message (control)', async () => {
    const relayResp = { ok: false, json: async () => ({ code: 'STORE_FAILED' }) };
    const { createCloudBackup, calls } = buildCreateCloudBackup({ recoveryMode: 'phrase' }, relayResp);
    await createCloudBackup();
    expect(calls.toasts.map(x => x.msg)).toContain('backupFailed');
    expect(calls.toasts.map(x => x.msg)).not.toContain('backupRelayDisabled');
  });
});

describe('cloud restore names a BACKUP_DISABLED relay', () => {
  function buildRestore(relayResp) {
    const calls = { toasts: [] };
    const src = sliceBackup('async function restoreCloudBackup()', '// ===== Backup & Restore (module end)');
    const factory = new Function('showPrompt', 'showToast', 't', 'signMessage', 'postAPIRelay',
      'homeRelays', 'D', '_dbg', 'dbPut', '_restoreBackupKeyMaterial', 'CONFIG', 'u8', 'setTimeout',
      src + '; return { restoreCloudBackup };');
    const api = factory(
      async () => 'passphrase-1',
      (msg, type) => calls.toasts.push({ msg, type }), (k) => k,
      async () => 'sig', async () => relayResp,
      () => [{ url: 'https://relay.test' }], { myId: () => 'user00001' }, () => {},
      async () => {}, async () => {}, {}, (a) => new Uint8Array(a), () => {},
    );
    return { ...api, calls };
  }

  it('restore: BACKUP_DISABLED is surfaced with its own message', async () => {
    const { restoreCloudBackup, calls } = buildRestore({ ok: false, json: async () => ({ code: 'BACKUP_DISABLED' }) });
    await restoreCloudBackup();
    expect(calls.toasts.map(x => x.msg)).toContain('backupRelayDisabled');
    expect(calls.toasts.map(x => x.msg)).not.toContain('backupFailed');
  });

  it('restore: a 404 stays the generic message (control)', async () => {
    const { restoreCloudBackup, calls } = buildRestore({ ok: false, json: async () => ({ code: 'NOT_FOUND' }) });
    await restoreCloudBackup();
    expect(calls.toasts.map(x => x.msg)).toContain('backupFailed');
  });
});

describe('i18n: the new keys exist in EN and JA', () => {
  it('EN keys are in index.html and JA keys in locales/ja.json', () => {
    for (const k of ['backupRelayDisabled', 'toastRecoveryNoneBackup']) {
      expect(html, `EN key ${k}`).toContain(`${k}:`);
      expect(ja[k], `JA key ${k}`).toBeTypeOf('string');
      expect(ja[k].length).toBeGreaterThan(0);
    }
  });
});

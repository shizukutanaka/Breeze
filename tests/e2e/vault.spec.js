import { test, expect } from '@playwright/test';
import { createIdentity, openAddContact } from './helpers.mjs';

const PASS = 'a separate strong vault passphrase';
async function harness(page) {
  await page.goto('/manifest.json');
  await page.evaluate(async pass => {
    const V = await import('/src/app/vault.js');
    const request = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const open = name => request(indexedDB.open(name));
    const done = tx => new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error || new Error('abort')); });
    const rows = async name => { const db = await open(name), tx = db.transaction('identity'), os = tx.objectStore('identity'); const [keys, values] = await Promise.all([request(os.getAllKeys()), request(os.getAll())]); db.close(); return Object.fromEntries(keys.map((k, i) => [k, values[i]])); };
    const make = (options = {}) => V.createVaultRuntime({ accounts: () => [], gate: unlock => unlock(pass), reload: () => {}, dbg: () => {}, quiesce: () => {}, ...options });
    window.VT = { V, pass, request, open, done, rows, make };
  }, PASS);
}

test('native IDB vault migration, encrypted enumeration/rotation, password rewrap and file restore', async ({ page, browser }) => {
  test.setTimeout(90_000);
  await harness(page);
  const backup = await page.evaluate(async () => {
    const { V, pass, request, open, done, rows, make } = VT;
    const older = indexedDB.open('breeze-acc-older', 5);
    older.onupgradeneeded = () => older.result.createObjectStore('identity');
    const olderDb = await request(older);
    await V.atomicVaultRows(olderDb, [['keys', { priv: { d: 'older-private' } }]], null); olderDb.close();
    const r = make(); await r.boot();
    const raw = await open('breeze-messenger');
    await V.atomicVaultRows(raw, [
      ['keys', { priv: { d: 'identity' }, pubB64: 'public' }], ['signing', { priv: { d: 'sign' } }],
      ['sess:alice', { chain: new Uint8Array([1, 2]), counter: 4 }], ['gsk:g', { chain: new Uint32Array([9, 8]) }],
      ['gsk-peer:g:a', { key: [4, 5] }], ['pq-priv', { seed: new Uint8Array(64) }],
      ['verify:peer', { binding: 'both-key-digest', verified: true, method: 'safety-number', at: 123 }],
    ], null);
    raw.close();
    await r.change(pass, true);
    const migratedOlder = await open('breeze-acc-older');
    if (migratedOlder.version !== 5) throw new Error('vault bumped account schema');
    migratedOlder.close();
    const unlocked = make(); await unlocked.boot();
    const db = await unlocked.database(await open('breeze-messenger'));
    const get = k => request(db.transaction('identity').objectStore('identity').get(k));
    if ((await get('sess:alice')).chain.constructor.name !== 'Uint8Array') throw new Error('typed chain lost');
    const all = await request(db.transaction('identity').objectStore('identity').getAll());
    if (!all.some(v => v.pubB64 === 'public')) throw new Error('enumeration not opened');
    await unlocked.prekeys(db, { d: 'rotated' }, [{ d: 'otp' }], { seed: new Uint8Array(64).fill(7) });
    const before = await rows('breeze-messenger');
    for (const [opaque, value] of Object.entries(before)) {
      if (value.vaultV !== 1 || value.priv || value.seed) throw new Error('plaintext leak: ' + opaque);
    }
    if (Object.keys(before).some(k => /^(keys|signing|sess:|gsk:)/.test(k))) throw new Error('primary key leak');
    const aborted = db.transaction('identity', 'readwrite'), abortedDone = done(aborted);
    aborted.objectStore('identity').put({ priv: 'must-not-commit' }, 'keys'); aborted.abort();
    await abortedDone.catch(() => {});
    if (JSON.stringify(await rows('breeze-messenger')) !== JSON.stringify(before)) throw new Error('abort changed identity');
    const backup = await unlocked.backup(); db.close();
    await unlocked.password(pass, pass + ' changed');
    if (JSON.stringify(await rows('breeze-messenger')) !== JSON.stringify(before)) throw new Error('password rewrote records');
    return backup;
  });
  const context = await browser.newContext(), restoredPage = await context.newPage();
  await harness(restoredPage);
  const result = await restoredPage.evaluate(async backup => {
    const { make, pass, open, request } = VT;
    const r = make(); await r.boot();
    const missing = structuredClone(backup); missing.accounts[0].snapshot.stores.find(([name]) => name === 'identity')[1].pop();
    let refused = false;
    try { await r.restore(missing, pass); } catch { refused = true; }
    if (!refused) throw new Error('incomplete backup accepted');
    try { await r.restore(backup, 'wrong passphrase'); throw new Error('wrong password accepted'); } catch (e) { if (e.message === 'wrong password accepted') throw e; }
    await r.restore(backup, pass);
    const next = make(); await next.boot();
    const db = await next.database(await open('breeze-messenger'));
    const rec = await request(db.transaction('identity').objectStore('identity').get('sess:alice')); db.close();
    let denied = false;
    try { await next.change('wrong passphrase', false); } catch { denied = true; }
    if (!denied) throw new Error('unauthenticated disable accepted');
    await next.change(pass, false);
    const plain = await VT.rows('breeze-messenger');
    if (plain.keys.vaultV || plain['vault:manifest'] || !plain.keys.priv) throw new Error('disable not complete');
    return { typed: rec.chain.constructor.name, bytes: [...rec.chain], counter: rec.counter };
  }, backup);
  expect(result).toEqual({ typed: 'Uint8Array', bytes: [1, 2], counter: 4 });
  await context.close();
});

test('legacy-keywrap migration journals survive an injected second-account crash', async ({ page }) => {
  test.setTimeout(90_000);
  await harness(page);
  const result = await page.evaluate(async () => {
    const { V, pass, request, open, done, rows, make } = VT;
    const r = make({ t: key => key, prompt: async () => pass + ' other account' }); await r.boot();
    const b64 = v => btoa(String.fromCharCode(...new Uint8Array(v)));
    const wrapped = async (priv, password) => {
      const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
      const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
      const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode('breeze-atrest-v1:keys') }, key, new TextEncoder().encode(JSON.stringify(priv)));
      return { pubB64: 'public', wrapped: { kdf: 'pbkdf2', iter: 600000, salt: b64(salt), iv: b64(iv), ct: b64(ct) } };
    };
    const db = await open('breeze-messenger');
    await V.atomicVaultRows(db, [['keys', await wrapped({ d: 'legacy-private' }, pass)]], null); db.close();
    const create = indexedDB.open('breeze-acc-test', 6);
    create.onupgradeneeded = () => create.result.createObjectStore('identity');
    const other = await request(create); await V.atomicVaultRows(other, [['keys', await wrapped({ d: 'other' }, pass + ' other account')]], null); other.close();
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value, key) {
      if (this.transaction.db.name === 'breeze-acc-test' && key === 'vault:manifest') throw new Error('injected account crash');
      return put.call(this, value, key);
    };
    let failed = false;
    try { await r.change(pass, true, pass); } catch { failed = true; }
    finally { IDBObjectStore.prototype.put = put; }
    const partial = await rows('breeze-messenger'), untouched = await rows('breeze-acc-test');
    const control = await open('breeze-vault');
    const journal = await request(control.transaction('meta').objectStore('meta').get('state'));
    const pending = make(); pending.boot();
    for (let i = 0; i < 100; i++) {
      const state = await request(control.transaction('meta').objectStore('meta').get('state'));
      if (state.phase === 'ready') break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    control.close();
    const resumed = make(); await resumed.boot();
    const main = await resumed.database(await open('breeze-messenger'));
    const restored = await request(main.transaction('identity').objectStore('identity').get('keys')); main.close();
    const second = await rows('breeze-acc-test');
    const otherDb = await resumed.database(await open('breeze-acc-test'));
    const otherKey = await request(otherDb.transaction('identity').objectStore('identity').get('keys')); otherDb.close();
    return { failed, phase: journal.phase, partial: partial['vault:manifest'].vaultV, untouched: !!untouched.keys.wrapped, restored: restored.priv.d, second: [second['vault:manifest'].vaultV, otherKey.priv.d] };
  });
  expect(result).toEqual({ failed: true, phase: 'enabling', partial: 1, untouched: true, restored: 'legacy-private', second: [1, 'other'] });
});

test('enable → cross-tab lock → reload → unlock → message; locked quick reply is dropped', async ({ browser }) => {
  test.setTimeout(120_000);
  const aCtx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.171' } });
  const bCtx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.172' } });
  const A = await aCtx.newPage(), B = await bCtx.newPage();
  const alice = await createIdentity(A, 'Vault Alice'), bob = await createIdentity(B, 'Vault Bob');
  const add = async (page, pub) => {
    await openAddContact(page); const panel = page.locator('dialog[open] .add-form-contact');
    await panel.locator('.modal-input').fill(pub); await panel.locator('button.btn-g').click();
    await page.locator('#msg-contacts .contact:not(.self-card)').click();
  };
  await add(A, bob); await add(B, alice);
  await A.locator('#msg-input').fill('/vault enable'); await A.locator('#msg-input').press('Enter');
  await A.locator('dialog[open] button[value="ok"]').click();
  for (const value of [PASS, PASS, '']) {
    await A.locator('dialog[open] .modal-input').fill(value); await A.locator('dialog[open] button[value="ok"]').click();
  }
  await expect(A.locator('#vault-gate')).toBeVisible();
  const unlock = async page => { await page.locator('#vault-gate input').fill(PASS); await page.locator('#vault-gate button').click(); await expect(page.locator('#vault-gate')).toHaveCount(0); await expect(page.locator('#msg-main')).toBeVisible(); };
  await unlock(A);
  const tab = await aCtx.newPage(); await tab.goto('/'); await expect(tab.locator('#vault-gate')).toBeVisible(); await unlock(tab);
  await A.locator('#msg-input').fill('/vault lock'); await A.locator('#msg-input').press('Enter');
  await expect(A.locator('#vault-gate')).toBeVisible(); await expect(tab.locator('#vault-gate')).toBeVisible();
  await A.evaluate(id => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'quick-reply', contactId: id, text: 'DENIED VAULT REPLY' } })), bob.slice(0, 12));
  await A.reload(); await expect(A.locator('#vault-gate')).toBeVisible();
  await unlock(A);
  await A.locator('#msg-contacts .contact:not(.self-card)').click();
  await A.locator('#msg-input').fill('vault unlocked message'); await A.locator('#b-msg-send').click();
  await expect(B.locator('#msg-messages')).toContainText('vault unlocked message', { timeout: 20_000 });
  await expect(B.locator('#msg-messages')).not.toContainText('DENIED VAULT REPLY');
  await aCtx.close(); await bCtx.close();
});

test('missing vault module never reaches identity creation', async ({ page }) => {
  await page.route('**/src/app/vault.js', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#msg-name')).toBeHidden();
  expect(await page.evaluate(async () => (await indexedDB.databases()).some(db => db.name === 'breeze-messenger'))).toBe(false);
});

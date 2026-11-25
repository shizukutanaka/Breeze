import { expect, test } from '@playwright/test';

async function harness(page) {
  await page.goto('/manifest.json');
  await page.evaluate(async () => {
    const V = await import('/src/app/vault.js'), H = await import('/src/app/vault-history.js');
    const pass = 'a separate strong vault passphrase';
    const request = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const done = tx => new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error || new Error('abort')); });
    const open = name => request(indexedDB.open(name));
    const make = (options = {}) => V.createVaultRuntime({ accounts: () => [], gate: unlock => unlock(pass), reload: () => {}, dbg: () => {}, quiesce: () => {}, ...options });
    const seed = async name => {
      const db = await open(name), tx = db.transaction(['identity', 'contacts', 'messages'], 'readwrite'), completed = done(tx);
      tx.objectStore('identity').put({ priv: { d: 'private-identity' } }, 'keys');
      tx.objectStore('identity').put({ key: 'private-local-message-key' }, 'msgkey');
      tx.objectStore('contacts').put({ id: 'private-peer', name: 'private-contact' });
      tx.objectStore('messages').put({ msgId: 'private-message-id', contactId: 'private-peer', text: 'private-body', fileData: 'private-file' });
      await completed; db.close();
    };
    const resumed = () => new Promise((resolve, reject) => { make({ reload: resolve }).boot().catch(reject); });
    window.LT = { V, H, pass, request, done, open, make, seed, resumed };
  });
}

test('history lifecycle enables, exports only ciphertext, disables and restores all stores', async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async () => {
    const { H, pass, request, open, make, seed } = LT;
    const initial = make(); await initial.boot(); await seed('breeze-messenger');
    await initial.change(pass, true);
    const unlocked = make(); await unlocked.boot();
    const backup = await unlocked.backup();
    if (JSON.stringify(backup).includes('private-')) throw new Error('plaintext export');
    const key = await LT.V.unlockVault(backup.manifest, pass);
    const codec = { open: (...args) => LT.V.openVaultRecord(key, backup.manifest, ...args) };
    const db = await open('breeze-messenger');
    const opened = await H.inspectHistory(db, backup.accounts[0].snapshot, codec); db.close();
    let wrong = false; try { await unlocked.change('wrong passphrase', false); } catch { wrong = true; }
    if (!wrong) throw new Error('unauthenticated disable');
    await unlocked.change(pass, false);
    const plainDb = await open('breeze-messenger');
    const plain = await request(plainDb.transaction('messages').objectStore('messages').get('private-message-id')); plainDb.close();
    await request(indexedDB.deleteDatabase('breeze-messenger'));
    const empty = make(); await empty.boot();
    const broken = structuredClone(backup); broken.accounts[0].snapshot.stores.find(([name]) => name === 'messages')[1].pop();
    let rejected = false; try { await empty.restore(broken, pass); } catch { rejected = true; }
    if (!rejected) throw new Error('missing encrypted row accepted');
    await empty.restore(backup, pass);
    const restored = make(); await restored.boot(); const again = await restored.backup();
    return { historyV: backup.manifest.historyV, stores: opened.stores.size, plain: plain.text, restored: again.accounts[0].snapshot.stores.length };
  });
  expect(result).toEqual({ historyV: 2, stores: 6, plain: 'private-body', restored: 6 });
});

test('authenticated history journal recovers an interrupted atomic account commit', async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async () => {
    const { pass, request, open, make, seed, resumed } = LT;
    const initial = make(); await initial.boot(); await seed('breeze-messenger');
    const put = IDBObjectStore.prototype.put;
    let injected = false;
    IDBObjectStore.prototype.put = function(value, ...args) {
      if (!injected && this.transaction.db.name === 'breeze-messenger' && this.name === 'messages' && value?.vaultV) { injected = true; throw new Error('injected account crash'); }
      return put.call(this, value, ...args);
    };
    try { await initial.change(pass, true); throw new Error('injection missed'); }
    catch (e) { if (e.message !== 'injected account crash') throw e; }
    finally { IDBObjectStore.prototype.put = put; }
    const db = await open('breeze-messenger');
    const before = await request(db.transaction('messages').objectStore('messages').get('private-message-id')); db.close();
    if (before.text !== 'private-body') throw new Error('account transaction partially committed');
    await resumed();
    const next = make(); await next.boot(); const backup = await next.backup();
    return { injected, phase: backup.manifest.phase, historyV: backup.manifest.historyV, leaked: JSON.stringify(backup).includes('private-') };
  });
  expect(result).toEqual({ injected: true, phase: 'ready', historyV: 2, leaked: false });
});

test('existing key-only vault upgrades behind the boot gate without changing DB version', async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async () => {
    const { V, pass, request, done, open, make, seed, resumed } = LT;
    const initial = make(); await initial.boot(); await seed('breeze-messenger');
    const { key, manifest } = await V.newVault(pass), db = await open('breeze-messenger');
    const keys = await request(db.transaction('identity').objectStore('identity').get('keys'));
    await V.atomicVaultRows(db, [['keys', await V.sealVaultRecord(key, manifest, db.name, 'identity', 'keys', keys)]], await V.sealVaultRecord(key, manifest, db.name, 'identity', 'vault:manifest', { slots: ['keys'] })); db.close();
    const control = await open('breeze-vault'), tx = control.transaction('meta', 'readwrite'), completed = done(tx);
    tx.objectStore('meta').put(await V.sealVaultState(key, manifest), 'state'); await completed; control.close();
    await resumed();
    const next = make(); await next.boot(); const backup = await next.backup();
    const raw = await open('breeze-messenger'), version = raw.version; raw.close();
    return { historyV: backup.manifest.historyV, version, leaked: JSON.stringify(backup).includes('private-') };
  });
  expect(result).toEqual({ historyV: 2, version: 6, leaked: false });
});

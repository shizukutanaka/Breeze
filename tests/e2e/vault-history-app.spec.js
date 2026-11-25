import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { createIdentity, openAddContact } from './helpers.mjs';

const PASS = 'a separate strong vault passphrase';
const NAME = 'Vault private contact';
const BODY = 'vault-private-history-body';
const DRAFT = 'vault-private-draft';
const LOCAL = 'vault-private-local-metadata';
const SESSION = 'vault-private-session-metadata';

async function command(page, value) {
  await page.locator('#msg-input').fill(value);
  await page.locator('#msg-input').press('Enter');
}

async function enable(page) {
  await command(page, '/vault enable');
  await page.locator('dialog[open] button[value="ok"]').click();
  for (const value of [PASS, PASS, '']) {
    await page.locator('dialog[open] .modal-input').fill(value);
    await page.locator('dialog[open] button[value="ok"]').click();
  }
  await expect(page.locator('#vault-gate')).toBeVisible();
}

async function unlock(page) {
  await page.locator('#vault-gate input').fill(PASS);
  await page.locator('#vault-gate button').click();
  await expect(page.locator('#vault-gate')).toHaveCount(0);
  await expect(page.locator('#msg-main')).toBeVisible();
  await expect(page.locator('#msg-contacts .contact:not(.self-card)')).toBeVisible();
}

async function seed(page) {
  await createIdentity(page, 'Vault history owner');
  await openAddContact(page);
  const form = page.locator('dialog[open] .add-form-contact');
  const pub = await page.evaluate(() => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
  await form.locator('.modal-input').fill(pub);
  await form.locator('button.btn-g').click();
  await expect(page.locator('#msg-contacts .contact:not(.self-card)')).toBeVisible();
  const seeded = await page.evaluate(async ({ name, body, draft, local, session }) => {
    const req = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const db = await req(indexedDB.open('breeze-messenger'));
    const contact = (await req(db.transaction('contacts').objectStore('contacts').getAll()))[0];
    const msgkey = await req(db.transaction('identity').objectStore('identity').get('msgkey'));
    const tx = db.transaction(['contacts', 'messages', 'settings', 'audit', 'calls'], 'readwrite');
    const done = new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error); });
    tx.objectStore('contacts').put({ ...contact, name, lastMsg: body, lastTs: Date.now() });
    tx.objectStore('messages').put({ msgId: 'vault-private-message-id', contactId: contact.id, text: body, mine: true, ts: Date.now() });
    tx.objectStore('messages').put({ msgId: 'vault-private-file-id', contactId: contact.id, text: '', mine: true, ts: Date.now(), type: 'file', fileName: 'vault-private-file.txt', fileData: 'vault-private-file-bytes' });
    tx.objectStore('settings').put({ private: 'vault-private-setting' }, 'vault-private-setting-key');
    tx.objectStore('audit').add({ type: 'settings', detail: 'vault-private-audit', ts: Date.now() });
    tx.objectStore('calls').add({ contactId: contact.id, name: 'vault-private-call', ts: Date.now(), direction: 'outgoing' });
    await done;
    localStorage.setItem('brz-drafts', JSON.stringify({ [contact.id]: draft }));
    localStorage.setItem('brz-private-future-setting', local);
    sessionStorage.setItem('brz-private-session-setting', session);
    const result = { id: contact.id, pub: contact.pubB64, key: msgkey.priv.k, version: db.version };
    db.close(); return result;
  }, { name: NAME, body: BODY, draft: DRAFT, local: LOCAL, session: SESSION });
  await page.reload();
  await page.locator('#msg-contacts .contact:not(.self-card)').click();
  await expect(page.locator('#msg-input')).toHaveValue(DRAFT);
  await expect(page.locator('#msg-messages')).toContainText(BODY);
  return seeded;
}

async function raw(page) {
  return page.evaluate(async () => {
    const req = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const databases = {};
    for (const { name } of await indexedDB.databases()) {
      const db = await req(indexedDB.open(name));
      const stores = {};
      for (const store of db.objectStoreNames) {
        const os = db.transaction(store).objectStore(store);
        const [keys, values] = await Promise.all([req(os.getAllKeys()), req(os.getAll())]);
        stores[store] = keys.map((key, i) => [key, values[i]]);
      }
      databases[name] = { version: db.version, stores }; db.close();
    }
    return { databases, local: Object.entries(localStorage), session: Object.entries(sessionStorage) };
  });
}

function noPlaintext(snapshot, seeded, extra = []) {
  const serialized = JSON.stringify(snapshot);
  for (const secret of [NAME, BODY, DRAFT, LOCAL, SESSION, seeded.id, seeded.pub, seeded.key, 'vault-private-', ...extra]) expect(serialized).not.toContain(secret);
  const account = snapshot.databases['breeze-messenger'];
  expect(account.version).toBe(seeded.version);
  for (const [store, rows] of Object.entries(account.stores)) for (const [key, value] of rows) {
    expect(value.vaultV).toBe(1);
    if (!(store === 'identity' && key === 'vault:manifest')) expect(key).toMatch(/^[\da-f-]{36}$/);
  }
  expect(snapshot.local.map(([key]) => key).sort()).toEqual(['brz-consent', 'brz-vault-browser-v1']);
  expect(snapshot.session.map(([key]) => key)).toEqual(['brz-vault-browser-v1']);
}

test('real app encrypts all raw stores, drafts and metadata; unlock restores previews/search and exports only ciphertext', async ({ page }) => {
  test.setTimeout(120_000);
  const seeded = await seed(page);
  await enable(page);
  await expect(page.locator('#vault-gate .modal')).toBeVisible();
  await expect(page.locator('#vault-gate .modal')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  expect((await page.locator('#vault-gate input').boundingBox()).width).toBeLessThan(400);
  noPlaintext(await raw(page), seeded);
  await expect(page.locator('#msg-contacts')).not.toContainText(NAME);
  await expect(page.locator('#msg-messages')).not.toContainText(BODY);
  await unlock(page);
  await page.locator('#msg-contacts .contact:not(.self-card)').click();
  await expect(page.locator('#msg-conv-name')).toContainText(NAME);
  await expect(page.locator('#msg-input')).toHaveValue(DRAFT);
  expect(await page.evaluate(() => [localStorage.getItem('brz-private-future-setting'), sessionStorage.getItem('brz-private-session-setting')])).toEqual([LOCAL, SESSION]);
  await command(page, '/searchall vault-private-history-body');
  await expect(page.locator('.help-header')).toContainText(NAME);
  await page.locator('.help-header').click();
  await expect(page.locator('#msg-messages')).toContainText(BODY);

  const download = page.waitForEvent('download');
  await command(page, '/export html');
  const exported = await download;
  expect(exported.suggestedFilename()).toBe('breeze-vault-backup.json');
  const backupText = await readFile(await exported.path(), 'utf8');
  expect(JSON.parse(backupText).manifest).toMatchObject({ historyV: 2, storageV: 1 });
  for (const secret of [NAME, BODY, DRAFT, LOCAL, SESSION, seeded.key]) expect(backupText).not.toContain(secret);

  await page.evaluate(() => {
    const encrypt = crypto.subtle.encrypt.bind(crypto.subtle);
    crypto.subtle.encrypt = (algorithm, ...args) => new TextDecoder().decode(algorithm.additionalData).startsWith('breeze-msgstore-v1:') ? Promise.reject(new Error('injected legacy body-key failure')) : encrypt(algorithm, ...args);
  });
  const message = 'vault-private-message-without-legacy-body-encryption';
  await page.locator('#msg-input').fill(message); await page.locator('#b-msg-send').click();
  await expect(page.locator('#msg-messages')).toContainText(message);
  await expect.poll(async () => (await raw(page)).databases['breeze-messenger'].stores.messages.length).toBe(3);
  noPlaintext(await raw(page), seeded, [message]);
  await command(page, '/vault lock');
  await expect(page.locator('#vault-gate')).toBeVisible();
  noPlaintext(await raw(page), seeded, [message]);
  await unlock(page);
  await page.locator('#msg-contacts .contact:not(.self-card)').click();
  await expect(page.locator('#msg-messages')).toContainText(message);
  await command(page, '/vault disable');
  await page.locator('dialog[open] button[value="ok"]').click();
  await page.locator('dialog[open] .modal-input').fill(PASS);
  await page.locator('dialog[open] button[value="ok"]').click();
  await expect(page.locator('#msg-contacts .contact:not(.self-card)')).toBeVisible();
  await expect.poll(async () => (await raw(page)).local.find(([key]) => key === 'brz-private-future-setting')?.[1]).toBe(LOCAL);
  const disabled = await raw(page);
  expect(disabled.local.some(([key]) => key === 'brz-vault-browser-v1')).toBe(false);
  expect(disabled.databases['breeze-messenger'].stores.contacts[0][1].name).toBe(NAME);
});

for (const point of ['account-commit', 'browser-enable', 'browser-disable']) {
  test(`real app recovers authenticated migration journal after ${point} crash before crypto starts`, async ({ page }) => {
    test.setTimeout(90_000);
    const seeded = await seed(page);
    if (point === 'browser-disable') { await enable(page); await unlock(page); await page.locator('#msg-contacts .contact:not(.self-card)').click(); }
    await page.evaluate(point => {
      if (point === 'account-commit') {
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function(value, ...args) {
          if (this.transaction.db.name === 'breeze-messenger' && this.name === 'messages' && value?.vaultV) throw new Error('injected account commit crash');
          return put.call(this, value, ...args);
        };
      } else {
        const scope = window.__breezeBrowser.raw[0], set = scope.setItem, remove = scope.removeItem;
        if (point === 'browser-enable') scope.setItem = (key, value) => { if (key === 'brz-vault-browser-v1') throw new Error('injected browser enable crash'); return set(key, value); };
        else scope.removeItem = key => { if (key === 'brz-vault-browser-v1') throw new Error('injected browser disable crash'); return remove(key); };
      }
    }, point);
    if (point === 'browser-disable') {
      await command(page, '/vault disable');
      await page.locator('dialog[open] button[value="ok"]').click();
      await page.locator('dialog[open] .modal-input').fill(PASS);
      await page.locator('dialog[open] button[value="ok"]').click();
      await expect(page.locator('#vault-gate')).toBeVisible();
    } else await enable(page);
    const interrupted = await raw(page);
    const journal = interrupted.databases['breeze-vault'].stores.meta.find(([key]) => key === 'state')[1];
    expect(journal.phase).toBe(point === 'browser-disable' ? 'disabling' : 'enabling');
    expect(journal.browser).toMatchObject({ vaultV: 1 });
    expect(JSON.stringify(interrupted.databases['breeze-vault'])).not.toContain(DRAFT);
    await expect(page.locator('#msg-main')).toBeHidden();
    await expect(page.locator('#msg-contacts')).not.toContainText(NAME);
    const recovered = page.waitForEvent('load');
    await page.locator('#vault-gate input').fill(PASS);
    await page.locator('#vault-gate button').click();
    await recovered;
    if (point === 'browser-disable') {
      await expect(page.locator('#msg-contacts .contact:not(.self-card)')).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('brz-private-future-setting'))).toBe(LOCAL);
      expect((await raw(page)).local.some(([key]) => key === 'brz-vault-browser-v1')).toBe(false);
    } else {
      await expect(page.locator('#vault-gate')).toBeVisible();
      noPlaintext(await raw(page), seeded);
      await unlock(page);
      await page.locator('#msg-contacts .contact:not(.self-card)').click();
      await expect(page.locator('#msg-input')).toHaveValue(DRAFT);
      await expect(page.locator('#msg-messages')).toContainText(BODY);
    }
  });
}

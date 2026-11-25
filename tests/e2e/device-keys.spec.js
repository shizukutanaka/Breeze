import { test, expect } from '@playwright/test';
import { createIdentity, openAddContact } from './helpers.mjs';

async function command(page, text) {
  await page.locator('#msg-input').fill(text); await page.locator('#msg-input').press('Enter');
}
async function open(page, pub) {
  await openAddContact(page);
  const form = page.locator('dialog[open] .add-form-contact');
  await form.locator('.modal-input').fill(pub); await form.locator('button.btn-g').click();
  await page.locator('#msg-contacts .contact:not(.self-card)').first().click();
}
async function get(page, key) {
  return page.evaluate(key => new Promise((resolve, reject) => {
    const req = indexedDB.open('breeze-messenger'); req.onerror = () => reject(req.error);
    req.onsuccess = () => { const db = req.result, tx = db.transaction('identity'), r = tx.objectStore('identity').get(key); tx.oncomplete = () => { db.close(); resolve(r.result); }; tx.onerror = () => reject(tx.error); };
  }), key);
}

test('direct certificate transfer pins both device keys and the root, survives reload, rejects replay and alerts on removal', async ({ browser }) => {
  test.setTimeout(180_000);
  const primary = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.211' } });
  const secondary = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.212' } });
  const A = await primary.newPage(), B = await secondary.newPage(), errors = [];
  A.on('pageerror', e => errors.push(e.message)); B.on('pageerror', e => errors.push(e.message));
  const root = await createIdentity(A, 'Primary keys'), pub = await createIdentity(B, 'Secondary keys');
  await open(A, pub); await open(B, root);
  await command(B, '/link keys');
  const offerCode = B.locator('.cmd-panel code').filter({ hasText: /^breeze-device-offer:v1:/ });
  await expect(offerCode).toBeVisible(); const offer = await offerCode.textContent();
  await command(A, '/link ' + offer);
  await A.locator('dialog[open] button[value="ok"]').click();
  const certificateCode = A.locator('.cmd-panel code').filter({ hasText: /^breeze-device-binding:v1:/ });
  await expect(certificateCode).toBeVisible();
  await A.locator('dialog[open] button[value="cancel"]').click();
  const certificate = await certificateCode.textContent();
  await command(B, '/linkto ' + certificate);
  await expect(B.locator('dialog[open]')).toContainText('transferred directly');
  await B.locator('dialog[open] button[value="ok"]').click();
  await expect(B.locator('.toast-container')).toContainText('root signing pin authenticated');
  const state = await get(B, 'verify:device-link'), signing = await get(B, 'signing'), rootSigning = await get(A, 'signing');
  expect(state.offer).toBeUndefined(); expect(state.binding).toMatchObject({ root, pub, ed: signing.pubB64, rootEd: rootSigning.pubB64 });
  const reg = await (await A.request.post('/api/device/list', { data: { accountId: root.slice(0, 12) } })).json();
  expect(state.binding).toMatchObject(reg.devices.find(d => d.pub === pub).binding);
  expect(state.binding.deviceSig).toBeTruthy();
  await B.reload(); await expect(B.locator('#msg-main')).toBeVisible();
  expect((await get(B, 'verify:device-link')).binding).toEqual(state.binding);
  await B.locator('#msg-contacts .contact:not(.self-card)').first().click();
  await command(B, '/linkto ' + certificate);
  await expect(B.locator('.toast-container')).toContainText('invalid, mismatched');
  await expect(B.locator('dialog[open]')).toHaveCount(0);
  const peerContext = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.213' } });
  const C = await peerContext.newPage(), peer = await createIdentity(C, 'Revocation peer');
  C.on('pageerror', e => errors.push(e.message));
  await open(A, peer); await open(C, root); await open(B, peer);
  const memberIndex = await A.evaluate(peer => new Promise(resolve => {
    const q = indexedDB.open('breeze-messenger'); q.onsuccess = () => {
      const r = q.result.transaction('contacts').objectStore('contacts').getAll();
      r.onsuccess = () => { q.result.close(); resolve(r.result.filter(c => !c.isGroup).findIndex(c => c.pubB64 === peer) + 1); };
    };
  }), peer);
  await openAddContact(A, 'group');
  const groupForm = A.locator('dialog[open] .add-form-group');
  await groupForm.locator('.modal-input').fill('Certified devices'); await groupForm.locator('button.btn-g').click();
  await A.locator('dialog[open] input').fill(String(memberIndex)); await A.locator('dialog[open] button[value="ok"]').click();
  await expect(A.locator('#msg-contacts .contact', { hasText: 'Certified devices' })).toBeVisible();
  const group = await A.evaluate(() => new Promise(resolve => {
    const q = indexedDB.open('breeze-messenger'); q.onsuccess = () => {
      const r = q.result.transaction('contacts').objectStore('contacts').getAll();
      r.onsuccess = () => { q.result.close(); resolve(r.result.find(c => c.isGroup)); };
    };
  }));
  // Seed only the secondary's roster, as contact sync would; keys, certificates,
  // policy negotiation and messages still travel through the real E2EE channels.
  expect(group?.isGroup).toBe(true);
  await B.evaluate(group => new Promise((resolve, reject) => {
    const q = indexedDB.open('breeze-messenger'); q.onsuccess = () => {
      const tx = q.result.transaction('contacts', 'readwrite'); tx.objectStore('contacts').put(group);
      tx.oncomplete = () => { q.result.close(); resolve(); };
      tx.onabort = () => reject(tx.error);
    };
  }), group);
  await B.reload();
  for (const page of [A, B, C]) await page.locator('#msg-contacts .contact', { hasText: 'Certified devices' }).click({ timeout: 20_000 });
  await command(A, 'Root group message'); await expect(C.locator('#msg-messages')).toContainText('Root group message');
  await command(C, 'Peer group message'); await expect(B.locator('#msg-messages')).toContainText('Peer group message', { timeout: 20_000 });
  await command(A, 'Root strict group message');
  await expect(B.locator('#msg-messages')).toContainText('Root strict group message', { timeout: 20_000 });
  expect((await get(B, 'gsk-peer:' + group.id + ':' + root.slice(0, 12))).epoch).toBe((await get(A, 'gsk:' + group.id)).epoch);
  expect((await get(B, 'ga-policy:' + group.id)).proofs[root]).toBe(rootSigning.pubB64);
  await expect.poll(async () => (await get(B, 'ga-policy:' + group.id))?.strict).toBe(true);
  await command(B, 'Certified secondary message');
  await expect(C.locator('#msg-messages')).toContainText('Certified secondary message', { timeout: 20_000 });
  const authenticated = await C.evaluate(([pub, gid]) => new Promise(resolve => {
    const q = indexedDB.open('breeze-messenger'); q.onsuccess = () => {
      const tx = q.result.transaction(['identity', 'messages']), r = tx.objectStore('identity').get('ga-replay:' + gid + ':' + pub);
      r.onsuccess = () => {
        const id = Object.values(r.result?.ids || {})[0];
        if (!id) { q.result.close(); resolve(false); return; }
        const m = tx.objectStore('messages').get(id); m.onsuccess = () => { q.result.close(); resolve(m.result?.authorVerified === true); };
      };
    };
  }), [pub, group.id]);
  expect(authenticated).toBe(true);
  const priorKey = await get(A, 'gsk:' + group.id);
  await A.reload();
  const banner = A.locator('[data-device-alert]');
  await expect(banner).toContainText('Device encryption/signing binding verified');
  await expect(A.locator('#msg-input-bar')).toBeInViewport();
  await A.screenshot({ path: '/Users/devin/device-keys-binding.png', animations: 'disabled' });
  await A.locator('#msg-contacts .contact', { hasText: 'Certified devices' }).click();
  await command(A, '/unlink 2');
  const removed = A.waitForResponse(r => r.url().endsWith('/api/device/set') && r.status() === 200);
  await A.locator('dialog[open] button[value="ok"]').click(); await removed;
  await expect.poll(async () => (await get(C, 'verify:device-authority:' + root))?.revoked).toContain(pub);
  expect((await get(A, 'gsk:' + group.id)).epoch).toBeGreaterThan(priorKey.epoch);
  await command(B, 'Revoked secondary message');
  await command(A, 'After unlink secret'); await expect(C.locator('#msg-messages')).toContainText('After unlink secret', { timeout: 20_000 });
  await expect(C.locator('#msg-messages')).not.toContainText('Revoked secondary message');
  await A.reload(); await expect(banner).toContainText('Device keys revoked');
  await A.screenshot({ path: '/Users/devin/device-revocation-alert.png', animations: 'disabled' });
  const after = await (await A.request.post('/api/device/list', { data: { accountId: root.slice(0, 12) } })).json();
  expect(after.devices.map(d => d.pub)).toEqual([root]); expect(errors).toEqual([]);
  await primary.close(); await secondary.close(); await peerContext.close();
});

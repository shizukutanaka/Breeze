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
  test.setTimeout(90_000);
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
  expect(reg.devices.find(d => d.pub === pub).binding).toEqual(state.binding);
  await B.reload(); await expect(B.locator('#msg-main')).toBeVisible();
  expect((await get(B, 'verify:device-link')).binding).toEqual(state.binding);
  await B.locator('#msg-contacts .contact:not(.self-card)').first().click();
  await command(B, '/linkto ' + certificate);
  await expect(B.locator('.toast-container')).toContainText('invalid, mismatched');
  await expect(B.locator('dialog[open]')).toHaveCount(0);
  await A.reload();
  const banner = A.locator('[data-device-alert]');
  await expect(banner).toContainText('Device encryption/signing binding verified');
  await expect(A.locator('#msg-input-bar')).toBeInViewport();
  await A.screenshot({ path: '/Users/devin/device-keys-binding.png', animations: 'disabled' });
  await A.locator('#msg-contacts .contact:not(.self-card)').first().click();
  await command(A, '/unlink 2');
  const removed = A.waitForResponse(r => r.url().endsWith('/api/device/set') && r.status() === 200);
  await A.locator('dialog[open] button[value="ok"]').click(); await removed;
  await A.reload(); await expect(banner).toContainText('old keys are not yet peer-revoked');
  const after = await (await A.request.post('/api/device/list', { data: { accountId: root.slice(0, 12) } })).json();
  expect(after.devices.map(d => d.pub)).toEqual([root]); expect(errors).toEqual([]);
  await primary.close(); await secondary.close();
});

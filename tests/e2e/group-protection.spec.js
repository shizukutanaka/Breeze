import { test, expect } from '@playwright/test';
import { createIdentity, openAddContact } from './helpers.mjs';

async function stored(page, store, key) {
  return page.evaluate(({ store, key }) => new Promise((resolve, reject) => {
    const req = indexedDB.open('breeze-messenger'); req.onerror = () => reject(req.error);
    req.onsuccess = () => { const db = req.result, tx = db.transaction(store), get = tx.objectStore(store).get(key); get.onsuccess = () => resolve(get.result); tx.oncomplete = () => db.close(); };
  }), { store, key });
}

test('signed invite anchor → strict → relay legacy claim warns/cancels → explicit drop → persistent peer notice → restore', async ({ browser }) => {
  test.setTimeout(120_000);
  const ac = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.191' } });
  const bc = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.192' } });
  const a = await ac.newPage(), b = await bc.newPage();
  await createIdentity(a, 'Admin');
  await openAddContact(a, 'group');
  const form = a.locator('dialog[open] .add-form-group');
  await form.locator('.modal-input').fill('Protection test'); await form.locator('button.btn-g').click();
  await a.locator('dialog[open] [value="ok"]').click();
  const link = await a.locator('.i-mono-box').textContent();
  expect(new URL(link).searchParams.has('invite')).toBe(true);
  await b.goto(link); await createIdentity(b, 'Member', { navigate: false });
  await expect(b.locator('#msg-conv-name')).toContainText('Protection test');
  const gid = 'g_' + new URL(link).searchParams.get('join');
  await a.locator('#msg-contacts .contact').filter({ hasText: 'Protection test' }).click();
  await expect.poll(async () => (await stored(a, 'contacts', gid))?.members.length).toBe(2);
  for (const p of [a, b]) expect((await stored(p, 'identity', 'verify:group-protection:' + gid)).anchor.source).toBe('invitation');
  await a.locator('#msg-input').fill('establish strict A'); await a.locator('#b-msg-send').click();
  await expect(b.locator('#msg-messages')).toContainText('establish strict A', { timeout: 20_000 });
  await b.locator('#msg-input').fill('establish strict B'); await b.locator('#b-msg-send').click();
  await expect(a.locator('#msg-messages')).toContainText('establish strict B', { timeout: 20_000 });
  for (const p of [a, b]) await expect.poll(async () => (await stored(p, 'identity', 'ga-policy:' + gid))?.strict).toBe(true);

  // Model a pre-anchor local group while preserving its original local creation record.
  await a.evaluate(gid => new Promise((resolve, reject) => {
    const req = indexedDB.open('breeze-messenger'); req.onerror = () => reject(req.error);
    req.onsuccess = () => { const db = req.result, tx = db.transaction('identity', 'readwrite'); tx.objectStore('identity').delete('verify:group-protection:' + gid); tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => reject(tx.error); };
  }), gid);
  await a.reload(); await a.locator('#msg-contacts .contact').filter({ hasText: 'Protection test' }).click();
  const selfAnchor = a.getByRole('button', { name: 'Confirm my creator identity as admin' });
  await selfAnchor.click();
  const ownDialog = a.getByRole('dialog').filter({ hasText: 'This device’s local record says you created this group.' });
  await expect(ownDialog.locator('[value="cancel"]')).toBeFocused();
  await a.screenshot({ path: '/Users/devin/group-downgrade-self-anchor.png' });
  await a.keyboard.press('Enter'); await expect(ownDialog).toBeHidden();
  expect(await stored(a, 'identity', 'verify:group-protection:' + gid)).toBeUndefined();
  await selfAnchor.click(); await ownDialog.locator('[value="ok"]').click();
  await expect.poll(async () => (await stored(a, 'identity', 'verify:group-protection:' + gid))?.anchor.source).toBe('local-creator');

  let inject = true;
  const legacyPub = Buffer.alloc(32, 7).toString('base64');
  await a.route('**/api/group/info', async route => {
    const response = await route.fetch(); const body = await response.json();
    if (inject) body.members.push({ id: legacyPub.slice(0, 12), pub: legacyPub, name: 'Legacy', caps: [] });
    await route.fulfill({ response, json: body });
  });
  const warning = a.getByRole('dialog').filter({ hasText: 'Reduce group author protection?' });
  await expect(warning).toBeVisible({ timeout: 15_000 });
  await expect(warning.locator('[value="cancel"]')).toBeFocused();
  await a.screenshot({ path: '/Users/devin/group-downgrade-warning.png' });
  await a.keyboard.press('Enter'); await expect(warning).toBeHidden();
  expect((await stored(a, 'contacts', gid)).members).toHaveLength(2);
  expect((await stored(a, 'identity', 'ga-policy:' + gid)).strict).toBe(true);
  await a.getByRole('button', { name: 'Review pending member change' }).click();
  await expect(warning.locator('[value="cancel"]')).toBeFocused();
  await warning.getByRole('button', { name: 'Allow legacy members' }).click();
  for (const p of [a, b]) await expect(p.locator('[data-group-protection]')).toContainText('Author protection reduced', { timeout: 20_000 });
  await a.locator('#msg-input').fill('explicit legacy message'); await a.locator('#b-msg-send').click();
  await expect(b.locator('#msg-messages')).toContainText('explicit legacy message', { timeout: 20_000 });
  await b.reload(); await b.locator('#msg-contacts .contact').filter({ hasText: 'Protection test' }).click();
  await expect(b.locator('[data-group-protection]')).toContainText('Author protection reduced');
  inject = false;
  await a.locator('#msg-input').fill('/admin kick Legacy'); await a.locator('#msg-input').press('Enter');
  for (const p of [a, b]) await expect(p.locator('[data-group-protection]')).toContainText('Signed-author protection restored', { timeout: 20_000 });
  await ac.close(); await bc.close();
});

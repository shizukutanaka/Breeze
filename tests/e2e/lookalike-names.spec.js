import { test, expect } from '@playwright/test';
import { createIdentity, openAddContact } from './helpers.mjs';

async function publicKey(page) {
  return page.evaluate(async () => {
    const kp = await crypto.subtle.generateKey('X25519', true, ['deriveBits']);
    return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))));
  });
}
async function add(page, pub, name) {
  await openAddContact(page);
  const input = page.locator('dialog[open] .add-form-contact .modal-input');
  const link = new URL('/', page.url()); link.searchParams.set('add', pub); link.searchParams.set('name', name);
  await input.fill(link.href); await input.press('Enter');
}
const row = (page, name) => page.locator('#msg-contacts .contact:not(.self-card)').filter({ has: page.locator('.name', { hasText: name }) });

test('confusable adds require confirmation; safe names and persistent header/group warnings survive reload', async ({ browser }) => {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.191' } });
  const page = await ctx.newPage();
  await createIdentity(page, 'Owner');
  const known = await publicKey(page), suspicious = await publicKey(page);
  await add(page, known, 'Alice');
  await expect(row(page, 'Alice')).toBeVisible();
  await expect(page.locator('.ln-warning')).toHaveCount(0);
  await add(page, suspicious, 'Аli\u202e\u200bce');
  const confirm = page.locator('dialog[open]');
  await expect(confirm).toContainText('resembles existing contact “Alice”');
  await expect(confirm).toContainText(known.slice(0, 12));
  await confirm.locator('[value="cancel"]').click();
  await expect(page.locator('#msg-contacts .contact:not(.self-card)')).toHaveCount(1);
  await add(page, suspicious, 'Аli\u202e\u200bce');
  await page.getByRole('button', { name: 'Add anyway', exact: true }).click();
  const bad = page.locator('#msg-contacts .contact:not(.self-card)').filter({ has: page.locator('.name', { hasText: /^Аlice/ }) });
  await expect(bad.locator('.ln-warning')).toContainText(known.slice(0, 12));
  expect(await bad.innerText()).not.toMatch(/[\u202e\u200b]/);
  await bad.click();
  await expect(page.locator('#msg-conv-name .ln-warning')).toContainText('Compare fingerprints');
  await expect(page.locator('#msg-input-bar')).toBeInViewport();
  await page.screenshot({ path: '/Users/devin/lookalike-names.png' });
  await page.reload();
  await bad.click();
  await expect(page.locator('#msg-conv-name .ln-warning')).toContainText(known.slice(0, 12));
  await page.evaluate(async ({ known, suspicious }) => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('breeze-messenger'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('contacts', 'readwrite');
      tx.objectStore('contacts').put({ id: 'group-lookalike', name: 'Study group', isGroup: true, addedAt: Date.now(), members: [{ id: known.slice(0, 12), pubB64: known, name: 'Alice' }, { id: suspicious.slice(0, 12), pubB64: suspicious, name: 'Аlice' }] });
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    }); db.close();
  }, { known, suspicious });
  await page.reload();
  await row(page, 'Study group').click();
  await expect(page.locator('#msg-conv-name .ln-warning')).toContainText('Alice');
  await page.locator('#msg-input').fill('/members'); await page.locator('#msg-input').press('Enter');
  await expect(page.locator('#msg-messages .ln-warning').first()).toContainText('Compare fingerprints');
  await ctx.close();
});

test('a stranger first message warns without blocking delivery or requiring an add confirmation', async ({ browser }) => {
  const receiverCtx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.192' } });
  const senderCtx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.193' } });
  const receiver = await receiverCtx.newPage(), sender = await senderCtx.newPage();
  const recipientPub = await createIdentity(receiver, 'Recipient');
  const known = await publicKey(receiver);
  await add(receiver, known, 'Alice');
  await expect(row(receiver, 'Alice')).toBeVisible();
  await createIdentity(sender, 'Аlice');
  await add(sender, recipientPub, 'Recipient');
  await row(sender, 'Recipient').click();
  await sender.locator('#msg-input').fill('First message from the lookalike');
  await sender.locator('#b-msg-send').click();
  const incoming = receiver.locator('#msg-contacts .contact:not(.self-card)').filter({ has: receiver.locator('.name', { hasText: /^Аlice/ }) });
  await expect(incoming.locator('.ln-warning')).toContainText(known.slice(0, 12), { timeout: 20_000 });
  await expect(receiver.locator('dialog[open]')).toHaveCount(0);
  await incoming.click();
  await expect(receiver.locator('#msg-messages')).toContainText('First message from the lookalike');
  await expect(receiver.locator('#msg-conv-name .ln-warning')).toContainText('Compare fingerprints');
  await receiverCtx.close(); await senderCtx.close();
});

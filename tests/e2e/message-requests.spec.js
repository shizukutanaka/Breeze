import { test, expect } from '@playwright/test';
import { createIdentity, openAddContact, readMessages } from './helpers.mjs';

async function addAndOpen(page, pub) {
  await openAddContact(page);
  const form = page.locator('dialog[open] .add-form-contact');
  await form.locator('.modal-input').fill(pub);
  await form.locator('button.btn-g').click();
  await expect(form).toBeHidden();
  await page.locator('#msg-contacts .contact:not(.self-card)').click();
}
async function send(page, text) {
  await page.locator('#msg-input').fill(text);
  await page.locator('#b-msg-send').click();
  await expect(page.locator('#msg-input')).toHaveValue('');
}
async function stored(page, store, key) {
  return page.evaluate(({ store, key }) => new Promise((resolve, reject) => {
    const req = indexedDB.open('breeze-messenger');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result, tx = db.transaction(store), get = key ? tx.objectStore(store).get(key) : tx.objectStore(store).getAll();
      tx.oncomplete = () => { resolve(get.result); db.close(); }; tx.onerror = () => reject(tx.error);
    };
  }), { store, key });
}

test('stranger stays quarantined across reload with no application responses, then Accept migrates ciphertext', async ({ browser }) => {
  test.setTimeout(60_000);
  const a = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.211' } });
  const b = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.212' } });
  try {
    const sender = await a.newPage(), receiver = await b.newPage();
    await receiver.addInitScript(() => {
      window.__requestNotices = [];
      window.Notification = class { static permission = 'granted'; constructor(title, options) { window.__requestNotices.push({ title, options }); } };
    });
    const senderPub = await createIdentity(sender, 'Unknown Alice');
    const receiverPub = await createIdentity(receiver, 'Receiver');
    await addAndOpen(sender, receiverPub);
    const responses = [];
    receiver.on('request', request => { if (/\/api\/(sealed\/send|msg\/send|signal)$/.test(new URL(request.url()).pathname)) responses.push(request.url()); });
    const text = 'quarantine secret https://example.invalid/no-preview ' + Date.now();
    await send(sender, text);
    await expect(receiver.locator('#b-msg-requests')).toHaveText('Requests (1)', { timeout: 20_000 });
    expect(await readMessages(receiver)).toEqual([]);
    expect((await stored(receiver, 'contacts')).filter(c => !c.isGroup)).toEqual([]);
    expect((await stored(receiver, 'settings', 'requests:v1')).entries[0].pub).toBe(senderPub);
    expect(JSON.stringify(await stored(receiver, 'settings', 'requests:v1'))).not.toContain(text);
    const notices = await receiver.evaluate(() => window.__requestNotices);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toEqual({ title: 'New message request', options: { tag: 'breeze-requests' } });
    await receiver.reload();
    await expect(receiver.locator('#b-msg-requests')).toHaveText('Requests (1)', { timeout: 15_000 });
    await receiver.locator('#b-msg-requests').click();
    const dialog = receiver.locator('dialog[open]');
    await expect(dialog).toContainText('Unknown Alice');
    await expect(dialog).not.toContainText(text);
    await expect(dialog.locator('img, video, audio, iframe')).toHaveCount(0);
    expect(responses).toEqual([]);
    await receiver.screenshot({ path: '/Users/devin/message-requests.png', fullPage: true });
    await dialog.locator('[data-request-action="accept"]').click();
    await expect(dialog).toContainText('No message requests');
    await dialog.locator('[value="cancel"]').click();
    const contact = receiver.locator('#msg-contacts .contact:not(.self-card)');
    await expect(contact).toBeVisible(); await contact.click();
    await expect(receiver.locator('#msg-messages')).toContainText(text, { timeout: 15_000 });
    await send(receiver, 'accepted reply');
    await expect(sender.locator('#msg-messages')).toContainText('accepted reply', { timeout: 15_000 });
  } finally { await a.close(); await b.close(); }
});

test('Delete allows a later request; Block persists and silently drops later messages', async ({ browser }) => {
  test.setTimeout(60_000);
  const a = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.213' } });
  const b = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.214' } });
  try {
    const sender = await a.newPage(), receiver = await b.newPage();
    await createIdentity(sender, 'Blocked Stranger');
    const receiverPub = await createIdentity(receiver, 'Receiver');
    await addAndOpen(sender, receiverPub);
    await send(sender, 'first request');
    await expect(receiver.locator('#b-msg-requests')).toHaveText('Requests (1)', { timeout: 20_000 });
    await receiver.locator('#b-msg-requests').click();
    await receiver.locator('[data-request-action="delete"]').click();
    await expect(receiver.locator('dialog[open]')).toContainText('No message requests');
    await send(sender, 'after delete');
    await expect(receiver.locator('[data-request-action="block"]')).toBeVisible({ timeout: 15_000 });
    await receiver.locator('[data-request-action="block"]').click();
    await expect(receiver.locator('[data-request-action="unblock"]')).toBeVisible();
    await receiver.reload();
    await expect(receiver.locator('#b-msg-requests')).toHaveText('Requests');
    const polled = receiver.waitForResponse(async r => /\/api\/sealed\/poll$/.test(new URL(r.url()).pathname) && r.ok() && (await r.json()).messages?.length > 0);
    await send(sender, 'after block'); await polled;
    await expect.poll(async () => (await stored(receiver, 'settings', 'requests:v1')).blocked.length).toBe(1);
    expect((await stored(receiver, 'settings', 'requests:v1')).entries).toEqual([]);
    expect(await readMessages(receiver)).toEqual([]);
    await receiver.locator('#b-msg-requests').click();
    await expect(receiver.locator('[data-request-action="unblock"]')).toBeVisible();
  } finally { await a.close(); await b.close(); }
});

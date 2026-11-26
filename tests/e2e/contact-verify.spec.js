import { test, expect } from '@playwright/test';
import { createIdentity, openAddContact } from './helpers.mjs';

async function contactRow(page) {
  const row = page.locator('#msg-contacts .contact:not(.self-card)');
  await expect(row).toBeVisible(); await row.click();
  await expect(page.locator('#msg-input-bar')).toBeVisible();
  return row;
}
async function compare(page, id, { groups = 12, screenshot = false } = {}) {
  await page.locator('#msg-input').fill('/verify'); await page.locator('#msg-input').press('Enter');
  const modal = page.locator('.overlay.overlay-dark').filter({ has: page.locator('[data-verify-contact]') });
  await expect(modal.locator('#kt-audit-status')).not.toHaveText('Checking key history...');
  const mark = modal.locator('[data-verify-contact]'); await expect(mark).toBeEnabled();
  const number = await modal.locator('.i-safety-num').textContent();
  expect(number.split(' ')).toHaveLength(groups);
  expect(await modal.locator('.verification-modal').evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  expect((await modal.locator('.verification-modal').boundingBox()).width).toBeLessThanOrEqual(400);
  await expect(modal.locator('canvas')).toBeVisible();
  const checkbox = modal.locator('.verification-strict input[type="checkbox"]');
  await checkbox.focus();
  expect(await checkbox.evaluate(el => {
    const firstLetter = document.createRange(); firstLetter.setStart(el.nextSibling, 0); firstLetter.setEnd(el.nextSibling, 1);
    return firstLetter.getBoundingClientRect().left - el.getBoundingClientRect().right;
  })).toBeGreaterThanOrEqual(8);
  if (screenshot) await page.screenshot({ path: '/Users/devin/safety-number-v2-verification.png' });
  await mark.click(); await expect(modal.locator('[role="status"]')).toHaveText('✓ Verified');
  await modal.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('#msg-conv-name [data-contact-verification]')).toHaveText('✓ Verified');
  expect(await page.evaluate(async id => {
    const req = indexedDB.open('breeze-messenger');
    const db = await new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const get = db.transaction('identity').objectStore('identity').get('verify:' + id);
    return new Promise(resolve => { get.onsuccess = () => { db.close(); resolve(get.result?.verified); }; });
  }, id)).toBe(true);
  return number;
}

test('verify → reload → verified; missing signing pin → persistent warning/send block → re-verify → send', async ({ browser }) => {
  test.setTimeout(120_000);
  const ac = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.181' } });
  const bc = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.182' } });
  const a = await ac.newPage(), b = await bc.newPage();
  const alice = await createIdentity(a, 'Verification Alice'), bob = await createIdentity(b, 'Verification Bob');
  const add = async (page, pub) => {
    await openAddContact(page); const panel = page.locator('dialog[open] .add-form-contact');
    await panel.locator('.modal-input').fill(pub); await panel.locator('button.btn-g').click(); await contactRow(page);
  };
  await add(a, bob); await add(b, alice);
  await a.locator('#msg-input').fill('establish signing pins'); await a.locator('#b-msg-send').click();
  await expect(b.locator('#msg-messages')).toContainText('establish signing pins', { timeout: 20_000 });
  await b.locator('#msg-input').fill('signed reply'); await b.locator('#b-msg-send').click();
  await expect(a.locator('#msg-messages')).toContainText('signed reply', { timeout: 20_000 });
  const id = bob.slice(0, 12);
  let legacy = true;
  await a.route('**/api/prekey/status', async route => {
    const response = await route.fetch(), data = await response.json();
    if (legacy && Array.isArray(data.caps)) data.caps = data.caps.filter(c => c !== 'safety-number-v2');
    await route.fulfill({ response, json: data });
  });
  await compare(a, id, { groups: 6 });
  legacy = false;
  await a.reload(); await contactRow(a);
  await expect(a.locator('#msg-conv-name [data-contact-verification]')).toHaveText('✓ Verified');
  const number = await compare(a, id, { screenshot: true });
  expect(await compare(b, alice.slice(0, 12))).toBe(number);
  await expect(a.locator('#msg-contacts [data-contact-verification="verified"]')).toHaveCount(1);
  await a.screenshot({ path: '/Users/devin/contact-verify-verified.png' });
  const signingPin = await a.evaluate(async id => {
    const req = indexedDB.open('breeze-messenger');
    const db = await new Promise(resolve => { req.onsuccess = () => resolve(req.result); });
    const tx = db.transaction('contacts', 'readwrite'), os = tx.objectStore('contacts'), get = os.get(id);
    let pin;
    get.onsuccess = () => { const contact = get.result; pin = contact.sigPub; delete contact.sigPub; os.put(contact); };
    return new Promise(resolve => { tx.oncomplete = () => { db.close(); resolve(pin); }; });
  }, id);
  await a.reload(); await contactRow(a);
  await expect(a.locator('[data-verification-warning]')).toBeVisible();
  await a.screenshot({ path: '/Users/devin/contact-verify-changed.png' });
  await a.locator('#msg-input').fill('MUST STAY BLOCKED'); await a.locator('#b-msg-send').click();
  await expect(a.locator('#msg-input')).toHaveValue('MUST STAY BLOCKED');
  await expect(a.locator('#msg-messages')).not.toContainText('MUST STAY BLOCKED');
  await a.reload(); await contactRow(a);
  await expect(a.locator('[data-verification-warning]')).toBeVisible();
  await a.evaluate(async ({ id, signingPin }) => {
    const req = indexedDB.open('breeze-messenger'); const db = await new Promise(resolve => { req.onsuccess = () => resolve(req.result); });
    const tx = db.transaction('contacts', 'readwrite'), os = tx.objectStore('contacts'), get = os.get(id);
    get.onsuccess = () => os.put({ ...get.result, sigPub: signingPin });
    await new Promise(resolve => { tx.oncomplete = resolve; }); db.close();
  }, { id, signingPin });
  await a.reload(); await contactRow(a);
  await expect(a.locator('[data-verification-warning]')).toBeVisible();
  await compare(a, id);
  await expect(a.locator('[data-verification-warning]')).toHaveCount(0);
  await a.locator('#msg-input').fill('reverified and unblocked'); await a.locator('#b-msg-send').click();
  await expect(b.locator('#msg-messages')).toContainText('reverified and unblocked', { timeout: 20_000 });
  await a.locator('#msg-input').fill('/security'); await a.locator('#msg-input').press('Enter');
  await expect(a.locator('#msg-messages')).toContainText('Contact verification');
  await ac.close(); await bc.close();
});

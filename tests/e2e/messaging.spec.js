// Two-party 1:1 message exchange over the sealed-sender relay, using the REAL app UI
// (create identity, add contact via the real add-contact dialog, open the rendered
// contact-list item, type + click send) driven by two isolated browser contexts
// against the same server (shared in-memory Worker KV — mirrors two real devices
// talking through one deployment). This is the first test in the repo that exercises
// encryptFor/decryptFrom/relaySend/handleIncoming end to end through actual UI
// interaction rather than calling the extracted functions directly.
//
// P2P WebRTC signaling is not exercised here (flaky/slow in headless CI); the sealed-
// sender relay is the reliable fallback path and is what this test drives.
//
// NOTE: app internals (myPubB64, addContact, openConversation, dbGet, ...) are declared
// INSIDE initMessenger()'s closure, not at the script's top level, so they are not
// reachable from page.evaluate(). The identity's pubB64 is instead read directly out of
// IndexedDB (a standard Web API, unlike the app's own closure state) and every other
// step is driven through real clicks/inputs against the shipped UI.
import { test, expect } from '@playwright/test';

async function createIdentity(page, name) {
  await page.goto('/');
  await page.locator('#msg-name').fill(name);
  await page.locator('#b-msg-setup').click();
  await expect(page.locator('#msg-main')).toBeVisible();

  // Mirrors initMessenger's own IndexedDB open (dbName defaults to 'breeze-messenger',
  // DB_VER 5) and the 'identity' store's 'keys' record written by createIdentity().
  return page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('breeze-messenger', 5);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('identity', 'readonly');
      const getReq = tx.objectStore('identity').get('keys');
      getReq.onsuccess = () => resolve(getReq.result?.pubB64);
      getReq.onerror = () => reject(getReq.error);
    };
  }));
}

// Drives the real add-contact dialog (#b-msg-add -> showPrompt -> resolveAndAdd ->
// addContact -> renderContacts) and opens the resulting contact-list item by clicking it,
// exactly as a user would. resolveAndAdd() names a raw-pubkey add "Contact" (no name
// field in that flow) — each test page adds exactly one contact, so selecting the sole
// rendered .contact item is unambiguous without matching on name.
async function addAndOpen(page, pubB64) {
  await page.locator('#b-msg-add').click();
  const dialog = page.locator('dialog[aria-labelledby]');
  await dialog.locator('.modal-input').fill(pubB64);
  await dialog.locator('[value="ok"]').click();
  await expect(dialog).toBeHidden();

  const contact = page.locator('#msg-contacts .contact');
  await expect(contact).toBeVisible();
  await contact.click();
}

test('two browsers exchange a 1:1 message over the sealed-sender relay', async ({ browser }) => {
  // Distinct synthetic CF-Connecting-IP per context: in production each device has its own
  // IP and thus its own rate-limit bucket (_worker.js caps the IP-less 'unknown' bucket at
  // 5 rpm to stop it being monopolized — see _worker.js's rate limiter). Without this, both
  // browser contexts share one 'unknown' bucket here (no reverse proxy in the local harness)
  // and a two-party flow's combined request volume can trip that 5 rpm cap.
  const aliceCtx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.1' } });
  const bobCtx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.2' } });
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  const alicePub = await createIdentity(alice, 'Alice');
  const bobPub = await createIdentity(bob, 'Bob');

  await addAndOpen(alice, bobPub);
  await addAndOpen(bob, alicePub);

  const text = 'hello from Alice via E2E — ' + Date.now();
  await alice.locator('#msg-input').fill(text);
  await alice.locator('#b-msg-send').click();

  // Bob's poll loop (CONFIG.POLL_FAST_MS = 3s) picks it up via /sealed/poll or /msg/poll.
  await expect(bob.locator('#msg-messages')).toContainText(text, { timeout: 15_000 });

  await aliceCtx.close();
  await bobCtx.close();
});

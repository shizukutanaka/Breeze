// Key-transparency /verify flow — exercises the user-triggered KT audit end to end through
// the real UI: /verify opens the safety-number modal, whose status line resolves by calling
// _auditKeyTransparency -> POST /api/ktlog/get -> _auditKeyHistory (the full auditBundle:
// verifyChain + rollover) against the peer's real server-side append-only key log. This is
// the regression guard for the KT /verify wiring; prior to it that path had only a throwaway
// manual check. Two isolated browser contexts share the same in-memory Worker KV, so Bob's
// prekey upload actually populates the ktlog:<id> entry Alice's audit then fetches.
import { test, expect } from '@playwright/test';

// Distinct synthetic CF-Connecting-IP per context — without it both contexts share the local
// harness's single 'unknown'-IP rate-limit bucket (see messaging.spec.js).
function ctxOpts(ip) {
  return { extraHTTPHeaders: { 'CF-Connecting-IP': ip } };
}

async function createIdentity(page, name) {
  await page.goto('/');
  await page.locator('#msg-name').fill(name);
  await page.locator('#b-msg-setup').click();
  await expect(page.locator('#msg-main')).toBeVisible();
  return page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('breeze-messenger', 5);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction('identity', 'readonly');
      const getReq = tx.objectStore('identity').get('keys');
      getReq.onsuccess = () => resolve(getReq.result?.pubB64);
      getReq.onerror = () => reject(getReq.error);
    };
  }));
}

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

test('/verify auto-verifies a fresh contact against the server key-transparency log', async ({ browser }) => {
  const aliceCtx = await browser.newContext(ctxOpts('203.0.113.21'));
  const bobCtx = await browser.newContext(ctxOpts('203.0.113.22'));
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  const errors = [];
  alice.on('pageerror', (e) => errors.push(e));

  // Bob must exist first: creating his identity uploads his prekey bundle, which is what
  // populates the Worker's ktlog:<bobId> append-only log that Alice's audit will fetch.
  const bobPub = await createIdentity(bob, 'Bob');
  await createIdentity(alice, 'Alice');
  await addAndOpen(alice, bobPub);
  // /verify only opens the modal when a 1:1 conversation is actually active — wait for the
  // compose bar (toggled visible by openConversation) so the click has fully taken effect
  // before issuing the command (otherwise, under parallel load, activeContact can still be null).
  await expect(alice.locator('#msg-input-bar')).toBeVisible();

  // /verify opens the safety-number modal with a live KT status line. Retry the command itself:
  // under 2-worker parallel load the Enter key has been observed to land before the slash-command
  // listener is wired, which drops the command silently — waiting longer cannot recover that, only
  // re-issuing it can. (Observed as a rare 'element(s) not found' on the modal.)
  const modal = alice.locator('.overlay.overlay-dark');
  await expect(async () => {
    await alice.locator('#msg-input').fill('/verify');
    await alice.locator('#msg-input').press('Enter');
    await expect(modal).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
  const status = alice.locator('#kt-audit-status');
  await expect(status).toBeVisible();

  // It starts as the "checking…" placeholder, then resolves. A fresh contact whose key log
  // is untampered and matches the current entry must land on the "verified" (ktOk) outcome,
  // rendered green — never the rolled/tampered/unavailable states.
  await expect(status).toHaveClass(/color-g/, { timeout: 10_000 });
  await expect(status).toContainText('verified');

  expect(errors, 'no uncaught errors during the KT audit').toEqual([]);

  await aliceCtx.close();
  await bobCtx.close();
});

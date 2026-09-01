// First-ever real-browser E2E for the shipped index.html. Every other test in this
// repo verifies extracted function fragments (vitest + mirror-drift) or Worker
// handlers called directly — none of them ever load index.html as an actual document
// and let a real browser parse/execute it end to end. This catches what those can't:
// a runtime error during boot, a broken DOM id a script references, or the setup flow
// silently failing in a real Chromium.
import { test, expect } from '@playwright/test';

test('boots to the setup screen with no console errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(new Error(msg.text())); });

  await page.goto('/');
  await expect(page.locator('#msg-setup')).toBeVisible();
  await expect(page.locator('#msg-main')).toBeHidden();
  expect(errors, 'no uncaught errors or console.error during boot').toEqual([]);
});

test('creating an identity reveals the main messenger UI', async ({ page }) => {
  await page.goto('/');
  await page.locator('#msg-name').fill('E2E Smoke Test');
  await page.locator('#b-msg-setup').click();

  await expect(page.locator('#msg-main')).toBeVisible();
  await expect(page.locator('#msg-setup')).toBeHidden();
  // Check the container the app explicitly toggles (b-msg-setup's click handler
  // removes 'hidden' from #msg-input-bar) rather than the nested textarea directly —
  // more robust against incidental layout/rendering details of the inner element.
  await expect(page.locator('#msg-input-bar')).toBeVisible();
  await expect(page.locator('#msg-input')).toBeAttached();
});

// The existing reload test proves the IDENTITY survives. It never checked that the contact
// LIST comes back — and "reopen the app, your contacts are gone" would be about the worst
// bug a messenger can have, so it gets its own assertion rather than being assumed.
test('the contact list survives a reload', async ({ browser }) => {
  const ctxA = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.70' } });
  const ctxB = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.71' } });
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  const idOf = async (page, name) => {
    await page.goto('/');
    await page.locator('#msg-name').fill(name);
    await page.locator('#b-msg-setup').click();
    await expect(page.locator('#msg-main')).toBeVisible();
    return page.evaluate(() => new Promise((resolve) => {
      const req = indexedDB.open('breeze-messenger', 5);
      req.onsuccess = () => {
        req.result.transaction('identity', 'readonly').objectStore('identity').get('keys')
          .onsuccess = (e) => resolve(e.target.result?.pubB64);
      };
    }));
  };
  await idOf(A, 'Keeper');
  const pubB = await idOf(B, 'Kept');

  await A.locator('#b-msg-add').click();
  const dialog = A.locator('dialog[aria-labelledby]');
  await dialog.locator('.modal-input').fill(pubB);
  await dialog.locator('[value="ok"]').click();
  await expect(dialog).toBeHidden();
  await expect(A.locator('#msg-contacts .contact')).toHaveCount(1);

  await A.reload();
  await expect(A.locator('#msg-main')).toBeVisible();
  await expect(A.locator('#msg-contacts .contact')).toHaveCount(1, { timeout: 15_000 });

  await ctxA.close(); await ctxB.close();
});

// The severe half of the same failure. The contact list vanishing is what you SEE; boot
// aborting part-way is what actually happened, and everything after the abort — including
// startPolling() — never runs. So this asserts the thing a user would notice second and
// care about most: after reopening the app, do messages still arrive at all?
test('messages still arrive after a reload (boot runs to completion)', async ({ browser }) => {
  // Two identities, two contact adds, a reload and a real delivery: the default 30 s budget
  // fits this in isolation but not under full-suite load. multidevice.spec.js raises its
  // budget for the same reason — a slow test is not a failing one.
  test.setTimeout(60_000);
  const ctxA = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.74' } });
  const ctxB = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.75' } });
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  const idOf = async (page, name) => {
    await page.goto('/');
    await page.locator('#msg-name').fill(name);
    await page.locator('#b-msg-setup').click();
    await expect(page.locator('#msg-main')).toBeVisible();
    return page.evaluate(() => new Promise((resolve) => {
      const req = indexedDB.open('breeze-messenger', 5);
      req.onsuccess = () => {
        req.result.transaction('identity', 'readonly').objectStore('identity').get('keys')
          .onsuccess = (e) => resolve(e.target.result?.pubB64);
      };
    }));
  };
  const pubA = await idOf(A, 'Returner');
  const pubB = await idOf(B, 'Sender');

  // A adds B, then RELOADS — simulating simply reopening the app tomorrow.
  await A.locator('#b-msg-add').click();
  const dlg = A.locator('dialog[aria-labelledby]');
  await dlg.locator('.modal-input').fill(pubB);
  await dlg.locator('[value="ok"]').click();
  await expect(dlg).toBeHidden();
  await A.reload();
  await expect(A.locator('#msg-main')).toBeVisible();

  // B sends. If boot aborted, startPolling() never ran and this never arrives.
  await B.locator('#b-msg-add').click();
  const dlgB = B.locator('dialog[aria-labelledby]');
  await dlgB.locator('.modal-input').fill(pubA);
  await dlgB.locator('[value="ok"]').click();
  await expect(dlgB).toBeHidden();
  await B.locator('#msg-contacts .contact').first().click();
  await expect(B.locator('#msg-input-bar')).toBeVisible();
  const probe = 'sent after the other side reloaded ' + Date.now();
  await B.locator('#msg-input').fill(probe);
  await B.locator('#b-msg-send').click();

  await expect.poll(async () => A.evaluate((needle) => new Promise((r) => {
    const q = indexedDB.open('breeze-messenger', 5);
    q.onsuccess = () => {
      let found = false;
      q.result.transaction('messages', 'readonly').objectStore('messages').openCursor().onsuccess = (e) => {
        const cur = e.target.result;
        if (cur) { if ((cur.value.text || '').includes(needle)) found = true; cur.continue(); } else r(found);
      };
    };
  }), probe), { timeout: 15_000 }).toBe(true);

  await ctxA.close(); await ctxB.close();
});

test('identity persists across a reload (IndexedDB actually wrote)', async ({ page }) => {
  await page.goto('/');
  await page.locator('#msg-name').fill('Persisted Identity');
  await page.locator('#b-msg-setup').click();
  await expect(page.locator('#msg-main')).toBeVisible();

  await page.reload();
  // A returning identity skips setup entirely and goes straight to the main UI.
  await expect(page.locator('#msg-main')).toBeVisible();
  await expect(page.locator('#msg-setup')).toBeHidden();
});

// Multi-account E2E — the last lifecycle state with no coverage at all.
//
// Grepping the suite found zero tests touching switchAccount, and reaching for one exposed why:
// the "+" that creates a second account lives inside the account tab bar, and the tab bar was
// only built once you already had two accounts. A bootstrap deadlock — the whole subsystem
// (per-account databases, switching, cross-account unread, Ctrl+1..9) was complete and
// unreachable. Settings now carries the entry point, and these tests keep the door open.
import { test, expect } from '@playwright/test';

const ctxOpts = (ip) => ({ extraHTTPHeaders: { 'CF-Connecting-IP': ip } });

async function createIdentity(page, name) {
  await page.addInitScript(() => { try { localStorage.setItem('brz-consent', String(Date.now())); } catch {} });
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
}

test('a second account is reachable, isolated, and switching back restores the first', async ({ browser }) => {
  test.setTimeout(90_000);
  const ctxA = await browser.newContext(ctxOpts('203.0.113.92'));
  const ctxB = await browser.newContext(ctxOpts('203.0.113.93'));
  const page = await ctxA.newPage(), other = await ctxB.newPage();
  await createIdentity(page, 'Work');
  const pubOther = await createIdentity(other, 'Someone');

  // Account 1 gets a contact — the thing that must NOT leak into account 2.
  await page.locator('#b-msg-add').click();
  const addDlg = page.locator('dialog[aria-labelledby]');
  await addDlg.locator('.modal-input').fill(pubOther);
  await addDlg.locator('[value="ok"]').click();
  await expect(addDlg).toBeHidden();
  await expect(page.locator('#msg-contacts .contact')).toHaveCount(1);

  // Create the second account through Settings (the entry point that did not exist before).
  await page.locator('#msg-input').fill('/settings');
  await page.locator('#msg-input').press('Enter');
  await page.locator('[data-action="add-account"]').click();
  const namePrompt = page.locator('dialog[aria-labelledby]');
  await expect(namePrompt).toBeVisible();
  await namePrompt.locator('.modal-input').fill('Personal');
  await namePrompt.locator('[value="ok"]').click();
  const avatarPrompt = page.locator('dialog[aria-labelledby]');
  await expect(avatarPrompt).toBeVisible();
  await avatarPrompt.locator('[value="ok"]').click(); // accept the preset avatar

  // The second account starts clean: its own database, so account 1's contact is absent.
  // (It lands on setup because the new database has no identity yet — that is correct.)
  await expect(page.locator('#msg-contacts .contact')).toHaveCount(0, { timeout: 20_000 });
  // ...and the tab bar now exists, because two accounts is when switching becomes meaningful.
  await expect(page.locator('#acc-tabs')).toBeVisible();
  await expect(page.locator('.acc-add')).toBeVisible();

  // Switching back to account 1 restores its contact — a second initMessenger() must not
  // have damaged the first account's state (the boot sequence runs again on every switch).
  await page.locator('#acc-tabs .acc-tab, #acc-tabs > div').first().click();
  await expect(page.locator('#msg-contacts .contact')).toHaveCount(1, { timeout: 20_000 });

  await ctxA.close(); await ctxB.close();
});

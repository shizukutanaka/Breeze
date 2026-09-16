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

// .acc-add ("+", add another account) had an aria-label but no tabIndex at all — a
// keyboard user could never Tab to it, let alone activate it. Found sweeping the whole
// file mechanically for the same shape as showMsgMenu's keyboard-access bug (a
// non-native <div>/<span> with an onclick and no tabIndex anywhere), after that fix
// turned up two more real instances. aria-label without focusability tells a screen
// reader a labeled control exists while leaving it completely unreachable — arguably
// worse than no label at all, since it reads as present and simply is not.
test('the "add account" button is keyboard-reachable and activatable', async ({ browser }) => {
  test.setTimeout(60_000);
  const ctx = await browser.newContext(ctxOpts('203.0.113.94'));
  const page = await ctx.newPage();
  await createIdentity(page, 'Keyboard A11y');

  await page.locator('#msg-input').fill('/settings');
  await page.locator('#msg-input').press('Enter');
  await page.locator('[data-action="add-account"]').click();
  const namePrompt = page.locator('dialog[aria-labelledby]');
  await expect(namePrompt).toBeVisible();
  await namePrompt.locator('.modal-input').fill('Second');
  await namePrompt.locator('[value="ok"]').click();
  const avatarPrompt = page.locator('dialog[aria-labelledby]');
  await expect(avatarPrompt).toBeVisible();
  await avatarPrompt.locator('[value="ok"]').click();
  await expect(page.locator('.acc-add')).toBeVisible();

  await expect(page.locator('.acc-add')).toHaveAttribute('tabindex', '0');
  await expect(page.locator('.acc-add')).toHaveAttribute('role', 'button');
  await page.locator('.acc-add').focus();
  await expect(page.locator('.acc-add')).toBeFocused();

  // Enter on the focused element should trigger the same addAccount() flow the click
  // handler does — a THIRD account-name prompt appears.
  await page.keyboard.press('Enter');
  const thirdNamePrompt = page.locator('dialog[aria-labelledby]');
  await expect(thirdNamePrompt).toBeVisible();

  await ctx.close();
});

// _messengerCleanup (which calls _ac.abort(), tearing down every listener registered
// with { signal: _ac.signal } — wake lock, panic-wipe, idle-lock, presence/poll
// visibilitychange handlers) used to be defined ONLY inside _boot()'s `if (hasId)`
// branch. That branch is false on exactly one occasion per account: its very first
// boot, right after identity creation (loadIdentity() has nothing to find yet) — the
// setup-completion handler duplicates the REST of that branch's effects (starting
// presence/polling/etc.) to reach the same live state, but never reached this
// assignment. Every account's first-ever live session therefore left
// _messengerCleanup null; the first switch away from it found nothing to call, and
// every _ac-scoped listener it had registered stayed attached forever. Switching
// between accounts that had ALREADY completed one full "existing identity" boot
// cleaned up correctly every time — masking the bug for anyone who reloaded before
// their first switch.
test('switching away from a freshly-created account does not leak its event listeners', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => { try { localStorage.setItem('brz-consent', String(Date.now())); } catch {} });
  await page.goto('/');
  await page.locator('#msg-name').fill('Leak Check');
  await page.locator('#b-msg-setup').click();
  await expect(page.locator('#msg-main')).toBeVisible();

  // DOMDebugger.getEventListeners is the only reliable way to count real, attached DOM
  // listeners — there is no portable JS-level API for it.
  const client = await page.context().newCDPSession(page);
  const countDocListeners = async () => {
    const { result } = await client.send('Runtime.evaluate', { expression: 'document', returnByValue: false });
    const { listeners } = await client.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
    const byType = {};
    for (const l of listeners) byType[l.type] = (byType[l.type] || 0) + 1;
    return byType;
  };

  // Create a SECOND account and finish its own setup — the exact case that never
  // reached the cleanup registration: a brand-new identity's first live session.
  await page.locator('#msg-input').fill('/settings');
  await page.locator('#msg-input').press('Enter');
  await page.locator('[data-action="add-account"]').click();
  const namePrompt = page.locator('dialog[aria-labelledby]');
  await namePrompt.locator('.modal-input').fill('Acc2');
  await namePrompt.locator('[value="ok"]').click();
  const avatarPrompt = page.locator('dialog[aria-labelledby]');
  await avatarPrompt.locator('[value="ok"]').click();
  await expect(page.locator('.acc-add')).toBeVisible();
  if (await page.locator('#msg-setup').isVisible().catch(() => false)) {
    await page.locator('#msg-name').fill('Acc2');
    await page.locator('#b-msg-setup').click();
    await expect(page.locator('#msg-main')).toBeVisible();
  }

  const before = await countDocListeners();

  // Switch away from and back to each account several times.
  for (let round = 0; round < 4; round++) {
    const tabs = page.locator('#acc-tabs .acc-tab, #acc-tabs > div');
    const count = await tabs.count();
    for (let i = 0; i < count - 1; i++) { // skip the last one, the "+" add button
      await tabs.nth(i).click();
      await page.waitForTimeout(300);
    }
  }

  const after = await countDocListeners();
  // A small amount of noise is fine; the bug produced UNBOUNDED growth (roughly one
  // extra full batch of listeners per switch), not a couple of stray entries.
  for (const type of Object.keys(after)) {
    expect(after[type], `document listener count for "${type}" did not grow across repeated switches`)
      .toBeLessThanOrEqual((before[type] || 0) + 2);
  }
});

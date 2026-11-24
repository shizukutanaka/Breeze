// The /lock screen in a real browser. It used to be a <div> appended over the app, which
// left two ways past it that need no password — both reproduced against the shipped page
// before the fix, and both asserted here:
//   1. reload: the locked state lived only in the DOM, so the app booted unlocked;
//   2. Tab: focus walked to the composer behind the overlay, where '/lock reset'
//      deleted the lock password.
// tests/lock-screen.test.js covers the same code in vitest (CI does not run Playwright).
import { test, expect } from '@playwright/test';
import { createIdentity } from './helpers.mjs';

const PASSWORD = 'correct horse';

// Sets a lock password through the real /lock command, then locks with a second /lock.
async function lock(page) {
  const composer = page.locator('#msg-input');
  await composer.fill('/lock');
  await composer.press('Enter');
  await page.locator('dialog[open] .modal-input').fill(PASSWORD);
  await page.locator('dialog[open] button[value="ok"]').click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('brz-lock-hash'))).not.toBeNull();
  await composer.fill('/lock');
  await composer.press('Enter');
  await expect(page.locator('#lock-screen')).toBeVisible();
}

async function openChat(browser) {
  const ctxA = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.96' } });
  const ctxB = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.97' } });
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  await createIdentity(A, 'Locker');
  const pubB = await createIdentity(B, 'Other');
  await A.locator('#b-msg-add').click();
  const panel = A.locator('#msg-messages .cmd-panel').last();
  await panel.locator('.modal-input').fill(pubB);
  await panel.locator('button.btn-g').click();
  await A.locator('#msg-contacts .contact').click();
  await expect(A.locator('#msg-input-bar')).toBeVisible();
  return { A, close: async () => { await ctxA.close(); await ctxB.close(); } };
}

test('a reload does not drop the lock screen', async ({ browser }) => {
  const { A, close } = await openChat(browser);
  await lock(A);

  await A.reload();
  await expect(A.locator('#lock-screen')).toBeVisible();
  // Still locked once the app behind it has finished booting.
  await expect(A.locator('#msg-main')).toBeAttached();
  await A.waitForTimeout(1500);
  await expect(A.locator('#lock-screen')).toBeVisible();

  // The password still opens it, and an unlocked app stays unlocked across a reload.
  await A.locator('#lock-screen .lock-input').fill(PASSWORD);
  await A.locator('#lock-screen button').click();
  await expect(A.locator('#lock-screen')).toHaveCount(0);
  await A.reload();
  await expect(A.locator('#b-msg-add')).toBeVisible();
  await A.waitForTimeout(1000);
  await expect(A.locator('#lock-screen')).toHaveCount(0);
  await close();
});

test('the keyboard cannot reach the app behind the lock screen', async ({ browser }) => {
  const { A, close } = await openChat(browser);
  await lock(A);

  for (let i = 0; i < 60; i++) {
    await A.keyboard.press('Tab');
    const outside = await A.evaluate(() => {
      const a = document.activeElement;
      return a && a !== document.body && !a.closest('#lock-screen') ? (a.id || a.className || a.tagName) : null;
    });
    expect(outside, 'focus left the lock screen').toBeNull();
  }
  // What the old overlay let through: a command typed into the composer behind it.
  await A.keyboard.type('/lock reset');
  await A.keyboard.press('Enter');
  await A.keyboard.press('Escape');
  await A.keyboard.press('Escape');
  await A.keyboard.press('?');
  await A.waitForTimeout(500);
  expect(await A.evaluate(() => localStorage.getItem('brz-lock-hash'))).not.toBeNull();
  await expect(A.locator('#lock-screen')).toBeVisible();
  await expect(A.locator('.kbd-overlay')).toHaveCount(0);
  await close();
});

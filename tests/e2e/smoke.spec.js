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

import { test, expect } from '@playwright/test';
import { createIdentity, seedConsent, openAddContact } from './helpers.mjs';

test('delayed app modules are used by the first messenger session', async ({ page }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/src/app/p2p-stats.js', async route => {
    await held;
    await route.continue();
  });
  await seedConsent(page);
  await page.goto('/', { waitUntil: 'commit' });
  try {
    await page.waitForFunction(() => document.readyState === 'interactive');
    expect(await page.evaluate(() => performance.getEntriesByName('brz:initMessenger').length)).toBe(0);
  } finally { release(); }
  await page.waitForLoadState('domcontentloaded');
  await createIdentity(page, 'Delayed Modules', { navigate: false });

  await openAddContact(page);
  const dialog = page.locator('dialog[open] .add-form-contact');
  const pub = await page.evaluate(() => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))));
  await dialog.locator('.modal-input').fill(pub);
  await dialog.locator('button.btn-g').click();
  await expect(dialog).toBeHidden();
  await page.locator('#msg-contacts .contact:not(.self-card)').click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('brz-p2p-signal') || '{}').preEstablished || 0)).toBeGreaterThan(0);
  await page.locator('#msg-input').fill('/security');
  await page.locator('#msg-input').press('Enter');
  const panel = page.locator('.cmd-panel-mono').last();
  await expect(panel).toContainText('Poll sessions 1');
  await expect(panel).toContainText('✓ Per-session ECDSA P-256');
});

// The app bridges are STATIC imports of one <script type="module"> block, so one failed
// fetch aborts the whole block and every bridge stays unset (tests/sw-assets.test.js pins
// the precache that makes this rare). This test used to expect /security to render an
// inert "no data yet" panel — true only while /security lived in the classic script; since
// it moved into src/app/info-panels.js the command had nothing to call and printed
// nothing at all. What must hold: the app still boots and messaging still works, and the
// user is TOLD that features are missing instead of commands silently doing nothing.
test('a failed app-module dependency still boots, and says features are missing', async ({ page }) => {
  await page.route('**/src/app/p2p-stats.js', route => route.abort('failed'));
  await createIdentity(page, 'Failed Modules');
  await expect(page.locator('.toast', { hasText: 'Some features failed to load. Please reload.' })).toBeVisible();
  // Booted for real: the composer is live and the add-contact surface (classic script) works.
  await openAddContact(page);
  await expect(page.locator('dialog[open] .add-form-contact .modal-input')).toBeVisible();
});

test('no missing-features notice when every app module loads', async ({ page }) => {
  await createIdentity(page, 'Healthy Modules');
  await expect(page.locator('#msg-input')).toBeVisible();
  await expect(page.locator('.toast', { hasText: 'Some features failed to load' })).toHaveCount(0);
});

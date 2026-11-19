import { test, expect } from '@playwright/test';
import { createIdentity, seedConsent } from './helpers.mjs';

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

  await page.locator('#b-msg-add').click();
  const dialog = page.locator('dialog[aria-labelledby]');
  const pub = await page.evaluate(() => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))));
  await dialog.locator('.modal-input').fill(pub);
  await dialog.locator('[value="ok"]').click();
  await expect(dialog).toBeHidden();
  await page.locator('#msg-contacts .contact').click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('brz-p2p-signal') || '{}').preEstablished || 0)).toBeGreaterThan(0);
  await page.locator('#msg-input').fill('/security');
  await page.locator('#msg-input').press('Enter');
  const panel = page.locator('.cmd-panel-mono').last();
  await expect(panel).toContainText('Poll sessions 1');
  await expect(panel).toContainText('✓ Per-session ECDSA P-256');
});

test('a failed app-module dependency still boots with inert fallbacks', async ({ page }) => {
  await page.route('**/src/app/p2p-stats.js', route => route.abort('failed'));
  await createIdentity(page, 'Failed Modules');
  await page.locator('#msg-input').fill('/security');
  await page.locator('#msg-input').press('Enter');
  const panel = page.locator('.cmd-panel-mono').last();
  await expect(panel).toContainText('Signaling poll requests (on-device): no data yet');
  await expect(panel).toContainText('Fresh RTC Certificate: ✗ Default');
});

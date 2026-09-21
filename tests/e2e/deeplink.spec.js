// Deep-link and command-regression guards for features that have no other coverage.
//
// 1. `/?settings` — the PWA manifest "Settings" shortcut targets this URL. The param is
//    read by _openSettingsFromUrl() AFTER add/join param processing, on BOTH boot paths
//    (returning identity and fresh setup). A regression here is invisible to unit tests:
//    the manifest advertises it, the handler exists, and nothing breaks — the shortcut
//    just silently stops doing anything.
// 2. `/codeverify` — the C8 served-vs-repo integrity check. Its GitHub fetches depend on
//    external network, so this asserts only the deterministic part: the command renders
//    its panel and reports the locally-computed served-hash line (fetching /index.html
//    against the local harness always succeeds), never throwing regardless of whether
//    raw.githubusercontent.com is reachable.
import { test, expect } from '@playwright/test';

async function createIdentity(page, name) {
  await page.locator('#msg-name').fill(name);
  await page.locator('#b-msg-setup').click();
  await expect(page.locator('#msg-main')).toBeVisible();
  await expect(page.locator('#msg-input-bar')).toBeVisible();
}

test('/?settings opens the settings panel right after onboarding (manifest shortcut)', async ({ page }) => {
  // The param must survive the setup click — _openSettingsFromUrl runs at the end of
  // the create-identity path, while the URL still carries ?settings.
  await page.goto('/?settings');
  await createIdentity(page, 'Deeplink');
  await expect(page.locator('.cmd-panel-mono').filter({ has: page.locator('[data-setting="hide-rr"]') })).toBeVisible({ timeout: 10_000 });
});

test('/?settings also opens the settings panel on the returning-user boot path', async ({ page }) => {
  // First visit creates an identity WITHOUT the param…
  await page.goto('/');
  await createIdentity(page, 'Deeplink');
  // …then a reload WITH it must hit _boot()'s hasId branch — different call site.
  await page.goto('/?settings');
  await expect(page.locator('.cmd-panel-mono').filter({ has: page.locator('[data-setting="hide-rr"]') })).toBeVisible({ timeout: 10_000 });
});

test('/codeverify renders its verdict panel (served-hash line is local and deterministic)', async ({ browser }) => {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.80' } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e));

  await page.goto('/');
  await createIdentity(page, 'CV');
  await page.locator('#msg-input').fill('/codeverify');
  await page.locator('#msg-input').press('Enter');

  const panel = page.locator('.cmd-panel-mono').last();
  await expect(panel).toBeVisible();
  // Resolves out of the "checking…" placeholder into either the hash report (the
  // served /index.html fetch always succeeds against the local harness) or a clean
  // failure message — both prove the command ran rather than dead-wiring.
  await expect(panel).toContainText(/SHA-256|failed|unreachable/i, { timeout: 15_000 });
  expect(errors, 'no uncaught errors during /codeverify').toEqual([]);
  await ctx.close();
});

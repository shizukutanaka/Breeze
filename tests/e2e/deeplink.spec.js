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
  // Same retry-the-command pattern as verify.spec.js — under load the Enter can land
  // before the slash-command listener is wired, silently dropping the command.
  const panel = page.locator('.cmd-panel-mono').last();
  await expect(async () => {
    await page.locator('#msg-input').fill('/codeverify');
    await page.locator('#msg-input').press('Enter');
    await expect(panel).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
  await expect(panel).toBeVisible();
  // Resolves out of the "checking…" placeholder into either the hash report (the
  // served /index.html fetch always succeeds against the local harness) or a clean
  // failure message — both prove the command ran rather than dead-wiring.
  await expect(panel).toContainText(/SHA-256|failed|unreachable/i, { timeout: 15_000 });
  expect(errors, 'no uncaught errors during /codeverify').toEqual([]);
  await ctx.close();
});

// Full dead-drop round-trip through the REAL stack: /drop encrypts client-side
// (AES-GCM, key in the URL fragment — never sent), the Worker stores only ciphertext,
// and a fresh browser context at ?drop=<id>#<key> must recover the exact plaintext.
// Guards the whole security contract in one shot: fragment-not-sent, one-time read,
// and the decrypt path in index.html's drop page.
test('/drop <secret> produces a link that a fresh context opens exactly once', async ({ browser }) => {
  const alice = await (await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.90' } })).newPage();
  await alice.goto('/');
  await createIdentity(alice, 'Dropper');
  const secret = 'launch-codes-' + Date.now();
  await alice.locator('#msg-input').fill('/drop ' + secret);
  await alice.locator('#msg-input').press('Enter');

  const link = alice.locator('#drop-url-copy');
  await expect(link).toBeVisible({ timeout: 10_000 });
  const url = await link.textContent();
  expect(url).toMatch(/\?drop=[A-Za-z0-9]+#[A-Za-z0-9+/=]+/);

  // Fresh context = the recipient. The drop page replaces the whole document body.
  const bob = await (await browser.newContext()).newPage();
  await bob.goto(url);
  await expect(bob.locator('#drop-content')).toContainText(secret, { timeout: 10_000 });

  // One-time read: a second visit must report expired — the Worker consumed the slot.
  const carol = await (await browser.newContext()).newPage();
  await carol.goto(url);
  await expect(carol.locator('#drop-status')).toContainText(/expired|already|failed|invalid/i, { timeout: 10_000 });
});

// /room regression: the old private implementation put a client-generated 'room:<id>'
// in ?join= while the Worker indexes groups by the SERVER token — every link 404'd.
// This spec drives the full loop: create → link → fresh context joins and lands in the
// group conversation.
test('/room produces a join link a fresh context can actually join', async ({ browser }) => {
  const alice = await (await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.91' } })).newPage();
  await alice.goto('/');
  await createIdentity(alice, 'Roomer');
  await expect(async () => {
    await alice.locator('#msg-input').fill('/room e2e-room');
    await alice.locator('#msg-input').press('Enter');
    await expect(alice.locator('.i-mono-box').last()).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
  const url = await alice.locator('.i-mono-box').last().textContent();
  expect(url).toMatch(/\?join=[a-z0-9]+$/);
  // Creator must have a local contact for the room (the old path never made one).
  await expect(alice.locator('#msg-contacts .contact').first()).toBeVisible();

  const bob = await (await browser.newContext()).newPage();
  await bob.goto(url);
  // Setup screen personalizes to the group; completing onboarding joins it.
  await bob.locator('#msg-name').fill('Joiner');
  await bob.locator('#b-msg-setup').click();
  await expect(bob.locator('#msg-main')).toBeVisible({ timeout: 15_000 });
  await expect(bob.locator('#msg-contacts .contact').first()).toBeVisible({ timeout: 15_000 });
});

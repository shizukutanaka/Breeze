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

// ?add=<garbage> used to plant a contact whose "key" could never complete a handshake —
// a dead entry that looks real until the first send fails. addContact now rejects anything
// that isn't a 32-byte X25519 or 65-byte P-256 raw public key.
test('/?add=<garbage> is refused with a toast instead of planting a dead contact', async ({ page }) => {
  await page.goto('/');
  await createIdentity(page, 'AddTarget');
  await page.goto('/?add=this-is-not-a-key&name=Phantom');
  await expect(page.locator('#msg-main')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.toast-container .toast').filter({ hasText: /not a valid/i }).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#msg-contacts .contact')).toHaveCount(0);
});

// Drafts used to live in localStorage as plaintext, shared across accounts — and the
// "save drafts before reload" handler on SW update referenced _drafts outside its scope,
// silently writing `{}` and wiping them. Now persisted per-account in the IDB settings
// store: type → switch contact → switch back → reload → still there; localStorage empty.
test('drafts persist across contact switch and reload via IDB, not localStorage', async ({ page }) => {
  const key = (b) => Buffer.alloc(32, b).toString('base64'); // valid X25519-length keys
  await page.goto(`/?add=${encodeURIComponent(key(11))}&name=DraftA`);
  await createIdentity(page, 'Drafter');
  await page.goto(`/?add=${encodeURIComponent(key(22))}&name=DraftB`);
  await expect(page.locator('#msg-contacts .contact')).toHaveCount(2, { timeout: 10_000 });
  await page.locator('#msg-contacts .contact').first().click();
  await page.locator('#msg-input').fill('unsent draft text');
  await page.locator('#msg-contacts .contact').nth(1).click();   // switch away → saves draft
  await page.locator('#msg-contacts .contact').first().click();  // back → draft restores
  await expect(page.locator('#msg-input')).toHaveValue('unsent draft text');
  await page.reload();
  await expect(page.locator('#msg-main')).toBeVisible({ timeout: 15_000 });
  await page.locator('#msg-contacts .contact').first().click();
  await expect(page.locator('#msg-input')).toHaveValue('unsent draft text');
  expect(await page.evaluate(() => localStorage.getItem('brz-drafts'))).toBeNull();
});

// /?open=<contactId> — the OS-notification tap deep-link. sw.js's notificationclick
// handler opens this URL, but nothing read the param — a tap landed on the contact list
// instead of the conversation (same dead-shortcut class as ?settings).
test('/?open=<contactId> opens that conversation on boot', async ({ page }) => {
  const key = Buffer.alloc(32, 9).toString('base64');
  await page.goto(`/?add=${encodeURIComponent(key)}&name=DeepOpen`);
  await createIdentity(page, 'Opener');
  await expect(page.locator('#msg-contacts .contact')).toHaveCount(1, { timeout: 10_000 });
  const cid = key.slice(0, 12); // contact id = pub prefix
  await page.goto(`/?open=${encodeURIComponent(cid)}`);
  await expect(page.locator('#msg-main')).toBeVisible({ timeout: 15_000 });
  // The conversation must be open: the input bar is shown only inside a conversation.
  await expect(page.locator('#msg-input')).toBeVisible({ timeout: 10_000 });
});

// Unknown contact id must not crash boot — falls back to the contact list.
test('/?open=<unknown> boots to the contact list without throwing', async ({ page }) => {
  await page.goto('/');
  await createIdentity(page, 'Opener2');
  await page.goto('/?open=definitely-not-a-contact');
  await expect(page.locator('#msg-main')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#msg-contacts')).toBeVisible();
});

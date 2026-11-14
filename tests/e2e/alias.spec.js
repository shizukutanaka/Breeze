// Alias-release E2E — /api/alias/delete existed, fully unit-tested, and utterly unreachable.
//
// The client's `/alias newname` command sets a new @handle and never released the old one:
// no TTL on alias records ("aliases are permanent"), so every previous @handle was left
// squatting on the relay forever, unreclaimable, still resolving to a now-orphaned identity.
// The Worker endpoint built to fix exactly this ("release a vanity alias without deleting the
// account") was never called from anywhere in index.html — the third instance this session of
// the same class of bug: a complete, well-tested feature with no door into it.
//
// Fixing the wiring surfaced a SECOND, independent bug in the same command: the success toast
// called `t('toastAliasSet')(newAlias)` — the string t() RETURNS, invoked as a function — which
// throws a TypeError immediately after the rename actually succeeds. The global
// unhandledrejection handler then showed the user a raw JS error instead of a confirmation, and
// (worse, in the sibling /schedule command bitten by the identical typo) the throw landed
// BEFORE the delivery timer was armed. tools/i18n-check.mjs gate 8 now catches this class.
import { test, expect } from '@playwright/test';
import { createIdentity } from './helpers.mjs';


test('renaming your @alias releases the OLD handle instead of squatting it forever', async ({ browser }) => {
  // The REAL cost here is the client's actual difficulty-20 PoW solves — one for the
  // setup claim, one for the rename itself (measured ~16s each on a fast machine, more
  // with variance) — that is the exact code a user's browser runs, so it is exercised
  // for real rather than faked.
  test.setTimeout(180_000);
  // Own context with a dedicated IP: /api/alias/set is rate-limited (10/min) and this test
  // makes two set calls plus several get calls, so sharing the suite's default IP with other
  // alias-touching tests risks a 429 that looks like a product failure but is only test
  // cross-contamination — the same reason every other spec in this suite picks its own IP.
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.97' } });
  const page = await ctx.newPage();

  // The old handle is claimed the way a real user gets one: typed into the setup form
  // at identity creation. Since recovery-plan step 5 the Worker requires an Ed25519
  // ownership signature for registration, so the previous setup trick — an unsigned
  // direct /api/alias/set from the test — is refused by design (AUTH_REQUIRED); the
  // client's own claim path (bundle upload, then signed + PoW claim) is the only way
  // in, which also makes this spec cover the step-5 creation-time claim for real.
  const oldAlias = 'oldh' + Date.now().toString(36).slice(-8);
  await createIdentity(page, 'Renamer', { alias: oldAlias });

  // Sanity: the old alias genuinely resolves server-side before the rename, and the
  // identity record the client persisted names it (the claim actually landed).
  await expect.poll(async () => {
    const r = await page.request.post('/api/alias/get', { data: { alias: oldAlias } });
    return r.status();
  }, { timeout: 15_000 }).toBe(200);

  // The fix under test: rename through the ACTUAL client command (real 20-bit PoW solve).
  const newAlias = 'newh' + Date.now().toString(36).slice(-8);
  await page.locator('#msg-input').fill(`/alias ${newAlias}`);
  await page.locator('#msg-input').press('Enter');
  // Confirms BOTH bugs are fixed at once: if the t()(args) TypeError were still present, this
  // success toast would never render (the unhandled-rejection toast would show instead, and
  // would not contain the new alias name).
  await expect(page.locator('.toast-container')).toContainText(newAlias, { timeout: 90_000 });

  // The new alias resolves...
  const afterNew = await page.request.post('/api/alias/get', { data: { alias: newAlias } });
  expect(afterNew.status()).toBe(200);

  // ...and the OLD one is released — the actual bug this test exists to pin.
  await expect.poll(async () => {
    const r = await page.request.post('/api/alias/get', { data: { alias: oldAlias } });
    return r.status();
  }, { timeout: 10_000 }).toBe(404);

  await ctx.close();
});

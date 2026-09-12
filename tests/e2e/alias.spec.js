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

// Cheap PoW solve for TEST SETUP only — seeding a pre-existing alias directly via the Worker
// API. The E2E harness's MIN_POW_DIFFICULTY floor is 8 (tests/helpers/mockKV.js), well below
// the shipped client's hardcoded CONFIG.POW_DIFFICULTY of 20, so this setup solve is near-
// instant. It is NOT a substitute for exercising the real client path — see below.
async function solveCheapPoW(challenge, difficulty) {
  const target = Math.pow(2, 32 - difficulty) >>> 0;
  let nonce = 0;
  for (;;) {
    const hash = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${challenge}:${nonce}`));
    if (new DataView(hash).getUint32(0, false) < target) return { challenge, nonce, difficulty };
    nonce++;
  }
}

test('renaming your @alias releases the OLD handle instead of squatting it forever', async ({ browser }) => {
  // The one REAL cost here is the client's actual difficulty-20 PoW solve for the rename
  // itself (measured ~16s on a fast machine, more with variance) — that is the exact code a
  // user's browser runs, so it is exercised for real rather than faked.
  test.setTimeout(120_000);
  // Own context with a dedicated IP: /api/alias/set is rate-limited (10/min) and this test
  // makes two set calls plus several get calls, so sharing the suite's default IP with other
  // alias-touching tests risks a 429 that looks like a product failure but is only test
  // cross-contamination — the same reason every other spec in this suite picks its own IP.
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.97' } });
  const page = await ctx.newPage();
  const pub = await createIdentity(page, 'Renamer');

  const oldAlias = 'oldh' + Date.now().toString(36).slice(-8);
  const seedChallenge = `${pub}:${oldAlias}:${Date.now()}`;
  const seedPow = await solveCheapPoW(seedChallenge, 8);
  const seedResp = await page.request.post('/api/alias/set', {
    data: { alias: oldAlias, pub, name: 'Renamer', pow: seedPow },
  });
  expect(seedResp.ok()).toBe(true);

  // Point the running client at the seeded alias — mirrors how a real user would have gotten
  // there (set once in an earlier session, persisted to identity.keys.alias, reloaded).
  await page.evaluate((alias) => new Promise((resolve, reject) => {
    const req = indexedDB.open('breeze-messenger', 5);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const store = req.result.transaction('identity', 'readwrite').objectStore('identity');
      const getReq = store.get('keys');
      getReq.onsuccess = () => {
        const id = getReq.result;
        id.alias = alias;
        const putReq = store.put(id, 'keys');
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    };
  }), oldAlias);
  await page.reload();
  await expect(page.locator('#msg-main')).toBeVisible();

  // Sanity: the old alias genuinely resolves server-side before the rename.
  const before = await page.request.post('/api/alias/get', { data: { alias: oldAlias } });
  expect(before.status()).toBe(200);

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

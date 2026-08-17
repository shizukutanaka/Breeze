// Two-party 1:1 message exchange over the sealed-sender relay, using the REAL app UI
// (create identity, add contact via the real add-contact dialog, open the rendered
// contact-list item, type + click send) driven by two isolated browser contexts
// against the same server (shared in-memory Worker KV — mirrors two real devices
// talking through one deployment). This is the first test in the repo that exercises
// encryptFor/decryptFrom/relaySend/handleIncoming end to end through actual UI
// interaction rather than calling the extracted functions directly.
//
// P2P WebRTC signaling is not exercised here (flaky/slow in headless CI); the sealed-
// sender relay is the reliable fallback path and is what this test drives.
//
// NOTE: app internals (myPubB64, addContact, openConversation, dbGet, ...) are declared
// INSIDE initMessenger()'s closure, not at the script's top level, so they are not
// reachable from page.evaluate(). The identity's pubB64 is instead read directly out of
// IndexedDB (a standard Web API, unlike the app's own closure state) and every other
// step is driven through real clicks/inputs against the shipped UI.
import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';

async function createIdentity(page, name) {
  await page.goto('/');
  await page.locator('#msg-name').fill(name);
  await page.locator('#b-msg-setup').click();
  await expect(page.locator('#msg-main')).toBeVisible();

  // Mirrors initMessenger's own IndexedDB open (dbName defaults to 'breeze-messenger',
  // DB_VER 5) and the 'identity' store's 'keys' record written by createIdentity().
  return page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('breeze-messenger', 5);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('identity', 'readonly');
      const getReq = tx.objectStore('identity').get('keys');
      getReq.onsuccess = () => resolve(getReq.result?.pubB64);
      getReq.onerror = () => reject(getReq.error);
    };
  }));
}

// Drives the real add-contact dialog (#b-msg-add -> showPrompt -> resolveAndAdd ->
// addContact -> renderContacts) and opens the resulting contact-list item by clicking it,
// exactly as a user would. resolveAndAdd() names a raw-pubkey add "Contact" (no name
// field in that flow) — each test page adds exactly one contact, so selecting the sole
// rendered .contact item is unambiguous without matching on name.
async function addAndOpen(page, pubB64) {
  await page.locator('#b-msg-add').click();
  const dialog = page.locator('dialog[aria-labelledby]');
  await dialog.locator('.modal-input').fill(pubB64);
  await dialog.locator('[value="ok"]').click();
  await expect(dialog).toBeHidden();

  const contact = page.locator('#msg-contacts .contact');
  await expect(contact).toBeVisible();
  await contact.click();
}

test('two browsers exchange a 1:1 message over the sealed-sender relay', async ({ browser }) => {
  // Distinct synthetic CF-Connecting-IP per context: in production each device has its own
  // IP and thus its own rate-limit bucket (_worker.js caps the IP-less 'unknown' bucket at
  // 5 rpm to stop it being monopolized — see _worker.js's rate limiter). Without this, both
  // browser contexts share one 'unknown' bucket here (no reverse proxy in the local harness)
  // and a two-party flow's combined request volume can trip that 5 rpm cap.
  const aliceCtx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.1' } });
  const bobCtx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.2' } });
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  const alicePub = await createIdentity(alice, 'Alice');
  const bobPub = await createIdentity(bob, 'Bob');

  await addAndOpen(alice, bobPub);
  await addAndOpen(bob, alicePub);

  const text = 'hello from Alice via E2E — ' + Date.now();
  await alice.locator('#msg-input').fill(text);
  await alice.locator('#b-msg-send').click();

  // Bob's poll loop (CONFIG.POLL_FAST_MS = 3s) picks it up via /sealed/poll or /msg/poll.
  await expect(bob.locator('#msg-messages')).toContainText(text, { timeout: 15_000 });

  await aliceCtx.close();
  await bobCtx.close();
});

// Serve-time patch flipping one CONFIG flag for a single browser context, without touching the
// committed file — simulates real client-version skew (an upgraded client talking to a legacy
// one). CONFIG is a plain top-level const, not runtime-toggleable, so a text patch is the only way.
// script-src is hash-pinned (no 'unsafe-inline'), and the E2E server computed that hash for the
// body IT served. Patching CONFIG here changes those bytes, so the pinned hash no longer matches
// and the browser refuses the whole bundle. Re-pin for the patched body — same security property
// (hash-pinned, no 'unsafe-inline'), digest just tracks what we actually serve.
function repinnedCspHeaders(resp, body) {
  const csp = resp.headers()['content-security-policy'];
  if (!csp) return resp.headers();
  const hashes = [...body.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
  if (!hashes.length) return resp.headers();
  return { ...resp.headers(), 'content-security-policy': csp.replace(/script-src [^;]+/, `script-src 'self' ${hashes.join(' ')}`) };
}

async function withConfigFlagPatched(context, flag) {
  await context.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const resp = await route.fetch();
    const body = (await resp.text()).replace(`${flag}: false,`, `${flag}: true,`);
    if (!body.includes(`${flag}: true,`)) throw new Error(`withConfigFlagPatched: '${flag}: false,' marker not found — CONFIG moved, update this test`);
    await route.fulfill({ response: resp, body, headers: repinnedCspHeaders(resp, body) });
  });
}

test('X3DH v5 interop: a v5-enabled client and a legacy client still exchange a 1:1 message', async ({ browser }) => {
  // Alice runs with authenticated X3DH v5 ON; Bob stays the pristine default (X3DH_V5_ENABLED:
  // false) — a legacy peer that never advertises the x3dh-v5 capability. This is the safety
  // property that must hold before X3DH_V5_ENABLED can ever default on: _peerSupportsX3dhV5 gates
  // on BOTH the local flag AND the peer's advertised caps, so Alice's initSessionV5Initiator sees
  // Bob has no x3dh-v5 cap, returns null, and falls back to the legacy initSession — the message
  // must still decrypt end to end. A drift here (v5 initiation without fallback) would silently
  // break first contact against every not-yet-upgraded contact.
  const aliceCtx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.30' } });
  const bobCtx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.31' } });
  await withConfigFlagPatched(aliceCtx, 'X3DH_V5_ENABLED');
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  const alicePub = await createIdentity(alice, 'Alice');
  const bobPub = await createIdentity(bob, 'Bob');
  await addAndOpen(alice, bobPub);
  await addAndOpen(bob, alicePub);

  // Alice (v5) -> Bob (legacy): Alice's session-init must fall back to the legacy path.
  const t1 = 'v5->legacy — ' + Date.now();
  await alice.locator('#msg-input').fill(t1);
  await alice.locator('#b-msg-send').click();
  await expect(bob.locator('#msg-messages')).toContainText(t1, { timeout: 15_000 });

  // Bob (legacy) -> Alice (v5): the reverse direction must interoperate too. (Bob typing here is
  // exactly what the smart-reply CSS bug used to block — receiving t1 collapsed his compose
  // textarea to 0px; see the dedicated regression test below.)
  const t2 = 'legacy->v5 — ' + Date.now();
  await bob.locator('#msg-input').fill(t2);
  await bob.locator('#b-msg-send').click();
  await expect(alice.locator('#msg-messages')).toContainText(t2, { timeout: 15_000 });

  await aliceCtx.close();
  await bobCtx.close();
});

test('receiving a message keeps the compose box usable (smart replies do not squeeze it)', async ({ browser }) => {
  // Regression for a real, default-path UX break: .smart-reply-bar is width:100% INSIDE the flex
  // .input-bar row. Without flex-wrap on the bar (and flex-basis:100% on the smart-reply row) it
  // became a same-row sibling and squeezed #msg-input from 660px to 0px — so the instant a user
  // received a message that triggers smart replies, they could no longer type a reply.
  const aliceCtx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.32' } });
  const bobCtx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.33' } });
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  const alicePub = await createIdentity(alice, 'Alice');
  const bobPub = await createIdentity(bob, 'Bob');
  await addAndOpen(alice, bobPub);
  await addAndOpen(bob, alicePub);

  // A question reliably triggers the local smart-reply generator.
  const text = 'hey what do you think about this plan? — ' + Date.now();
  await alice.locator('#msg-input').fill(text);
  await alice.locator('#b-msg-send').click();
  await expect(bob.locator('#msg-messages')).toContainText(text, { timeout: 15_000 });

  // The smart-reply bar is showing on the receiver...
  await expect(bob.locator('#smart-reply-bar')).toBeVisible();
  // ...and the compose textarea must still be usable (visible + real width), not collapsed to 0.
  await expect(bob.locator('#msg-input')).toBeVisible();
  const width = await bob.locator('#msg-input').evaluate(el => el.getBoundingClientRect().width);
  expect(width).toBeGreaterThan(100);
  // Strongest proof: the user can actually type and send a reply.
  await bob.locator('#msg-input').fill('yes, sounds good');
  await bob.locator('#b-msg-send').click();
  await expect(alice.locator('#msg-messages')).toContainText('yes, sounds good', { timeout: 15_000 });

  await aliceCtx.close();
  await bobCtx.close();
});

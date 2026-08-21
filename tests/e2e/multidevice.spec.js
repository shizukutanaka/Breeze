// Multi-device Phase 1 E2E — the "phone + laptop" test.
//
// Design under test: a device is just another Breeze identity; an account is a root-signed
// device registry on the relay. Senders fan the same plaintext out to every device (each with
// its own ratchet), and a sender's own other devices get a self-sync copy. The wire format is
// unchanged, so a contact with no registry keeps working exactly as before.
//
// Three real browser contexts: A = primary device, B = linked secondary, C = a contact.
import { test, expect } from '@playwright/test';

const ip = (n) => ({ extraHTTPHeaders: { 'CF-Connecting-IP': `203.0.113.${n}` } });

async function createIdentity(page, name) {
  await page.goto('/');
  await page.locator('#msg-name').fill(name);
  await page.locator('#b-msg-setup').click();
  await expect(page.locator('#msg-main')).toBeVisible();
  return page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('breeze-messenger', 5);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction('identity', 'readonly');
      const getReq = tx.objectStore('identity').get('keys');
      getReq.onsuccess = () => resolve(getReq.result?.pubB64);
      getReq.onerror = () => reject(getReq.error);
    };
  }));
}

async function addAndOpen(page, pubB64) {
  await page.locator('#b-msg-add').click();
  const dialog = page.locator('dialog[aria-labelledby]');
  await dialog.locator('.modal-input').fill(pubB64);
  await dialog.locator('[value="ok"]').click();
  await expect(dialog).toBeHidden();
  const contact = page.locator('#msg-contacts .contact').first();
  await expect(contact).toBeVisible();
  await contact.click();
  await expect(page.locator('#msg-input-bar')).toBeVisible();
}

async function runCommand(page, cmd) {
  await page.locator('#msg-input').fill(cmd);
  await page.locator('#msg-input').press('Enter');
}

test('link a second device: contact messages reach BOTH devices; sent messages self-sync', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctxA = await browser.newContext(ip(60)); // primary
  const ctxB = await browser.newContext(ip(61)); // secondary
  const ctxC = await browser.newContext(ip(62)); // contact
  const A = await ctxA.newPage(), B = await ctxB.newPage(), C = await ctxC.newPage();

  const pubA = await createIdentity(A, 'Alice-Phone');
  const pubB = await createIdentity(B, 'Alice-Laptop');
  const pubC = await createIdentity(C, 'Carol');

  // C and A become contacts (C knows the ACCOUNT root = A's pub; nothing about B).
  await addAndOpen(A, pubC);
  await addAndOpen(C, pubA);

  // C must pin A's signing key before the registry verifies for her: one message does it (TOFU).
  const pinMsg = 'pin my signing key ' + Date.now();
  await A.locator('#msg-input').fill(pinMsg);
  await A.locator('#b-msg-send').click();
  await expect(C.locator('#msg-messages')).toContainText(pinMsg, { timeout: 15_000 });

  // A links B: primary signs the registry, secondary binds to the root.
  await addAndOpen(A, pubC); // ensure a conversation is open so the command bar exists
  await runCommand(A, `/link ${pubB}`);
  const confirmDialog = A.locator('dialog[aria-labelledby]');
  await confirmDialog.locator('[value="ok"]').click();
  await expect(A.locator('.toast-container')).toContainText(/added|追加/i, { timeout: 10_000 });

  // Registry now lists both devices (server-side truth).
  const reg = await A.request.post('/api/device/list', { data: { accountId: pubA.slice(0, 12) } });
  const rec = await reg.json();
  expect(rec.root).toBe(pubA);
  expect(rec.devices.map((d) => d.pub).sort()).toEqual([pubA, pubB].sort());

  // B binds to the account. The fresh laptop knows NOTHING about C — it adds only the
  // PRIMARY's key (the one the user physically carried over) to get a command bar.
  await addAndOpen(B, pubA);
  await runCommand(B, `/linkto ${pubA}`);
  await expect(B.locator('.toast-container')).toContainText(/linked|リンク/i, { timeout: 10_000 });

  // === The point #1: A sends from the "phone" while the laptop has never heard of C.
  // C receives it AND the laptop bootstraps the WHOLE conversation from the self-sync copy
  // (sfPub/sfName) — before this existed, everything sent pre-reply was silently dropped.
  const fromA = 'sent from the phone ' + Date.now();
  await A.locator('#msg-input').fill(fromA);
  await A.locator('#b-msg-send').click();
  await expect(C.locator('#msg-messages')).toContainText(fromA, { timeout: 20_000 });
  // The laptop now shows a NEW conversation carrying that message...
  const cRowOnB = B.locator('#msg-contacts .contact', { hasText: fromA.slice(0, 20) });
  await expect(cRowOnB).toBeVisible({ timeout: 20_000 });
  await cRowOnB.click();
  await expect(B.locator('#msg-messages')).toContainText(fromA, { timeout: 10_000 });
  // ...rendered as an OUTGOING message (mine), not an incoming one.
  const isMine = await B.evaluate((needle) => {
    const els = [...document.querySelectorAll('#msg-messages .msg')];
    const el = els.find((x) => x.textContent.includes(needle));
    return el ? el.classList.contains('me') : null;
  }, fromA);
  expect(isMine).toBe(true);

  // === The point #2: C sends ONE message; BOTH of Alice's devices get it. ===
  const fromC = 'hello alice on all your devices ' + Date.now();
  await C.locator('#msg-input').fill(fromC);
  await C.locator('#b-msg-send').click();
  await expect(A.locator('#msg-messages')).toContainText(fromC, { timeout: 20_000 });
  await expect(B.locator('#msg-messages')).toContainText(fromC, { timeout: 20_000 });

  // === The point #3: B sends from the "laptop". C must see it in the ALICE conversation —
  // NOT as a new stranger contact — because the envelope's account-root claim verifies
  // against the root-signed device registry. And A gets the self-sync copy.
  const fromB = 'sent from the laptop ' + Date.now();
  await B.locator('#msg-input').fill(fromB);
  await B.locator('#b-msg-send').click();
  await expect(C.locator('#msg-messages')).toContainText(fromB, { timeout: 20_000 });
  await expect(C.locator('#msg-contacts .contact')).toHaveCount(1); // no stranger appeared
  await expect(A.locator('#msg-messages')).toContainText(fromB, { timeout: 20_000 });
  const isMineOnA = await A.evaluate((needle) => {
    const els = [...document.querySelectorAll('#msg-messages .msg')];
    const el = els.find((x) => x.textContent.includes(needle));
    return el ? el.classList.contains('me') : null;
  }, fromB);
  expect(isMineOnA).toBe(true);

  await ctxA.close(); await ctxB.close(); await ctxC.close();
});

test('a contact with no device registry keeps working exactly as before (backward compat)', async ({ browser }) => {
  const ctx1 = await browser.newContext(ip(63));
  const ctx2 = await browser.newContext(ip(64));
  const P = await ctx1.newPage(), Q = await ctx2.newPage();
  const pubP = await createIdentity(P, 'Plain-P');
  const pubQ = await createIdentity(Q, 'Plain-Q');
  await addAndOpen(P, pubQ);
  await addAndOpen(Q, pubP);
  const text = 'no registry, classic path ' + Date.now();
  await P.locator('#msg-input').fill(text);
  await P.locator('#b-msg-send').click();
  await expect(Q.locator('#msg-messages')).toContainText(text, { timeout: 15_000 });
  await ctx1.close(); await ctx2.close();
});

// "Quiet messenger" E2E — the features whose whole purpose is that the app demands LESS.
//
// Each one fails silently if it regresses: a no-reply-needed message that still bumps the
// unread badge, a read receipt that fires instantly anyway, or a focus mode that doesn't
// actually suppress. None of those throw — they just quietly restore the pressure the
// features exist to remove. So they are asserted in a real browser, end to end.
import { test, expect } from '@playwright/test';

const ip = (n) => ({ extraHTTPHeaders: { 'CF-Connecting-IP': `203.0.113.${n}` } });

async function createIdentity(page, name) {
  await page.addInitScript(() => { try { localStorage.setItem('brz-consent', String(Date.now())); } catch {} });
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

// Add a contact WITHOUT opening it: unread only accrues while you are not looking at the
// conversation, so the badge assertions need a contact that was never opened.
async function addOnly(page, pubB64) {
  await page.locator('#b-msg-add').click();
  const dialog = page.locator('dialog[aria-labelledby]');
  await dialog.locator('.modal-input').fill(pubB64);
  await dialog.locator('[value="ok"]').click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#msg-contacts .contact').first()).toBeVisible();
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

const runCommand = async (page, cmd) => {
  await page.locator('#msg-input').fill(cmd);
  await page.locator('#msg-input').press('Enter');
};

test('a "no reply needed" message arrives in full but raises no unread badge', async ({ browser }) => {
  const ctxA = await browser.newContext(ip(120));
  const ctxB = await browser.newContext(ip(121));
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  const pubA = await createIdentity(A, 'Sender');
  const pubB = await createIdentity(B, 'Receiver');
  await addAndOpen(A, pubB);
  await addOnly(B, pubA); // never opened -> unread can accrue

  // Baseline: an ordinary message DOES raise the badge, or the test proves nothing.
  const normal = 'ordinary message ' + Date.now();
  await A.locator('#msg-input').fill(normal);
  await A.locator('#b-msg-send').click();
  await expect(B.locator('#msg-contacts .cbadge')).toBeVisible({ timeout: 20_000 });
  const baseline = parseInt((await B.locator('#msg-contacts .cbadge').first().textContent()) || '0', 10);
  expect(baseline).toBeGreaterThan(0);

  // Now the same thing marked "no reply needed": delivered, but the badge must not move.
  const quiet = 'no reply needed here ' + Date.now();
  await A.locator('#b-msg-nrn').click();
  await expect(A.locator('#b-msg-nrn')).toHaveClass(/nrn-on/);
  await A.locator('#msg-input').fill(quiet);
  await A.locator('#b-msg-send').click();

  // It really arrives (stored on B) ...
  await expect.poll(async () => B.evaluate((needle) => new Promise((r) => {
    const q = indexedDB.open('breeze-messenger', 5);
    q.onsuccess = () => {
      let found = false;
      q.result.transaction('messages', 'readonly').objectStore('messages').openCursor().onsuccess = (e) => {
        const cur = e.target.result;
        if (cur) { if ((cur.value.text || '').includes(needle)) found = true; cur.continue(); } else r(found);
      };
    };
  }), quiet), { timeout: 20_000 }).toBe(true);

  // ... and the unread count did not grow.
  const after = parseInt((await B.locator('#msg-contacts .cbadge').first().textContent()) || '0', 10);
  expect(after).toBe(baseline);

  // The toggle is one-shot: it resets after sending so it can never silently mute a thread.
  await expect(A.locator('#b-msg-nrn')).not.toHaveClass(/nrn-on/);

  await ctxA.close(); await ctxB.close();
});

test('the settings panel holds the read receipt instead of firing it the instant you open the chat', async ({ browser }) => {
  const ctxA = await browser.newContext(ip(122));
  const ctxB = await browser.newContext(ip(123));
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  const pubA = await createIdentity(A, 'Reader');
  const pubB = await createIdentity(B, 'Watcher');
  await addAndOpen(A, pubB);
  await addAndOpen(B, pubA);

  // Set the delay the way a real user does — through the settings panel, not a command
  // only a power user would guess. (The command was deleted for exactly that reason: a
  // persistent preference belongs in settings; the command line is for actions.)
  await runCommand(A, '/settings');
  await A.locator('input[data-setting="rr-delay"]').check();
  const delay = await A.evaluate(() => new Promise((r) => {
    const q = indexedDB.open('breeze-messenger', 5);
    q.onsuccess = () => { q.result.transaction('settings', 'readonly').objectStore('settings').get('app').onsuccess = (e) => r(e.target.result?.readReceiptDelay); };
  }));
  expect(delay).toBe(120); // the panel's one sensible default

  // Watch the wire: opening the conversation must not produce a 'read' signal right away.
  const reads = [];
  A.on('request', (r) => { if (r.url().includes('/api/signal') && (r.postData() || '').includes('"read"')) reads.push(Date.now()); });
  await A.locator('#msg-contacts .contact').first().click();
  await expect(A.locator('#msg-input-bar')).toBeVisible();
  await expect.poll(() => reads.length, { timeout: 4000 }).toBe(0);

  await ctxA.close(); await ctxB.close();
});

test('focus mode suppresses the alert but keeps the unread count honest', async ({ browser }) => {
  const ctxA = await browser.newContext(ip(124));
  const ctxB = await browser.newContext(ip(125));
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  const pubA = await createIdentity(A, 'Busy');
  const pubB = await createIdentity(B, 'Caller');
  await addOnly(A, pubB); // never opened -> an incoming message would normally alert + badge
  await addAndOpen(B, pubA);

  await runCommand(A, '/focus 60 all');
  await expect(A.locator('#focus-bar')).toBeVisible({ timeout: 10_000 });
  await expect(A.locator('#focus-bar')).toContainText(/60|59/);

  const notified = await A.evaluate(() => { window.__notifs = 0; const N = window.Notification; if (N) { window.Notification = function (...a) { window.__notifs++; return new N(...a); }; window.Notification.permission = N.permission; } return true; });
  expect(notified).toBe(true);

  const msg = 'while you were focused ' + Date.now();
  await B.locator('#msg-input').fill(msg);
  await B.locator('#b-msg-send').click();

  // Unread still accrues — focus hides the interruption, never the information.
  await expect(A.locator('#msg-contacts .cbadge')).toBeVisible({ timeout: 20_000 });
  expect(await A.evaluate(() => window.__notifs)).toBe(0);

  // Tapping the banner ends focus.
  await A.locator('#focus-bar').click();
  await expect(A.locator('#focus-bar')).toBeHidden({ timeout: 5000 });

  await ctxA.close(); await ctxB.close();
});

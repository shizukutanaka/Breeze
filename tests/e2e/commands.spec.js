// Slash commands are routed by a keydown listener on #msg-input, so pressing Enter runs
// them and never puts them on the wire — its sibling handler explicitly skips
// sendMessage() for '/' text, with a comment noting an E2E once found commands being
// "sent as literal text first". That fix only ever covered Enter. The send button — the
// big ↑ a beginner reaches for, and the only affordance on a touch keyboard that does not
// also insert a newline — called sendMessage() directly, so clicking it TRANSMITTED the
// command to the contact as an ordinary encrypted chat message.
//
// The privacy consequence is worse than the lost command: '/note <private note about this
// contact>' goes to that contact, '/searchall <query>' ships the query, and '/drop
// <secret>' — a feature that exists so a secret does NOT sit in a chat log — puts it
// straight into one. So this asserts the peer's own database, not just the sender's UI.
import { test, expect } from '@playwright/test';

async function createIdentity(page, name) {
  await page.goto('/');
  await page.locator('#msg-name').fill(name);
  await page.locator('#b-msg-setup').click();
  await expect(page.locator('#msg-main')).toBeVisible();
  return page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('breeze-messenger', 5);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const getReq = req.result.transaction('identity', 'readonly').objectStore('identity').get('keys');
      getReq.onsuccess = () => resolve(getReq.result?.pubB64);
      getReq.onerror = () => reject(getReq.error);
    };
  }));
}

const messageTexts = (page) => page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('breeze-messenger', 5);
  req.onsuccess = () => {
    const out = [];
    req.result.transaction('messages', 'readonly').objectStore('messages').openCursor()
      .onsuccess = (e) => { const c = e.target.result; if (c) { out.push((c.value.text || '').trim()); c.continue(); } else resolve(out); };
  };
}));

test('clicking send on a slash command runs it instead of messaging it to the contact', async ({ browser }) => {
  const ctxA = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.84' } });
  const ctxB = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.85' } });
  const A = await ctxA.newPage(), B = await ctxB.newPage();

  await createIdentity(A, 'Sender');
  const pubB = await createIdentity(B, 'Receiver');

  await A.locator('#b-msg-add').click();
  const dialog = A.locator('dialog[aria-labelledby]');
  await dialog.locator('.modal-input').fill(pubB);
  await dialog.locator('[value="ok"]').click();
  await expect(dialog).toBeHidden();
  await A.locator('#msg-contacts .contact').click();
  await expect(A.locator('#msg-input-bar')).toBeVisible();

  // The obvious action: type a command, click the send button.
  await A.locator('#msg-input').fill('/help');
  await A.locator('#b-msg-send').click();

  // The command ran: /help renders its panel into the message list.
  await expect(A.locator('.cmd-panel, .cmd-panel-mono').first()).toBeVisible();
  await expect(A.locator('#msg-input')).toHaveValue('');

  // And nothing went out. Poll the receiver for longer than a delivery would take, then
  // assert its store never held the command text — the sender's own UI cannot show this.
  await B.waitForTimeout(9000);
  expect(await messageTexts(B), 'the contact never received the command as a message').not.toContain('/help');
  expect(await messageTexts(A), 'the sender did not store it as an outgoing message either').not.toContain('/help');

  await ctxA.close();
  await ctxB.close();
});

test('the send button still sends ordinary text that merely mentions a command', async ({ browser }) => {
  // Guard against over-correcting: only a LEADING slash is a command. Text containing a
  // slash anywhere else must still send, or the fix would silently eat real messages.
  const ctxA = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.86' } });
  const ctxB = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.87' } });
  const A = await ctxA.newPage(), B = await ctxB.newPage();

  await createIdentity(A, 'Sender2');
  const pubB = await createIdentity(B, 'Receiver2');

  await A.locator('#b-msg-add').click();
  const dialog = A.locator('dialog[aria-labelledby]');
  await dialog.locator('.modal-input').fill(pubB);
  await dialog.locator('[value="ok"]').click();
  await expect(dialog).toBeHidden();
  await A.locator('#msg-contacts .contact').click();
  await expect(A.locator('#msg-input-bar')).toBeVisible();

  const text = 'run /help to see the commands';
  await A.locator('#msg-input').fill(text);
  await A.locator('#b-msg-send').click();

  await expect.poll(async () => (await messageTexts(B)).includes(text), {
    message: 'an ordinary message containing a slash still reaches the contact',
    timeout: 30000,
  }).toBe(true);

  await ctxA.close();
  await ctxB.close();
});

// /searchall's per-contact group headers ("Alice", click to jump to that conversation)
// had an onclick and no tabIndex anywhere — found by the same mechanical sweep that
// caught showMsgMenu's original keyboard-access bug and two more instances after it. A
// keyboard-only user browsing global search results had no way to open a result.
test('/searchall result headers are keyboard-reachable and jump to the conversation on Enter', async ({ browser }) => {
  const ctxA = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.160' } });
  const A = await ctxA.newPage();
  await createIdentity(A, 'SearchAll A11y');

  await A.locator('#b-msg-add').click();
  const dialog = A.locator('dialog[aria-labelledby]');
  // Standard base64, exactly as the app's own btoa-exported keys — addContact rejects base64url.
  const fakePub = await A.evaluate(() => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))));
  await dialog.locator('.modal-input').fill(fakePub);
  await dialog.locator('[value="ok"]').click();
  await expect(dialog).toBeHidden();
  const contactId = await A.evaluate(() => new Promise((r) => {
    const q = indexedDB.open('breeze-messenger', 5);
    q.onsuccess = () => { q.result.transaction('contacts', 'readonly').objectStore('contacts').getAll().onsuccess = (e) => r(e.target.result[0].id); };
  }));
  await A.evaluate((cid) => new Promise((resolve, reject) => {
    const req = indexedDB.open('breeze-messenger', 5);
    req.onsuccess = () => {
      const tx = req.result.transaction('messages', 'readwrite');
      tx.objectStore('messages').put({ msgId: 'searchall-probe', contactId: cid, text: 'a needle in a haystack', mine: true, ts: Date.now() });
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    };
  }), contactId);

  await A.locator('#msg-input').fill('/searchall needle');
  await A.locator('#msg-input').press('Enter');
  const header = A.locator('.help-header');
  await expect(header).toBeVisible();
  await expect(header).toHaveAttribute('tabindex', '0');
  await expect(header).toHaveAttribute('role', 'button');

  await header.focus();
  await expect(header).toBeFocused();
  await A.keyboard.press('Enter');
  // Activating the header opens that conversation — the composer becomes reachable and
  // the conversation header shows the contact rather than "Select a contact".
  await expect(A.locator('#msg-input-bar')).toBeVisible();
  await expect(A.locator('#msg-conv-name')).not.toHaveText('Select a contact');

  await ctxA.close();
});

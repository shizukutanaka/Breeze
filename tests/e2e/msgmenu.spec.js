// The Electron un-trapping fix earlier this session (e339fe3) balanced the braces of
// the Electron-only guard, but never checked the freed code against initMessenger's OWN
// closing brace — the "Global: Escape to close modals + keyboard shortcuts (all
// platforms)" listener it un-trapped landed a few lines PAST where initMessenger()
// itself ends, at true top level. Any reference inside it to an initMessenger-closure
// variable (dbGetAll, activeContact, openConversation) threw a bare ReferenceError on
// every keypress, on every platform — not gated behind `typeof`, unlike the
// _selectMode/togglePicker checks right next to them, which is exactly why THOSE two
// still worked and Ctrl+N/Ctrl+F didn't. Fixed by exposing the handful of needed
// internals via window.* (the same pattern already used for togglePicker/toggleReaction/
// showLightbox elsewhere in this file) instead of moving 300+ lines back inside the
// closure, which the standing "no large refactor" rule rules out for a fix this narrow.
//
// Chasing that same closure-boundary blindness into the rest of the block found a
// second, independent bug: an older "v3.5" delegated right-click handler on
// #msg-messages was never removed when the newer per-message showMsgMenu (v3.6) was
// added. Both fire on the same right-click; showContextMenu() clears any existing
// .ctx-menu before building its own, so whichever ran SECOND (bubbling from the message
// up to its ancestor) always won — which was always the older, worse one, so the newer
// menu's React/Bookmark/Select/Report items were created and destroyed in the same
// synchronous event dispatch, before a single paint. Multi-select mode had NO other
// entry point at all, and Report was the ONLY way to file an abuse report on desktop.
//
// And a THIRD bug surfaced fixing the second: even with the duplicate deleted,
// showMsgMenu's own menu was appended as a child of the message bubble, which has
// `contain: content` for its own content-visibility virtualization — paint containment
// clips ALL descendants (fixed-positioned ones included) to the bubble's own small box,
// so only the first item or two of a 7-9 item menu ever rendered or were clickable.
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

test('Ctrl+N jumps to the next unread contact without throwing', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await createIdentity(page, 'Ctrl-N Tester');
  // A contact with an unread count, written directly (no live peer needed — this test
  // is about the shortcut's own scope, not message delivery).
  await page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('breeze-messenger', 5);
    req.onsuccess = () => {
      const tx = req.result.transaction('contacts', 'readwrite');
      tx.objectStore('contacts').put({ id: 'unread-probe', name: 'Unread Probe', pubB64: 'A'.repeat(43) + '=', unread: 2, archived: false, lastMsgAt: Date.now() });
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    };
  }));
  await page.reload();
  await expect(page.locator('#msg-main')).toBeVisible();
  await expect(page.locator('#msg-contacts .contact').first()).toBeVisible();

  errors.length = 0;
  await page.keyboard.press('Control+n');
  await page.waitForTimeout(300);

  expect(errors, 'no ReferenceError from a keydown listener outside initMessenger\'s closure').toEqual([]);
  // The header also renders an "E2E" encryption badge alongside the name (unrelated to
  // this test), so check for the name rather than an exact match on the whole element.
  await expect(page.locator('#msg-conv-name')).toContainText('Unread Probe');
});

test('Ctrl+F opens the in-chat search bar without throwing', async ({ browser }) => {
  const ctxA = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.150' } });
  const ctxB = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.151' } });
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  const errors = [];
  A.on('pageerror', (e) => errors.push(e.message));

  const pubA = await createIdentity(A, 'Ctrl-F Tester');
  const pubB = await createIdentity(B, 'Ctrl-F Peer');
  await addAndOpen(A, pubB);
  await addAndOpen(B, pubA);

  errors.length = 0;
  await A.keyboard.press('Control+f');
  await A.waitForTimeout(300);

  expect(errors, 'no ReferenceError evaluating activeContact from outside the closure').toEqual([]);
  await expect(A.locator('#search-bar')).toHaveClass(/show/);

  await ctxA.close();
  await ctxB.close();
});

test('right-clicking a message shows every action, not just the first two', async ({ browser }) => {
  const ctxA = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.152' } });
  const ctxB = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.153' } });
  const A = await ctxA.newPage(), B = await ctxB.newPage();

  const pubA = await createIdentity(A, 'Menu Tester');
  const pubB = await createIdentity(B, 'Menu Peer');
  await addAndOpen(A, pubB);
  await addAndOpen(B, pubA);

  await B.locator('#msg-input').fill('right-click me');
  await B.locator('#b-msg-send').click();
  await expect(A.locator('.msg.them').first()).toBeVisible({ timeout: 15000 });

  await A.locator('.msg.them').first().click({ button: 'right' });
  const menu = A.locator('.ctx-menu');
  await expect(menu).toBeVisible();
  const labels = await menu.locator('.ctx-item').allTextContents();

  // The full v3.6 set for a received message (not mine, no frankId on a freshly-sent
  // message so no Report item): the old duplicate handler showed only a subset of this.
  for (const expected of ['React', 'Reply', 'Copy', 'Forward', 'Pin', 'Bookmark', 'Select']) {
    expect(labels, `menu includes "${expected}"`).toContain(expected);
  }

  // Every item must actually be on screen and clickable — not just present in the DOM.
  // This is what the contain:paint clipping bug broke even after the duplicate handler
  // was removed: the geometry said the items existed, but a click there hit the message
  // list underneath instead.
  const items = menu.locator('.ctx-item');
  const count = await items.count();
  for (let i = 0; i < count; i++) {
    await expect(items.nth(i)).toBeInViewport();
  }

  await ctxA.close();
  await ctxB.close();
});

test('entering select mode from the message menu and pressing Escape exits it', async ({ browser }) => {
  const ctxA = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.154' } });
  const ctxB = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.155' } });
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  const errors = [];
  A.on('pageerror', (e) => errors.push(e.message));

  const pubA = await createIdentity(A, 'Select Tester');
  const pubB = await createIdentity(B, 'Select Peer');
  await addAndOpen(A, pubB);
  await addAndOpen(B, pubA);

  await B.locator('#msg-input').fill('select mode probe');
  await B.locator('#b-msg-send').click();
  await expect(A.locator('.msg.them').first()).toBeVisible({ timeout: 15000 });

  await A.locator('.msg.them').first().click({ button: 'right' });
  await A.locator('.ctx-menu .ctx-item', { hasText: 'Select' }).click();
  await expect(A.locator('#select-fab')).toBeVisible();

  errors.length = 0;
  await A.keyboard.press('Escape');
  await A.waitForTimeout(300);

  // _selectMode is also initMessenger-closure-local; the desktop-only Escape handler's
  // `typeof _selectMode !== 'undefined'` guard was ALWAYS false from outside that
  // closure, so this never threw — it just silently never exited select mode either,
  // leaving only the FAB's own close button as a way out.
  expect(errors, 'no error from the desktop keydown listener').toEqual([]);
  await expect(A.locator('#select-fab')).not.toBeVisible();

  await ctxA.close();
  await ctxB.close();
});

// showMsgMenu never had keyboard support at all — no tabIndex, no role=menuitem, no
// arrow-key navigation, no initial focus — unlike showContextMenu right next to it in
// index.html, which has all of it. Not something the earlier fix in this same function
// (moving the menu to document.body to stop it being clipped by the bubble's own
// contain:content) broke; a separate, pre-existing gap that survived because every
// other check in this file only asked whether the menu items existed and were
// clickable, never whether a keyboard-only or screen-reader user could reach them.
test('the message menu is fully keyboard-operable: focus, arrow keys, Enter', async ({ browser }) => {
  const ctxA = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.158' } });
  const ctxB = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.159' } });
  const A = await ctxA.newPage(), B = await ctxB.newPage();

  const pubA = await createIdentity(A, 'Keyboard Tester');
  const pubB = await createIdentity(B, 'Keyboard Peer');
  await addAndOpen(A, pubB);
  await addAndOpen(B, pubA);

  await B.locator('#msg-input').fill('keyboard nav probe');
  await B.locator('#b-msg-send').click();
  await expect(A.locator('.msg.them').first()).toBeVisible({ timeout: 15000 });

  await A.locator('.msg.them').first().click({ button: 'right' });
  const menu = A.locator('.ctx-menu');
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute('role', 'menu');

  const focusedLabel = () => A.evaluate(() => {
    const a = document.activeElement;
    return a?.classList?.contains('ctx-item') ? a.textContent.trim() : null;
  });

  // Opening the menu must move focus INTO it — the tabIndex/role/onkeydown wiring on
  // each item is inert if nothing ever receives it, which is exactly how this shipped:
  // fully wired, never focused, so a keyboard user's Tab/Enter/Arrow presses all landed
  // on <body> instead.
  await expect.poll(focusedLabel, { message: 'opening the menu focuses its first item' }).toBe('React');

  await A.keyboard.press('ArrowDown');
  expect(await focusedLabel(), 'ArrowDown moves to the next item').toBe('Reply');
  await A.keyboard.press('ArrowDown');
  expect(await focusedLabel(), 'ArrowDown again moves to the item after that').toBe('Copy');
  await A.keyboard.press('ArrowUp');
  expect(await focusedLabel(), 'ArrowUp moves back').toBe('Reply');

  // Enter activates the focused item (Reply) and closes the menu.
  await A.keyboard.press('Enter');
  await expect(menu).not.toBeVisible();
  await expect(A.locator('.reply-preview')).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});

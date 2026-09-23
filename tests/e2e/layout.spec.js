// Layout E2E. Every other spec in this repo asserts that things EXIST and RESPOND —
// which is exactly why a broken layout slipped through all 35 of them: one stray
// </div> closed .msg-layout early, so the conversation pane stopped being the second
// column of the two-pane layout and rendered below the fold instead. Nothing changed
// about which elements existed or whether Playwright could click them, so 41 validate
// checks, 798 unit tests and the whole E2E suite stayed green while the primary desktop
// screen was unusable without scrolling past a full-height contact list.
//
// So these assert GEOMETRY, the one property the rest of the suite never looks at.
// tools/html-balance.mjs guards the structural root cause; this guards the symptom a
// user would actually report, and would also catch a CSS regression that broke the
// same thing without any markup mistake.
import { test, expect } from '@playwright/test';

const boot = async (page, name) => {
  await page.goto('/');
  await page.locator('#msg-name').fill(name);
  await page.locator('#b-msg-setup').click();
  await expect(page.locator('#msg-main')).toBeVisible();
};

// At phone width the sidebar is `position: absolute; inset: 0` — a full-screen overlay
// over the chat column until a contact is opened, which is what hides it. The emoji
// tests below need the composer reachable, so they need a contact open first, same as a
// real phone user would have.
const openAnyContact = async (page) => {
  await page.locator('#b-msg-add').click();
  const dialog = page.locator('dialog[aria-labelledby]');
  // Standard base64, exactly as the app's own btoa-exported keys — addContact rejects base64url.
  const fakePub = await page.evaluate(() => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))));
  await dialog.locator('.modal-input').fill(fakePub);
  await dialog.locator('[value="ok"]').click();
  await expect(dialog).toBeHidden();
  await page.locator('#msg-contacts .contact').first().click();
  await expect(page.locator('#msg-input-bar')).toBeVisible();
};

test('the desktop chat pane sits beside the sidebar, not below it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page, 'Layout Desktop');

  const geom = await page.evaluate(() => {
    const sb = document.getElementById('msg-sidebar').getBoundingClientRect();
    const chat = document.querySelector('.chat-area').getBoundingClientRect();
    return { sbRight: sb.right, sbTop: sb.top, chatLeft: chat.left, chatTop: chat.top, chatBottom: chat.bottom };
  });

  // Side by side: the chat column starts at the sidebar's right edge, on the same row.
  expect(geom.chatLeft, 'chat pane starts where the sidebar ends').toBeGreaterThanOrEqual(geom.sbRight - 1);
  expect(Math.abs(geom.chatTop - geom.sbTop), 'both columns share a top edge').toBeLessThan(2);
  // And the whole conversation column is on screen without scrolling the page.
  expect(geom.chatBottom, 'chat pane fits in the viewport').toBeLessThanOrEqual(800 + 1);
  await expect(page.locator('#msg-input-bar')).toBeInViewport();
});

test('the message list scrolls inside its own box instead of growing the page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page, 'Layout Scroll');

  // #msg-messages is `flex: 1; overflow-y: auto; min-height: 0`, which only means
  // anything while an ancestor bounds its height. Fill it past its own height and
  // require that the OVERFLOW landed on the box, not on the document.
  await page.evaluate(() => {
    const box = document.getElementById('msg-messages');
    for (let i = 0; i < 60; i++) {
      const d = document.createElement('div');
      d.className = 'msg';
      d.textContent = 'layout probe line ' + i;
      box.appendChild(d);
    }
  });

  const scroll = await page.evaluate(() => {
    const box = document.getElementById('msg-messages');
    box.scrollTop = box.scrollHeight; // the app's own auto-scroll-to-bottom move
    return {
      boxOverflows: box.scrollHeight > box.clientHeight + 1,
      autoScrollLands: box.scrollTop > 0,
      pageGrewInstead: document.documentElement.scrollHeight > innerHeight + 120,
    };
  });

  expect(scroll.boxOverflows, 'the message box, not the page, absorbs a long conversation').toBe(true);
  expect(scroll.autoScrollLands, 'scrollTop = scrollHeight actually moves (not a silent no-op)').toBe(true);
  expect(scroll.pageGrewInstead, 'the document did not grow to fit the conversation').toBe(false);
  // The composer must stay reachable no matter how long the conversation gets.
  await expect(page.locator('#msg-input-bar')).toBeInViewport();
});

// showToast() is the app's only feedback channel — 60+ call sites, every error and every
// confirmation. It rendered as a 143px column of one word per line on every screen,
// because .toast repeated the `position: fixed; left: 50%` its container already does,
// and the container's own transform made it the containing block for that fixed child.
// With every child out of flow the container measured 0px wide, so `left: 50%` resolved
// against nothing and the toast collapsed to min-content. Unreadable, and invisible to
// every test — the text was all there in the DOM, just shaped into a strip.
// The emoji picker's mobile override mixed a viewport-relative width (100vw) with
// left/right offsets resolved against its actual containing block, #msg-input-bar —
// which is narrower than and inset from the viewport (its own padding, sitting inside
// the chat column). The two disagreed and 'right' lost, so the picker's right edge
// landed past the physical screen edge. No element was missing or unclickable, so
// nothing in the existing suite noticed — the same blind spot as the layout and toast
// bugs above, just on a floating panel instead of the main layout.
for (const width of [320, 390, 640]) {
  test(`the emoji picker stays on screen at phone width (${width}px)`, async ({ page }) => {
    // The consent banner is bottom-fixed and, at phone width, wide enough to intercept
    // clicks on the controls under test — pre-accept it, same as the other specs that
    // drive real clicks at narrow viewports (consent UX is not what this test is about).
    await page.addInitScript(() => { try { localStorage.setItem('brz-consent', String(Date.now())); } catch {} });
    await page.setViewportSize({ width, height: 800 });
    await boot(page, 'Layout Emoji');
    await openAnyContact(page);

    await page.locator('#b-msg-emoji').click();
    const picker = page.locator('.emoji-picker');
    await expect(picker).toBeVisible();

    const box = await picker.boundingBox();
    expect(box.x, 'picker does not start off-screen to the left').toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, 'picker right edge stays within the viewport').toBeLessThanOrEqual(width + 0.5);
    expect(await picker.locator('.emoji-picker-grid button').count(), 'the grid still renders emoji').toBeGreaterThan(0);
  });
}

for (const width of [1280, 390]) {
  test(`a toast renders as a readable line, not a min-content strip (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await boot(page, 'Layout Toast');

    await page.evaluate(() => showToast('Short toast', 'info'));
    const box = await page.evaluate(() => {
      const t = [...document.querySelectorAll('.toast')].pop().getBoundingClientRect();
      return { w: t.width, h: t.height, mid: t.x + t.width / 2 };
    });

    // A short message must fit on one line. The collapsed bug gave ~143px and ~13 lines,
    // so assert on shape (wider than tall) rather than an exact pixel count.
    expect(box.w, 'toast is wider than it is tall — one line, not a column').toBeGreaterThan(box.h * 2);
    expect(box.h, 'a short toast occupies a single line').toBeLessThan(60);
    expect(box.w, 'toast never overflows the viewport').toBeLessThanOrEqual(width);
    expect(Math.abs(box.mid - width / 2), 'toast stays horizontally centred').toBeLessThan(3);
  });
}

// Swipe-to-reply (message) and swipe-to-archive (contact row) both add a `.swiping`
// class and set an inline `translateX(dx)` while dragging, then on release swap to
// `.swipe-back` — whose `transform: translateX(0) !important` overrides the inline
// value only for as long as that class is present. Neither handler ever cleared the
// inline value itself, so once the class comes off (CONFIG.SWIPE_BACK_MS later) the
// mask is gone and the stale offset reasserts: the element visibly animates back to
// place and then silently snaps right back out. A snapshot taken mid-transition would
// have shown the fix already "working"; only checking AFTER the transition ends catches
// it, which is exactly why no existence-based test ever would.
test('a swiped message bubble does not snap back out after the swipe-back animation ends', async ({ browser }) => {
  const ctxA = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.111' }, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const ctxB = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.112' } });
  const A = await ctxA.newPage(), B = await ctxB.newPage();

  const identity = async (page, name) => {
    await page.goto('/');
    await page.locator('#msg-name').fill(name);
    await page.locator('#b-msg-setup').click();
    await expect(page.locator('#msg-main')).toBeVisible();
    return page.evaluate(() => new Promise((r) => {
      const q = indexedDB.open('breeze-messenger', 5);
      q.onsuccess = () => { q.result.transaction('identity', 'readonly').objectStore('identity').get('keys').onsuccess = (e) => r(e.target.result?.pubB64); };
    }));
  };
  const pubA = await identity(A, 'Swipe Receiver');
  const pubB = await identity(B, 'Swipe Sender');

  await A.locator('#b-msg-add').click();
  const dlgA = A.locator('dialog[aria-labelledby]');
  await dlgA.locator('.modal-input').fill(pubB);
  await dlgA.locator('[value="ok"]').click();
  await expect(dlgA).toBeHidden();
  await A.locator('#msg-contacts .contact').first().click();
  await expect(A.locator('#msg-input-bar')).toBeVisible();

  // A real received message so it renders through the app's own message-building
  // function and gets the actual touchstart/touchmove/touchend listeners wired — a
  // fabricated element would have none of them and prove nothing.
  await B.locator('#b-msg-add').click();
  const dlgB = B.locator('dialog[aria-labelledby]');
  await dlgB.locator('.modal-input').fill(pubA);
  await dlgB.locator('[value="ok"]').click();
  await expect(dlgB).toBeHidden();
  await B.locator('#msg-contacts .contact').first().click();
  await expect(B.locator('#msg-input-bar')).toBeVisible();
  await B.locator('#msg-input').fill('swipe me to test the transform reset');
  await B.locator('#b-msg-send').click();

  await expect(A.locator('.msg.them').first()).toBeVisible({ timeout: 15000 });

  const finalState = await A.evaluate(async () => {
    const el = [...document.querySelectorAll('.msg.them')].pop();
    const origX = el.getBoundingClientRect().x;
    const rect = el.getBoundingClientRect();
    const y = rect.y + rect.height / 2;
    const mkTouch = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
    const fire = (type, x) => el.dispatchEvent(new TouchEvent(type, {
      bubbles: true, cancelable: true,
      touches: type === 'touchend' ? [] : [mkTouch(x)], changedTouches: [mkTouch(x)],
    }));
    fire('touchstart', rect.x + 10);
    await new Promise((r) => setTimeout(r, 20));
    fire('touchmove', rect.x + 80); // > 60px: crosses the reply trigger threshold
    await new Promise((r) => setTimeout(r, 20));
    fire('touchend', rect.x + 80);
    // Poll for the actual moment .swipe-back comes off (CONFIG.SWIPE_BACK_MS later)
    // rather than guessing a fixed delay — the bug is specifically about what happens
    // AT that transition, so a race against a timeout would make this test as flaky
    // as the bug is timing-dependent.
    const deadline = Date.now() + 2000;
    while (el.classList.contains('swipe-back') && Date.now() < deadline) await new Promise((r) => setTimeout(r, 10));
    await new Promise((r) => setTimeout(r, 30)); // let the removal's style recalc settle
    return { origX, x: el.getBoundingClientRect().x, transform: getComputedStyle(el).transform };
  });

  // Chromium reports "no transform" as either the keyword `none` or an identity matrix
  // depending on whether a transition ever touched the property — both mean the same
  // thing, so check the geometry it actually affects rather than the string shape.
  expect(Math.abs(finalState.x - finalState.origX), 'the bubble is back at its original position').toBeLessThan(6);

  await ctxA.close();
  await ctxB.close();
});

test('a contact row released mid-swipe (below the archive threshold) settles back in place', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, 'Layout Swipe Contact');
  await openAnyContact(page);
  // openAnyContact opens the conversation, which is the state a real swipe-to-archive
  // gesture happens FROM (the contact list) — go back to it. The back button drives
  // history.back(), which resolves the popstate handler asynchronously, so wait for the
  // sidebar to actually reappear rather than assuming the click alone did it (a `.catch`
  // swallowing a failed click here previously let the test pass against the very CSS bug
  // it exists to catch, because it was swiping a still-hidden row from off-screen).
  await page.locator('#b-msg-back').click();
  await expect(page.locator('#msg-sidebar')).not.toHaveClass(/hidden/);

  const finalState = await page.evaluate(async () => {
    const row = document.querySelector('#msg-contacts .contact');
    const rect = row.getBoundingClientRect();
    const origX = rect.x;
    const y = rect.y + rect.height / 2;
    const mkTouch = (x) => new Touch({ identifier: 1, target: row, clientX: x, clientY: y });
    const fire = (type, x) => row.dispatchEvent(new TouchEvent(type, {
      bubbles: true, cancelable: true,
      touches: type === 'touchend' ? [] : [mkTouch(x)], changedTouches: [mkTouch(x)],
    }));
    fire('touchstart', rect.x + rect.width - 10);
    await new Promise((r) => setTimeout(r, 20));
    fire('touchmove', rect.x + rect.width - 50); // -40px: BELOW the -60px archive threshold
    await new Promise((r) => setTimeout(r, 20));
    fire('touchend', rect.x + rect.width - 50);
    const deadline = Date.now() + 2000;
    while (row.classList.contains('swipe-back') && Date.now() < deadline) await new Promise((r) => setTimeout(r, 10));
    await new Promise((r) => setTimeout(r, 30));
    return { origX, x: row.getBoundingClientRect().x, transform: getComputedStyle(row).transform };
  });

  // A swipe that crosses the archive threshold gets papered over by the resulting
  // renderContacts() call; a partial swipe below it never re-renders, so it is the one
  // case nothing else in the app would ever fix. Check geometry, not the transform
  // string's exact shape — Chromium can report identity as `none` or a matrix
  // depending on transition history, and both mean the same thing.
  expect(Math.abs(finalState.x - finalState.origX), 'the row is back at its original position').toBeLessThan(6);
});

// #scroll-fab and its unread-while-scrolled-up badge were part of the ~190 lines
// trapped inside the Electron-only guard earlier this session — reachable now, but
// never actually exercised end to end since. onNewMsgWhileScrolled() is a top-level
// function (declared after initMessenger closes) called from inside initMessenger at
// message-render time; tools/closure-boundary.mjs confirms the reference direction is
// safe (a hoisted top-level function is visible from inside the closure — the OPPOSITE
// direction from the Ctrl+N/Ctrl+F bug), but a direction being structurally safe isn't
// the same as the feature actually firing, so this drives it with a real received
// message rather than trusting the static check alone.
test('the scroll-to-bottom FAB counts up when a message arrives while scrolled away from the bottom', async ({ browser }) => {
  const ctxA = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.156' } });
  const ctxB = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.157' } });
  const A = await ctxA.newPage(), B = await ctxB.newPage();

  const identity = async (page, name) => {
    await page.goto('/');
    await page.locator('#msg-name').fill(name);
    await page.locator('#b-msg-setup').click();
    await expect(page.locator('#msg-main')).toBeVisible();
    return page.evaluate(() => new Promise((r) => {
      const q = indexedDB.open('breeze-messenger', 5);
      q.onsuccess = () => { q.result.transaction('identity', 'readonly').objectStore('identity').get('keys').onsuccess = (e) => r(e.target.result?.pubB64); };
    }));
  };
  const pubA = await identity(A, 'FAB Receiver');
  const pubB = await identity(B, 'FAB Sender');

  await A.locator('#b-msg-add').click();
  const dlgA = A.locator('dialog[aria-labelledby]');
  await dlgA.locator('.modal-input').fill(pubB);
  await dlgA.locator('[value="ok"]').click();
  await expect(dlgA).toBeHidden();
  await A.locator('#msg-contacts .contact').first().click();
  await expect(A.locator('#msg-input-bar')).toBeVisible();

  // Enough messages that the list actually overflows and scrolling up means something.
  for (let i = 0; i < 30; i++) {
    await A.locator('#msg-input').fill('padding ' + i);
    await A.locator('#b-msg-send').click();
  }
  await A.waitForTimeout(300);

  await A.evaluate(() => {
    const box = document.getElementById('msg-messages');
    box.scrollTop = 0;
    box.dispatchEvent(new Event('scroll'));
  });
  await expect(A.locator('#scroll-fab')).toBeVisible();
  await expect(A.locator('#scroll-fab')).toHaveText('↓');

  await B.locator('#b-msg-add').click();
  const dlgB = B.locator('dialog[aria-labelledby]');
  await dlgB.locator('.modal-input').fill(pubA);
  await dlgB.locator('[value="ok"]').click();
  await expect(dlgB).toBeHidden();
  await B.locator('#msg-contacts .contact').first().click();
  await expect(B.locator('#msg-input-bar')).toBeVisible();
  await B.locator('#msg-input').fill('arrives while you are scrolled up');
  await B.locator('#b-msg-send').click();

  await expect(A.locator('#scroll-fab')).toHaveText('↓ 1', { timeout: 15000 });
  // The scroll position itself must not have been disturbed by the arrival — the whole
  // point of the FAB is that arriving messages do NOT yank the reader back to the
  // bottom mid-read.
  expect(await A.evaluate(() => document.getElementById('msg-messages').scrollTop), 'still scrolled away from the bottom').toBeLessThan(100);

  // Clicking it returns to the bottom and clears the count.
  await A.locator('#scroll-fab').click();
  await expect(A.locator('#scroll-fab')).toHaveText('↓');

  await ctxA.close();
  await ctxB.close();
});

// #load-more-hint ("N older messages") had an onclick and no tabIndex anywhere — found
// by the same mechanical sweep that caught .acc-add after the showMsgMenu keyboard-
// access fix. Its own text already serves as an accessible name (no separate aria-label
// needed), but with no tabIndex it was never reachable by Tab in the first place.
test('the "load older messages" hint is keyboard-reachable and activatable', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page, 'Layout LoadOlder');
  await openAnyContact(page);

  const contactId = await page.evaluate(() => new Promise((r) => {
    const q = indexedDB.open('breeze-messenger', 5);
    q.onsuccess = () => { q.result.transaction('contacts', 'readonly').objectStore('contacts').getAll().onsuccess = (e) => r(e.target.result[0].id); };
  }));
  // PAGE_SIZE is 50 — seed enough that the "N older" hint renders. Direct IndexedDB
  // write, not real sends: the point here is the hint's keyboard wiring, not delivery.
  await page.evaluate((cid) => new Promise((resolve, reject) => {
    const req = indexedDB.open('breeze-messenger', 5);
    req.onsuccess = () => {
      const tx = req.result.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      const now = Date.now();
      for (let i = 0; i < 55; i++) store.put({ msgId: `seed:${i}`, contactId: cid, text: 'seeded ' + i, mine: true, ts: now - (55 - i) * 1000 });
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    };
  }), contactId);

  await page.reload();
  await page.locator('#msg-contacts .contact').first().click();
  const hint = page.locator('#load-more-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toHaveAttribute('tabindex', '0');
  await expect(hint).toHaveAttribute('role', 'button');

  // .focus() on an element positioned above the fold also scrolls it into view — which
  // itself can be enough to cross the app's own scroll-triggered "load more" threshold
  // before a key is ever pressed. Check reachability and the post-focus state in one
  // atomic evaluate() so there is no gap for a second process to observe a stale locator.
  const afterFocus = await page.evaluate(() => {
    const el = document.getElementById('load-more-hint');
    el?.focus();
    return { focused: document.activeElement === el, stillPresent: !!document.getElementById('load-more-hint') };
  });
  expect(afterFocus.focused || !afterFocus.stillPresent, 'Tab-focusing the hint either lands on it or already triggered its own action').toBe(true);

  // If focus's own scroll didn't already trigger the load, Enter on the focused element
  // must: the same load-older action the click handler runs (scrolling to the top of
  // the box, which the app's own scroll listener treats as a request for more — the
  // hint disappears once older messages are loaded in).
  if (afterFocus.stillPresent) {
    await page.keyboard.press('Enter');
  }
  await expect(hint).not.toBeVisible({ timeout: 5000 });
});

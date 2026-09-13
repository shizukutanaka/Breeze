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

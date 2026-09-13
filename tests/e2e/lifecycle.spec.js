// Lifecycle E2E — the states a user is in from their SECOND visit onward.
//
// A boot-order crash that left every returning user with an empty contact list and no message
// delivery survived 29 green tests, because of nine spec files only two ever called reload():
// the suite tested the first session and nothing else. These tests exist to close that hole
// where it would hurt most — not in the UI, but in the CRYPTO state.
//
// A Double Ratchet session is read-modify-write state persisted in IndexedDB. If it does not
// come back correctly after a reload, yesterday's conversation cannot be read or continued
// today — the worst failure an encrypted messenger can have, and one that is invisible in any
// test that starts from a fresh identity.
import { test, expect } from '@playwright/test';

const ip = (n) => ({ extraHTTPHeaders: { 'CF-Connecting-IP': `203.0.113.${n}` } });

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

async function addAndOpen(page, pubB64) {
  await page.locator('#b-msg-add').click();
  const dialog = page.locator('dialog[aria-labelledby]');
  await dialog.locator('.modal-input').fill(pubB64);
  await dialog.locator('[value="ok"]').click();
  await expect(dialog).toBeHidden();
  await page.locator('#msg-contacts .contact').first().click();
  await expect(page.locator('#msg-input-bar')).toBeVisible();
}

const send = async (page, text) => {
  await page.locator('#msg-input').fill(text);
  await page.locator('#b-msg-send').click();
};

test('the Double Ratchet survives a reload (yesterday\'s conversation still works today)', async ({ browser }) => {
  test.setTimeout(90_000);
  const ctxA = await browser.newContext(ip(80));
  const ctxB = await browser.newContext(ip(81));
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  const pubA = await createIdentity(A, 'Yesterday');
  const pubB = await createIdentity(B, 'Today');
  await addAndOpen(A, pubB);
  await addAndOpen(B, pubA);

  // Establish a session and advance the ratchet in BOTH directions first.
  const a1 = 'before the reload, from A ' + Date.now();
  await send(A, a1);
  await expect(B.locator('#msg-messages')).toContainText(a1, { timeout: 20_000 });
  const b1 = 'before the reload, from B ' + Date.now();
  await send(B, b1);
  await expect(A.locator('#msg-messages')).toContainText(b1, { timeout: 20_000 });

  // A closes the app and comes back — the ratchet state must reload from IndexedDB intact.
  await A.reload();
  await expect(A.locator('#msg-main')).toBeVisible();
  await A.locator('#msg-contacts .contact').first().click();
  await expect(A.locator('#msg-input-bar')).toBeVisible();
  // The history is still readable.
  await expect(A.locator('#msg-messages')).toContainText(a1);
  await expect(A.locator('#msg-messages')).toContainText(b1);

  // ...and the conversation CONTINUES: A can still encrypt to B on the resumed chain.
  const a2 = 'after the reload, from A ' + Date.now();
  await send(A, a2);
  await expect(B.locator('#msg-messages')).toContainText(a2, { timeout: 20_000 });

  // ...and B can still encrypt to the reloaded A, which must still decrypt it.
  // A must be FOREGROUNDED for this: a hidden page polls the relay every POLL_SLOW_MS (15 s)
  // instead of POLL_FAST_MS (3 s), so under full-suite load a 20 s budget was marginal and
  // this assertion flaked — while the A->B direction, which needs no poll on A, never did.
  // Bringing A to the front is also the honest scenario: a user reading their messages.
  const b2 = 'after the reload, from B ' + Date.now();
  await send(B, b2);
  await A.bringToFront();
  await expect(A.locator('#msg-messages')).toContainText(b2, { timeout: 40_000 });

  await ctxA.close(); await ctxB.close();
});

test('a reloaded member still receives group messages (sender-key state survives)', async ({ browser }) => {
  test.setTimeout(90_000);
  const ctxA = await browser.newContext(ip(82));
  const ctxB = await browser.newContext(ip(83));
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  await createIdentity(A, 'GroupOwner');

  // Owner creates a server-backed group and takes the invite link (group.spec.js's path).
  await A.locator('#b-msg-add').click();
  const gDlg = A.locator('dialog[aria-labelledby]');
  await gDlg.locator('.modal-input').fill('group:Lifecycle Group');
  await gDlg.locator('[value="ok"]').click();
  const membersDlg = A.locator('dialog[aria-labelledby]');
  await expect(membersDlg).toBeVisible();
  await membersDlg.locator('[value="ok"]').click();
  const inviteBox = A.locator('.i-mono-box');
  await expect(inviteBox).toBeVisible();
  const joinUrl = (await inviteBox.textContent()).trim();

  // A second member joins, then RELOADS before any group traffic flows.
  await B.addInitScript(() => { try { localStorage.setItem('brz-consent', String(Date.now())); } catch {} });
  await B.goto(joinUrl);
  await B.locator('#msg-name').fill('Joiner');
  await B.locator('#b-msg-setup').click();
  await expect(B.locator('#msg-conv-name')).toContainText('Lifecycle Group');
  await B.reload();
  await expect(B.locator('#msg-main')).toBeVisible();
  await B.locator('#msg-contacts .contact', { hasText: 'Lifecycle Group' }).click();
  await expect(B.locator('#msg-input-bar')).toBeVisible();

  // The owner learns of a joiner only through startGroupMemberPoll (5 s). Until that lands her
  // local member list is just herself, and a group send reaches nobody — the same trap
  // group.spec.js documents. A control run without the reload failed identically, which is how
  // this was identified as a test-setup gap rather than a reload bug.
  await A.locator('#msg-contacts .contact', { hasText: 'Lifecycle Group' }).click();
  await expect(A.locator('#msg-input-bar')).toBeVisible();
  await expect(async () => {
    const g = await A.evaluate(() => new Promise((resolve) => {
      const q = indexedDB.open('breeze-messenger', 5);
      q.onsuccess = () => {
        const out = [];
        q.result.transaction('contacts', 'readonly').objectStore('contacts').openCursor().onsuccess = (e) => {
          const cur = e.target.result;
          if (cur) { if (cur.value.isGroup) out.push(cur.value); cur.continue(); } else resolve(out[0] || null);
        };
      };
    }));
    expect(g?.members?.length || 0).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 20_000, intervals: [1000] });
  const g1 = 'group message after the member reloaded ' + Date.now();
  await send(A, g1);
  await B.bringToFront(); // same slow-poll reason as above
  await expect(B.locator('#msg-messages')).toContainText(g1, { timeout: 40_000 });

  await ctxA.close(); await ctxB.close();
});

test('a follower tab is promoted to leader and polls when the leader goes away', async ({ browser }) => {
  // Only the leader tab polls the relay, so a follower that is never promoted receives
  // NOTHING — silently, forever. acquireLeaderLock() used ifAvailable:true with no retry and
  // never awaited the lock decision, so a reload (where the PREVIOUS document still briefly
  // holds the lock) left the new document a permanent follower with no leader in existence.
  // Measured before the fix: 4 of 6 reloads made zero API requests for the whole delivery
  // window while the message sat unread in the relay's sealed queue.
  //
  // That bug reached production behind an "intermittent" smoke failure, because reproducing it
  // via reload is a race that only lands 30-60% of the time. Two pages in the SAME browser
  // context share one Web Locks scope, so a second page takes the contended path
  // DETERMINISTICALLY — no reload race, no flake.
  //
  // Count only SUSTAINED polling that starts after the leader goes away: checkRemoteWipe()
  // fires a one-shot /msg/poll at boot regardless of leadership, and an earlier draft of this
  // test counted that and passed against the very bug it exists to catch.
  const ctx = await browser.newContext(ip(61));
  const leader = await ctx.newPage();
  await createIdentity(leader, 'Leader');

  // Second tab of the same account: the lock is already held, so this one boots as a follower.
  const follower = await ctx.newPage();
  let polls = 0;
  follower.on('request', (r) => { if (r.url().includes('/api/msg/poll')) polls++; });
  await follower.addInitScript(() => { try { localStorage.setItem('brz-consent', String(Date.now())); } catch {} });
  await follower.goto('/');
  await expect(follower.locator('#msg-main')).toBeVisible();

  // Let boot settle (including that one-shot), then require genuine silence: a follower must
  // not be polling while a leader is alive.
  await follower.waitForTimeout(6000);
  polls = 0;
  await follower.waitForTimeout(6000);
  expect(polls, 'a follower must not poll while a leader holds the lock').toBe(0);

  // The leader goes away (tab closed, or a reload replacing the document) — the follower must
  // take over. Before the fix it stayed a follower forever and this never moved off zero.
  await leader.close();
  await expect.poll(() => polls, { timeout: 25_000, intervals: [500] }).toBeGreaterThan(0);

  await ctx.close();
});

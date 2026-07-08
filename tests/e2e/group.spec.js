// Group creation via server-backed invite link, a second real browser joining that link,
// and a Sender-Key group message flowing from the creator to the joiner — driven entirely
// through the real UI (add-contact/group prompt, invite link extraction, join-flow setup
// screen, contact click, compose, send). Exercises createGroup/createGroupInviteLink/
// processJoinToken/startGroupMemberPoll/encryptGroupMsg/distributeSenderKey end to end.
import { test, expect } from '@playwright/test';

// Distinct synthetic CF-Connecting-IP per context — see messaging.spec.js for why: without
// it both contexts share the local harness's single 'unknown'-IP rate-limit bucket.
function ctxOpts(ip) {
  return { extraHTTPHeaders: { 'CF-Connecting-IP': ip } };
}

async function createIdentity(page, name) {
  await page.locator('#msg-name').fill(name);
  await page.locator('#b-msg-setup').click();
  await expect(page.locator('#msg-main')).toBeVisible();
}

test('group invite link: creator and joiner exchange a Sender-Key message', async ({ browser }) => {
  const aliceCtx = await browser.newContext(ctxOpts('203.0.113.11'));
  const bobCtx = await browser.newContext(ctxOpts('203.0.113.12'));
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  await alice.goto('/');
  await createIdentity(alice, 'Alice');

  // Create a group with no existing contacts to add — "group:<name>" through the same
  // add-contact prompt used for 1:1 adds, then an empty answer to the members prompt
  // routes to the server-backed invite-link path (createGroupInviteLink).
  await alice.locator('#b-msg-add').click();
  const groupDialog = alice.locator('dialog[aria-labelledby]');
  await groupDialog.locator('.modal-input').fill('group:E2E Group');
  await groupDialog.locator('[value="ok"]').click();

  const membersDialog = alice.locator('dialog[aria-labelledby]');
  await expect(membersDialog).toBeVisible();
  await membersDialog.locator('[value="ok"]').click(); // empty members list -> invite link

  const inviteBox = alice.locator('.i-mono-box');
  await expect(inviteBox).toBeVisible();
  const joinUrl = await inviteBox.textContent();
  expect(joinUrl).toMatch(/\?join=/);

  // Bob joins via the invite link — a brand-new identity, so he lands on the setup screen
  // (now labeled for the join) and processJoinToken runs right after createIdentity.
  await bob.goto(joinUrl);
  await createIdentity(bob, 'Bob');

  // processJoinToken opens the group conversation automatically — no click needed.
  await expect(bob.locator('#msg-conv-name')).toContainText('E2E Group');

  // Alice's own tab only learns of the new joiner via startGroupMemberPoll (5s interval) —
  // open her group conversation so the poll's renderContacts() update is visible, then wait
  // for it to pick Bob up before she sends (otherwise her local `members` list is still just
  // herself and Bob would never receive the message).
  const aliceGroup = alice.locator('#msg-contacts .contact');
  await expect(aliceGroup).toBeVisible();
  await aliceGroup.click();

  await expect(async () => {
    const memberCount = await alice.evaluate(() => new Promise((resolve, reject) => {
      const req = indexedDB.open('breeze-messenger', 5);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('contacts', 'readonly');
        tx.objectStore('contacts').getAll().onsuccess = (e) => {
          const group = e.target.result.find(c => c.isGroup);
          resolve(group?.members?.length || 0);
        };
      };
    }));
    expect(memberCount).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 20_000, intervals: [1000] });

  const text = 'hello group from Alice — ' + Date.now();
  await alice.locator('#msg-input').fill(text);
  await alice.locator('#b-msg-send').click();

  await expect(bob.locator('#msg-messages')).toContainText(text, { timeout: 15_000 });

  await aliceCtx.close();
  await bobCtx.close();
});

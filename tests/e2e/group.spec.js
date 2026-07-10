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

// Creates a server-backed group via the add-contact prompt's "group:<name>" syntax, leaving
// the members prompt empty to route to the invite-link path (createGroupInviteLink), and
// returns the extracted invite URL.
async function createGroupWithInviteLink(page, name) {
  await page.locator('#b-msg-add').click();
  const groupDialog = page.locator('dialog[aria-labelledby]');
  await groupDialog.locator('.modal-input').fill('group:' + name);
  await groupDialog.locator('[value="ok"]').click();

  const membersDialog = page.locator('dialog[aria-labelledby]');
  await expect(membersDialog).toBeVisible();
  await membersDialog.locator('[value="ok"]').click(); // empty members list -> invite link

  const inviteBox = page.locator('.i-mono-box');
  await expect(inviteBox).toBeVisible();
  const joinUrl = await inviteBox.textContent();
  expect(joinUrl).toMatch(/\?join=/);
  return joinUrl;
}

// processJoinToken opens the group conversation automatically — no click needed afterward.
async function joinGroup(page, name, joinUrl, groupName) {
  await page.goto(joinUrl);
  await createIdentity(page, name);
  await expect(page.locator('#msg-conv-name')).toContainText(groupName);
}

async function readGroupFromIdb(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('breeze-messenger', 5);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction('contacts', 'readonly');
      tx.objectStore('contacts').getAll().onsuccess = (e) => resolve(e.target.result.find(c => c.isGroup));
    };
  }));
}

async function waitForMemberCount(page, n) {
  await expect(async () => {
    const group = await readGroupFromIdb(page);
    expect(group?.members?.length || 0).toBeGreaterThanOrEqual(n);
  }).toPass({ timeout: 20_000, intervals: [1000] });
}

test('group invite link: creator and joiner exchange a Sender-Key message', async ({ browser }) => {
  const aliceCtx = await browser.newContext(ctxOpts('203.0.113.11'));
  const bobCtx = await browser.newContext(ctxOpts('203.0.113.12'));
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  await alice.goto('/');
  await createIdentity(alice, 'Alice');
  const joinUrl = await createGroupWithInviteLink(alice, 'E2E Group');
  await joinGroup(bob, 'Bob', joinUrl, 'E2E Group');

  // Alice's own tab only learns of the new joiner via startGroupMemberPoll (5s interval) —
  // open her group conversation so the poll's renderContacts() update is visible, then wait
  // for it to pick Bob up before she sends (otherwise her local `members` list is still just
  // herself and Bob would never receive the message).
  const aliceGroup = alice.locator('#msg-contacts .contact');
  await expect(aliceGroup).toBeVisible();
  await aliceGroup.click();
  await waitForMemberCount(alice, 2);

  const text = 'hello group from Alice — ' + Date.now();
  await alice.locator('#msg-input').fill(text);
  await alice.locator('#b-msg-send').click();

  await expect(bob.locator('#msg-messages')).toContainText(text, { timeout: 15_000 });

  await aliceCtx.close();
  await bobCtx.close();
});

test('group invite link: creator kicks a member via /admin, server-side too', async ({ browser }) => {
  const aliceCtx = await browser.newContext(ctxOpts('203.0.113.13'));
  const bobCtx = await browser.newContext(ctxOpts('203.0.113.14'));
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  await alice.goto('/');
  await createIdentity(alice, 'Alice');
  const joinUrl = await createGroupWithInviteLink(alice, 'Kick Group');
  await joinGroup(bob, 'Bob', joinUrl, 'Kick Group');

  const aliceGroup = alice.locator('#msg-contacts .contact');
  await expect(aliceGroup).toBeVisible();
  await aliceGroup.click();
  await waitForMemberCount(alice, 2);

  // /admin requires isGroupAdmin(activeContact) — true for the creator via `createdBy`,
  // which createGroupInviteLink previously never set (E2E-found, fixed alongside this test).
  await alice.locator('#msg-input').fill('/admin kick Bob');
  await alice.locator('#msg-input').press('Enter');

  // Client-side: Bob is gone from Alice's local member list.
  await expect(async () => {
    const group = await readGroupFromIdb(alice);
    expect(group.members.some(m => m.name === 'Bob')).toBe(false);
  }).toPass({ timeout: 10_000, intervals: [500] });

  // Server-side truth: /admin kick previously used a field (`groupToken`) that groups never
  // set, so the /group/kick call silently never fired — confirm it actually reached the
  // server this time by asking it directly for the group's current roster.
  const group = await readGroupFromIdb(alice);
  const infoResp = await alice.request.post('/api/group/info', { data: { token: group.joinToken } });
  const info = await infoResp.json();
  expect(info.members.some(m => m.name === 'Bob')).toBe(false);

  await aliceCtx.close();
  await bobCtx.close();
});

test('deleting a server-backed group as its creator removes it server-side too', async ({ browser }) => {
  const aliceCtx = await browser.newContext(ctxOpts('203.0.113.15'));
  const alice = await aliceCtx.newPage();

  await alice.goto('/');
  await createIdentity(alice, 'Alice');
  await createGroupWithInviteLink(alice, 'Delete Group');
  const group = await readGroupFromIdb(alice);

  const aliceGroup = alice.locator('#msg-contacts .contact');
  await expect(aliceGroup).toBeVisible();
  await aliceGroup.click({ button: 'right' });
  await alice.locator('.ctx-menu .ctx-item', { hasText: 'Delete' }).click();
  await alice.locator('dialog[aria-labelledby] [value="ok"]').click();

  // Client-side: the group is gone from the local contact list.
  await expect(alice.locator('#msg-contacts .contact')).toHaveCount(0);

  // Server-side truth: createGroupInviteLink's delete-context-menu wiring previously never
  // called /api/group/delete at all, leaving every member's id/pub/name in the Worker's KV
  // for the full 30-day TTL to anyone still holding the invite token (E2E-found).
  const infoResp = await alice.request.post('/api/group/info', { data: { token: group.joinToken } });
  expect(infoResp.status()).toBe(404);

  await aliceCtx.close();
});

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

test('creator promotes then demotes a member via /admin, reflected server-side', async ({ browser }) => {
  const aliceCtx = await browser.newContext(ctxOpts('203.0.113.25'));
  const bobCtx = await browser.newContext(ctxOpts('203.0.113.26'));
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  await alice.goto('/');
  await createIdentity(alice, 'Alice');
  const joinUrl = await createGroupWithInviteLink(alice, 'Admin Group');
  await joinGroup(bob, 'Bob', joinUrl, 'Admin Group');

  const aliceGroup = alice.locator('#msg-contacts .contact', { hasText: 'Admin Group' });
  await expect(aliceGroup).toBeVisible();
  await aliceGroup.click();
  await waitForMemberCount(alice, 2);

  const token = (await readGroupFromIdb(alice)).joinToken;
  const bobId = (await readGroupFromIdb(alice)).members.find(m => m.name === 'Bob').id;
  const adminsOnServer = async () => (await (await alice.request.post('/api/group/info', { data: { token } })).json()).admins;

  // handleGroupAdmin stores the target's *id* in group.admins; /group/info echoes it back.
  expect(await adminsOnServer()).not.toContain(bobId); // baseline: nobody promoted yet

  await alice.locator('#msg-input').fill('/admin promote Bob');
  await alice.locator('#msg-input').press('Enter');
  await expect(async () => expect(await adminsOnServer()).toContain(bobId)).toPass({ timeout: 10_000, intervals: [500] });

  // Demote (added this session alongside the existing promote) must reach the server and
  // remove Bob from the admins array — distinct from kick (he stays a member, loses admin).
  await alice.locator('#msg-input').fill('/admin demote Bob');
  await alice.locator('#msg-input').press('Enter');
  await expect(async () => expect(await adminsOnServer()).not.toContain(bobId)).toPass({ timeout: 10_000, intervals: [500] });

  // Bob is still a member the whole time — demote only revokes the admin role.
  const info = await (await alice.request.post('/api/group/info', { data: { token } })).json();
  expect(info.members.some(m => m.name === 'Bob')).toBe(true);

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

test('a non-creator leaving a group removes only them server-side (group survives)', async ({ browser }) => {
  const aliceCtx = await browser.newContext(ctxOpts('203.0.113.20'));
  const bobCtx = await browser.newContext(ctxOpts('203.0.113.24'));
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  await alice.goto('/');
  await createIdentity(alice, 'Alice');
  const joinUrl = await createGroupWithInviteLink(alice, 'Leave Group');
  await joinGroup(bob, 'Bob', joinUrl, 'Leave Group');
  const token = (await readGroupFromIdb(alice)).joinToken;

  // Precondition: the server sees both members.
  const before = await (await alice.request.post('/api/group/info', { data: { token } })).json();
  expect(before.members.map(m => m.name).sort()).toEqual(['Alice', 'Bob']);

  // Bob is NOT the creator (his local record has no matching createdBy), so deleting the
  // group from his contact list routes to /api/group/leave, not /api/group/delete.
  // processJoinToken also adds Alice as an individual contact, so target the group by name.
  const bobGroup = bob.locator('#msg-contacts .contact', { hasText: 'Leave Group' });
  await expect(bobGroup).toBeVisible();
  await bobGroup.click({ button: 'right' });
  await bob.locator('.ctx-menu .ctx-item', { hasText: 'Delete' }).click();
  await bob.locator('dialog[aria-labelledby] [value="ok"]').click();
  await expect(bob.locator('#msg-contacts .contact', { hasText: 'Leave Group' })).toHaveCount(0);

  // Server-side truth: the group still EXISTS (Alice the creator didn't delete it) but Bob is
  // gone from its roster — the leave path, distinct from the creator-delete 404 above.
  const after = await (await alice.request.post('/api/group/info', { data: { token } })).json();
  expect(after.members.map(m => m.name)).toEqual(['Alice']);
  expect(after.members.some(m => m.name === 'Bob')).toBe(false);

  await aliceCtx.close();
  await bobCtx.close();
});

// Patches the served index.html so this context's client behaves as if GROUP_RATCHET_V5
// were true, without touching the committed file — simulates a real client-version skew
// (an upgraded client talking to a not-yet-upgraded one) rather than two copies of the
// same build. CONFIG is a plain top-level const, not exposed on window/runtime-toggleable,
// so a serve-time text patch is the only way to flip it for one browser context only.
async function withGroupV5Patched(context) {
  await context.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const resp = await route.fetch();
    const body = (await resp.text()).replace('GROUP_RATCHET_V5: false,', 'GROUP_RATCHET_V5: true,');
    if (!body.includes('GROUP_RATCHET_V5: true,')) throw new Error('withGroupV5Patched: marker not found — CONFIG moved, update this test');
    await route.fulfill({ response: resp, body });
  });
}

async function readGroupSenderKey(page, groupId) {
  return page.evaluate((gid) => new Promise((resolve, reject) => {
    const req = indexedDB.open('breeze-messenger', 5);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      req.result.transaction('identity', 'readonly').objectStore('identity').get('gsk:' + gid).onsuccess = (e) => resolve(e.target.result);
    };
  }), groupId);
}

test('group-v5 negotiation: one legacy member keeps the whole group on the v3 fallback', async ({ browser }) => {
  const aliceCtx = await browser.newContext(ctxOpts('203.0.113.16'));
  const bobCtx = await browser.newContext(ctxOpts('203.0.113.17'));
  await withGroupV5Patched(aliceCtx); // Alice's client supports group-v5...
  // ...Bob's stays the pristine default (GROUP_RATCHET_V5: false) — a legacy peer.
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  await alice.goto('/');
  await createIdentity(alice, 'Alice');
  const joinUrl = await createGroupWithInviteLink(alice, 'Mixed Group');
  await joinGroup(bob, 'Bob', joinUrl, 'Mixed Group');

  const aliceGroup = alice.locator('#msg-contacts .contact');
  await expect(aliceGroup).toBeVisible();
  await aliceGroup.click();
  await waitForMemberCount(alice, 2);

  const text = 'hello mixed group — ' + Date.now();
  await alice.locator('#msg-input').fill(text);
  await alice.locator('#b-msg-send').click();

  // Strongest black-box proof: a real v5 emission would leave Bob unable to decrypt at all
  // (indistinguishable from a dropped message) — so the plaintext actually arriving proves
  // the v3 wire format was used despite Alice's local flag being on.
  await expect(bob.locator('#msg-messages')).toContainText(text, { timeout: 15_000 });

  const group = await readGroupFromIdb(alice);
  expect(group.groupV5).toBe(false);
  const sk = await readGroupSenderKey(alice, group.id);
  expect(sk.v).toBeUndefined();
  expect(Array.isArray(sk.raw)).toBe(true);

  await aliceCtx.close();
  await bobCtx.close();
});

test('group-v5 negotiation: both members supporting it upgrades the group to the v5 ratchet', async ({ browser }) => {
  const aliceCtx = await browser.newContext(ctxOpts('203.0.113.18'));
  const bobCtx = await browser.newContext(ctxOpts('203.0.113.19'));
  await withGroupV5Patched(aliceCtx);
  await withGroupV5Patched(bobCtx);
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();

  await alice.goto('/');
  await createIdentity(alice, 'Alice');
  const joinUrl = await createGroupWithInviteLink(alice, 'V5 Group');
  await joinGroup(bob, 'Bob', joinUrl, 'V5 Group');

  const aliceGroup = alice.locator('#msg-contacts .contact');
  await expect(aliceGroup).toBeVisible();
  await aliceGroup.click();
  await waitForMemberCount(alice, 2);

  const text = 'hello v5 group — ' + Date.now();
  await alice.locator('#msg-input').fill(text);
  await alice.locator('#b-msg-send').click();
  await expect(bob.locator('#msg-messages')).toContainText(text, { timeout: 15_000 });

  const group = await readGroupFromIdb(alice);
  expect(group.groupV5).toBe(true);
  const sk = await readGroupSenderKey(alice, group.id);
  expect(sk.v).toBe(5);
  expect(Array.isArray(sk.chainKey)).toBe(true);

  await aliceCtx.close();
  await bobCtx.close();
});

// First contact, in two real browsers. Regression for the add-contact profile greeting:
// it used to be the first ratchet message to a new contact, spending the one-shot X3DH
// header on a control payload the peer dropped or collided with — after which NO chat
// message between the two ever decrypted (status stayed "deposited", nothing was shown).
import { test, expect } from '@playwright/test';
import { createIdentity } from './helpers.mjs';

// The add-contact surface is the in-chat panel (_showAddContactPanel).
async function addContact(page, pubB64) {
  await page.locator('#b-msg-add').click();
  const input = page.locator('#msg-messages .modal-input');
  await input.fill(pubB64);
  await input.press('Enter');
  const contact = page.locator('#msg-contacts .contact');
  await expect(contact).toBeVisible();
  await contact.click();
}

async function pair(browser, ipA, ipB) {
  const aliceCtx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': ipA } });
  const bobCtx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': ipB } });
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();
  const alicePub = await createIdentity(alice, 'Alice');
  const bobPub = await createIdentity(bob, 'Bob');
  return { aliceCtx, bobCtx, alice, bob, alicePub, bobPub };
}

async function say(page, text) {
  await page.locator('#msg-input').fill(text);
  await page.locator('#b-msg-send').click();
}

test('both sides add each other: the first message and the reply are delivered', async ({ browser }) => {
  const { aliceCtx, bobCtx, alice, bob, alicePub, bobPub } = await pair(browser, '203.0.113.61', '203.0.113.62');
  await addContact(alice, bobPub);
  await addContact(bob, alicePub);

  await say(alice, 'first message from Alice');
  await expect(bob.locator('#msg-messages')).toContainText('first message from Alice', { timeout: 20_000 });
  await say(bob, 'reply from Bob');
  await expect(alice.locator('#msg-messages')).toContainText('reply from Bob', { timeout: 20_000 });

  await aliceCtx.close(); await bobCtx.close();
});

test('only the sender added the recipient: the stranger still receives the first message', async ({ browser }) => {
  const { aliceCtx, bobCtx, alice, bob, bobPub } = await pair(browser, '203.0.113.63', '203.0.113.64');
  await addContact(alice, bobPub);

  await say(alice, 'hello stranger');
  const incoming = bob.locator('#msg-contacts .contact');
  await expect(incoming).toBeVisible({ timeout: 20_000 });
  await incoming.click();
  await expect(bob.locator('#msg-messages')).toContainText('hello stranger', { timeout: 20_000 });
  await say(bob, 'who is this?');
  await expect(alice.locator('#msg-messages')).toContainText('who is this?', { timeout: 20_000 });

  await aliceCtx.close(); await bobCtx.close();
});

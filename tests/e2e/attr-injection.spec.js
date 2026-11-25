// A peer's message text reaches innerHTML through esc() → renderMarkdown → renderLinks.
// esc() must neutralise quotes, or a URL carrying `"` closes the generated href="…"
// and smuggles attributes the sanitizer allows (style, class, id, data-*) onto the
// link — a one-message full-screen overlay / remote-fetch (style background:url) vector.
import { test, expect } from '@playwright/test';
import { createIdentity } from './helpers.mjs';

// The add-contact surface is the in-chat panel (_showAddContactPanel), not a dialog.
async function addAndOpen(page, pubB64) {
  await page.locator('#b-msg-add').click();
  const input = page.locator('#msg-messages .modal-input');
  await input.fill(pubB64);
  await input.press('Enter');
  const contact = page.locator('#msg-contacts .contact');
  await expect(contact).toBeVisible();
  await contact.click();
}

test('a quote inside a received URL cannot inject attributes onto the rendered link', async ({ browser }) => {
  const aliceCtx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.71' } });
  const bobCtx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.72' } });
  const alice = await aliceCtx.newPage();
  const bob = await bobCtx.newPage();
  const alicePub = await createIdentity(alice, 'Alice');
  const bobPub = await createIdentity(bob, 'Bob');
  await addAndOpen(alice, bobPub);
  await addAndOpen(bob, alicePub);

  const url = 'https://example.com/"style="position:fixed;inset:0"id="pwned"data-x="1';
  await alice.locator('#msg-input').fill('see ' + url);
  await alice.locator('#b-msg-send').click();

  for (const page of [alice, bob]) {
    const link = page.locator('#msg-messages a.md-link').first();
    await expect(link).toBeVisible({ timeout: 20_000 });
    expect(await link.getAttribute('style')).toBeNull();
    expect(await link.getAttribute('id')).toBeNull();
    expect(await link.getAttribute('data-x')).toBeNull();
    await expect(page.locator('#pwned')).toHaveCount(0);
    // The message is still shown verbatim as text.
    await expect(link).toHaveText(url);
  }
  await aliceCtx.close(); await bobCtx.close();
});

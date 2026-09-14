// A disappearing message's badge is rendered ONCE, precisely, by appendMsg() — the one
// function that renders every message (fresh, incoming, or reloaded from IndexedDB
// history) — using the real `meta.disappearAt` timestamp directly. A second, separate
// 30-second global scanner used to also exist, re-deriving a deadline by regex-matching
// the badge's already-TRANSLATED title ("Disappears in 1h") instead of using the real
// timestamp: `/(\d+)/` extracts the leading digits and always multiplies by minutes,
// ignoring the unit letter the label itself carries. E2E-confirmed against the real
// generated title: it computed a 1-MINUTE deadline for a message promised to last a full
// HOUR — 59 minutes short — and 23h36m short for the 24h option, the two longest, most-
// trusted choices in the picker. Deleted entirely rather than fixed: the precise
// implementation already covered every real case (fresh sends AND history reloads), so
// the buggy one had nothing left to contribute except deleting people's messages up to
// 60x sooner than promised.
//
// This needs to wait real wall-clock time rather than Playwright's page.clock: the
// per-message countdown's first tick is kicked off via requestAnimationFrame, which
// Playwright's virtual clock does not reliably drive in this environment (confirmed:
// fast-forwarding past even a 30s TTL left the message showing as still present).
import { test, expect } from '@playwright/test';

test('a message set to disappear in 1h is not deleted within the first 90 seconds', async ({ page }) => {
  // Inherently real-time-bound (see file header for why page.clock can't substitute):
  // the 90s wait alone exceeds the default 30s test timeout, let alone with setup.
  test.setTimeout(150_000);
  await page.goto('/');
  await page.locator('#msg-name').fill('Disappear Tester');
  await page.locator('#b-msg-setup').click();
  await expect(page.locator('#msg-main')).toBeVisible();

  await page.locator('#b-msg-add').click();
  const dialog = page.locator('dialog[aria-labelledby]');
  const fakePub = await page.evaluate(() => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
  await dialog.locator('.modal-input').fill(fakePub);
  await dialog.locator('[value="ok"]').click();
  await expect(dialog).toBeHidden();
  await page.locator('#msg-contacts .contact').first().click();
  await expect(page.locator('#msg-input-bar')).toBeVisible();

  // The timer button cycles Off -> 30s -> 5min -> 1h -> 24h.
  for (let i = 0; i < 3; i++) await page.locator('#b-msg-timer').click();
  await expect(page.locator('#b-msg-timer')).toHaveText('1h');

  await page.locator('#msg-input').fill('promised to last one hour');
  await page.locator('#b-msg-send').click();

  const badge = page.locator('.msg-timer-badge');
  await expect(badge).toHaveText('⏱1h');
  await expect(badge).toHaveAttribute('title', /Disappears in 1h/);

  // The deleted scanner ran every 30s and, on the FIRST scan that discovered a new
  // badge, seeded its (wrong) deadline; the very NEXT 30s scan would then see it as
  // expired. 90s covers three of its cycles — comfortably past where the bug would have
  // fired, and still ~58 minutes short of the message's real, correct deadline.
  await page.waitForTimeout(90_000);

  await expect(page.locator('.msg.me')).toBeVisible();
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText(/⏱\d+m/); // now counting down in minutes, not gone
});

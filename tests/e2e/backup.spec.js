// Backup restore used to reload the page almost instantly after showing its "Restored!
// Reloading..." toast, defeating the whole point of showing it. restoreBackup() (drag-drop /
// file-picker restore) had `setTimeout(() => location.reload(), 1.5 * MS.SEC)` immediately
// followed by an unconditional `location.reload()` on the very next line — a leftover
// duplicate, the same "two implementations, one stale" shape found repeatedly elsewhere this
// session, just inside one function instead of across two. The immediate call fired before the
// delayed one ever got a chance to, so the toast was torn down with the rest of the page well
// under half a second after appearing. restoreCloudBackup() had the same underlying symptom
// via a different mistake — no delay at all, just an immediate reload right after the toast.
// Both now use the single, delayed-reload pattern already established elsewhere in this file
// (the remote-wipe handler, the IDB-connection-lost handler) for the exact same
// toast-then-reload sequence.
import { test, expect } from '@playwright/test';
import fs from 'fs';

test('restoring a backup shows its confirmation toast for a real interval before reloading, not a fraction of a second', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => { try { localStorage.setItem('brz-consent', String(Date.now())); } catch {} });
  await page.goto('/');
  await page.locator('#msg-name').fill('Restore Timing');
  await page.locator('#b-msg-setup').click();
  await expect(page.locator('#msg-main')).toBeVisible();

  await page.locator('#msg-input').fill('/backup');
  await page.locator('#msg-input').press('Enter');
  await expect(page.locator('[data-action="backup-file"]')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-action="backup-file"]').click();
  const backupPrompt = page.locator('dialog[aria-labelledby]');
  await backupPrompt.locator('.modal-input').fill('testpass123');
  await backupPrompt.locator('[value="ok"]').click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  const backupBase64 = fs.readFileSync(backupPath).toString('base64');

  // Drag-drop restore: the exact backup file just downloaded, dropped onto the sidebar.
  await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const file = new File([bytes], 'breeze-backup-test.json', { type: 'application/json' });
    const dt = new DataTransfer();
    dt.items.add(file);
    const sidebar = document.getElementById('msg-sidebar');
    sidebar.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, backupBase64);

  const restorePrompt = page.locator('dialog[aria-labelledby]');
  await expect(restorePrompt).toBeVisible();

  const navPromise = page.waitForEvent('framenavigated', { timeout: 10_000 });
  const t0 = Date.now();
  await restorePrompt.locator('.modal-input').fill('testpass123');
  await restorePrompt.locator('[value="ok"]').click();
  await navPromise;
  const elapsed = Date.now() - t0;

  // The pre-fix build reloads in well under 500ms (the immediate call wins the race); the
  // fixed build honors the intended ~1.5s delay. 1000ms comfortably separates the two while
  // leaving margin for CI slowness on the "real delay happened" side.
  expect(elapsed, 'the reload should wait for the full toast delay, not fire near-instantly').toBeGreaterThan(1000);
});

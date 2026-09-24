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

// Both restore paths (file + cloud) required a non-empty `pubB64` on every contact — but groups
// are stored with pubB64:'' — so restoring a backup silently dropped EVERY group, even though the
// loop's own next line sanitized `members` (a field only groups have). /contacts import exempted
// groups correctly; the two restore copies had drifted. Both now share _restoreContacts().
test('restoring a backup brings back groups, not just 1:1 contacts', async ({ browser }) => {
  test.setTimeout(90_000);
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'CF-Connecting-IP': '203.0.113.170' } });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('brz-consent', String(Date.now())); } catch {} });
  await page.goto('/');
  await page.locator('#msg-name').fill('Group Restore');
  await page.locator('#b-msg-setup').click();
  await expect(page.locator('#msg-main')).toBeVisible();

  // Create a server-backed group (same dialog flow as group.spec's createGroupWithInviteLink).
  await page.locator('#b-msg-add').click();
  await page.locator('dialog[aria-labelledby] .modal-input').fill('group:Restore Me');
  await page.locator('dialog[aria-labelledby] [value="ok"]').click();
  await page.locator('dialog[aria-labelledby] [value="ok"]').click(); // empty members -> invite link
  await expect(page.locator('.i-mono-box')).toBeVisible();

  const groups = () => page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.open('breeze-messenger', 5);
    req.onsuccess = () => {
      req.result.transaction('contacts', 'readonly').objectStore('contacts').getAll()
        .onsuccess = (e) => resolve(e.target.result.filter((c) => c.isGroup).map((c) => c.name));
    };
  }));
  expect(await groups()).toEqual(['Restore Me']);

  await page.locator('#msg-input').fill('/backup');
  await page.locator('#msg-input').press('Enter');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-action="backup-file"]').click();
  await page.locator('dialog[aria-labelledby] .modal-input').fill('grouppass123');
  await page.locator('dialog[aria-labelledby] [value="ok"]').click();
  const backupB64 = fs.readFileSync(await (await downloadPromise).path()).toString('base64');

  // Simulate restoring onto a device that doesn't have the group.
  await page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.open('breeze-messenger', 5);
    req.onsuccess = () => {
      const tx = req.result.transaction('contacts', 'readwrite');
      const store = tx.objectStore('contacts');
      store.getAll().onsuccess = (e) => { for (const c of e.target.result) if (c.isGroup) store.delete(c.id); };
      tx.oncomplete = resolve;
    };
  }));
  expect(await groups()).toEqual([]);

  await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'backup.json', { type: 'application/json' }));
    document.getElementById('msg-sidebar').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, backupB64);
  const nav = page.waitForEvent('framenavigated', { timeout: 15_000 });
  await page.locator('dialog[aria-labelledby] .modal-input').fill('grouppass123');
  await page.locator('dialog[aria-labelledby] [value="ok"]').click();
  await nav;
  await expect(page.locator('#msg-main')).toBeVisible();
  expect(await groups(), 'the group must survive a backup/restore round trip').toEqual(['Restore Me']);
  await ctx.close();
});

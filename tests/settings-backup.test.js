import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// One-tap restore (owner request): backup/restore used to live only in the
// /backup slash-command panel — undiscoverable for anyone who does not type
// commands. The Settings panel now carries the same three actions; the
// document-level data-action delegation routes them to the same handlers,
// and restore goes through restoreBackupSmart (passphrase prompt, then
// restore + reload — nothing else to tap).
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('settings panel backup section', () => {
  const start = html.indexOf("${t('settingsPrivacy')}");
  const panel = html.slice(start, html.indexOf('box.appendChild(d); box.scrollTop', start));

  it('has a backup section heading', () => {
    expect(panel).toContain("${t('settingsBackup')}");
  });
  it('offers cloud backup, one-tap restore and file restore', () => {
    expect(panel).toContain('data-action="backup"');
    expect(panel).toContain('data-action="restore"');
    expect(panel).toContain('data-action="restore-file"');
  });
  it('the restore action routes to restoreBackupSmart', () => {
    expect(html).toContain('if (e.target.closest(\'[data-action="restore"]\')) { restoreBackupSmart(); return; }');
  });
});

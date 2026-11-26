import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { settingsPanelHtml } from '../src/app/settings-panel.js';

// One-tap restore (owner request): backup/restore used to live only in the
// /backup slash-command panel — undiscoverable for anyone who does not type
// commands. The Settings panel now carries the same three actions; the
// document-level data-action delegation routes them to the same handlers,
// and restore goes through restoreBackupSmart (passphrase prompt, then
// restore + reload — nothing else to tap).
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('settings panel backup section', () => {
  const panel = settingsPanelHtml({
    t: (key) => key, esc: (x) => String(x), myName: 'Name', fanout: 2, powerMode: 'auto',
    relays: [{ label: 'relay', url: 'https://relay.example', origin: false, blocked: false }],
  });

  it('has a backup section heading', () => {
    expect(panel).toContain('<h2>settingsBackup</h2>');
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

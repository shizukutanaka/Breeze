// postinst.sh contract: the .deb afterInstall hook registers breeze:// via
// xdg-mime against whatever .desktop file electron-builder emitted. The file
// name follows executableName (unset → productName "Breeze" → Breeze.desktop),
// which once differed from the hardcoded "breeze-desktop.desktop" the hook
// referenced — the || true then silently skipped registration forever.
// Pin: the hook must try the plausible emitted names, not a single guess.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..');
const hook = fs.readFileSync(path.join(root, 'desktop/scripts/postinst.sh'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'desktop/package.json'), 'utf8'));

describe('desktop postinst.sh', () => {
  it('is wired as the linux afterInstall hook', () => {
    expect(pkg.build.deb.afterInstall).toBe('scripts/postinst.sh');
  });

  it('registers the breeze:// scheme via xdg-mime', () => {
    expect(hook).toContain('x-scheme-handler/breeze');
  });

  it('tries candidate desktop filenames (electron-builder names it after executableName)', () => {
    expect(hook).toMatch(/for\s+d\s+in\s+/);
    expect(hook).toContain('Breeze.desktop');
    expect(hook).toContain('breeze-desktop.desktop');
    // single-name regression guard
    expect(hook).not.toMatch(/^xdg-mime/m);
  });

  it('only registers a desktop file that exists (no dangling xdg-mime default)', () => {
    expect(hook).toContain('[ -f "/usr/share/applications/$d" ]');
  });
});

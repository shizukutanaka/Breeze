// deb.depends contract: electron-builder REPLACES its default dependency
// set when `depends` is specified — the old 3-entry list silently dropped
// libgtk-3-0/libnss3/libxss1/libxtst6/xdg-utils/libatspi2.0-0/libuuid1, so
// the .deb installed on a minimal system without pulling the libraries the
// app needs to launch. And libappindicator3-1 alone fails on Ubuntu 24.04 /
// Debian 12+, where the package was renamed libayatana-appindicator3-1 —
// an `a | b` alternative covers both.
import { describe, it, expect } from 'vitest';
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('desktop/package.json', 'utf8'));
const depends = pkg.build.deb.depends;

const REQUIRED = [
  'libgtk-3-0',
  'libnotify4',
  'libnss3',
  'libxss1',
  'libxtst6',
  'xdg-utils',
  'libatspi2.0-0',
  'libuuid1',
  'libsecret-1-0',
];

describe('deb.depends covers the Electron runtime set', () => {
  for (const lib of REQUIRED) {
    it(lib, () => expect(depends).toContain(lib));
  }

  it('appindicator dep allows the ayatana rename (Ubuntu 24.04 / Debian 12+)', () => {
    expect(depends).toContain('libayatana-appindicator3-1 | libappindicator3-1');
  });
});

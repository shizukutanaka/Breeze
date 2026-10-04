// rpm.depends contract — same defect class as deb.depends: a custom list
// replaces electron-builder's defaults, so the 3-entry list dropped
// gtk3/nss/libXScrnSaver/libXtst/xdg-utils/at-spi2-atk/libuuid and the
// package could not launch on a minimal Fedora/RHEL install.
import { describe, it, expect } from 'vitest';
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('desktop/package.json', 'utf8'));
const depends = pkg.build.rpm.depends;

const REQUIRED = [
  'gtk3',
  'libnotify',
  'nss',
  'libXScrnSaver',
  'libXtst',
  'xdg-utils',
  'at-spi2-atk',
  'libuuid',
  'libsecret',
  'libappindicator-gtk3',
];

describe('rpm.depends covers the Electron runtime set (Fedora/RHEL names)', () => {
  for (const lib of REQUIRED) {
    it(lib, () => expect(depends).toContain(lib));
  }
});

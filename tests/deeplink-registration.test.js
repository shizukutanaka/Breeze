// Pin: breeze:// deep links must be registered on every desktop target.
// electron-builder's `protocols` covers Windows (NSIS registry), Linux
// (desktop-file MimeType — the only path AppImage/rpm get, since postinst.sh
// runs for .deb only and setAsDefaultProtocolClient is a Linux no-op), and
// macOS (CFBundleURLTypes — which is why extendInfo must not re-declare it).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'desktop/package.json'), 'utf8'));
const tauri = JSON.parse(readFileSync(join(root, 'tauri/src-tauri/tauri.conf.json'), 'utf8'));
const main = readFileSync(join(root, 'desktop/main.js'), 'utf8');

describe('breeze:// registration', () => {
  it('electron-builder protocols declares the breeze scheme (all platforms)', () => {
    const protos = [].concat(pkg.build.protocols || []);
    expect(
      protos.some(p => (p.schemes || []).includes('breeze')),
      'build.protocols has no breeze scheme — Windows/AppImage/rpm deep links dead'
    ).toBe(true);
  });

  it('extendInfo does not double-register CFBundleURLTypes (protocols generates it)', () => {
    const ei = pkg.build.mac.extendInfo || {};
    expect(ei.CFBundleURLTypes).toBeUndefined();
  });

  it('main.js keeps the runtime fallback for unpackaged/dev launches', () => {
    expect(main).toMatch(/PROTOCOL\s*=\s*'breeze'/);
    expect(main).toContain('setAsDefaultProtocolClient(PROTOCOL');
  });

  it('tauri deep-link plugin registers breeze on desktop and mobile', () => {
    const dl = tauri.plugins?.['deep-link'];
    expect(dl?.desktop?.schemes).toContain('breeze');
    expect(dl?.mobile?.schemes).toContain('breeze');
  });
});

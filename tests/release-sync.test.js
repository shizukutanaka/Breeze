// Release-metadata sync pins. The dist/ manifests spent months pinned to 3.5.0
// while the app shipped 3.6.1, and the mobile bundle once shipped English-only
// because a packaging ASSETS table forgot locales/. These tests pin the two
// drift classes at the source: (a) the three places the app version is declared
// must agree — a stale sw.js VERSION serves a mixed-version cache and a stale
// manifest version mislabels the installed PWA; (b) every file a packaging /
// precache list claims to ship must actually exist in the repo.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(join(root, f), 'utf8');

const swVersion = read('sw.js').match(/const VERSION = '([^']+)'/)[1];
const appVersion = read('index.html').match(/VERSION: '([^']+)'/)[1];
const manifest = JSON.parse(read('manifest.json'));

describe('version parity', () => {
  it('sw.js VERSION === index.html CONFIG.VERSION === manifest.version', () => {
    expect(swVersion).toBe(appVersion);
    expect(manifest.version).toBe(appVersion);
  });
});

describe('every packaged/precached file exists', () => {
  it('sw.js precache ASSETS all resolve to real files', () => {
    const declared = read('sw.js').match(/const ASSETS = \[([^\]]*)\]/)[1];
    for (const m of declared.matchAll(/'\/([^']*)'/g)) {
      const rel = m[1] || 'index.html'; // '/' serves index.html
      expect(existsSync(join(root, rel)), `precached /${rel} missing`).toBe(true);
    }
  });

  it('build.sh WEB_FILES entries all exist — the desktop packaging gate exits 1 on a missing file', () => {
    const m = read('build.sh').match(/WEB_FILES=\(([^)]*)\)/);
    expect(m).not.toBeNull();
    for (const f of m[1].trim().split(/\s+/)) {
      expect(existsSync(join(root, f)), `WEB_FILES entry ${f} missing`).toBe(true);
    }
  });

  it('manifest icon paths exist', () => {
    for (const icon of manifest.icons || []) {
      const p = icon.src.replace(/^\//, '');
      expect(existsSync(join(root, p)), `manifest icon ${icon.src} missing`).toBe(true);
    }
  });
});

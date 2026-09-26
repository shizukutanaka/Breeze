// mobile/prepare.js decides what lands in the Capacitor bundle's www/. Its
// static ASSETS table forgot locales/ entirely — index.html fetches
// locales/<lang>.json at boot, so the packaged app silently fell back to
// English for all 7 shipped locales. Runs the real script (BREEZE_WWW points
// it at a temp dir) and asserts the copy covers everything.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, readdirSync, readFileSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let www;

beforeAll(() => {
  www = mkdtempSync(join(tmpdir(), 'breeze-www-'));
  execFileSync('node', [join(root, 'mobile/prepare.js')], {
    env: { ...process.env, BREEZE_WWW: www },
    stdio: 'pipe',
  });
});
afterAll(() => rmSync(www, { recursive: true, force: true }));

describe('mobile/prepare.js copies everything the app fetches', () => {
  it('ships every locales/*.json — a missing one silently reverts that UI to English', () => {
    const shipped = readdirSync(join(root, 'locales')).filter(f => f.endsWith('.json'));
    expect(shipped.length).toBeGreaterThan(0);
    for (const f of shipped) {
      expect(existsSync(join(www, 'locales', f)), `locales/${f} missing from www/`).toBe(true);
    }
  });

  it('ships the app shell', () => {
    for (const f of ['index.html', 'sw.js', 'manifest.json', 'icon-192.png', 'icon-512.png']) {
      expect(existsSync(join(www, f)), `${f} missing from www/`).toBe(true);
    }
  });

  it('hashes every copied file into .build-manifest.json', () => {
    const manifest = JSON.parse(readFileSync(join(www, '.build-manifest.json'), 'utf8'));
    for (const f of readdirSync(join(root, 'locales')).filter(f => f.endsWith('.json'))) {
      expect(manifest[`locales/${f}`]).toMatch(/^[0-9a-f]{16}$/);
    }
    expect(manifest['index.html']).toMatch(/^[0-9a-f]{16}$/);
  });
});

// Software-form packaging pins (2026-11-20, owner's instruction:
// if it is not software, make it software). The desktop build was
// found broken three ways: no package-lock.json anywhere npm ci
// was scripted (desktop/mobile/tauri), build.sh's copy_web
// resolved sources from the caller's cwd, and — the substantive
// one — the Electron extraResources omitted src/crypto and
// src/app, so the packaged app would have booted without its
// runtime-imported modules (PQ, calls, recovery, everything the
// bridges provide). These pins keep the packaging honest.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

describe('desktop packaging carries the whole app', () => {
  const build = JSON.parse(read('desktop/package.json')).build;
  const froms = (build.extraResources || []).map((r) => r.from);

  it('extraResources ships the runtime-imported module trees', () => {
    expect(froms).toContain('../src/crypto');
    expect(froms).toContain('../src/app');
    expect(froms).toContain('../index.html');
    expect(froms).toContain('../locales');
  });

  it('every shell that scripts npm ci has a committed lockfile', () => {
    for (const d of ['desktop', 'mobile', 'tauri']) {
      expect(existsSync(join(root, d, 'package-lock.json')), `${d}/package-lock.json missing`).toBe(true);
    }
  });

  it('every module main.js requires is inside the asar file set', () => {
    // The packaged app crashed on launch with "Cannot find module
    // './nav-guard'": build.files listed bounds-guard.js only.
    const main = read('desktop/main.js');
    const files = JSON.parse(read('desktop/package.json')).build.files;
    const reqs = [...main.matchAll(/require\('\.\/([a-z0-9-]+)'\)/g)].map((m) => `${m[1]}.js`);
    expect(reqs.length).toBeGreaterThan(0);
    for (const r of reqs) expect(files, `build.files missing ${r}`).toContain(r);
  });

  it('the Windows icon carries a 256x256 entry (packaging rejects anything smaller)', () => {
    // icon.ico shipped with only 16x16 and a malformed 192 entry;
    // electron-builder refused the Windows build outright.
    const ico = readFileSync(join(root, 'desktop', 'icon.ico'));
    const count = ico.readUInt16LE(4);
    const sizes = [];
    for (let i = 0; i < count; i++) sizes.push(ico[6 + i * 16] || 256);
    expect(Math.max(...sizes)).toBe(256);
  });

  it('the author carries an email (DEB/RPM metadata refuses the build without one)', () => {
    // The v3.7.0 release run built the AppImages, then died at the DEB
    // target: fpm requires an author/maintainer email. Reproduced from a
    // clean checkout before fixing.
    const pkg = JSON.parse(read('desktop/package.json'));
    expect(typeof pkg.author).toBe('object');
    expect(pkg.author.email).toMatch(/^[^@\s]+@[^@\s]+$/);
  });

  it('builds never publish from inside electron-builder (the workflow attaches assets itself)', () => {
    // The publish block must stay (electron-updater reads its feed from
    // it), but the v3.7.0 macOS job built its DMG and then failed with
    // "GH_TOKEN is not set, and cannot publish": on a tag build,
    // electron-builder tries to publish on its own. build.sh therefore
    // passes -p never on every invocation.
    const buildSh = read('build.sh');
    const invocations = buildSh.split('\n').filter((l) => l.includes('electron-builder'));
    expect(invocations.length).toBeGreaterThan(0);
    for (const line of invocations) expect(line).toContain('-p never');
    expect(build.publish?.provider).toBe('github');
  });

  it('Windows builds skip the sign/edit-executable path (no certificate exists)', () => {
    // The v3.7.0 Windows job crashed inside WinPackager.signApp even
    // though no signing certificate is configured anywhere. Until a
    // certificate exists, the honest configuration is to not enter
    // that path at all.
    expect(build.win.signAndEditExecutable).toBe(false);
  });

  it('build.sh resolves web sources from the repo root, not the cwd', () => {
    const buildSh = read('build.sh');
    expect(buildSh).toContain('cp "$SCRIPT_DIR/$f"');
    expect(buildSh).toContain('"$SCRIPT_DIR/$CRYPTO_DIR"');
    expect(buildSh).toContain('"$SCRIPT_DIR/$APP_DIR"');
  });
});

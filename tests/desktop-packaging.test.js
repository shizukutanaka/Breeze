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
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
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

  it('build.sh resolves web sources from the repo root, not the cwd', () => {
    const buildSh = read('build.sh');
    expect(buildSh).toContain('cp "$SCRIPT_DIR/$f"');
    expect(buildSh).toContain('"$SCRIPT_DIR/$CRYPTO_DIR"');
    expect(buildSh).toContain('"$SCRIPT_DIR/$APP_DIR"');
  });
});

// Bundle-referenced files must exist under src-tauri: a missing icon set
// already killed `cargo tauri build` (fixed on the icons PR), and
// bundle.linux.deb.desktopTemplate pointed at breeze.desktop which also
// did not exist — the .deb bundle failed the same way. Pin every file path
// the conf references plus the runtime-critical invariants.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const DIR = 'tauri/src-tauri';
const conf = JSON.parse(fs.readFileSync(`${DIR}/tauri.conf.json`, 'utf8'));
const bundle = conf.bundle;

describe('bundle-referenced files exist', () => {
  it('linux.deb.desktopTemplate', () => {
    expect(fs.existsSync(path.join(DIR, bundle.linux.deb.desktopTemplate))).toBe(true);
  });

  it('desktop template is a valid Desktop Entry', () => {
    const t = fs.readFileSync(path.join(DIR, bundle.linux.deb.desktopTemplate), 'utf8');
    expect(t).toContain('[Desktop Entry]');
    expect(t).toContain('{{exec}}');
    expect(t).toContain('{{icon}}');
    expect(t).toContain('{{name}}');
  });

  it('macOS entitlements file exists and is plist XML', () => {
    const p = path.join(DIR, bundle.macOS.entitlements);
    expect(fs.existsSync(p)).toBe(true);
    expect(fs.readFileSync(p, 'utf8')).toContain('<plist');
  });

  it('externalBin entries all exist', () => {
    for (const bin of bundle.externalBin || []) {
      expect(fs.existsSync(path.join(DIR, bin)), bin).toBe(true);
    }
  });
});

describe('runtime wiring', () => {
  it('frontendDist resolves to the repo root containing index.html', () => {
    const root = path.resolve(DIR, conf.build.frontendDist);
    expect(fs.existsSync(path.join(root, 'index.html'))).toBe(true);
  });

  it('identifier matches the shared app id', () => {
    expect(conf.identifier).toBe('com.breeze.messenger');
  });
});

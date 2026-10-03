// Pin: index.html loads non-English UI via a relative `locales/${LANG}.json`
// fetch — every packaging path must ship the locales/ directory next to
// index.html, or the packaged app silently degrades to English-only.
// This bug class has hit THREE manifests already (mobile www/ bf771a2,
// build.sh copy_web, and desktop extraResources — this file rides
// both fix branches; each branch pins the surfaces its own fix covers).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const locales = readdirSync(join(root, 'locales')).filter(f => f.endsWith('.json'));
expect(locales.length).toBeGreaterThan(0);

describe('every packaging path ships locales/ next to index.html', () => {
  it('mobile/prepare.js adds locales/*.json to ASSETS (dynamic)', () => {
    const src = readFileSync(join(root, 'mobile/prepare.js'), 'utf8');
    expect(src).toMatch(/ASSETS\.push.*locales/s);
    expect(src).toContain('locales/${f}');
  });

  it('build.sh copy_web copies locales/ into the packaged bundle', () => {
    const src = readFileSync(join(root, 'build.sh'), 'utf8');
    expect(src).toContain('locales/');
    expect(src).toMatch(/cp\s+locales\/\*\.json/);
  });

  it('tauri frontendDist covers the repo root (locales/ ships with it)', () => {
    const conf = JSON.parse(readFileSync(join(root, 'tauri/src-tauri/tauri.conf.json'), 'utf8'));
    expect(conf.build?.frontendDist).toBe('../../');
  });
});

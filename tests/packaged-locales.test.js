// Pin: index.html loads non-English UI via a relative `locales/${LANG}.json`
// fetch — every packaging path must ship the locales/ directory next to
// index.html, or the packaged app silently degrades to English-only.
// This bug class has hit THREE manifests already (mobile www/ bf771a2,
// build.sh copy_web — the build.sh assertion lives on its fix branch,
// and desktop extraResources — fixed alongside this test).
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

  it('desktop/package.json extraResources includes ../locales → locales', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'desktop/package.json'), 'utf8'));
    const res = pkg.build?.extraResources || [];
    expect(
      res.some(r => r.from === '../locales' && r.to === 'locales'),
      'extraResources lacks a ../locales → locales entry'
    ).toBe(true);
  });

  it('tauri frontendDist covers the repo root (locales/ ships with it)', () => {
    const conf = JSON.parse(readFileSync(join(root, 'tauri/src-tauri/tauri.conf.json'), 'utf8'));
    expect(conf.build?.frontendDist).toBe('../../');
  });
});

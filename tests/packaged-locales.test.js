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
    // Sources resolve against $SCRIPT_DIR since 2026-11-20 (the
    // cwd-relative form broke every packaged build); the pin is
    // on the copy itself, not the prefix spelling.
    expect(src).toMatch(/cp\s+"\$SCRIPT_DIR\/locales"\/\*\.json\s+"\$dst\/locales\/"/);
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

// D11: key completeness is pinned, not aspirational. Until wave 4, every
// non-ja locale silently fell back to English for 179 of 859 keys — including
// the key-transparency verdicts (ktChecking/ktOk/ktRolled/ktTampered), so a
// Spanish or Korean user saw the security-critical strings in English. Every
// locale file must now carry EXACTLY the English key set: a missing key
// (silent English fallback) or an extra key (dead translation) fails here.
// Placeholder sets and plural shapes follow the tools/i18n-check.mjs rules.
describe('every locale file is key-complete against the inline English reference (D11)', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const start = html.indexOf('const _I = {');
  let depth = 0, raw = '';
  for (let i = html.indexOf('{', start); i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { raw = html.slice(html.indexOf('{', start), i + 1); break; } }
  }
  const EN = (0, eval)('(' + raw + ')').en;
  const enKeys = Object.keys(EN).sort();
  const placeholders = (s) => [...new Set((String(s).match(/\{(\d+)\}/g) || []))].sort().join(',');
  const categoriesFor = (loc) => new Set([0, 1, 2, 3, 5, 11, 21, 101, 1.5].map((n) => new Intl.PluralRules(loc).select(n)));

  for (const file of locales) {
    const loc = file.replace(/\.json$/, '');
    it(`${loc}: exactly the English key set, placeholders and plural shapes intact`, () => {
      const T = JSON.parse(readFileSync(join(root, 'locales', file), 'utf8'));
      expect(Object.keys(T).sort(), `${loc} key set differs from English`).toEqual(enKeys);
      const cats = categoriesFor(loc);
      for (const [key, v] of Object.entries(T)) {
        const rv = EN[key];
        const rPlural = rv && typeof rv === 'object';
        const vPlural = v && typeof v === 'object';
        expect(vPlural, `${loc}.${key} plural shape`).toBe(rPlural);
        if (vPlural) {
          expect(Object.keys(v).sort(), `${loc}.${key} plural categories`).toEqual([...cats].sort());
          expect(placeholders(Object.values(v).join('')), `${loc}.${key} placeholders`).toBe(placeholders(Object.values(rv).join('')));
        } else {
          expect(typeof v, `${loc}.${key} is a string`).toBe('string');
          expect(placeholders(v), `${loc}.${key} placeholders`).toBe(placeholders(rv));
        }
      }
    });
  }
});

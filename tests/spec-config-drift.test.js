// SPEC.md §4.2 quotes CONFIG values by hand. It was "re-verified" on 2026-11-21 and
// two days later five of its pairs were wrong again (VERSION one release behind,
// DISAPPEAR_CHECK_MS 30000 vs 10000, POW_DIFFICULTY 16 vs 20, and two constants that
// no longer exist). Pinning individual strings (wave 6, R09) only protects the strings
// someone thought to pin, so this reads EVERY pair in the excerpt and compares it to
// the CONFIG object index.html actually ships.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const html = read('index.html');
const spec = read('SPEC.md');

const start = html.indexOf('const CONFIG = {');
const end = html.indexOf('\n};', start);
// CONFIG is a plain literal (numbers, strings, booleans, arithmetic) — evaluate it as shipped.
// eslint-disable-next-line no-new-func
const CONFIG = new Function('return ' + html.slice(start + 'const CONFIG = '.length, end + 2))();

const section = spec.slice(spec.indexOf('### 4.2 CONFIG Constants'));
const excerpt = section.match(/```javascript\n([\s\S]*?)```/)[1];
const pairs = [...excerpt.matchAll(/([A-Z][A-Z0-9_]+): ('[^']*'|\d+)/g)]
  .map((m) => [m[1], m[2].startsWith("'") ? m[2].slice(1, -1) : Number(m[2])]);

describe('SPEC.md §4.2 CONFIG excerpt matches the shipped CONFIG', () => {
  it('parses the shipped CONFIG and a non-trivial excerpt', () => {
    expect(CONFIG.VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pairs.length).toBeGreaterThanOrEqual(30);
  });

  it.each(pairs)('%s: %s', (key, value) => {
    expect(Object.prototype.hasOwnProperty.call(CONFIG, key), `${key} is not a CONFIG constant`).toBe(true);
    expect(CONFIG[key]).toBe(value);
  });

  it('the bump tool rewrites the SPEC version with every other site', () => {
    expect(read('tools/bump-version.mjs')).toContain("file: 'SPEC.md'");
  });
});

describe('SPEC.md prose figures', () => {
  it('states the prekey batch size the client actually uploads', () => {
    expect(spec).toContain(`\`PREKEY_OTP_COUNT\` (${CONFIG.PREKEY_OTP_COUNT})`);
    expect(spec).not.toContain('10 keys generated');
  });

  it('lists exactly the locale files that ship', () => {
    const shipped = readdirSync(new URL('../locales/', import.meta.url))
      .filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')).sort();
    const line = spec.match(/\*\*Locale files\*\*: .*? for ([^,]+(?:, [^,]+)*?), fetched/)[1];
    expect(line.split(', ').sort()).toEqual(shipped);
    expect(spec).not.toContain('372 keys');
  });
});

// §1.2 sizes were 712 KB / 160 KB for files that are 872 KB / 296 KB. A hand-written
// size cannot be exact, but it must stay within a quarter of the real file.
describe('SPEC.md §1.2 file sizes', () => {
  it.each(['index.html', '_worker.js', 'sw.js', 'manifest.json'])('%s', (file) => {
    const m = spec.match(new RegExp('\\| ' + file.replace('.', '\\.') + ' \\| (\\d+) KB \\|'));
    expect(m, `${file} row missing`).not.toBeNull();
    const actualKB = statSync(new URL('../' + file, import.meta.url)).size / 1024;
    expect(Math.abs(Number(m[1]) - actualKB) / actualKB).toBeLessThan(0.25);
  });
});

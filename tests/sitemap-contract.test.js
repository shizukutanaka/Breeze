// Sitemap contract pins — the file listed RELATIVE <loc> values (crawlers
// reject the whole sitemap) and kept advertising /?pricing long after the
// pricing view was deleted. Pins both invariants.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sitemap = readFileSync(join(root, 'sitemap.xml'), 'utf8');
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');

const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

describe('sitemap.xml', () => {
  it('every <loc> is a fully-qualified absolute URL — relative locs are spec-invalid and get the file ignored', () => {
    expect(locs.length).toBeGreaterThan(0);
    for (const loc of locs) {
      expect(loc, `${loc} is not absolute`).toMatch(/^https:\/\//);
    }
  });

  it('every ?param entry is a view index.html actually handles (dead views mislead crawlers)', () => {
    for (const loc of locs) {
      for (const key of new URL(loc).searchParams.keys()) {
        expect(
          indexHtml.includes(`P.has('${key}')`) || indexHtml.includes(`P.get('${key}')`),
          `sitemap loc ${loc} -> ?${key} has no handler in index.html`,
        ).toBe(true);
      }
    }
  });
});

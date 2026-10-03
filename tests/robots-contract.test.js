// robots.txt contract pins — its Sitemap directive was relative and is
// ignored by crawlers per spec.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const robots = readFileSync(join(root, 'robots.txt'), 'utf8');

describe('robots.txt', () => {
  it('Sitemap directive is a fully-qualified URL — a relative value is ignored by crawlers', () => {
    const m = robots.match(/^Sitemap:\s*(\S+)/m);
    expect(m, 'no Sitemap directive').not.toBeNull();
    expect(m[1]).toMatch(/^https:\/\//);
  });

  it('keeps /api/ out of the index — API paths are not crawlable content', () => {
    expect(robots).toMatch(/^Disallow:\s*\/api\//m);
  });
});

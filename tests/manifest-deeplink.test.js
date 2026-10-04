// Deep-link contract: every URL the manifest advertises (shortcut items,
// share_target.action, protocol_handlers.url, start_url) becomes an in-app
// ?param the client must handle — an advertised param with no P.has/P.get
// handler is a deep link that lands on the bare shell. The class already
// bit once: /?pricing stayed in sitemap.xml + FUNDING.yml long after its
// view was deleted.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');

// Collect every manifest URL that carries a query string.
const urls = [];
(function walk(o) {
  if (Array.isArray(o)) return o.forEach(walk);
  if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) {
      if ((k === 'url' || k === 'action') && typeof v === 'string' && v.includes('?')) urls.push(v);
      else walk(v);
    }
  }
})(manifest);

describe('manifest.json advertised deep links', () => {
  it('finds at least one param-ful URL (sanity: the walker works)', () => {
    expect(urls.length).toBeGreaterThan(0);
  });

  it('every advertised ?param has a handler (P.has/P.get) in index.html', () => {
    for (const raw of urls) {
      // %s placeholders are OS-side substitutions (e.g. /?join=%s) — the key is what matters.
      const url = new URL(raw.replace(/%s/g, 'x'), 'https://breeze.pages.dev');
      for (const key of url.searchParams.keys()) {
        expect(
          indexHtml.includes(`P.has('${key}')`) || indexHtml.includes(`P.get('${key}')`),
          `manifest url ${raw} → ?${key} has no handler in index.html`,
        ).toBe(true);
      }
    }
  });
});

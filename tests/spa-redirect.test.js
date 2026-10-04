// 404 contract pins. The production CSP pins script-src to index.html's two
// hashes with NO 'unsafe-inline' — an inline <script> in ANY other deployed
// HTML file is dead code that never executes. The SPA redirect lived exactly
// there: deep links like /foo?join=TOKEN hit a static 404 page and stopped.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, '404.html'), 'utf8');

describe('404 redirect contract', () => {
  it('has NO inline <script> — the pinned production CSP (no unsafe-inline) blocks it outright', () => {
    const inline = html.match(/<script>(?![^>]*src)[\s\S]*?<\/script>/g) || [];
    expect(inline, 'inline script in 404.html can never run under the pinned CSP').toEqual([]);
  });

  it('references its redirect script via a same-origin src', () => {
    expect(html).toMatch(/<script[^>]+src=["']\/404\.js["']/);
  });

  it('404.js redirects non-API paths to the root, preserving search+hash (deep-link recovery)', () => {
    const js = readFileSync(join(root, '404.js'), 'utf8');
    expect(js).toContain('location.replace');
    expect(js).toContain('location.search');
    expect(js).toContain('location.hash');
    expect(js).toContain("'/api/'"); // API paths must NOT be redirected
  });

  it('no other deployed root *.html file carries an inline script either', () => {
    for (const f of readdirSync(root).filter(f => f.endsWith('.html') && f !== 'index.html')) {
      const h = readFileSync(join(root, f), 'utf8');
      const inline = h.match(/<script>(?![^>]*src)[\s\S]*?<\/script>/g) || [];
      expect(inline, `${f} has an inline script that the pinned CSP will block`).toEqual([]);
    }
  });
});

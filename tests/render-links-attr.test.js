// renderLinks() attribute-context fix: the URL regex (https?://[^\s<]+) legally
// matches " and ' — esc() runs BEFORE renderLinks but doesn't touch quotes, so a
// received URL like https://a/"style="x reached `href="${url}"` unescaped and
// broke out of the attribute — on* handlers are TT-stripped, but the whitelisted
// style attribute still allowed UI-redress injection. The href now strips quotes.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname;
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');

// Extract the real renderLinks (single-responsibility fn: ends before fmtSize).
function loadRenderLinks() {
  const start = html.indexOf('function renderLinks(text)');
  const end = html.indexOf('function fmtSize', start);
  if (start < 0 || end < 0) throw new Error('renderLinks not found');
  return new Function('return ' + html.slice(start, end).trim())();
}

describe('renderLinks URL branch', () => {
  const renderLinks = loadRenderLinks();

  it('wire-site: href interpolates the quote-stripped url', () => {
    expect(html).toContain('href="${url.replace(/["\']/g, \'\')}"');
  });

  it('a " inside a matched URL cannot break out of href', () => {
    const out = renderLinks('https://a/"style="position:fixed');
    expect(out).toContain('href="https://a/style=position:fixed"');
    expect(out).not.toContain('href="https://a/"');
  });

  it("a ' inside a matched URL is stripped from href too", () => {
    const out = renderLinks("https://a/'onmouseover='x");
    expect(out).toContain('href="https://a/onmouseover=x"');
  });

  it('clean URLs keep href and visible text identical', () => {
    const out = renderLinks('see https://example.com/path?q=1&z=2 now');
    expect(out).toContain('href="https://example.com/path?q=1&z=2"');
    expect(out).toContain('>https://example.com/path?q=1&z=2</a>');
  });

  it('javascript:/data: schemes still cannot link (regex unchanged)', () => {
    const out = renderLinks('javascript:alert(1) data:text/html,<b>');
    expect(out).not.toContain('<a href');
  });

  it('mailto/tel/mention branches still work', () => {
    const out = renderLinks('mail a@b.co call +81 90 1234 5678 hi @alice');
    expect(out).toContain('href="mailto:a@b.co"');
    expect(out).toContain('href="tel:+81');
    expect(out).toContain('<span class="md-mention">@alice</span>');
  });
});

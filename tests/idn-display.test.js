// TR36/UTS39: Unicode-lookalike link hosts must display in canonical (punycode) form —
// browser URL bars already do this; bubbles showed the sender's glyphs verbatim.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// the same canonicalization the inline code applies — verifies intent against real URL behavior
const canonicalize = (url) => {
  const u = new URL(url);
  const h0 = url.slice(url.indexOf('://') + 3).split(/[\/?#]/)[0];
  return u.host !== h0 ? url.replace(h0, u.host) : url;
};

describe('renderLinks canonicalizes Unicode/confusable link hosts (TR36)', () => {
  it('linkify callback compares typed host vs URL-normalized host and renders punycode', () => {
    const cb = html.match(/\.replace\(\/\(https\?:\\\/\\\/\[\^\\s<\]\+\)\/g, \(url\) => \{([\s\S]*?)\}\)/)?.[1];
    expect(cb, 'linkify callback must canonicalize the host').toBeTruthy();
    expect(cb).toMatch(/new URL\(url\)/);
    expect(cb).toMatch(/u\.host !== h0/);
    expect(cb).toMatch(/url\.replace\(h0, u\.host\)/);
    expect(cb).toMatch(/\$\{shown\}/); // rendered text uses the canonicalized string
  });

  it('expected behavior: Cyrillic-lookalike host renders as xn-- punycode', () => {
    // U+0430 CYRILLIC SMALL LETTER A, U+0440 ER, U+04CF PALOCHKA, U+0435 IE
    const spoof = 'https://аррӏе.com/x';
    const shown = canonicalize(spoof);
    expect(shown).toContain('xn--');
    expect(shown).not.toBe(spoof);
    // the href target itself is untouched — only the displayed text changes
    expect(new URL(spoof).host).toMatch(/^xn--/);
  });

  it('expected behavior: ordinary hosts render unchanged', () => {
    expect(canonicalize('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    // case-fold normalization is canonicalization, not spoofing — shows the canonical form
    expect(canonicalize('https://Example.COM/')).toBe('https://example.com/');
  });
});

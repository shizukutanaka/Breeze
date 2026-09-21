// renderLinks is a pure string→string function inside index.html — no DOM needed, so it
// is extracted verbatim (the mirror-drift.test.js pattern: readFileSync + new Function)
// and exercised directly. Regression coverage for the nested-anchor bug: URLs were
// anchorified first, then the email/phone regexes RE-MATCHED inside the generated
// <a href="…"> markup — https://x/?u=a@b.com produced <a> inside <a> and mangled output.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');

const START = 'function renderLinks(text) {';
const END = '\n  function fmtSize(';
const s = html.indexOf(START);
const e = html.indexOf(END, s);
if (s < 0 || e < 0) {
  throw new Error('renderLinks test: could not locate the function in index.html — update the extraction markers if it moved.');
}
const renderLinks = new Function(`${html.slice(s, e)}; return renderLinks;`)();

const count = (str, re) => (str.match(re) || []).length;

describe('renderLinks — placeholder-protected URL pass', () => {
  it('does not nest anchors when a URL contains an @ (the a@b.com-in-query case)', () => {
    const out = renderLinks('see https://x.co/?u=a@b.com ok');
    expect(count(out, /<a /g)).toBe(1);
    expect(out).toContain('href="https://x.co/?u=a@b.com"');
    expect(out).not.toContain('mailto:');
  });

  it('does not let the phone pass match digits inside a URL', () => {
    const out = renderLinks('call https://x.co/p=+1234567890 ok');
    expect(out).not.toContain('tel:');
  });

  it('does not mention-highlight a path segment like /@handle inside a URL', () => {
    const out = renderLinks('https://x.co/@alice');
    expect(out).not.toContain('md-mention');
  });

  it('still linkifies a bare email and a bare phone', () => {
    const out = renderLinks('mail a@b.co or +81 90 1234 5678');
    expect(out).toContain('href="mailto:a@b.co"');
    expect(out).toContain('href="tel:+81 90 1234 5678"');
  });

  it('linkifies URL + email in the same message independently', () => {
    const out = renderLinks('https://a.co and b@c.de');
    expect(out).toContain('href="https://a.co"');
    expect(out).toContain('href="mailto:b@c.de"');
    expect(count(out, /<a /g)).toBe(2);
  });

  it('still mention-highlights a real @name outside any URL', () => {
    const out = renderLinks('hey @alice');
    expect(out).toContain('<span class="md-mention">@alice</span>');
  });

  it('a peer typing the PUA placeholder literally gets it back, not "undefined"', () => {
    const out = renderLinks('what is \uE0007\uE001 ?');
    expect(out).toContain('\uE0007\uE001');
    expect(out).not.toContain('undefined');
  });
});

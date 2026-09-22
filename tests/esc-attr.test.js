// esc() is used in BOTH text and quoted-attribute contexts — textContent→innerHTML only
// escapes <, >, &, so a " or ' in a peer-supplied value could break out of attr="...".
// Peer-controlled values reach those sites: f.name (download=/alt=), m.name (data-name=),
// plus local prompts (value=). OWASP: escape for the context — attribute values need
// quote escaping.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Minimal document stub to evaluate the real esc() — the stub mimics textContent→innerHTML
// escaping (<, >, &) which is exactly why the quotes had to be added by hand in esc().
const documentStub = { createElement: () => { let t; return { set textContent(v) { t = v; }, get innerHTML() { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); } }; } };
const escSrc = html.match(/function esc\(s\) \{[^}]+\}/)?.[0];
const esc = new Function('document', '_BIDI_CTL_RE', `${escSrc}; return esc;`)(
  documentStub, /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu);

describe('esc() covers quoted-attribute contexts (OWASP context-aware escaping)', () => {
  it('escapes double and single quotes', () => {
    expect(esc('a"b')).toBe('a&quot;b');
    expect(esc("a'b")).toBe('a&#39;b');
  });

  it('still escapes <, >, & as before', () => {
    expect(esc('<a href="x">')).toBe('&lt;a href=&quot;x&quot;&gt;');
    expect(esc('a & b')).toBe('a &amp; b');
  });

  it('attribute-injection payloads cannot break out', () => {
    for (const v of ['x" onmouseover="alert(1)', "x' style='position:fixed", '" ><script>alert(1)</script>']) {
      const out = esc(v);
      expect(out).not.toContain('"');  // no raw quote to close the attribute
      expect(out).not.toContain("'");  // or reopen a quoted payload
    }
  });

  it('keeps the bidi-direction-control strip (esc is the render funnel)', () => {
    expect(esc('ab\u202Ecd\u2069e')).toBe('abcde');
  });

  it('source pins: esc() itself performs the quote escaping', () => {
    expect(escSrc).toBeTruthy();
    expect(escSrc).toMatch(/replace\(\/[^/]*"[^/]*\/g,'&quot;'\)/);
    expect(escSrc).toMatch(/replace\(\/[^/]*'[^/]*\/g,'&#39;'\)/);
    // attr-interpolated esc() call sites exist and are all covered by this single fix
    expect(html.match(/="\$\{esc\(/g)?.length || 0).toBeGreaterThan(4);
  });
});

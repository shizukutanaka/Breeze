// Peer-controlled strings reach innerHTML through esc(). esc() used to be
// `div.textContent = s; return div.innerHTML`, which escapes & < > but NOT quotes —
// yet its output is interpolated into attribute values in ~30 templates:
//   renderLinks:  <a href="${url}">        (url = esc()'d message text, regex [^\s<]+)
//   file bubble:  alt="${esc(f.name)}" download="${esc(f.name)}"
//   mentions:     data-name="${esc(m.name)}"
// A `"` closed the attribute and the rest became new attributes. The sanitizer keeps
// style / class / id / data-*, so one text message could put a full-screen overlay on
// its link or fetch a remote URL (style background:url(...)) — an IP / read-time leak
// that bypasses relay-only calls and delayed read receipts.
// These tests run the SHIPPED functions, sliced out of index.html.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function sliceFn(startMarker, endMarker) {
  const a = html.indexOf(startMarker);
  const b = html.indexOf(endMarker, a);
  expect(a, startMarker).toBeGreaterThan(-1);
  expect(b, endMarker).toBeGreaterThan(a);
  return html.slice(a, b);
}

const escSrc = html.match(/^function esc\(s\) \{.*$/m)[0];
const mdSrc = sliceFn('  function renderMarkdown(text) {', '  function fmtSize(bytes) {');
// eslint-disable-next-line no-new-func
const { esc, render } = new Function(`${escSrc}\n${mdSrc}\nreturn { esc, render: (t) => renderLinks(renderMarkdown(esc(t))) };`)();

// Minimal attribute reader: the attributes of the FIRST tag in `out`, parsed the way
// an HTML tokenizer would (double-quoted values only — that is all the templates emit).
function firstTagAttrs(out) {
  const tag = out.match(/<[a-z]+((?:\s+[^\s"=>]+(?:="[^"]*")?)*)\s*>/i);
  expect(tag, out).not.toBeNull();
  return [...tag[1].matchAll(/([^\s"=>]+)(?:="([^"]*)")?/g)].map((m) => m[1]);
}

describe('esc() is safe in attribute context', () => {
  it('escapes both quote characters as well as & < >', () => {
    const out = esc(`a"b'c<d>e&f`);
    expect(out).not.toMatch(/["'<>]/);
    expect(out).toBe('a&#34;b&#39;c&#60;d&#62;e&#38;f');
  });

  it('keeps the old null/undefined/number behaviour', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
    expect(esc(42)).toBe('42');
    expect(esc('plain text')).toBe('plain text');
  });

  it('needs no DOM (it runs once per rendered string)', () => {
    expect(escSrc).not.toContain('createElement');
  });
});

describe('a received message cannot add attributes to its own link', () => {
  const attack = 'https://example.com/"style="position:fixed;inset:0;background:url(https://evil.example/p)"id="x"data-action="y';

  it('the rendered link carries only the attributes the template wrote', () => {
    expect(firstTagAttrs(render(attack))).toEqual(['href', 'target', 'rel', 'class']);
  });

  it('single quotes are neutralised too', () => {
    expect(firstTagAttrs(render("https://example.com/'onfocus='x"))).toEqual(['href', 'target', 'rel', 'class']);
  });

  it('an ordinary link still renders as one', () => {
    const out = render('see https://example.com/a?b=1&c=2 ok');
    expect(out).toContain('<a href="https://example.com/a?b=1&#38;c=2" target="_blank" rel="noopener noreferrer" class="md-link">');
  });
});

describe('file bubble: a peer-supplied blobUrl must be a real blob: URL', () => {
  // The 1:1 path stores the peer's decrypted file JSON verbatim; appendMsg used to copy
  // f.blobUrl straight into src="…" / href="…", so `x"><img src="https://…">` injected markup.
  const cond = html.match(/\} else if \(typeof f\.blobUrl === 'string' && (\/\^blob:.*?\/)\.test\(f\.blobUrl\)\) \{/);

  it('the guard is in place on the only branch that reads f.blobUrl', () => {
    expect(cond).not.toBeNull();
    expect(html.match(/f\.blobUrl/g)).toHaveLength(3); // typeof, test, and the one use inside the guarded branch
    expect(html).not.toContain('} else if (f.blobUrl) {');
  });

  it('accepts browser blob URLs and rejects anything that could leave the attribute', () => {
    // eslint-disable-next-line no-new-func
    const re = new Function('return ' + cond[1])();
    expect(re.test('blob:https://breeze.pages.dev/3f6c1c0e-8a7b-4a53-9d0e-1b2c3d4e5f60')).toBe(true);
    expect(re.test('blob:null/3f6c1c0e-8a7b-4a53-9d0e-1b2c3d4e5f60')).toBe(true);
    for (const bad of [
      'https://evil.example/pixel.gif',
      'x"><img src="https://evil.example/p">',
      'blob:x" style="position:fixed',
      "blob:x' onerror='y",
      'blob:x><b>',
      'blob:x y',
      '',
    ]) expect(re.test(bad), bad).toBe(false);
  });
});

describe('search highlight never lands inside an escaped entity', () => {
  // Both highlighters run a regex over esc()'d text. Without the entity alternative a
  // query like "3" matched inside "&#34;" and the quote rendered as broken markup
  // (the same happened before for "a" inside "&amp;").
  const expr = html.match(/safeSetHTML\(d, (esc\(m\.text\.slice\(0, 120\)\)\.replace\(.*?\)) \+ '<span class="ts">' \+ time/)[1];
  // eslint-disable-next-line no-new-func
  const highlight = new Function('esc', 'm', 'query', 'return ' + expr).bind(null, esc);

  it('a digit query does not break an escaped quote or ampersand', () => {
    const out = highlight({ text: 'say "34" & go' }, '3');
    expect(out).toBe('say &#34;<mark class="i-highlight">3</mark>4&#34; &#38; go');
  });

  it('a query for the special character itself is still highlighted', () => {
    expect(highlight({ text: 'a & b' }, '&')).toBe('a <mark class="i-highlight">&#38;</mark> b');
    expect(highlight({ text: 'Hello World' }, 'world')).toBe('Hello <mark class="i-highlight">World</mark>');
  });

  it('the in-conversation highlighter uses the same entity-skipping pattern', () => {
    expect(html).toContain("(m, hit) => hit ? '<mark class=\"search-match\">' + hit + '</mark>' : m));");
  });
});

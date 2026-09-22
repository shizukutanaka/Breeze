// TT-sanitizer vs renderLinks consistency: renderLinks emits tel: hrefs for phone
// numbers, but the _ttPolicy href allowlist only permitted https:/mailto:/#/path —
// so safeSetHTML silently stripped the href and every auto-linked phone number
// rendered as a dead anchor. The allowlist now includes tel: (RFC 3966). These
// tests exercise the REAL shipped regex extracted from index.html plus wire-site
// guards on both sides of the contract.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname;
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');

// Extract the real href allowlist regex from the sanitizer and eval it.
function loadHrefAllowRe() {
  const m = html.match(/if \(!(\/\^\([^)]+\)\/i)\.test\(href\)\) el\.removeAttribute\('href'\)/);
  if (!m) throw new Error('href allowlist regex not found');
  return new Function('return ' + m[1])();
}

function loadRenderLinks() {
  const start = html.indexOf('function renderLinks(text)');
  const end = html.indexOf('function fmtSize', start);
  if (start < 0 || end < 0) throw new Error('renderLinks not found');
  return new Function('return ' + html.slice(start, end).trim())();
}

describe('TT href allowlist', () => {
  const allow = loadHrefAllowRe();

  it('permits tel: (RFC 3966) — the scheme renderLinks emits for phone numbers', () => {
    expect(allow.test('tel:+819012345678')).toBe(true);
    expect(allow.test('TEL:+81')).toBe(true); // case-insensitive
  });

  it('still permits https:/mailto:/#/path', () => {
    for (const ok of ['https://a.b', 'http://a.b', 'mailto:a@b.co', '#frag', '/foo?x=1']) {
      expect(allow.test(ok), ok).toBe(true);
    }
  });

  it('still refuses javascript:/data:/vbscript:/protocol-relative/relative', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'vbscript:x', '//evil.com', 'foo.html', 'file:///etc/passwd', 'sms:+81']) {
      expect(allow.test(bad), bad).toBe(false);
    }
  });

  it('wire-site: the sanitizer regex contains tel:', () => {
    expect(html).toContain('/^(https?:|mailto:|tel:|#|\\/[^\\/])/i.test(href)');
  });
});

describe('renderLinks ↔ sanitizer contract', () => {
  it('every href scheme renderLinks can emit is allowlisted', () => {
    const renderLinks = loadRenderLinks();
    const allow = loadHrefAllowRe();
    const out = renderLinks('x https://a.b mail a@b.co call +81 90 1234 5678');
    for (const m of out.matchAll(/href="([^"]+)"/g)) {
      const href = m[1].replace(/&amp;/g, '&');
      expect(allow.test(href), href).toBe(true);
    }
  });
});

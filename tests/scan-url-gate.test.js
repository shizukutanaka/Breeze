import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// QR-scan URL gate: scanned text becomes location.href only when _isTrustedScanUrl
// accepts it. index.html has no jsdom here, so the real helper is extracted from
// source and evaluated the same way the page would run it.
const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

const fnSrc = html.match(/function _isTrustedScanUrl\(v\) \{[^\n]+\}/)?.[0];
const gate = new Function('SHARE_BASE', 'URL', `${fnSrc}; return _isTrustedScanUrl;`)(
  'https://breeze.pages.dev/', URL);

describe('scan-url gate — _isTrustedScanUrl', () => {
  it('accepts a real https invite URL on this origin', () => {
    expect(gate('https://breeze.pages.dev/?add=ABC123')).toBe(true);
    expect(gate('https://breeze.pages.dev/index.html?add=ABC&name=Bob')).toBe(true);
  });
  it('rejects javascript: and data: schemes (the breakout payloads)', () => {
    expect(gate("javascript:alert('x?add=')")).toBe(false);
    expect(gate('data:text/html,<script>alert(1)</script>?add=x')).toBe(false);
    expect(gate('vbscript:msgbox("?add=")')).toBe(false);
  });
  it('rejects foreign hosts carrying a look-alike invite param', () => {
    expect(gate('https://evil.example/?add=x')).toBe(false);
    expect(gate('https://breeze.pages.dev.evil.example/?add=x')).toBe(false);
  });
  it('rejects same-origin URLs without the add param', () => {
    expect(gate('https://breeze.pages.dev/')).toBe(false);
    expect(gate('https://breeze.pages.dev/?join=abc')).toBe(false);
    expect(gate('not a url ?add= at all')).toBe(false);
  });
  it('rejects http: even on the right host (no downgrade)', () => {
    expect(gate('http://breeze.pages.dev/?add=ABC')).toBe(false);
  });
});

describe('scan-url gate — wiring pins', () => {
  it('the QR handler navigates ONLY through the gate', () => {
    const qrBlock = html.match(/const value = await qrScanOnce\(closeBtn, scanBtn\)[\s\S]{0,400}/)?.[0];
    expect(qrBlock).toContain('_isTrustedScanUrl(value)');
    expect(qrBlock).not.toMatch(/includes\('\?add='\)/);
    // No second raw-navigation path inside the same handler block
    expect((qrBlock.match(/location\.href/g) || []).length).toBe(1);
  });
  it('helper sits before SHARE_BASE consumers and is defined once', () => {
    expect(html.indexOf('function _isTrustedScanUrl')).toBeGreaterThan(html.indexOf('const SHARE_BASE'));
    expect((html.match(/_isTrustedScanUrl/g) || []).length).toBe(2);
  });
});

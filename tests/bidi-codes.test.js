import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const offlinePairing = readFileSync(new URL('../src/app/offline-pairing.js', import.meta.url), 'utf8');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cssRule(selector) {
  const match = html.match(new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`));
  expect(match, `${selector} rule exists`).toBeTruthy();
  return match[1];
}

function expectLtrIsolated(selector) {
  const rule = cssRule(selector);
  expect(rule).toMatch(/direction\s*:\s*ltr\b/);
  expect(rule).toMatch(/unicode-bidi\s*:\s*isolate\b/);
}

describe('bidi isolation for code-like displays', () => {
  it.each(['.i-safety-num', '.i-mono-box', '.qr-url', '.sidebar-id'])('%s is rendered left-to-right as an isolated bidi run', (selector) => {
    expectLtrIsolated(selector);
  });

  it('forces the recovery phrase textarea left-to-right', () => {
    const match = html.match(/<textarea\b[^>]*\brp-phrase\b[^>]*>/);
    expect(match, 'recovery phrase textarea exists').toBeTruthy();
    expect(match[0]).toContain('dir="ltr"');
  });

  it('forces offline pairing invite textareas left-to-right where they are created', () => {
    const start = offlinePairing.indexOf("const area = document.createElement('textarea')");
    expect(start, 'offline pairing textarea creation exists').toBeGreaterThanOrEqual(0);
    const creation = offlinePairing.slice(start, start + 400);
    expect(creation).toMatch(/area\.dir\s*=\s*['"]ltr['"]/);
  });

  it.each(['pre.md-pre', 'code.md-code'])('%s keeps user message content direction unchanged', (selector) => {
    expect(cssRule(selector)).not.toMatch(/direction\s*:\s*ltr\b/);
  });
});

// Electron's desktop app used to enforce its own hand-written CSP that allowed
// 'unsafe-inline' script execution and omitted `trusted-types` /
// `require-trusted-types-for 'script'` entirely — SECURITY.md documents hash-pinned
// script-src and Trusted Types enforcement as Breeze's CSP, but that was only true for
// the web build. desktop/csp-guard.js reads the SAME Content-Security-Policy line from
// _headers (the file tools/csp-hash.mjs --write maintains) instead, so the two can never
// drift apart. main.js requires('electron') as its first line, which throws outside a
// real Electron process, so this lives in its own dependency-free module for coverage.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractCSP, readWebCSP, FALLBACK_CSP } from '../desktop/csp-guard.js';

describe('extractCSP', () => {
  it('extracts the CSP value from a real _headers-shaped file', () => {
    const text = [
      '/*',
      '  X-Content-Type-Options: nosniff',
      "  Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-ABC='",
      '  X-Frame-Options: DENY',
      '',
    ].join('\n');
    expect(extractCSP(text)).toBe("default-src 'self'; script-src 'self' 'sha256-ABC='");
  });

  it('returns null when there is no Content-Security-Policy line', () => {
    expect(extractCSP('/*\n  X-Frame-Options: DENY\n')).toBeNull();
  });

  it('is not fooled by leading/trailing whitespace around the value', () => {
    expect(extractCSP('  Content-Security-Policy:    default-src \'self\'   \n')).toBe("default-src 'self'");
  });
});

describe('readWebCSP', () => {
  // Each test creates and cleans up its own temp dir, rather than sharing fixture
  // state across tests via a hook.
  const withTempDir = (fn) => {
    const dir = mkdtempSync(join(tmpdir(), 'breeze-csp-test-'));
    try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
  };

  it('reads the real deployed _headers CSP when the file is present and well-formed', () => {
    withTempDir((dir) => {
      writeFileSync(join(dir, '_headers'), "/*\n  Content-Security-Policy: default-src 'self'; object-src 'none'\n");
      expect(readWebCSP(dir)).toBe("default-src 'self'; object-src 'none'");
    });
  });

  it('falls back to the permissive default when _headers does not exist', () => {
    withTempDir((dir) => { expect(readWebCSP(dir)).toBe(FALLBACK_CSP); });
  });

  it('falls back to the permissive default when _headers exists but has no CSP line', () => {
    withTempDir((dir) => {
      writeFileSync(join(dir, '_headers'), '/*\n  X-Frame-Options: DENY\n');
      expect(readWebCSP(dir)).toBe(FALLBACK_CSP);
    });
  });

  it('the fallback is fail-CLOSED — no scripts, no unsafe-inline', () => {
    // Only reachable on a packaging bug (_headers ships in extraResources), and a
    // permissive fallback there would silently re-open the exact XSS-to-key-
    // exfiltration hole hash-pinning exists to close. Broken-loud beats unsafe-quiet.
    expect(FALLBACK_CSP).not.toContain('unsafe-inline');
    expect(FALLBACK_CSP).toBe("default-src 'none'"); // blocks scripts, styles, everything
  });

  it('matches the real repo _headers file end to end (regression against real content)', () => {
    // Reads the actual, checked-in _headers this project ships — proves the parser
    // agrees with reality, not just a hand-crafted fixture.
    const repoRoot = join(import.meta.dirname, '..');
    const csp = readWebCSP(repoRoot);
    expect(csp).not.toBe(FALLBACK_CSP);
    expect(csp).toContain("trusted-types breeze-sanitizer default");
    // script-src is hash-pinned with no 'unsafe-inline', even though style-src does
    // carry 'unsafe-inline' (styles are not hash-pinned) — check the script-src
    // DIRECTIVE specifically, not the string as a whole.
    const scriptSrc = csp.match(/script-src[^;]*/)?.[0] || '';
    expect(scriptSrc).toContain("'sha256-");
    expect(scriptSrc).not.toContain('unsafe-inline');
  });
});

'use strict';
/**
 * Reads the SAME hash-pinned Content-Security-Policy the web deployment enforces via
 * Cloudflare Pages' _headers, rather than duplicating a hand-written one in main.js.
 *
 * The desktop app used to set its own CSP that allowed 'unsafe-inline' script execution
 * and omitted `trusted-types` / `require-trusted-types-for 'script'` entirely.
 * SECURITY.md documents hash-pinned script-src (no 'unsafe-inline') and Trusted Types
 * enforcement as Breeze's CSP — that was only ever true for the web build; the desktop
 * app quietly shipped a strictly weaker policy of its own. Reusing _headers' own line
 * means this can never drift from what tools/csp-hash.mjs --write computes — no second
 * hash to keep in sync by hand.
 *
 * Extracted into its own dependency-free module (fs + path only) for the same reason as
 * nav-guard.js: main.js requires('electron') as its first line, which throws outside a
 * real Electron process, so logic that needs testing has to live somewhere importable
 * on its own.
 */
const fs = require('fs');
const path = require('path');

const FALLBACK_CSP = "default-src 'self' 'unsafe-inline'; connect-src 'self' https: wss: stun: turn:; "
  + "img-src 'self' blob: data: https:; media-src 'self' blob:; worker-src 'self' blob:;";

// Extracted for its own test coverage — the file-reading half (readWebCSP) can't easily
// be exercised without touching the filesystem, but the parsing rule itself easily can.
function extractCSP(headersFileText) {
  const m = headersFileText.match(/^\s*Content-Security-Policy:\s*(.+)$/m);
  return m ? m[1].trim() : null;
}

// webRoot: the directory index.html (and _headers, shipped alongside it — see
// build.sh's WEB_FILES and desktop/package.json's extraResources) lives in, in both dev
// and packaged builds. Falls back to the previous permissive policy if _headers is
// missing or has no CSP line, rather than let a missing file crash the app.
function readWebCSP(webRoot) {
  try {
    const text = fs.readFileSync(path.join(webRoot, '_headers'), 'utf8');
    const csp = extractCSP(text);
    if (csp) return csp;
  } catch {}
  return FALLBACK_CSP;
}

module.exports = { extractCSP, readWebCSP, FALLBACK_CSP };

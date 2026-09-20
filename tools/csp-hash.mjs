#!/usr/bin/env node
// ============================================================================
// CSP script-src hash tool.
//
// WHY: index.html is a single self-contained file, so its JS lives in an inline
// <script>. The obvious way to allow that is script-src 'unsafe-inline' — which also
// allows ANY injected script, i.e. it hands an XSS the ability to read the identity
// private key straight out of IndexedDB. That is the exact risk SECURITY.md's threat
// model names, and the codebase already flags it in-line (see the translate-indicator
// comment in index.html: "under 'unsafe-inline' CSP an injected onerror= payload would
// execute").
//
// A hash-based CSP keeps the single-file architecture while dropping 'unsafe-inline':
// the browser executes only scripts whose SHA-256 matches one we published. Feasible
// here because the app has ZERO inline event handlers, ZERO javascript: URLs and no
// eval/new Function.
//
// HAZARD: the hash is of the exact script bytes, so ANY edit to index.html invalidates
// it — and a stale hash blocks the whole app. That failure is silent in the E2E harness
// (it serves index.html without _headers), so this tool exists to make drift mechanical:
//   --write  recompute and rewrite the hashes into _headers
//   --check  verify _headers matches the current index.html (exit 1 on drift)
// validate.sh runs --check, so a drifted hash fails the gate instead of production.
//
// WHY ONLY _headers: index.html also carries a <meta> CSP, and a browser enforces the
// INTERSECTION of every policy it receives — so the strict header alone already makes the hash
// binding in production, no matter how permissive the meta copy is. Pinning the hash in the meta
// tag as well would additionally break any byte-level rewrite of the served HTML: the E2E harness
// legitimately rewrites one line (`const API = ...`), which invalidates the hash and blocked the
// entire suite when this was first attempted. The meta copy therefore keeps 'unsafe-inline' as the
// baseline for header-less deployments (self-hosting without _headers), which is exactly the
// status quo it always was — no regression — while _headers delivers the real hardening.
// ============================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = join(ROOT, 'index.html');
const HEADERS = join(ROOT, '_headers');
// The Tauri desktop build's CSP is a THIRD copy, in its own static JSON config (unlike
// Electron's, which reads _headers at runtime — see desktop/csp-guard.js). It had the
// same drift as Electron's did before that fix: 'unsafe-inline' in place of a hash-
// pinned script-src, no separate script-src directive at all (falling through to
// default-src, which also governs unrelated fetch types), and no trusted-types
// directives. Kept in sync here rather than left to drift a second time — this file
// (Tauri's frontendDist points straight at the repo's own index.html, unlike the E2E
// harness's byte-rewritten copy) has none of the reasons _headers' hash-pinning was
// deliberately kept out of index.html's own <meta> CSP.
const TAURI_CONF = join(ROOT, 'tauri', 'src-tauri', 'tauri.conf.json');

// Match inline <script> blocks only (those WITHOUT src=). A browser hashes the element's
// exact text content, so we hash precisely the bytes between the tags.
const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;

export function computeHashes(html) {
  const out = [];
  for (const m of html.matchAll(INLINE_SCRIPT)) {
    out.push(`'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
  }
  return out;
}

// Replace the script-src directive's value, dropping 'unsafe-inline' and pinning hashes.
function rewriteScriptSrc(csp, hashes) {
  return csp.replace(/script-src [^;]+/, `script-src 'self' ${hashes.join(' ')}`);
}

function main() {
  const mode = process.argv[2] || '--check';
  const html = readFileSync(HTML, 'utf8');
  const headers = readFileSync(HEADERS, 'utf8');
  const hashes = computeHashes(html);

  if (hashes.length === 0) {
    console.error('csp-hash: no inline <script> found in index.html — refusing to proceed');
    process.exit(1);
  }

  const headerMatch = headers.match(/^(\s*Content-Security-Policy:\s*)(.+)$/m);
  if (!headerMatch) {
    console.error('csp-hash: could not locate Content-Security-Policy in _headers');
    process.exit(1);
  }

  const wantHeader = rewriteScriptSrc(headerMatch[2], hashes);

  // Tauri's CSP is a JSON string value, not a "directive: value; directive: value" line,
  // and has no script-src of its own (it falls through to default-src, which also governs
  // unrelated fetch types) — so rather than a targeted script-src replace, pin the whole
  // value to the SAME string _headers uses. A surgical regex on the raw text (not a JSON
  // parse+stringify round-trip, which reformats unrelated parts of the file — e.g.
  // collapses `{ "x": false }` onto its own multi-line block) keeps every other byte in
  // the file untouched.
  const tauriConf = readFileSync(TAURI_CONF, 'utf8');
  const tauriMatch = tauriConf.match(/("csp":\s*")((?:[^"\\]|\\.)*)(")/);

  if (mode === '--write') {
    writeFileSync(HEADERS, headers.replace(headerMatch[2], wantHeader));
    console.log(`csp-hash: wrote ${hashes.length} hash(es) to _headers`);
    for (const h of hashes) console.log(`  ${h}`);
    if (tauriMatch) {
      const escaped = wantHeader.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      writeFileSync(TAURI_CONF, tauriConf.replace(tauriMatch[0], `${tauriMatch[1]}${escaped}${tauriMatch[3]}`));
      console.log('csp-hash: synced tauri.conf.json\'s CSP to match');
    } else {
      console.error('csp-hash: WARNING — could not locate "csp" in tauri.conf.json, left unchanged');
    }
    return;
  }

  const problems = [];
  if (headerMatch[2] !== wantHeader) problems.push('_headers CSP script-src is stale');
  const dir = headerMatch[2].match(/script-src ([^;]+)/);
  if (dir && dir[1].includes("'unsafe-inline'")) problems.push("_headers script-src still allows 'unsafe-inline'");
  if (!tauriMatch) problems.push('could not locate "csp" in tauri/src-tauri/tauri.conf.json');
  else {
    const tauriCsp = tauriMatch[2].replace(/\\"/g, '"');
    if (tauriCsp !== wantHeader) problems.push("tauri.conf.json's CSP does not match _headers'");
  }
  if (problems.length) {
    console.error('csp-hash: FAIL');
    for (const p of problems) console.error('  - ' + p);
    console.error('  run: node tools/csp-hash.mjs --write');
    process.exit(1);
  }
  console.log(`csp-hash: OK — ${hashes.length} inline script hash(es) pinned, no 'unsafe-inline'`);
  console.log(`csp-hash: OK — tauri.conf.json's CSP matches _headers'`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();

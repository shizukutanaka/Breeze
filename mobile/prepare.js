#!/usr/bin/env node
'use strict';
/**
 * prepare.js — Copy web assets from project root into www/ for Capacitor.
 *
 * Usage:
 *   node prepare.js          # copy + validate
 *   node prepare.js --check  # validate only (CI dry run)
 *
 * Exit codes:
 *   0 = success
 *   1 = missing required file
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const WWW = path.join(__dirname, 'www');
const CHECK_ONLY = process.argv.includes('--check');

// ── Asset manifest ──────────────────────────────────────────
// [source, destination (relative to www/), required?]
const ASSETS = [
  ['index.html',    'index.html',    true],
  ['sw.js',         'sw.js',         true],
  ['manifest.json', 'manifest.json', true],
  ['lang.js',       'lang.js',       true],
  ['icon-192.png',  'icon-192.png',  true],
  ['icon-512.png',  'icon-512.png',  true],
  ['404.html',      '404.html',      false],
];

// ── Validate ────────────────────────────────────────────────
let errors = 0;
for (const [src, , required] of ASSETS) {
  const full = path.join(ROOT, src);
  if (!fs.existsSync(full)) {
    if (required) { console.error(`  ✗ MISSING: ${src}`); errors++; }
    else { console.warn(`  ⚠ optional: ${src}`); }
  }
}
if (errors > 0) {
  console.error(`\n${errors} required file(s) missing. Aborting.`);
  process.exit(1);
}
if (CHECK_ONLY) {
  console.log('  ✓ All required files present (check-only mode)');
  process.exit(0);
}

// ── Clean + copy ────────────────────────────────────────────
fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });

let totalBytes = 0;
for (const [src, dst, required] of ASSETS) {
  const srcPath = path.join(ROOT, src);
  const dstPath = path.join(WWW, dst);
  if (!fs.existsSync(srcPath)) continue;

  // Ensure destination directory exists
  fs.mkdirSync(path.dirname(dstPath), { recursive: true });
  fs.copyFileSync(srcPath, dstPath);

  const stat = fs.statSync(dstPath);
  totalBytes += stat.size;
  const kb = (stat.size / 1024).toFixed(1);
  console.log(`  ✓ ${dst.padEnd(20)} ${kb.padStart(8)} KB`);
}

// ── Integrity check: verify index.html contains <script> ───
const idx = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');
if (!idx.includes('<script>') || !idx.includes('</script>')) {
  console.error('  ✗ index.html missing <script> tag — corrupt file?');
  process.exit(1);
}

// ── Summary ─────────────────────────────────────────────────
const totalKB = (totalBytes / 1024).toFixed(0);
const totalMB = (totalBytes / 1048576).toFixed(2);
console.log(`\n  www/ ready: ${ASSETS.length} files, ${totalKB} KB (${totalMB} MB)`);

// ── Generate sha256 manifest for reproducible builds ────────
const manifest = {};
for (const [, dst] of ASSETS) {
  const fp = path.join(WWW, dst);
  if (!fs.existsSync(fp)) continue;
  const hash = crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex');
  manifest[dst] = hash.slice(0, 16);
}
fs.writeFileSync(path.join(WWW, '.build-manifest.json'), JSON.stringify(manifest, null, 2));
console.log('  ✓ .build-manifest.json written');

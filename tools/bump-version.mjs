#!/usr/bin/env node
// Breeze version bumper — SHARE_PLAN stage 6 step 4.
// The app version lives in fifteen places (app config, service
// worker, PWA manifest, four package manifests, Cargo, the build
// script, the worker's health response, the page footer). They drifted before — the
// dist manifests sat a full release behind — because a bump was a
// dozen manual edits. Now it is one command:
//
//   node tools/bump-version.mjs 3.7.0     rewrite every site
//   node tools/bump-version.mjs --check   report any site that
//                                         disagrees (exit 1)
//
// The source of truth is index.html's CONFIG.VERSION (the parity
// tests anchor there too). Every site is an ANCHORED pattern: if
// an anchor is missing the tool refuses rather than guessing —
// a moved version string must fail loudly, never drift silently.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

const SITES = [
  { file: 'index.html', re: /VERSION: '(\d+\.\d+\.\d+)'/, fmt: (v) => `VERSION: '${v}'` },
  // R06: the always-visible page footer carried a hand-edited version
  // that sat two releases stale (3.6.1) because no site covered it.
  { file: 'index.html', re: /Breeze v(\d+\.\d+\.\d+)/, fmt: (v) => `Breeze v${v}` },
  { file: 'sw.js', re: /const VERSION = '(\d+\.\d+\.\d+)'/, fmt: (v) => `const VERSION = '${v}'` },
  { file: 'manifest.json', re: /"version": "(\d+\.\d+\.\d+)"/, fmt: (v) => `"version": "${v}"` },
  { file: 'package.json', re: /"version": "(\d+\.\d+\.\d+)"/, fmt: (v) => `"version": "${v}"` },
  { file: 'desktop/package.json', re: /"version": "(\d+\.\d+\.\d+)"/, fmt: (v) => `"version": "${v}"` },
  { file: 'mobile/package.json', re: /"version": "(\d+\.\d+\.\d+)"/, fmt: (v) => `"version": "${v}"` },
  { file: 'tauri/package.json', re: /"version": "(\d+\.\d+\.\d+)"/, fmt: (v) => `"version": "${v}"` },
  { file: 'tauri/src-tauri/tauri.conf.json', re: /"version": "(\d+\.\d+\.\d+)"/, fmt: (v) => `"version": "${v}"` },
  { file: 'tauri/src-tauri/Cargo.toml', re: /(\[package\][\s\S]*?version\s*=\s*")(\d+\.\d+\.\d+)(")/, fmt: null }, // group-aware, handled below
  { file: 'build-all.sh', re: /VERSION="(\d+\.\d+\.\d+)"/, fmt: (v) => `VERSION="${v}"` },
  { file: 'build.sh', re: /^VERSION="(\d+\.\d+\.\d+)"/m, fmt: (v) => `VERSION="${v}"` },
  { file: '_worker.js', re: /version: '(\d+\.\d+\.\d+)',/, fmt: (v) => `version: '${v}',` },
  { file: '_worker.js', re: /'X-Breeze-Version': '(\d+\.\d+\.\d+)'/, fmt: (v) => `'X-Breeze-Version': '${v}'` },
  { file: 'deploy.sh', re: /"v(\d+\.\d+\.\d+)"/, fmt: (v) => `"v${v}"` },
  // SPEC.md §4.2 quotes CONFIG.VERSION; it sat one release behind after v3.8.0.
  { file: 'SPEC.md', re: /^VERSION: '(\d+\.\d+\.\d+)'/m, fmt: (v) => `VERSION: '${v}'` },
];

function siteVersion(site) {
  const text = read(site.file);
  const m = text.match(site.re);
  if (!m) return { file: site.file, version: null };
  return { file: site.file, version: site.file.endsWith('Cargo.toml') ? m[2] : m[1] };
}

function currentVersion() {
  const v = siteVersion(SITES[0]).version;
  if (!v) { console.error('bump-version: cannot read CONFIG.VERSION from index.html'); process.exit(2); }
  return v;
}

const arg = process.argv[2];
if (arg === '--check') {
  const want = currentVersion();
  let bad = 0;
  for (const site of SITES) {
    const { version } = siteVersion(site);
    if (version !== want) { console.error(`  ✗ ${site.file}: ${version ?? '(anchor missing)'} != ${want}`); bad++; }
  }
  if (bad) { console.error(`bump-version: ${bad} site(s) out of sync with ${want}`); process.exit(1); }
  console.log(`bump-version: all ${SITES.length} sites at ${want}`);
} else if (/^\d+\.\d+\.\d+$/.test(arg || '')) {
  const from = currentVersion();
  // No early exit when arg === from: a same-version run is the
  // repair path for sites that drifted (found in the wild by
  // tests/app-version.test.js during the 3.7.0 audit).
  for (const site of SITES) {
    const text = read(site.file);
    if (!site.re.test(text)) { console.error(`bump-version: anchor missing in ${site.file} — refusing to bump partially`); process.exit(2); }
    const out = site.file.endsWith('Cargo.toml')
      ? text.replace(site.re, `$1${arg}$3`)
      : text.replace(site.re, site.fmt(arg));
    writeFileSync(join(ROOT, site.file), out);
    console.log(`  ${site.file}: ${from} → ${arg}`);
  }
  console.log(`bump-version: ${from} → ${arg} at ${SITES.length} sites. Next: move CHANGELOG [Unreleased] to [${arg}], run npm test && ./validate.sh, commit, then tag v${arg} and push the tag (the Release workflow does the rest).`);
} else {
  console.error('usage: node tools/bump-version.mjs <x.y.z> | --check');
  process.exit(2);
}

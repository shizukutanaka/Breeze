#!/usr/bin/env node
// ============================================================================
// Dead-wiring checker.
//
// `_DOM.get('x')` returns null when no element has that id, and the client uses optional
// chaining nearly everywhere, so a renamed or deleted element leaves its listener attached to
// nothing — with no error, no warning, and no test failure. Two real cases found this way:
//
//   - local backup-to-file was wired to #b-msg-backup, an element that does not exist, so you
//     could RESTORE a local backup (drag-and-drop) that you had no way to CREATE;
//   - #b-msg-panic and #contact-sort handlers outlived the buttons they belonged to.
//
// Ids can be declared four ways in this single-file app, and all four count as existing:
//   1. static markup            id="msg-main"
//   2. inside template strings  safeSetHTML(el, `<div id="call-overlay">`)
//   3. assigned at runtime      el.id = 'acc-tabs'
//   4. setAttribute             el.setAttribute('id', 'x')
//
// Only literal lookups are checked. `_DOM.get(`dur-${x}`)` cannot be resolved statically and is
// skipped by design — the goal is finding typos and orphans, not proving reachability.
// Lookup scanners cover all three string spellings (', ", `) for _DOM.get AND
// getElementById — a lone double-quoted or backticked call used to slip through the
// single-quote-only scan (the same blind spot i18n-check had for t("key")).
// ============================================================================
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = join(ROOT, 'index.html');

// Extracted src/app modules create DOM in the same document as index.html
// (the slash picker is one example), so their literal id declarations are part
// of the runtime declaration set even though the lookup may stay in index.html.
export function readRuntimeClientSource(root = ROOT) {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const appDir = join(root, 'src', 'app');
  const modules = readdirSync(appDir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(join(appDir, f), 'utf8'))
    .join('\n');
  return html + '\n' + modules;
}

// Every id the file can produce, in markup OR in JS strings. Backtick variants are
// legal inside template literals (`id="x"` scanned by the same regex once the backtick
// delimiters are also matched).
export function collectDeclaredIds(html) {
  const have = new Set();
  for (const m of html.matchAll(/\bid\s*=\s*"([A-Za-z][\w-]*)"/g)) have.add(m[1]);
  for (const m of html.matchAll(/\bid\s*=\s*'([A-Za-z][\w-]*)'/g)) have.add(m[1]);
  for (const m of html.matchAll(/\bid\s*=\s*`([A-Za-z][\w-]*)`/g)) have.add(m[1]);
  for (const m of html.matchAll(/\.id\s*=\s*['"`]([A-Za-z][\w-]*)['"`]/g)) have.add(m[1]);
  // setAttribute('id', 'x') — rare but legal
  for (const m of html.matchAll(/setAttribute\(\s*['"]id['"]\s*,\s*['"]([A-Za-z][\w-]*)['"]/g)) have.add(m[1]);
  return have;
}

// Literal lookups only: _DOM.get('x') / getElementById('x') with a plain quoted or
// backticked string. Returns Map id -> first 1-based line it is looked up on.
// A lookup whose string contains `${` is dynamic — matchAll simply won't match it,
// because the id charset excludes `$` and `{`.
export function collectLookups(html) {
  const want = new Map();
  const record = (id, idx) => { if (!want.has(id)) want.set(id, (html.slice(0, idx).match(/\n/g) || []).length + 1); };
  const LOOKUP = /(?:_DOM\.get|getElementById)\(\s*(['"`])([A-Za-z][\w-]*)\1\s*\)/g;
  for (const m of html.matchAll(LOOKUP)) record(m[2], m.index);
  return want;
}

// Lookup ids that no declaration can satisfy. declarationSrc defaults to the
// same source for unit tests; the live gate passes the combined runtime client
// source so ids created by extracted modules satisfy lookups in index.html.
export function deadWirings(html, declarationSrc = html) {
  const have = collectDeclaredIds(declarationSrc);
  return [...collectLookups(html).entries()].filter(([id]) => !have.has(id));
}

export function main() {
  const html = readFileSync(HTML, 'utf8');
  const runtimeSrc = readRuntimeClientSource();
  const dead = deadWirings(html, runtimeSrc);
  if (dead.length) {
    console.error(`dead-wiring: FAIL — ${dead.length} lookup(s) target an id that never exists`);
    for (const [id, line] of dead) console.error(`  - index.html:${line}  _DOM.get('${id}') — no element ever has this id`);
    console.error('  Either the element was removed (delete the dead handler) or the id is a typo.');
    process.exit(1);
  }
  const want = collectLookups(html), have = collectDeclaredIds(runtimeSrc);
  console.log(`dead-wiring: OK — ${want.size} literal id lookup(s), all resolve (${have.size} runtime ids declared)`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();

#!/usr/bin/env node
// ============================================================================
// Unreachable platform-branch checker.
//
// PLATFORM is exactly one of 'electron' | 'capacitor' | 'web', so a guard for one
// platform nested inside a guard for another can never run. Neither the browser, the
// linter, nor any test complains: the code is syntactically perfect and simply never
// executes.
//
// This is not hypothetical. A misplaced closing brace put ~190 lines of the client —
// including a block whose own comment read "(all platforms)" — inside
// `if (PLATFORM === 'electron' && window.breeze)`. On web, the primary platform, that
// silently disabled Escape-to-close-overlays, Ctrl+K/Ctrl+Shift+F/Ctrl+N, the
// scroll-to-bottom FAB, unread badge increments, the disappearing-message countdown and
// the in-chat search bar, while the '?' shortcut overlay advertised them to every user.
// #scroll-fab and #search-bar sat in the DOM as dead UI.
//
// The tell that something was structurally wrong was small and mechanical: an
// `if (PLATFORM === 'capacitor')` block sitting inside the electron guard. That is the
// canary this gate watches for — an impossible condition is always a bug, so the check
// has no judgement calls and no false positives to argue about.
//
// Mobile guards (IS_IOS / IS_ANDROID) inside an electron guard are flagged for the same
// reason: an Electron desktop build is neither. They are NOT flagged inside a web or
// capacitor guard — a web browser on a phone is legitimately both, and Capacitor IS
// mobile.
//
// Extraction details: braces (and the `if (` condition's own parens) are matched against
// a MASKED copy of the source with string, template-literal and comment contents
// blanked out. Naive brace counting mis-parses this file — it has template literals
// containing HTML braces and significant leading whitespace — and produced confidently
// wrong answers twice while this bug was being diagnosed. Conditions are found by
// paren-matching forward from each `if (`, NOT by a `[^)]` regex — the earlier regex
// form silently skipped every guard whose condition contained a call or nested parens
// (132 such `if (...) {` blocks went unscanned), so a misplaced brace inside a compound
// platform guard like `if (PLATFORM === 'electron' && ready())` would have recurred
// invisibly. Regex literals inside conditions are not masked — none exist today; a
// `{` inside one would need extending mask().
// ============================================================================
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = join(ROOT, 'index.html');

export function mask(src) {
  const out = src.split('');
  const blank = (a, b) => { for (let k = a; k < b && k < out.length; k++) if (out[k] !== '\n') out[k] = ' '; };
  let i = 0;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { let j = src.indexOf('\n', i); if (j < 0) j = src.length; blank(i, j); i = j; continue; }
    if (c === '/' && n === '*') { const j = src.indexOf('*/', i + 2); const e = j < 0 ? src.length : j + 2; blank(i, e); i = e; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length) { if (src[j] === '\\') { j += 2; continue; } if (src[j] === c) break; j++; }
      blank(i + 1, j); i = j + 1; continue;
    }
    i++;
  }
  return out.join('');
}

const SKIP_WS = (s, k) => { while (s[k] === ' ' || s[k] === '\n' || s[k] === '\t') k++; return k; };

// Pair-match from `open` (which must be a '(' or '{') to its closer in masked source.
function pairEnd(masked, open) {
  const OPEN = masked[open], CLOSE = OPEN === '(' ? ')' : '}';
  let depth = 0;
  for (let k = open; k < masked.length; k++) {
    if (masked[k] === OPEN) depth++;
    else if (masked[k] === CLOSE) { depth--; if (depth === 0) return k; }
  }
  return -1;
}

// Every `if (cond) { ... }` block: condition text (from the UNmasked source), the
// matched-paren end of the condition, and the brace-pair end of the body. Blocks whose
// `)` is not followed by `{` (`if (x) return;`) carry no nesting information and are
// skipped; they cannot contain a dead nested guard.
export function findGuards(js) {
  const masked = mask(js);
  const lineOf = (idx) => js.slice(0, idx).split('\n').length;
  const guards = [];
  for (const m of masked.matchAll(/\bif\s*\(/g)) {
    const openParen = m.index + m[0].length - 1;
    const closeParen = pairEnd(masked, openParen);
    if (closeParen < 0) continue;
    const openBrace = SKIP_WS(masked, closeParen + 1);
    if (masked[openBrace] !== '{') continue;
    const end = pairEnd(masked, openBrace);
    if (end < 0) continue;
    guards.push({
      cond: js.slice(openParen + 1, closeParen).trim(),
      start: m.index, end, line: lineOf(m.index),
    });
  }
  return guards;
}

// Which mutually exclusive predicate, if any, does this condition assert?
const predicate = (c) => {
  const p = c.match(/PLATFORM\s*===\s*'(\w+)'/);
  if (p) return 'PLATFORM:' + p[1];
  if (/\bIS_IOS\b/.test(c) && !/!\s*IS_IOS/.test(c)) return 'IS_IOS';
  if (/\bIS_ANDROID\b/.test(c) && !/!\s*IS_ANDROID/.test(c)) return 'IS_ANDROID';
  return null;
};
const MOBILE = new Set(['IS_IOS', 'IS_ANDROID']);
const exclusive = (a, b) => {
  if (a === b) return false;
  if (a.startsWith('PLATFORM:') && b.startsWith('PLATFORM:')) return true;
  if (a === 'PLATFORM:electron' && MOBILE.has(b)) return true;
  if (b === 'PLATFORM:electron' && MOBILE.has(a)) return true;
  return false;
};

export function deadBranches(js) {
  const guards = findGuards(js);
  const dead = [];
  for (const outer of guards) {
    const po = predicate(outer.cond);
    if (!po) continue;
    for (const inner of guards) {
      if (inner.start <= outer.start || inner.end >= outer.end) continue;
      const pi = predicate(inner.cond);
      if (pi && exclusive(po, pi)) dead.push({ inner, outer });
    }
  }
  return { dead, guardCount: guards.length };
}

export function main() {
  const html = readFileSync(HTML, 'utf8');
  const js = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (!js) {
    console.error('unreachable-branch: no inline <script> found in index.html');
    process.exit(1);
  }
  const { dead, guardCount } = deadBranches(js);
  if (dead.length) {
    console.error(`unreachable-branch: FAIL — ${dead.length} branch(es) can never run`);
    for (const { inner, outer } of dead) {
      console.error(`  - index.html:${inner.line}  if (${inner.cond})`);
      console.error(`    nested inside index.html:${outer.line}  if (${outer.cond}) — the two can never both be true`);
    }
    console.error('  Usually a misplaced closing brace: check where the OUTER block actually ends.');
    process.exit(1);
  }
  console.log(`unreachable-branch: OK — ${guardCount} if-blocks scanned, no impossible platform nesting`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();

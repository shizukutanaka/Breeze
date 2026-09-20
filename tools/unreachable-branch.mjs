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
// reason: an Electron desktop build is neither.
//
// Braces are matched against a MASKED copy of the source with string, template-literal,
// comment and regex contents blanked out. Naive brace counting mis-parses this file —
// it has template literals containing HTML braces and significant leading whitespace —
// and produced confidently wrong answers twice while this bug was being diagnosed.
// ============================================================================
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const js = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!js) {
  console.error('unreachable-branch: no inline <script> found in index.html');
  process.exit(1);
}

function mask(src) {
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

const masked = mask(js);
const lineOf = (idx) => js.slice(0, idx).split('\n').length;

const guards = [];
for (const m of masked.matchAll(/\bif\s*\(([^)]{0,120})\)\s*\{/g)) {
  const open = m.index + m[0].lastIndexOf('{');
  let depth = 0, end = -1;
  for (let k = open; k < masked.length; k++) {
    if (masked[k] === '{') depth++;
    else if (masked[k] === '}') { depth--; if (depth === 0) { end = k; break; } }
  }
  if (end < 0) continue;
  guards.push({
    cond: js.slice(m.index + m[0].indexOf('(') + 1, m.index + m[0].lastIndexOf(')')).trim(),
    start: m.index, end, line: lineOf(m.index),
  });
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

if (dead.length) {
  console.error(`unreachable-branch: FAIL — ${dead.length} branch(es) can never run`);
  for (const { inner, outer } of dead) {
    console.error(`  - index.html:${inner.line}  if (${inner.cond})`);
    console.error(`    nested inside index.html:${outer.line}  if (${outer.cond}) — the two can never both be true`);
  }
  console.error('  Usually a misplaced closing brace: check where the OUTER block actually ends.');
  process.exit(1);
}
console.log(`unreachable-branch: OK — ${guards.length} if-blocks scanned, no impossible platform nesting`);

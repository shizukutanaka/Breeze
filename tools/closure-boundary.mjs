// ============================================================================
// initMessenger()-closure-boundary checker.
//
// A misplaced brace fix once balanced `if (PLATFORM === 'electron')`'s braces without
// checking the freed code against initMessenger()'s OWN closing brace. The freed
// "Global: Escape to close modals + keyboard shortcuts (all platforms)" listener landed
// a few lines PAST where initMessenger itself ends — at true top level. Names declared
// with const/let/function INSIDE initMessenger (dbGetAll, activeContact,
// openConversation, ...) are invisible there: referencing one threw a bare
// ReferenceError on every keypress, on every platform, and nothing caught it — the code
// parses fine, and every element it might have touched already existed.
//
// This walks the same territory a human already had to audit by hand to find that bug,
// so a second instance doesn't need the same manual trace: collect every top-level
// const/let/function name declared inside initMessenger's body, then scan the SCRIPT
// TAIL (everything after initMessenger's closing brace) for a bare reference to one of
// those names that isn't behind a `window.` prefix or a `typeof X !== 'undefined'`
// guard (the pattern this file's own authors already used correctly for
// _selectMode/togglePicker right next to the two names that weren't).
//
// This is deliberately NOT a general JS scope analyzer — it doesn't track function
// parameters, nested block scoping, or shadowing. It only answers the one question that
// actually matters here: does this specific name, known to be initMessenger-local,
// appear as a live reference outside it. False negatives (a name this script doesn't
// know to look for) are possible; false positives should not be, since every candidate
// is confirmed to be undeclared anywhere in the tail before being reported.
// ============================================================================
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { maskJs } from './lib/mask-js.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

const scriptOpen = html.indexOf('<script>') + '<script>'.length;
const scriptClose = html.indexOf('</script>', scriptOpen);
const offsetLines = html.slice(0, scriptOpen).split('\n').length - 1;
const js = html.slice(scriptOpen, scriptClose);

const masked = maskJs(js);
const lineOf = (idx) => offsetLines + js.slice(0, idx).split('\n').length;

const startMarker = 'async function initMessenger(dbName)';
const startIdx = js.indexOf(startMarker);
if (startIdx < 0) {
  console.error('closure-boundary: could not find initMessenger — has it been renamed?');
  process.exit(1);
}
const openBrace = masked.indexOf('{', startIdx);
let depth = 0, bodyEnd = -1;
for (let k = openBrace; k < masked.length; k++) {
  if (masked[k] === '{') depth++;
  else if (masked[k] === '}') { depth--; if (depth === 0) { bodyEnd = k; break; } }
}
if (bodyEnd < 0) {
  console.error('closure-boundary: initMessenger never closes — malformed braces?');
  process.exit(1);
}

const body = js.slice(openBrace + 1, bodyEnd);
const bodyMasked = masked.slice(openBrace + 1, bodyEnd);
const tail = js.slice(bodyEnd + 1);
const tailMasked = masked.slice(bodyEnd + 1);

// Every top-level-within-the-closure name: const/let and named function declarations.
// (var is not used in this codebase's style; arrow functions assigned to const are
// already covered by the const branch.)
const closureNames = new Set();
for (const m of bodyMasked.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)/g)) closureNames.add(m[1]);
for (const m of bodyMasked.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) closureNames.add(m[1]);
// Destructured consts (const { a, b } = ...) — grab identifiers inside the braces too.
for (const m of bodyMasked.matchAll(/\bconst\s*\{([^}]*)\}\s*=/g)) {
  for (const part of m[1].split(',')) {
    const name = part.split(':').pop().trim().split('=')[0].trim();
    if (/^[A-Za-z_$][\w$]*$/.test(name)) closureNames.add(name);
  }
}

// Names declared in the tail itself are legitimate siblings, not the bug class this
// checks for — a name can be BOTH closure-local (shadowed) and tail-local; only flag
// names that resolve EXCLUSIVELY to the closure.
const tailOwnNames = new Set();
for (const m of tailMasked.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)/g)) tailOwnNames.add(m[1]);
for (const m of tailMasked.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) tailOwnNames.add(m[1]);
// Function parameters in the tail are also legitimately local to their own function.
// `[^()]` (not just `[^)]`) so a param list can't span past an OUTER call's opening
// paren when there's no closing paren in between (e.g. `addListener('x', (info) => {`
// — `[^)]*` would greedily swallow `'x', (info` as if it were all one parameter list).
for (const m of tailMasked.matchAll(/\bfunction\s*[A-Za-z_$]*\s*\(([^()]*)\)/g)) {
  for (const part of m[1].split(',')) { const n = part.trim().split('=')[0].trim(); if (/^[A-Za-z_$][\w$]*$/.test(n)) tailOwnNames.add(n); }
}
for (const m of tailMasked.matchAll(/\(([^()]*)\)\s*=>/g)) {
  for (const part of m[1].split(',')) { const n = part.trim().split('=')[0].trim(); if (/^[A-Za-z_$][\w$]*$/.test(n)) tailOwnNames.add(n); }
}
for (const m of tailMasked.matchAll(/\b([A-Za-z_$][\w$]*)\s*=>/g)) tailOwnNames.add(m[1]); // single-arg arrow, no parens
for (const m of tailMasked.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) tailOwnNames.add(m[1]);
for (const m of tailMasked.matchAll(/\bfor\s*\(\s*(?:const|let)\s+([A-Za-z_$][\w$]*)/g)) tailOwnNames.add(m[1]);
// Class method / constructor / object-literal shorthand-method params (`constructor(title, opts) {`,
// `get permission() {`, `foo(a, b) {`). A bare call expression is never followed
// directly by `{` in valid JS outside this shape, EXCEPT for control-flow statements
// (`if (activeContact) {`, `while (x) {`), which look identical to a naive regex and
// would otherwise get their condition misread as a declared parameter — masking the
// exact class of bug this file exists to catch (caught empirically: an early draft of
// this tool missed the pre-fix `activeContact` bug for exactly this reason).
const CONTROL_KEYWORDS = /^(if|while|for|switch|catch|with|return|typeof|in|of|instanceof|new|delete|void|yield|await)$/;
for (const m of tailMasked.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(([^()]*)\)\s*\{/g)) {
  if (CONTROL_KEYWORDS.test(m[1])) continue;
  for (const part of m[2].split(',')) { const n = part.trim().split('=')[0].trim(); if (/^[A-Za-z_$][\w$]*$/.test(n)) tailOwnNames.add(n); }
}

const problems = [];
for (const name of closureNames) {
  if (tailOwnNames.has(name)) continue; // shadowed locally in the tail — not this bug
  // A reference: the name NOT preceded by `.` (property access) or `function`/const/let
  // (a declaration, already excluded from closureNames-in-tail by construction, but a
  // parameter default or similar could still match) and not followed immediately by a
  // colon (object key) — approximated by requiring a word boundary on both sides and
  // excluding `.name` / `name:`.
  const refRe = new RegExp(`(?<![.\\w$])${name}(?![\\w$:])`, 'g');
  for (const m of [...tailMasked.matchAll(refRe)]) {
    const idx = m.index;
    // Skip if immediately preceded (ignoring whitespace) by `window.` — the sanctioned
    // exposure pattern already used elsewhere in this file.
    const before = tail.slice(Math.max(0, idx - 40), idx);
    if (/window\.\s*$/.test(before)) continue;
    // Skip if inside a `typeof NAME` check on this exact name anywhere on the same
    // logical guard — the _selectMode/togglePicker pattern.
    const lineStart = tail.lastIndexOf('\n', idx) + 1;
    const lineEnd = tail.indexOf('\n', idx);
    const line = tail.slice(lineStart, lineEnd < 0 ? tail.length : lineEnd);
    if (new RegExp(`typeof\\s+${name}\\b`).test(line)) continue;
    problems.push({ name, line: lineOf(bodyEnd + 1 + idx), context: line.trim().slice(0, 100) });
    break; // one report per name is enough to act on; avoid spamming every occurrence
  }
}

if (problems.length) {
  console.error(`closure-boundary: FAIL — ${problems.length} name(s) referenced outside initMessenger() but declared only inside it`);
  for (const p of problems) console.error(`  - index.html:${p.line}  \`${p.name}\`  ${p.context}`);
  console.error('  Fix: expose via window.<name> = <name>; inside initMessenger (see the exposures');
  console.error('  near its `await _boot();` line) and reference window.<name> at the call site, OR');
  console.error('  guard with `typeof <name> !== \'undefined\'` if a missing value is a valid no-op.');
  process.exit(1);
}
console.log(`closure-boundary: OK — ${closureNames.size} closure-local name(s) checked, none referenced unguarded outside initMessenger()`);

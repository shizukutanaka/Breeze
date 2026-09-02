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
// Ids can be declared three ways in this single-file app, and all three count as existing:
//   1. static markup            id="msg-main"
//   2. inside template strings  safeSetHTML(el, `<div id="call-overlay">`)
//   3. assigned at runtime      el.id = 'acc-tabs'
//
// Only literal lookups are checked. `_DOM.get(`dur-${x}`)` cannot be resolved statically and is
// skipped by design — the goal is finding typos and orphans, not proving reachability.
// ============================================================================
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

const have = new Set();
for (const m of html.matchAll(/\bid\s*=\s*"([A-Za-z][\w-]*)"/g)) have.add(m[1]);
for (const m of html.matchAll(/\bid\s*=\s*'([A-Za-z][\w-]*)'/g)) have.add(m[1]);
for (const m of html.matchAll(/\.id\s*=\s*['"`]([A-Za-z][\w-]*)['"`]/g)) have.add(m[1]);
// setAttribute('id', 'x') — rare but legal
for (const m of html.matchAll(/setAttribute\(\s*['"]id['"]\s*,\s*['"]([A-Za-z][\w-]*)['"]/g)) have.add(m[1]);

// Literal lookups only: _DOM.get('x') / getElementById('x') with a plain quoted string.
const want = new Map();
const scan = (re) => {
  for (const m of html.matchAll(re)) {
    const id = m[1];
    if (!want.has(id)) want.set(id, (html.slice(0, m.index).match(/\n/g) || []).length + 1);
  }
};
scan(/_DOM\.get\(\s*'([A-Za-z][\w-]*)'\s*\)/g);
scan(/_DOM\.get\(\s*"([A-Za-z][\w-]*)"\s*\)/g);
scan(/getElementById\(\s*'([A-Za-z][\w-]*)'\s*\)/g);

const dead = [...want.entries()].filter(([id]) => !have.has(id));
if (dead.length) {
  console.error(`dead-wiring: FAIL — ${dead.length} lookup(s) target an id that never exists`);
  for (const [id, line] of dead) console.error(`  - index.html:${line}  _DOM.get('${id}') — no element ever has this id`);
  console.error('  Either the element was removed (delete the dead handler) or the id is a typo.');
  process.exit(1);
}
console.log(`dead-wiring: OK — ${want.size} literal id lookup(s), all resolve (${have.size} ids declared)`);

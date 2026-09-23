// ============================================================================
// Boot TDZ checker.
//
// The top-level boot block calls `initMessenger()` — a hoisted function — hundreds of lines
// BEFORE many top-level `let`/`const` declarations run. initMessenger executes synchronously
// up to its first `await`, so any top-level binding it touches in that prefix and that is
// declared textually after the boot call is still in its temporal dead zone: a bare
// ReferenceError, the crash overlay, on every fresh page load. Parses fine; every unit test
// stays green (they exercise extracted fragments, never the real top-level order).
//
// It has shipped three times: `_perf` (read on initMessenger's first line — see the comment
// above its declaration), `_boot()`'s renderContacts() reading closure `let`s (why _boot is
// deferred to the end of initMessenger), and `_messengerCleanup` (written on initMessenger's
// third line by the "minimal cleanup at init start" fix — every boot crashed).
//
// First-order only: checks names used directly in initMessenger's synchronous prefix, not
// functions it calls from there. That covers all three historical instances.
// ============================================================================
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const lines = readFileSync(process.argv[2] || join(ROOT, 'index.html'), 'utf8').split('\n');

const bootIdx = lines.findIndex((l) => /^\s*initMessenger\(\)\.catch\(/.test(l));
const fnIdx = lines.findIndex((l) => /^async function initMessenger\(/.test(l));
if (bootIdx < 0 || fnIdx < 0) {
  console.error('boot-tdz: could not locate the boot call or initMessenger — update this tool');
  process.exit(1);
}

// Synchronous prefix: through the first line containing `await` (its operand evaluates
// before suspension, so that line is still synchronous).
const strip = (l) => l.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '""').replace(/(^|\s)\/\/.*$/, '');
const prefix = [];
for (let i = fnIdx + 1; i < lines.length; i++) {
  prefix.push({ n: i + 1, src: strip(lines[i]) });
  if (/\bawait\b/.test(prefix.at(-1).src)) break;
}
const localNames = new Set(prefix.flatMap(({ src }) =>
  [...src.matchAll(/\b(?:let|const|var|function)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1])));

const bad = [];
for (let i = bootIdx + 1; i < lines.length; i++) {
  const m = /^(?:let|const)\s+([A-Za-z_$][\w$]*)/.exec(lines[i]);
  if (!m || localNames.has(m[1])) continue;
  const use = new RegExp(`(^|[^\\w$.])${m[1].replace(/\$/g, '\\$')}(?![\\w$])`);
  const hit = prefix.find(({ src }) => use.test(src));
  if (hit) bad.push(`index.html:${hit.n} reads/writes \`${m[1]}\`, declared at line ${i + 1} — after the boot call at line ${bootIdx + 1}`);
}

if (bad.length) {
  console.error(`boot-tdz: ${bad.length} top-level binding(s) in their TDZ when initMessenger() runs:`);
  for (const b of bad) console.error('  ' + b);
  console.error('Fix: move the declaration above the boot call (next to `_perf`).');
  process.exit(1);
}
console.log(`boot-tdz: OK — initMessenger's ${prefix.length}-line synchronous prefix reads no top-level binding declared after the boot call`);

// ============================================================================
// Trojan-Source / bidi gate.
//
// The same character class _UNSAFE_DISPLAY_RE strips from display names must never appear
// literally in the source tree: a raw U+202E inside a code comment can reorder the rendered
// line in editors and PR review ("Trojan Source", CVE-2021-42574), and raw invisible chars
// (ZWSP, soft hyphen, tag chars) make two identifiers look identical while differing in
// bytes. Escaped forms (\u202E) are fine — this scans for the literal code points only.
//
// Scans git-tracked text files (by extension); binaries are skipped. ZWJ/ZWNJ/variation
// selectors are NOT banned — emoji sequences and Indic/Arabic-script names need them, and
// legitimate uses exist in the i18n tables.
// ============================================================================
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const BIDI_RE = /[\u00AD\u034F\u061C\u115F\u1160\u180E\u200B\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\u2800\u3164\uFFA0\uFEFF\u{1D173}-\u{1D17A}\u{E0000}-\u{E007F}]/u;

const TEXT_EXT = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.jsx', '.tsx',
  '.html', '.htm', '.css', '.json', '.md', '.txt',
  '.sh', '.bash', '.zsh', '.yaml', '.yml', '.toml', '.xml', '.svg',
  '.py', '.rb', '.go', '.rs', '.java', '.c', '.h', '.cpp', '.hpp',
]);

const files = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && TEXT_EXT.has('.' + (f.split('.').pop() || '').toLowerCase()));

const hits = [];
for (const f of files) {
  let s;
  try { s = readFileSync(join(ROOT, f), 'utf8'); } catch { continue; }
  const lines = s.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const bad = [...lines[i]].filter((c) => BIDI_RE.test(c));
    if (bad.length) {
      const cps = [...new Set(bad.map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase()))].join(' ');
      hits.push(`  - ${f}:${i + 1}  ${cps}`);
    }
  }
}

if (hits.length) {
  console.error(`bidi-check: FAIL — ${hits.length} line(s) contain raw direction-control or invisible chars`);
  for (const h of hits) console.error(h);
  console.error('  Use \\uXXXX escape sequences instead of literal characters (Trojan-Source class).');
  process.exit(1);
}
console.log(`bidi-check: OK — ${files.length} text files scanned, no raw direction-control/invisible chars`);

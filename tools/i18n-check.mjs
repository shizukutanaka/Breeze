#!/usr/bin/env node
// ============================================================================
// Locale integrity checker.
//
// Locale tables used to be JavaScript — 340 of the entries were arrow functions like
// `(n) => `${n} replies``. That made them un-checkable, un-translatable by non-programmers,
// and impossible to move out of index.html. They are now pure data: plain strings with {0}
// placeholders, plus plural objects keyed by CLDR categories.
//
// Being data means a machine can verify them, which is what this does. Adding a language
// should be a mechanical, gated operation — not a careful manual diff.
//
// Checks, per locale against the English reference:
//   1. KEY PARITY      — no missing keys (a missing key silently falls back to English, so
//                        this is invisible at runtime and only shows up as an untranslated UI).
//   2. PLACEHOLDERS    — the same {0}..{n} set. A translator dropping {0} produces a string
//                        that renders a blank where a filename or count belonged.
//   3. PLURAL SHAPE    — a plural entry must supply exactly the CLDR categories the language
//                        actually uses (Intl.PluralRules is the authority: English needs
//                        one/other, Japanese only other, Polish one/few/many/other).
//   4. NO CODE         — no functions may creep back in, or the table stops being portable data.
// ============================================================================
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

// Extract the `const _I = {...}` table by brace matching.
function extractTable() {
  const start = html.indexOf('const _I = {');
  if (start < 0) throw new Error('i18n-check: could not find `const _I = {` in index.html');
  let depth = 0;
  for (let i = html.indexOf('{', start); i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) return html.slice(html.indexOf('{', start), i + 1); }
  }
  throw new Error('i18n-check: unbalanced braces in _I');
}

const raw = extractTable();
if (/=>/.test(raw)) {
  console.error('i18n-check: FAIL — the locale table contains a function (`=>`).');
  console.error('  Locales must stay pure data so they can be verified, translated and externalised.');
  console.error('  Use a "{0}" placeholder, or a plural object like { one: "...", other: "..." }.');
  process.exit(1);
}

let table;
try { table = (0, eval)('(' + raw + ')'); }
catch (e) { console.error('i18n-check: FAIL — locale table is not valid data: ' + e.message); process.exit(1); }

const placeholders = (s) => [...new Set((s.match(/\{(\d+)\}/g) || []))].sort().join(',');
const categoriesFor = (loc) => {
  // Probe a spread of counts to learn which CLDR categories this language actually uses.
  const pr = new Intl.PluralRules(loc);
  return new Set([0, 1, 2, 3, 5, 11, 21, 101, 1.5].map((n) => pr.select(n)));
};

const REF = 'en';
const refKeys = Object.keys(table[REF]);
const problems = [];

for (const loc of Object.keys(table)) {
  if (loc === REF) continue;
  const t = table[loc];
  const cats = categoriesFor(loc);

  for (const key of refKeys) {
    const rv = table[REF][key], v = t[key];
    if (v === undefined) { problems.push(`${loc}: missing key "${key}"`); continue; }

    const rIsPlural = rv && typeof rv === 'object';
    const vIsPlural = v && typeof v === 'object';
    if (rIsPlural !== vIsPlural) {
      problems.push(`${loc}."${key}": ${vIsPlural ? 'is' : 'is not'} a plural object but English ${rIsPlural ? 'is' : 'is not'}`);
      continue;
    }

    if (vIsPlural) {
      for (const cat of cats) {
        if (v[cat] === undefined) problems.push(`${loc}."${key}": missing plural category "${cat}" (required for ${loc})`);
      }
      for (const cat of Object.keys(v)) {
        if (!cats.has(cat)) problems.push(`${loc}."${key}": unused plural category "${cat}" (${loc} never selects it)`);
      }
      const refPh = placeholders(Object.values(rv).join(''));
      const vPh = placeholders(Object.values(v).join(''));
      if (refPh !== vPh) problems.push(`${loc}."${key}": placeholders ${vPh || '(none)'} != English ${refPh || '(none)'}`);
      continue;
    }

    if (typeof v !== 'string') { problems.push(`${loc}."${key}": not a string`); continue; }
    const rp = placeholders(rv), vp = placeholders(v);
    if (rp !== vp) problems.push(`${loc}."${key}": placeholders ${vp || '(none)'} != English ${rp || '(none)'}`);
  }

  for (const key of Object.keys(t)) {
    if (!(key in table[REF])) problems.push(`${loc}: extra key "${key}" not present in English`);
  }
}

const locales = Object.keys(table);
if (problems.length) {
  console.error(`i18n-check: FAIL — ${problems.length} problem(s) across ${locales.length} locales`);
  for (const p of problems.slice(0, 40)) console.error('  - ' + p);
  if (problems.length > 40) console.error(`  ... and ${problems.length - 40} more`);
  process.exit(1);
}
console.log(`i18n-check: OK — ${locales.length} locales (${locales.join(', ')}), ${refKeys.length} keys, placeholders and plural categories consistent`);

#!/usr/bin/env node
// ============================================================================
// Locale integrity checker.
//
// Architecture: ENGLISH is the only locale inside index.html — it is the reference table and
// the runtime fallback. Every other language is a pure-JSON file in locales/<lang>.json,
// fetched at boot and merged over English. That split exists because locale tables used to be
// JavaScript (340 arrow functions), which made them un-checkable, un-translatable by
// non-programmers, and impossible to move out of the 15,000-line index.html.
//
// Being data means a machine can verify them. Checks:
//   1. EN PURITY       — the inline reference contains no functions (data only, forever).
//   2. KEY VALIDITY    — every key in a locale file exists in English (no dead keys).
//   3. PLACEHOLDERS    — each translated string carries the same {0}..{n} set as English.
//                        A dropped {0} renders a blank where a filename or count belonged.
//   4. PLURAL SHAPE    — plural entries carry exactly the CLDR categories that language uses
//                        (Intl.PluralRules is the authority: en needs one/other, ja only
//                        other, ar six). Matching English's shape is NOT enough.
//   5. COVERAGE        — ja is the founding locale and must stay 100%. Other locales must
//                        cover >= 95% of CORE keys (everything except diagnostics-command
//                        output and legal prose, which fall back to English by design).
//   6. DEAD KEYS       — an English key nothing references is deleted, not translated. Without
//                        this check 212 of them accumulated behind removed features, each one
//                        an eternal translation obligation in 8 locales.
//   7. MISSING KEYS    — the mirror: a key that IS referenced but never defined renders as the
//                        raw key name, because t() falls back to its argument. Check 6 cannot
//                        see these (it only inspects keys that exist), and one hid for months
//                        behind a button no user could reach.
// ============================================================================
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

function extractInline() {
  const start = html.indexOf('const _I = {');
  if (start < 0) throw new Error('i18n-check: could not find `const _I = {` in index.html');
  let depth = 0;
  for (let i = html.indexOf('{', start); i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) return html.slice(html.indexOf('{', start), i + 1); }
  }
  throw new Error('i18n-check: unbalanced braces in _I');
}

const rawInline = extractInline();
if (/=>/.test(rawInline)) {
  console.error('i18n-check: FAIL — the inline English table contains a function (`=>`).');
  console.error('  Locales are pure data. Use a "{0}" placeholder or a plural object.');
  process.exit(1);
}
let EN;
try { EN = (0, eval)('(' + rawInline + ')').en; }
catch (e) { console.error('i18n-check: FAIL — inline table not valid data: ' + e.message); process.exit(1); }
if (!EN) { console.error('i18n-check: FAIL — no `en` table found inline'); process.exit(1); }

// CORE = what a normal user sees. Diagnostics command dumps and legal prose intentionally
// fall back to English, so they do not count against a locale's coverage.
const isDiag = (k) => /^(sec|stats|cmd|uptime|net[A-Z]|peer[A-Z]|debug|perf|whoami|storage|kt[A-Z])/.test(k);
const isLegal = (k) => /^(terms|privacy|legal|tosBody|privacyBody)/.test(k);
const refKeys = Object.keys(EN);
const coreKeys = refKeys.filter((k) => !isDiag(k) && !isLegal(k));

const placeholders = (s) => [...new Set((s.match(/\{(\d+)\}/g) || []))].sort().join(',');
const categoriesFor = (loc) => {
  const pr = new Intl.PluralRules(loc);
  return new Set([0, 1, 2, 3, 5, 11, 21, 101, 1.5].map((n) => pr.select(n)));
};

const localeFiles = readdirSync(join(ROOT, 'locales')).filter((f) => f.endsWith('.json'));
const problems = [];
const summary = [];

for (const file of localeFiles) {
  const loc = file.replace(/\.json$/, '');
  let T;
  try { T = JSON.parse(readFileSync(join(ROOT, 'locales', file), 'utf8')); }
  catch (e) { problems.push(`${loc}: not valid JSON — ${e.message}`); continue; }

  const cats = categoriesFor(loc);
  for (const [key, v] of Object.entries(T)) {
    const rv = EN[key];
    if (rv === undefined) { problems.push(`${loc}: dead key "${key}" (not in English)`); continue; }
    const rIsPlural = rv && typeof rv === 'object';
    const vIsPlural = v && typeof v === 'object';
    if (rIsPlural !== vIsPlural) {
      problems.push(`${loc}."${key}": ${vIsPlural ? 'is' : 'is not'} a plural object but English ${rIsPlural ? 'is' : 'is not'}`);
      continue;
    }
    if (vIsPlural) {
      for (const cat of cats) if (v[cat] === undefined) problems.push(`${loc}."${key}": missing plural category "${cat}"`);
      for (const cat of Object.keys(v)) {
        if (!cats.has(cat)) problems.push(`${loc}."${key}": unused plural category "${cat}"`);
        if (typeof v[cat] !== 'string') problems.push(`${loc}."${key}.${cat}": not a string`);
      }
      const refPh = placeholders(Object.values(rv).join(''));
      const vPh = placeholders(Object.values(v).filter((x) => typeof x === 'string').join(''));
      if (refPh !== vPh) problems.push(`${loc}."${key}": placeholders ${vPh || '(none)'} != English ${refPh || '(none)'}`);
      continue;
    }
    if (typeof v !== 'string') { problems.push(`${loc}."${key}": not a string`); continue; }
    if (placeholders(rv) !== placeholders(v)) {
      problems.push(`${loc}."${key}": placeholders ${placeholders(v) || '(none)'} != English ${placeholders(rv) || '(none)'}`);
    }
  }

  const coveredCore = coreKeys.filter((k) => T[k] !== undefined).length;
  const corePct = Math.round((coveredCore / coreKeys.length) * 100);
  const totalPct = Math.round((Object.keys(T).filter((k) => EN[k] !== undefined).length / refKeys.length) * 100);
  summary.push(`${loc}: ${corePct}% core (${coveredCore}/${coreKeys.length}), ${totalPct}% total`);

  if (loc === 'ja') {
    for (const k of refKeys) if (T[k] === undefined) problems.push(`ja: missing key "${k}" (ja must stay 100%)`);
  } else if (corePct < 95) {
    problems.push(`${loc}: core coverage ${corePct}% is below the 95% floor`);
  }
}

// 6. DEAD KEYS — an English key that nothing in index.html references is pure rot: it costs a
//    translation obligation in every locale forever and labels a feature that no longer exists.
//    212 of them had accumulated behind deleted commands before this check existed, and the
//    only reason anyone noticed was a manual first-principles inventory. Now it is mechanical.
//    A key counts as referenced if its identifier appears anywhere in index.html besides its
//    own definition line — t('k'), data-i18n="k", or a computed `const key = cond ? 'a' : 'b'`
//    all leave the bare identifier in the source, so a single textual occurrence means dead.
const KEY_RE = (k) => new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
const deadKeys = refKeys.filter((k) => (html.match(KEY_RE(k)) || []).length <= 1);
for (const k of deadKeys) problems.push(`EN."${k}": defined but never referenced (dead key — delete it)`);

// 7. MISSING KEYS — the mirror of check 6, and the more visible failure of the two: `t()`
//    falls back to the key itself, so an undefined key renders as raw "addAccountBtn" in the
//    UI. That exact key sat referenced-but-undefined behind an unreachable button until it
//    was reached, and check 6 could not see it — it only looks at keys that exist. Both
//    directions are now covered. Only literal t('...') calls are checked; a computed key
//    cannot be resolved statically and is out of scope by design.
const referenced = new Set([...html.matchAll(/\bt\(\s*'([A-Za-z][A-Za-z0-9_]*)'/g)].map((m) => m[1]));
for (const el of html.matchAll(/data-i18n(?:-ph|-aria|-title|-html)?="([A-Za-z][A-Za-z0-9_]*)"/g)) {
  referenced.add(el[1]);
}
const known = new Set(refKeys);
for (const k of [...referenced].sort()) {
  if (!known.has(k)) problems.push(`t("${k}") is used but not defined in the EN table (renders as the raw key)`);
}

if (problems.length) {
  console.error(`i18n-check: FAIL — ${problems.length} problem(s)`);
  for (const p of problems.slice(0, 40)) console.error('  - ' + p);
  if (problems.length > 40) console.error(`  ... and ${problems.length - 40} more`);
  process.exit(1);
}
console.log(`i18n-check: OK — inline EN reference (${refKeys.length} keys, pure data) + ${localeFiles.length} locale file(s)`);
for (const s of summary) console.log('  ' + s);

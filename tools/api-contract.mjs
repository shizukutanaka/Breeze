#!/usr/bin/env node
// api-contract.mjs — static gate: every postAPIRaw('/api/x', {...}) call in index.html
// must supply the fields the Worker's handler marks REQUIRED. Catches the bug class this
// session kept finding by hand: onboarding /alias/set without pow, /msg/send with
// payload:'' (empty fails !payload), etc.
//
// Method (conservative — reports only definite violations):
//   1. _worker.js: map `case '/api/x':` → handler fn; scan the handler for guards of the
//      shape `if (!a || !b) return json({...required...|MISSING...}, 400,` and collect
//      the negated identifiers as required fields.
//   2. index.html: for each postAPIRaw('/x', { ... }) with a brace-balanced object
//      literal, collect top-level keys. Calls with `...` spread or a non-literal body are
//      dynamic → skipped (can't prove absence).
//   3. Flag required fields absent from a fully-static body.
//
// Exit 1 on any violation.

import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const client = readFileSync(root + 'index.html', 'utf8');
const worker = readFileSync(root + '_worker.js', 'utf8');

// --- 1. route → handler name ---
const routeToHandler = {};
for (const m of worker.matchAll(/case\s+'\/api\/([a-z0-9/\-_]+)':\s*return await (\w+)\(/g))
  routeToHandler[m[1]] = m[2];

// --- 2. handler → required fields ---
// Function body = from `async function H(` to the next `async function` at column 0.
const fnStarts = [...worker.matchAll(/^async function (\w+)\(/gm)];
const fnBody = {};
for (let i = 0; i < fnStarts.length; i++) {
  const name = fnStarts[i][1];
  const end = i + 1 < fnStarts.length ? fnStarts[i + 1].index : worker.length;
  fnBody[name] = worker.slice(fnStarts[i].index, end);
}
const required = {}; // route → [fields]
for (const [route, fn] of Object.entries(routeToHandler)) {
  const body = fnBody[fn];
  if (!body) continue;
  const req = new Set();
  // `if (...cond...) return json(... 400` where the response says 'required'/'MISSING':
  // collect every bare `!ident` in the condition (skipping `!obj.prop` — a member access
  // negates the OBJECT's field presence, not a top-level body field name).
  for (const m of body.matchAll(/if\s*\(([^)]*)\)\s*(?:\{[^}]*?)?return json\([^)]*(?:required|MISSING)[^)]*400/gs)) {
    for (const id of m[1].matchAll(/!(\w+)(?!\s*[.(])/g)) req.add(id[1]);
  }
  // `if (!x) return` where the message literally names the field as required.
  for (const m of body.matchAll(/if\s*\(!(\w+)\)\s*return json\([^)]*'(\w+) required'[^)]*400/g))
    if (m[2] === m[1]) req.add(m[1]);
  // Default-on ownership auth: a handler whose `*_REQUIRE_AUTH !== 'false'` branch
  // 403s unsigned calls makes {ts, sig} required fields even though no `!field` guard
  // names them. (Only the !== 'false' default-enforced form; the opt-in === 'true'
  // form stays advisory since unsigned still works without the flag.)
  if (/env\.\w+_REQUIRE_AUTH\s*!==\s*'false'/.test(body)) { req.add('ts'); req.add('sig'); }
  if (req.size) required[route] = [...req];
}

// --- 3. client call sites ---
const violations = [];
for (const m of client.matchAll(/postAPIRaw\('([a-z0-9/\-_]+)'\s*,\s*\{/g)) {
  const route = m[1].replace(/^\//, '').replace(/^api\//, '');
  const bodyStart = m.index + m[0].length - 1; // at the '{'
  // Brace-match the object literal.
  let depth = 0, end = -1, hasSpread = false;
  for (let i = bodyStart; i < client.length; i++) {
    const ch = client[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) continue;
  const literal = client.slice(bodyStart, end + 1);
  if (/\.\.\.|\?\s*[^:]*:/.test(literal.split('\n')[0])) hasSpread = true;
  if (literal.includes('...')) hasSpread = true;
  // top-level keys at depth 1: both `key:` and shorthand `key` forms
  const keys = new Set();
  for (const km of literal.matchAll(/([{,])\s*(\w+)\s*(?=[:,}])/g)) {
    let d = 0;
    for (let i = 0; i <= km.index; i++) { // <= counts the '{' that opened this key
      if (literal[i] === '{') d++;
      else if (literal[i] === '}') d--;
    }
    if (d === 1) keys.add(km[2]);
  }
  if (hasSpread) continue; // can't prove a field is absent
  const req = [...(required[route] || [])]; // copy — alternates splice mutates
  // Or-fields: /presence accepts either `id` (single) or `ids` (batch check) — a bare
  // `!id` guard sits after the batch branch's early return, so static extraction can't
  // see the alternation. Supply it here.
  const alternates = { presence: { id: ['ids'] } }[route] || {};
  for (const [need, alts] of Object.entries(alternates))
    if (alts.some(a => keys.has(a))) { const i = req.indexOf(need); if (i >= 0) req.splice(i, 1); }
  for (const f of req)
    if (!keys.has(f))
      violations.push(`  /api/${route} call at index.html offset ${m.index}: missing required field '${f}'`);
}

if (violations.length) {
  console.log('api-contract: client calls missing Worker-required fields:');
  console.log(violations.join('\n'));
  process.exit(1);
}
console.log(`api-contract: OK — ${Object.keys(required).length} routes with required fields; all static call sites comply`);

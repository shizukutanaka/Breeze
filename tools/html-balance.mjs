// ============================================================================
// HTML tag-balance checker for index.html.
//
// HTML has no syntax errors. A stray `</div>` is not rejected by the browser, the
// build, the linter or any test — the parser simply closes whatever element is open
// and carries on, silently re-parenting everything after it.
//
// This is not hypothetical. ONE duplicated `</div>` after the sidebar's contact list
// closed `.msg-layout` ~50 lines early, so `.chat-area` became a sibling of the layout
// box instead of its second column. The whole desktop two-pane layout was gone: the
// sidebar filled the 700px layout box alone, the conversation pane rendered BELOW the
// fold (y=781 on a 1280x800 screen), `#msg-messages` lost the bounded-height ancestor
// that makes `overflow-y: auto` mean anything, so it never scrolled — it grew the page
// instead. That made #scroll-fab dead UI and turned every `scrollTop = scrollHeight`
// auto-scroll into a no-op. 41 validate.sh checks, 798 unit tests and 35 Playwright
// E2E tests all passed against that build, because every element still EXISTED and was
// still clickable — only its position on screen was wrong, and nothing asserted layout.
//
// So the gate is structural, not visual: walk the markup with a tag stack and require
// that every close tag matches the innermost open one. That has no judgement calls and
// no false positives — a `</div>` that closes a `<main>` is always a bug.
//
// <script> and <style> bodies are blanked (line count preserved, so reported line
// numbers stay true) — they contain template literals full of HTML-looking text that
// is not markup. Void elements and self-closing tags are skipped.
// ============================================================================
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

const nl = (s) => '\n'.repeat((s.match(/\n/g) || []).length);
const body = html
  .replace(/<script[\s\S]*?<\/script>/g, (s) => '<script>' + nl(s) + '</script>')
  .replace(/<style[\s\S]*?<\/style>/g, (s) => '<style>' + nl(s) + '</style>')
  .replace(/<!--[\s\S]*?-->/g, nl);

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const lineOf = (idx) => body.slice(0, idx).split('\n').length;

const stack = [];
const problems = [];
for (const m of body.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g)) {
  const [, close, tag, attrs] = m;
  const t = tag.toLowerCase();
  if (VOID.has(t) || attrs.trim().endsWith('/')) continue;
  const line = lineOf(m.index);
  if (!close) { stack.push({ t, line, attrs: attrs.trim().slice(0, 60) }); continue; }
  const top = stack[stack.length - 1];
  if (!top) { problems.push(`index.html:${line}  </${t}> with nothing open — one close tag too many`); continue; }
  if (top.t !== t) problems.push(`index.html:${line}  </${t}> closes <${top.t} ${top.attrs}> opened at index.html:${top.line}`);
  stack.pop();
}
for (const s of stack) problems.push(`index.html:${s.line}  <${s.t} ${s.attrs}> is never closed`);

if (problems.length) {
  console.error(`html-balance: FAIL — ${problems.length} mismatched tag(s)`);
  for (const p of problems) console.error('  - ' + p);
  console.error('  The FIRST mismatch is the real one; the rest cascade from it.');
  console.error('  A close tag that lands on the wrong element silently re-parents the whole subtree after it.');
  process.exit(1);
}
console.log('html-balance: OK — every close tag matches the innermost open element');

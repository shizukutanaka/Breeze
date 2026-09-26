// ============================================================================
// Shared JS-source masker for the validate.sh structural gates.
//
// Replaces the contents of strings, template literals, comments and regex
// literals with spaces (newlines preserved so reported line numbers stay true).
// Brace-matching checkers MUST run against a masked copy: index.html's script
// contains template literals full of HTML braces and significant leading
// whitespace — naive brace counting mis-parses it and produced confidently wrong
// answers twice while the original unreachable-branch bug was being diagnosed.
//
// This used to be TWO hand-maintained copies (closure-boundary.mjs and
// unreachable-branch.mjs) that drifted apart: only one of them masked regex
// literals, so a regex containing an unbalanced brace — `/\}/`, `/[{}]/` —
// corrupted the other's guard-boundary matching and silently disabled its
// check inside that block. One implementation now, same as the inline-mirror
// rule: never keep two copies that can drift.
//
// `/` is ambiguous between division and regex-start without real parsing;
// approximate with the standard heuristic: it starts a regex unless the last
// non-whitespace character scanned so far is an identifier char, digit, `)`,
// `]`, or a closing string delimiter.
// ============================================================================
export function maskJs(src) {
  const out = src.split('');
  const blank = (a, b) => { for (let k = a; k < b && k < out.length; k++) if (out[k] !== '\n') out[k] = ' '; };
  let lastSignificant = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { let j = src.indexOf('\n', i); if (j < 0) j = src.length; blank(i, j); i = j; continue; }
    if (c === '/' && n === '*') { const j = src.indexOf('*/', i + 2); const e = j < 0 ? src.length : j + 2; blank(i, e); i = e; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length) { if (src[j] === '\\') { j += 2; continue; } if (src[j] === c) break; j++; }
      blank(i + 1, j); i = j + 1; lastSignificant = c; continue;
    }
    if (c === '/' && !/[\w$)\]]/.test(lastSignificant)) {
      let j = i + 1, inClass = false;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') { inClass = true; j++; continue; }
        if (src[j] === ']') { inClass = false; j++; continue; }
        if (src[j] === '/' && !inClass) break;
        if (src[j] === '\n') { j = -1; break; } // no literal newline in a regex — not actually a regex, bail
        j++;
      }
      if (j > i) {
        while (/[a-z]/i.test(src[j + 1] || '')) j++; // flags
        blank(i, j + 1); i = j + 1; lastSignificant = '/';
        continue;
      }
    }
    if (!/\s/.test(c)) lastSignificant = c;
    i++;
  }
  return out.join('');
}

// Find `marker` in src, then return the raw text of the balanced {...} block that
// follows it — from the opening brace to its matching close, inclusive.
// The walk runs on the MASKED copy (indices are 1:1 with the raw text) so braces
// inside strings/comments/regexes can't corrupt the depth count: a string value
// like "} trailing" ends a naive walk early and silently truncates whatever table
// the caller was extracting — the failure mode this module exists to prevent.
// Returns null when the marker or its '{' is absent; throws when unbalanced.
export function extractBraceBlock(src, marker) {
  const m = src.indexOf(marker);
  if (m < 0) return null;
  const open = src.indexOf('{', m + marker.length);
  if (open < 0) return null;
  const masked = maskJs(src);
  let depth = 0;
  for (let i = open; i < masked.length; i++) {
    if (masked[i] === '{') depth++;
    else if (masked[i] === '}') { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  throw new Error(`extractBraceBlock: unbalanced braces after "${marker}"`);
}

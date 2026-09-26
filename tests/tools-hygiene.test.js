// The structural gates (html-balance, unreachable-branch, closure-boundary) all
// depend on tools/lib/mask-js.mjs blanking every non-code region correctly.
// These tests pin its contract directly — a mask regression turns a real gate
// into a false positive storm or a silent no-op.
import { describe, it, expect } from 'vitest';
import { maskJs, extractBraceBlock } from '../tools/lib/mask-js.mjs';

const bracesOf = (masked) => masked.replace(/[^{}]/g, '');

describe('maskJs — shared source masker for the structural gates', () => {
  it('blanks string, template and comment contents; preserves newlines and code', () => {
    const src = 'const a = "x{y}\n" // {comment}\n/* {multi\nline} */\nconst t = `tpl{ ${x} }`\n';
    const masked = maskJs(src);
    expect(masked.split('\n').length).toBe(src.split('\n').length); // line count preserved
    expect(masked).not.toContain('comment');
    expect(masked).not.toContain('multi');
    expect(masked).not.toContain('tpl');
    // Template contents — INCLUDING ${} interpolations — are blanked wholesale.
    // That's the documented approximation: index.html templates carry HTML braces
    // that must never reach the brace counter, and the gates accept the resulting
    // blind spot on references inside ${}.
    expect(masked).not.toContain('${x}');
  });

  it('blanks regex contents, including unbalanced braces', () => {
    // `/\}/` inside an if-guard once corrupted guard-boundary matching: the lone }
    // decremented the depth counter and ended the block early. Regex contents must
    // not survive masking.
    const src = "if (ok) { const re = /\\}/; if (inner) { work(); } }";
    const masked = maskJs(src);
    expect(bracesOf(masked)).toBe('{{}}'); // regex's lone } is gone — depth stays true
    expect(masked).not.toContain('\\}');
  });

  it('blanks character-class braces and quantifier braces', () => {
    const src = 'const a = /[{}]/g; const b = /x{2,4}/;';
    const masked = maskJs(src);
    // The whole literal — delimiters included — is blanked.
    expect(masked).not.toContain('/');
    expect(bracesOf(masked)).toBe(''); // no braces survive inside the regexes
  });

  it('does NOT treat division as a regex', () => {
    const src = 'const r = a / b / c; if (r) { run(); }';
    const masked = maskJs(src);
    expect(masked).toContain('a / b / c'); // division untouched
    expect(bracesOf(masked)).toBe('{}');
  });

  it('keeps braces in live code and object literals intact', () => {
    const src = 'if (x) { const o = { a: 1 }; f({ g: /re/ }); }';
    const masked = maskJs(src);
    expect(bracesOf(masked)).toBe('{{}{}}'); // if{ obj{} arg{} } — regex adds none
  });
});

describe('extractBraceBlock — masked balanced-brace extraction (i18n-check)', () => {
  it('returns the full raw block; string braces cannot truncate it', () => {
    // i18n-check's old naive walk ended `const _I = {` early on any lone `}` inside
    // a string value — the EN table truncated, every check ran on a subset.
    const src = 'const _I = { en: { a: "} x", b: "{0}" }, ja: { a: "}" } };';
    expect(extractBraceBlock(src, 'const _I = ')).toBe('{ en: { a: "} x", b: "{0}" }, ja: { a: "}" } }');
  });

  it('returns null on a missing marker and throws on unbalanced braces', () => {
    expect(extractBraceBlock('const x = {a:1};', 'const NOPE = ')).toBeNull();
    expect(() => extractBraceBlock('const x = {a: 1;', 'const x = ')).toThrow(/unbalanced/);
  });
});

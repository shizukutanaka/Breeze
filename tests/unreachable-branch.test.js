// Tests for tools/unreachable-branch.mjs — the gate that flags a platform guard
// nested inside a guard for an incompatible platform. Conditions are extracted by
// paren-matching on masked source, so a guard whose condition contains a CALL or
// nested parens must still be scanned (the earlier `[^)]` regex form skipped all
// 132 such blocks — the exact shape a misplaced-brace regression would recur in).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deadBranches, findGuards, mask } from '../tools/unreachable-branch.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
const liveJs = html.match(/<script>([\s\S]*?)<\/script>/)[1];

describe('unreachable-branch — detection', () => {
  it('flags a capacitor guard nested inside an electron guard', () => {
    const js = `if (PLATFORM === 'electron' && window.breeze) {
      a();
      if (PLATFORM === 'capacitor') { b(); }
    }`;
    const { dead } = deadBranches(js);
    expect(dead.length).toBe(1);
    expect(dead[0].inner.cond).toBe("PLATFORM === 'capacitor'");
  });

  it('flags a platform guard inside a COMPOUND guard (call in condition)', () => {
    // The exact regression the regex form missed: the outer `)` is not the cond's end.
    const js = `if (PLATFORM === 'electron' && readyNow()) {
      if (PLATFORM === 'web') { b(); }
    }`;
    const { dead } = deadBranches(js);
    expect(dead.length).toBe(1);
  });

  it('flags mobile guards inside an electron guard', () => {
    const js = `if (PLATFORM === 'electron') {
      if (IS_IOS) { a(); }
      if (IS_ANDROID) { b(); }
    }`;
    expect(deadBranches(js).dead.length).toBe(2);
  });

  it('does NOT flag mobile guards inside web or capacitor guards', () => {
    const js = `if (PLATFORM === 'web') { if (IS_ANDROID) { a(); } }
      if (PLATFORM === 'capacitor') { if (IS_IOS) { b(); } }`;
    expect(deadBranches(js).dead.length).toBe(0);
  });

  it('does NOT flag a different-platform guard in the else branch', () => {
    const js = `if (PLATFORM === 'electron') { a(); }
      else { if (PLATFORM === 'capacitor') { b(); } }`;
    expect(deadBranches(js).dead.length).toBe(0);
  });

  it('conditions containing string braces/parens stay masked', () => {
    const js = `if (PLATFORM === 'electron') {
      const s = '{)if (PLATFORM === \\'web\\'){';
      if (PLATFORM === 'web') { a(); }
    }`;
    // The inner web guard IS dead (inside electron); the string must not create
    // phantom guards or break brace matching.
    const { dead } = deadBranches(js);
    expect(dead.length).toBe(1);
    expect(findGuards(js).length).toBe(2);
  });
});

describe('unreachable-branch — live file', () => {
  it('index.html has no impossible platform nesting', () => {
    expect(deadBranches(liveJs).dead).toEqual([]);
  });

  it('every platform/mobile `if (...) {` in index.html is scanned', () => {
    // Pin the extractor against the live file: find every `if (` whose masked
    // condition contains a platform token AND whose `)` is followed by `{` —
    // those MUST appear in findGuards. This is the regression the regex form
    // had: nested parens in the condition silently dropped the whole block.
    const masked = mask(liveJs);
    const scanned = new Set(findGuards(liveJs).map((g) => g.start));
    const missed = [];
    for (const m of masked.matchAll(/\bif\s*\(/g)) {
      const openParen = m.index + m[0].length - 1;
      let depth = 0, closeParen = -1;
      for (let k = openParen; k < masked.length; k++) {
        if (masked[k] === '(') depth++;
        else if (masked[k] === ')') { depth--; if (depth === 0) { closeParen = k; break; } }
      }
      if (closeParen < 0) continue;
      if (!/PLATFORM|IS_IOS|IS_ANDROID/.test(masked.slice(openParen, closeParen))) continue;
      let k = closeParen + 1;
      while (masked[k] === ' ' || masked[k] === '\n' || masked[k] === '\t') k++;
      if (masked[k] === '{' && !scanned.has(m.index)) missed.push(liveJs.slice(m.index, m.index + 60));
    }
    expect(missed).toEqual([]);
  });
});

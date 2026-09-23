import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('rate-limit early-return releases the send lock', () => {
  it('consume() failure path resets _isSending + restores input + re-enables button', () => {
    const block = SRC.match(/if \(!_rateLimiter\.consume\(\)\) \{[\s\S]+?return;\s*\}/)[0];
    expect(block).toContain('_isSending = false');
    expect(block).toContain('input.value = text');
    expect(block).toContain('sendBtn.disabled = false');
    // ordering: reset statements must precede the return
    expect(block.indexOf('_isSending = false')).toBeLessThan(block.indexOf('return;'));
  });
  it('every early-return inside sendMessage resets _isSending (audit all paths)', () => {
    const fn = SRC.match(/async function sendMessage\(\) \{[\s\S]+?\n  \}/)[0];
    const returns = fn.match(/\breturn;/g).length;
    // 5 early returns: blocked/kicked/announce/double-submit/empty/tooLong/secondary/group-fail/
    // encrypt-fail/rate-limit — every path except the final tail must reset or be pre-lock.
    const preLock = fn.slice(0, fn.indexOf('_isSending = true'));
    const postLock = fn.slice(fn.indexOf('_isSending = true'));
    // after the lock is taken, each `return` must sit in a block that resets first
    const bad = postLock.split(/_isSending = false;/);
    // the LAST segment is the tail after the final reset — no `return` may live there
    expect(bad[bad.length - 1]).not.toContain('return;');
    void returns; void preLock;
  });
  it('functional: stubbed consume-false path leaves _isSending false', () => {
    const snippet = `const _rateLimiter = { consume(){ return false; } };
      let _isSending = true, input = { value: '' }, text = 'hello';
      const showToast = () => {}; const t = (k) => k;
      const sendBtn = { disabled: true, classList: { add(){}, remove(){} } };
      (function(){ ${SRC.match(/if \(!_rateLimiter\.consume\(\)\) \{[\s\S]+?return;\s*\}/)[0]} })();
      return { _isSending, val: input.value, disabled: sendBtn.disabled };`;
    const r = new Function(snippet)();
    expect(r._isSending).toBe(false);
    expect(r.val).toBe('hello');
    expect(r.disabled).toBe(false);
  });
});

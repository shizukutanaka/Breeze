import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Extract the shipped showToast and drive it against a minimal DOM stub.
const FN = SRC.match(/function showToast\(message, type = 'info', duration = CONFIG\.TOAST_DURATION_MS\) \{[\s\S]+?\n\}/)[0];
const mkDom = () => {
  const mk = () => ({ children: [], childElementCount: 0, classList: { add() {}, remove() {} },
    set textContent(v) { this._t = v; }, get firstElementChild() { return this.children[0]; },
    appendChild(c) { c.parent = this; this.children.push(c); this.childElementCount = this.children.length; },
    remove() { const p = this.parent; const i = p?.children.indexOf(this); if (i >= 0) { p.children.splice(i, 1); p.childElementCount = p.children.length; } } });
  const document = { createElement: mk, body: mk() };
  return document;
};
const drive = (n) => {
  const document = mkDom();
  const sandbox = {
    _toastContainer: null, announceToSR: () => {}, haptic: { success() {}, error() {}, tap() {} },
    document, setTimeout: () => 0, CONFIG: { TOAST_DURATION_MS: 3000, FADE_OUT_MS: 300 },
  };
  const showToast = new Function(...Object.keys(sandbox), `${FN} return showToast;`)(...Object.values(sandbox));
  for (let i = 0; i < n; i++) showToast('t' + i, 'info', 60000);
  return { container: document.body.children[0] };
};

describe('toast concurrency cap', () => {
  it('caps at 5 concurrent toasts under flood', () => {
    const { container } = drive(50);
    expect(container.childElementCount).toBe(5);
  });
  it('evicts oldest first', () => {
    const { container } = drive(7);
    expect(container.children[0]._t).toBe('t2'); // t0,t1 evicted
    expect(container.children[4]._t).toBe('t6');
  });
  it('normal volumes unaffected', () => {
    const { container } = drive(3);
    expect(container.childElementCount).toBe(3);
  });
  it('tripwires: cap shipped in showToast', () => {
    expect(SRC).toContain('while (_toastContainer.childElementCount >= 5)');
    expect(SRC).toContain('_toastContainer.firstElementChild.remove()');
  });
});

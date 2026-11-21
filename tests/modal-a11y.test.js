// D17: overlay modals get role/aria-modal, initial focus, a Tab trap
// and focus restoration from ONE installer watching <body> — the ~30
// hand-rolled overlay sites keep their own open/close wiring and are
// enhanced as they appear. Exercised against a minimal fake DOM (the
// repo's node-harness style): the module only relies on the small
// surface faked here (querySelectorAll, classList, contains, focus,
// addEventListener, getClientRects, MutationObserver via env).
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { enhanceModal, focusableIn, installModalA11y } from '../src/app/modal-a11y.js';

function makeDoc() {
  const doc = { activeElement: null, body: null, contains(n) { return !!doc.body?.contains(n); } };
  return doc;
}
function makeEl(doc, { classes = [], focusable = false, rects = 1 } = {}) {
  const el = {
    nodeType: 1, children: [], parent: null, attrs: {}, listeners: {}, hidden: false, tabIndex: -1,
    classList: { contains: (c) => classes.includes(c) },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'tabindex') this.tabIndex = Number(v); },
    addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); },
    removeEventListener(t, fn) { this.listeners[t] = (this.listeners[t] || []).filter((f) => f !== fn); },
    appendChild(c) { c.parent = this; this.children.push(c); return c; },
    contains(other) { let n = other; while (n) { if (n === this) return true; n = n.parent; } return false; },
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
    querySelectorAll(sel) {
      const out = [];
      const walk = (n) => { for (const c of n.children) { if (matches(c, sel)) out.push(c); walk(c); } };
      walk(this);
      return out;
    },
    getClientRects() { return Array.from({ length: rects }); },
    focus() { doc.activeElement = this; },
    keydown(ev) { for (const fn of [...(this.listeners.keydown || [])]) fn(ev); },
  };
  el.__classes = classes; el.__focusable = focusable;
  return el;
}
function matches(el, sel) {
  if (sel === '.modal') return el.__classes.includes('modal');
  return el.__focusable === true; // the module's FOCUSABLE selector list
}
function makeOverlay(doc, { buttons = 2 } = {}) {
  const overlay = makeEl(doc, { classes: ['overlay'] });
  const modal = makeEl(doc, { classes: ['modal'] });
  const btns = [];
  for (let i = 0; i < buttons; i++) { const b = makeEl(doc, { focusable: true }); modal.appendChild(b); btns.push(b); }
  overlay.appendChild(modal);
  doc.body.appendChild(overlay);
  return { overlay, modal, btns };
}
const tab = (shiftKey = false) => ({ key: 'Tab', shiftKey, preventDefault: vi.fn() });

describe('modal a11y (src/app/modal-a11y.js)', () => {
  it('marks the modal box as an aria-modal dialog and focuses the first control', () => {
    const doc = makeDoc(); doc.body = makeEl(doc);
    const opener = makeEl(doc, { focusable: true }); doc.body.appendChild(opener); opener.focus();
    const { modal, btns } = makeOverlay(doc);
    const release = enhanceModal(doc.body.children[1], doc);
    expect(modal.getAttribute('role')).toBe('dialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
    expect(doc.activeElement).toBe(btns[0]);
    release();
  });

  it('does not steal focus a site already placed inside the modal', () => {
    const doc = makeDoc(); doc.body = makeEl(doc);
    const { overlay, btns } = makeOverlay(doc);
    btns[1].focus();
    enhanceModal(overlay, doc);
    expect(doc.activeElement).toBe(btns[1]);
  });

  it('traps Tab at both ends and recaptures focus that escaped', () => {
    const doc = makeDoc(); doc.body = makeEl(doc);
    const { overlay, btns } = makeOverlay(doc);
    enhanceModal(overlay, doc);
    btns[1].focus();
    let ev = tab(); overlay.keydown(ev);
    expect(doc.activeElement).toBe(btns[0]); // wrapped last -> first
    expect(ev.preventDefault).toHaveBeenCalled();
    ev = tab(true); overlay.keydown(ev);
    expect(doc.activeElement).toBe(btns[1]); // shift+Tab on first -> last
    btns[0].focus();
    ev = tab(); overlay.keydown(ev);
    expect(ev.preventDefault).not.toHaveBeenCalled(); // mid-list Tab is the browser's business
    doc.activeElement = doc.body;
    ev = tab(); overlay.keydown(ev);
    expect(doc.activeElement).toBe(btns[0]); // escaped focus is pulled back in
  });

  it('focuses the modal box itself when it has no focusable control', () => {
    const doc = makeDoc(); doc.body = makeEl(doc);
    const { overlay, modal } = makeOverlay(doc, { buttons: 0 });
    enhanceModal(overlay, doc);
    expect(modal.getAttribute('tabindex')).toBe('-1');
    expect(doc.activeElement).toBe(modal);
    const ev = tab(); overlay.keydown(ev);
    expect(ev.preventDefault).toHaveBeenCalled(); // nowhere to go: Tab stays trapped
  });

  it('restores focus to the opener on release and disarms the trap', () => {
    const doc = makeDoc(); doc.body = makeEl(doc);
    const opener = makeEl(doc, { focusable: true }); doc.body.appendChild(opener); opener.focus();
    const { overlay, btns } = makeOverlay(doc);
    const release = enhanceModal(overlay, doc);
    expect(doc.activeElement).toBe(btns[0]);
    release();
    expect(doc.activeElement).toBe(opener);
    btns[1].focus();
    const ev = tab(); overlay.keydown(ev);
    expect(ev.preventDefault).not.toHaveBeenCalled(); // listener removed
  });

  it('ignores overlays without a .modal and non-element nodes', () => {
    const doc = makeDoc(); doc.body = makeEl(doc);
    const spinner = makeEl(doc, { classes: ['acc-switch-overlay'] });
    doc.body.appendChild(spinner);
    expect(enhanceModal(spinner, doc)).toBeNull();
    expect(spinner.__breezeModalA11y).toBeUndefined();
  });

  it('focusableIn skips hidden and zero-rect controls', () => {
    const doc = makeDoc(); doc.body = makeEl(doc);
    const { modal, btns } = makeOverlay(doc, { buttons: 0 });
    const gone = makeEl(doc, { focusable: true, rects: 0 }); modal.appendChild(gone);
    const hid = makeEl(doc, { focusable: true }); hid.hidden = true; modal.appendChild(hid);
    const ok = makeEl(doc, { focusable: true }); modal.appendChild(ok);
    expect(focusableIn(modal)).toEqual([ok]);
    expect(btns).toHaveLength(0);
  });

  it('installs a body observer that enhances additions and releases removals', () => {
    const doc = makeDoc(); doc.body = makeEl(doc);
    let observer;
    class FakeMO { constructor(cb) { this.cb = cb; observer = this; } observe() {} disconnect() { this.dead = true; } }
    const opener = makeEl(doc, { focusable: true }); doc.body.appendChild(opener); opener.focus();
    const handle = installModalA11y({ document: doc, MutationObserver: FakeMO });
    const { overlay, modal, btns } = makeOverlay(doc);
    observer.cb([{ addedNodes: [overlay], removedNodes: [] }]);
    expect(modal.getAttribute('aria-modal')).toBe('true');
    expect(doc.activeElement).toBe(btns[0]);
    observer.cb([{ addedNodes: [], removedNodes: [overlay] }]);
    expect(doc.activeElement).toBe(opener); // focus handed back on close
    handle.disconnect();
    expect(observer.dead).toBe(true);
  });

  it('degrades to a no-op without a DOM or MutationObserver', () => {
    expect(installModalA11y({ document: null, MutationObserver: null }).disconnect).toBeTypeOf('function');
  });
});

describe('modal a11y wiring', () => {
  it('index.html loads and installs the enhancer in the app-module block', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).toContain("import { installModalA11y } from './src/app/modal-a11y.js'; installModalA11y();");
  });
});

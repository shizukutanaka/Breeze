import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { showContextMenu } from '../src/app/context-menu.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function makeNode() {
  const classes = new Set();
  const attrs = {};
  const children = [];
  const node = {
    className: '',
    textContent: '',
    style: {},
    tabIndex: -1,
    children,
    removed: false,
    focused: false,
    classList: {
      add(...cs) { cs.forEach(c => classes.add(c)); },
      remove(...cs) { cs.forEach(c => classes.delete(c)); },
      contains(c) { return classes.has(c); },
    },
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return attrs[k]; },
    appendChild(child) { children.push(child); return child; },
    querySelector(sel) { return children.find(c => sel === '.ctx-item' && c.className === 'ctx-item') || null; },
    querySelectorAll(sel) { return children.filter(c => sel === '.ctx-item' && c.className === 'ctx-item'); },
    contains(t) { return t === node || children.includes(t); },
    focus() { node.focused = true; },
    click() { node.onclick?.(); },
    remove() { node.removed = true; },
  };
  return node;
}

describe('src/app/context-menu.js — showContextMenu', () => {
  const savedDescriptors = {};
  const setGlobal = (k, value) => {
    if (!(k in savedDescriptors)) {
      savedDescriptors[k] = Object.getOwnPropertyDescriptor(globalThis, k);
    }
    Object.defineProperty(globalThis, k, { value, configurable: true, writable: true });
  };

  afterEach(() => {
    for (const [k, desc] of Object.entries(savedDescriptors)) {
      if (desc === undefined) delete globalThis[k];
      else Object.defineProperty(globalThis, k, desc);
      delete savedDescriptors[k];
    }
  });

  function setup() {
    const menus = [];
    const docListeners = { click: [], keydown: [] };
    setGlobal('window', { innerWidth: 400, innerHeight: 300 });
    setGlobal('requestAnimationFrame', (cb) => { cb(); return 1; });
    setGlobal('document', {
      createElement: () => makeNode(),
      querySelectorAll: () => menus.filter(m => !m.removed),
      addEventListener: (type, fn) => { (docListeners[type] ||= []).push(fn); },
      removeEventListener: (type, fn) => {
        docListeners[type] = (docListeners[type] || []).filter(f => f !== fn);
      },
      body: { appendChild: (el) => { menus.push(el); } },
    });
    return { menus, docListeners };
  }

  it('clamps position to viewport, resolves clicked action, and removes both document listeners', async () => {
    const { menus, docListeners } = setup();
    const p = showContextMenu(999, 999, [
      { label: 'Pin', action: 'pin' },
      '---',
      { label: 'Delete', action: 'del', danger: true },
    ]);
    const menu = menus[0];
    expect(menu.style.left).toBe('240px');
    expect(menu.style.top).toBe('172px');
    expect(menu.children[0].focused).toBe(true);
    expect(menu.children[1].className).toBe('folder-sep');
    expect(menu.children[2].classList.contains('color-r')).toBe(true);
    expect(docListeners.click).toHaveLength(1);
    expect(docListeners.keydown).toHaveLength(1);

    menu.children[2].click();
    expect(await p).toBe('del');
    expect(menu.removed).toBe(true);
    expect(docListeners.click).toHaveLength(0);
    expect(docListeners.keydown).toHaveLength(0);
  });

  it('supports Escape dismissal and ArrowDown/ArrowUp keyboard navigation', async () => {
    const { menus, docListeners } = setup();
    const p = showContextMenu(10, 10, [
      { label: 'A', action: 'a' },
      { label: 'B', action: 'b' },
    ]);
    const menu = menus[0];
    menu.children[0].onkeydown({ key: 'ArrowDown', preventDefault() {} });
    expect(menu.children[1].focused).toBe(true);

    docListeners.keydown[0]({ key: 'Escape' });
    expect(await p).toBeNull();
    expect(menu.removed).toBe(true);
    expect(docListeners.click).toHaveLength(0);
    expect(docListeners.keydown).toHaveLength(0);
  });

  it('wiring: index.html exposes window.__breezeContextMenu and delegates showContextMenu', () => {
    expect(html).toContain("import { showContextMenu as _showContextMenuMod } from './src/app/context-menu.js'; window.__breezeContextMenu = { showContextMenu: _showContextMenuMod };");
    expect(html).toContain('globalThis.__breezeContextMenu?.showContextMenu(x, y, items)');
  });
});

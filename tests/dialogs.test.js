import { describe, it, expect, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const moduleUrl = new URL('../src/app/dialogs.js', import.meta.url);
const moduleExists = existsSync(moduleUrl);
const moduleSrc = moduleExists ? readFileSync(moduleUrl, 'utf8') : '';

function inlineFunction(name) {
  const m = html.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}`));
  expect(m, name).not.toBeNull();
  return m[0];
}

function installDialogDom() {
  const nodes = new Map();
  const node = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, {
      value: '', onclick: null, focus: vi.fn(), select: vi.fn(), addEventListener: vi.fn(),
    });
    return nodes.get(selector);
  };
  const listeners = {};
  const dlg = {
    setAttribute: vi.fn(),
    querySelector: node,
    addEventListener: vi.fn((type, fn) => { listeners[type] = fn; }),
    close: vi.fn(), remove: vi.fn(), showModal: vi.fn(),
    getBoundingClientRect: () => ({ left: 0, right: 100, top: 0, bottom: 100 }),
  };
  const body = { appendChild: vi.fn() };
  vi.stubGlobal('document', { createElement: vi.fn(() => dlg), body });
  return { dlg, node, listeners, body };
}

describe('shared dialog foundation extraction', () => {
  it('ships src/app/dialogs.js and precaches it', () => {
    expect(moduleExists).toBe(true);
    expect(sw).toContain("'/src/app/dialogs.js'");
  });

  it('createDialogs returns the five dialog primitives', async () => {
    expect(moduleExists).toBe(true);
    const { createDialogs } = await import('../src/app/dialogs.js');
    const api = createDialogs({ uid: () => 'id', esc: (s) => String(s), t: (k) => k, safeSetHTML: () => {} });
    for (const key of ['makeDialog', 'showDialog', 'wireDialogDismiss', 'showPrompt', 'showConfirm']) {
      expect(api[key], key).toBeTypeOf('function');
    }
    expect(Object.keys(api).sort()).toEqual(['makeDialog', 'showConfirm', 'showDialog', 'showPrompt', 'wireDialogDismiss']);
  });

  it('the module carries the moved prompt/confirm implementations', () => {
    expect(moduleSrc).toContain('export function createDialogs');
    expect(moduleSrc).toContain('function showPrompt(title, defaultVal = \'\', opts = {})');
    expect(moduleSrc).toContain('function showConfirm(title, opts = {})');
    expect(moduleSrc).toContain('placeholder="${esc(opts.placeholder || \'\')}"');
    expect(moduleSrc).toContain('opts.defaultCancel');
    expect(moduleSrc).toContain("input.addEventListener('keydown', (e) => { if (e.key === 'Enter') close(input.value); });");
  });

  it('loads in an independent module block, so an unrelated app-module failure cannot disable the dialog foundation', () => {
    const blocks = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    const block = blocks.find((b) => b.includes('window.__breezeDialogs'));
    expect(block).toBeTruthy();
    expect(block).toContain("import { createDialogs } from './src/app/dialogs.js';");
    expect(block).not.toContain('p2p-stats.js');
    expect(html).toContain('if (!globalThis.__breezeOfflinePairing || !globalThis.__breezeDialogs) showToast');
  });

  it('index.html bridges the module once and keeps only delegating same-name wrappers', () => {
    expect(html).toContain("import { createDialogs } from './src/app/dialogs.js';");
    expect(html).toContain('window.__breezeDialogs = { createDialogs };');
    expect(html.match(/function _makeDialog\(/g)).toHaveLength(1);
    expect(html.match(/function _showDialog\(/g)).toHaveLength(1);
    expect(html.match(/function _wireDialogDismiss\(/g)).toHaveLength(1);
    expect(html.match(/function showPrompt\(/g)).toHaveLength(1);
    expect(html.match(/function showConfirm\(/g)).toHaveLength(1);
    expect(inlineFunction('_makeDialog')).toContain('_dialogs.makeDialog()');
    expect(inlineFunction('_makeDialog')).toContain("dlg.setAttribute('aria-labelledby', titleId)");
    expect(inlineFunction('_showDialog')).toContain('_dialogs.showDialog(dlg)');
    expect(inlineFunction('_showDialog')).toContain('document.body.appendChild(dlg)');
    expect(inlineFunction('_wireDialogDismiss')).toContain('_dialogs.wireDialogDismiss(dlg, close, cancelVal)');
    expect(inlineFunction('_wireDialogDismiss')).toContain("dlg.addEventListener('close'");
    expect(inlineFunction('showPrompt')).toContain('_dialogs.showPrompt(title, defaultVal, opts)');
    expect(inlineFunction('showPrompt')).toContain('Promise.resolve(null)');
    expect(inlineFunction('showConfirm')).toContain('_dialogs.showConfirm(title, opts)');
    expect(inlineFunction('showConfirm')).toContain('Promise.resolve(false)');
  });

  it('no copy of the old prompt/confirm bodies remains in index.html', () => {
    expect(inlineFunction('showPrompt')).not.toContain('modal-input');
    expect(inlineFunction('showPrompt')).not.toContain('input.select()');
    expect(inlineFunction('showConfirm')).not.toContain('modal-actions');
    expect(inlineFunction('showConfirm')).not.toContain('opts.defaultCancel');
    expect(html).not.toContain('placeholder="${esc(opts.placeholder || \'\')}"');
    expect(html).not.toContain('opts.danger ? \'btn-r\' : \'btn-g\'');
  });

  it('showPrompt resolves the input through the module implementation', async () => {
    const { createDialogs } = await import('../src/app/dialogs.js');
    const dom = installDialogDom();
    const setHTML = vi.fn();
    const api = createDialogs({ uid: () => 'fixed', esc: (s) => String(s), t: (k) => k, safeSetHTML: setHTML });
    const pending = api.showPrompt('Title', 'initial', { placeholder: 'hint' });
    expect(dom.dlg.setAttribute).toHaveBeenCalledWith('aria-labelledby', 'mdl-fixed');
    expect(dom.body.appendChild).toHaveBeenCalledWith(dom.dlg);
    expect(dom.dlg.showModal).toHaveBeenCalledOnce();
    expect(setHTML.mock.calls[0][1]).toContain('value="initial"');
    dom.node('.modal-input').value = 'typed';
    dom.node('[value="ok"]').onclick();
    await expect(pending).resolves.toBe('typed');
    expect(dom.dlg.close).toHaveBeenCalledOnce();
    expect(dom.dlg.remove).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it('dismissal resolves each public cancel value: prompt null, confirm false', async () => {
    const { createDialogs } = await import('../src/app/dialogs.js');
    const dom = installDialogDom();
    const api = createDialogs({ uid: () => 'fixed', esc: (s) => String(s), t: (k) => k, safeSetHTML: vi.fn() });
    const prompt = api.showPrompt('Title');
    dom.node('[value="cancel"]').onclick();
    await expect(prompt).resolves.toBeNull();
    const confirm = api.showConfirm('Sure?');
    dom.node('[value="cancel"]').onclick();
    await expect(confirm).resolves.toBe(false);
    vi.unstubAllGlobals();
  });
});

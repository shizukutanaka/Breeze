// SHARE_PLAN stage 4 step 4 — unified add-contact surface pins.
// All four add paths (invite link, QR scan, @alias, raw key) plus
// group: creation funnel through _dispatchAddInput into the same
// resolveAndAdd the boot landing uses, so validation cannot drift
// between the old prompt and the new panel. These pins hold that
// construction in the deployed file.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('add-contact dialog keyboard submission', () => {
  function form() {
    const nodes = new Map();
    const node = selector => {
      if (!nodes.has(selector)) nodes.set(selector, {
        classList: { remove: vi.fn(), add: vi.fn() }, focus: vi.fn(), appendChild: vi.fn(),
        handlers: {}, value: '', addEventListener(type, fn) { this.handlers[type] = fn; },
      });
      return nodes.get(selector);
    };
    const dlg = { querySelector: node, close: vi.fn(), remove: vi.fn() };
    const dispatch = vi.fn();
    const start = html.indexOf('function _showAddContactPanel(');
    const source = html.slice(start, html.indexOf('async function resolveAndAdd(', start));
    new Function('_makeDialog', 'safeSetHTML', 'esc', 't', '_showDialog', '_wireDialogDismiss', '_deviceScanButton', '_dispatchAddInput', 'shareInvite', source + '\n_showAddContactPanel();')(
      () => [dlg, 'title'], vi.fn(), s => s, s => s, vi.fn(), vi.fn(), vi.fn(), dispatch, vi.fn(),
    );
    return { node, dlg, dispatch };
  }

  it.each([
    ['.add-input', 'peer-key', 'peer-key'],
    ['.add-input', '', ''],
    ['.group-input', ' My group ', 'group:My group'],
  ])('prevents Enter activation of the restored opener: %s %j', (selector, value, expected) => {
    const { node, dlg, dispatch } = form();
    node(selector).value = value;
    const event = { key: 'Enter', preventDefault: vi.fn() };
    node(selector).handlers.keydown(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(dlg.close).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith(expected);
    expect(event.preventDefault.mock.invocationCallOrder[0]).toBeLessThan(dlg.close.mock.invocationCallOrder[0]);
  });

  it('keeps an empty group open and ignores non-submit keys', () => {
    const { node, dlg, dispatch } = form();
    const enter = { key: 'Enter', preventDefault: vi.fn() };
    node('.group-input').handlers.keydown(enter);
    expect(enter.preventDefault).toHaveBeenCalledOnce();
    const letter = { key: 'a', preventDefault: vi.fn() };
    node('.add-input').handlers.keydown(letter);
    expect(letter.preventDefault).not.toHaveBeenCalled();
    expect(dlg.close).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('add-contact surface wiring (deployed inline)', () => {
  it('defines the dispatch and the panel exactly once', () => {
    expect(html.match(/async function _dispatchAddInput\(/g)).toHaveLength(1);
    expect(html.match(/function _showAddContactPanel\(/g)).toHaveLength(1);
  });

  it('the dispatch preserves the group shortcut and the invite-URL extraction', () => {
    const start = html.indexOf('async function _dispatchAddInput(');
    const body = html.slice(start, start + 600);
    expect(body).toContain("input.startsWith('group:')");
    expect(body).toContain('createGroup(');
    expect(body).toContain('?add=');
    expect(body).toContain('await resolveAndAdd(');
  });

  it('the panel offers typing and QR scan into the same dispatch', () => {
    // The surface is a dialog now (batch-2 fix e) with three choices, so
    // the window covers the whole function instead of its first 1200
    // chars; the claim — typing and QR scan funnel into the same
    // dispatch — is unchanged.
    const start = html.indexOf('function _showAddContactPanel(');
    const body = html.slice(start, html.indexOf('async function resolveAndAdd(', start));
    expect(body).toContain("t('addContactPh')");
    expect(body).toContain("_deviceScanButton('scanQR'");
    expect(body).toContain('_dispatchAddInput(v)');
  });

  it('both entry points open the panel: the + button and /add', () => {
    expect(html).toContain("_DOM.get('b-msg-add')?.addEventListener('click', () => _showAddContactPanel());");
    expect(html).toContain("if (val === '/add') {");
  });

  it('resolveAndAdd keeps the alias transparency audit (validation unchanged)', () => {
    const start = html.indexOf('async function resolveAndAdd(');
    const body = html.slice(start, start + 3600);
    expect(body).toContain("postAPIRaw('/alias/get'");
    expect(body).toContain('_auditKeyTransparency');
    expect(body).toContain('await addContact(pubB64, name, homeHint, alias)');
  });

  it('the new strings exist in English and Japanese', () => {
    for (const key of ['addContactTitle', 'addBtn']) {
      expect(html, `en ${key}`).toContain(key + ':');
    }
    const ja = JSON.parse(readFileSync(new URL('../locales/ja.json', import.meta.url), 'utf8'));
    for (const key of ['addContactTitle', 'addBtn']) {
      expect(typeof ja[key], `ja ${key}`).toBe('string');
    }
  });
});

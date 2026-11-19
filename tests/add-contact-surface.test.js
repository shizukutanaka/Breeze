// SHARE_PLAN stage 4 step 4 — unified add-contact surface pins.
// All four add paths (invite link, QR scan, @alias, raw key) plus
// group: creation funnel through _dispatchAddInput into the same
// resolveAndAdd the boot landing uses, so validation cannot drift
// between the old prompt and the new panel. These pins hold that
// construction in the deployed file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

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
    const start = html.indexOf('function _showAddContactPanel(');
    const body = html.slice(start, start + 1200);
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
    const body = html.slice(start, start + 2600);
    expect(body).toContain("postAPIRaw('/alias/get'");
    expect(body).toContain('_auditKeyTransparency');
    expect(body).toContain('await addContact(pubB64, name, homeHint)');
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

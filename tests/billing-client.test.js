// Operator billing, phase 1 (2026-11-27) — client side: when an added
// relay advertises billing.required, the add flow runs the pass step
// (verify a stored pass, offer the operator's checkout page, accept a
// pass or a payment reference via the one-time claim), and both API
// paths attach the stored pass so gated operations carry it.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const NEW_KEYS = ['billingPaidDesc', 'billingOpenCheckout', 'billingPassPrompt', 'billingPassOk', 'billingPassInvalid', 'billingPassNeeded'];

function extractFunction(name) {
  const start = INDEX.indexOf(`function ${name}(`);
  expect(start, `function ${name} present in index.html`).toBeGreaterThan(-1);
  // Skip the parameter list first: defaults like `opts = {}` would
  // otherwise be mistaken for the body by naive brace counting.
  let parens = 0; let open = -1;
  for (let i = INDEX.indexOf('(', start); i < INDEX.length; i++) {
    if (INDEX[i] === '(') parens++;
    else if (INDEX[i] === ')') { parens--; if (parens === 0) { open = INDEX.indexOf('{', i); break; } }
  }
  expect(open, `body of ${name} found`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = open; i < INDEX.length; i++) {
    if (INDEX[i] === '{') depth++;
    else if (INDEX[i] === '}') { depth--; if (depth === 0) return INDEX.slice(start, i + 1); }
  }
  throw new Error(`unbalanced braces extracting ${name}`);
}

function extractEnglishTable() {
  const start = INDEX.indexOf('const _I = {');
  const open = INDEX.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < INDEX.length; i++) {
    if (INDEX[i] === '{') depth++;
    else if (INDEX[i] === '}') { depth--; if (depth === 0) return (0, eval)(`(${INDEX.slice(open, i + 1)})`).en; }
  }
  throw new Error('unbalanced braces extracting _I');
}

describe('billing: add-flow wiring', () => {
  it('runs the pass flow after addHomeRelay when the relay requires billing', () => {
    const src = extractFunction('_addRelayFlow');
    const addAt = src.indexOf('await addHomeRelay(');
    const flowAt = src.indexOf('await _billingPassFlow(res.url, res.health.billing)');
    expect(addAt).toBeGreaterThan(-1);
    expect(src).toContain('res.health?.billing?.required');
    expect(flowAt).toBeGreaterThan(addAt);
  });

  it('the pass flow checks a stored pass, offers checkout, and claims by payment reference', () => {
    const src = extractFunction('_billingPassFlow');
    expect(src).toContain("'/billing/check'");
    expect(src).toContain("'/billing/claim'");
    expect(src).toContain("window.open(billing.checkoutUrl, '_blank', 'noopener')");
    expect(src).toContain("t('billingPaidDesc')");
    expect(src).toContain("t('billingPassPrompt')");
    expect(src).toContain('_setBillingPass(url, pass)');
  });

  it('both API paths attach the stored pass and surface 402 blocks', () => {
    const relay = extractFunction('postAPIRelay');
    expect(relay).toContain('__breezeBillingPass');
    expect(relay).toContain('__breezeNoteBillingBlock');
    const raw = extractFunction('postAPIRaw');
    expect(raw).toContain('__breezeBillingPass');
    expect(raw).toContain('__breezeNoteBillingBlock');
  });

  it('passes persist in settings (billingPasses), not localStorage', () => {
    expect(INDEX).toContain('billingPasses: {}');
    expect(INDEX).toContain('globalThis.__breezeBillingPass');
    expect(INDEX).not.toContain('brz-billpass');
  });
});

describe('billing: i18n keys', () => {
  it('en + ja hold real text and every locale defines the keys with a matching key set', () => {
    const en = extractEnglishTable();
    const enKeys = Object.keys(en).sort();
    for (const k of NEW_KEYS) expect(typeof en[k], `en.${k}`).toBe('string');
    const files = fs.readdirSync(path.join(ROOT, 'locales')).filter((f) => f.endsWith('.json')).sort();
    expect(files.length).toBeGreaterThan(100);
    for (const file of files) {
      const table = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', file), 'utf8'));
      expect(Object.keys(table).sort(), `${file} key set matches en`).toEqual(enKeys);
      for (const k of NEW_KEYS) expect(typeof table[k], `${file}.${k}`).toBe('string');
      if (file === 'ja.json') for (const k of NEW_KEYS) expect(table[k], `ja.${k} is a real translation`).not.toBe(en[k]);
    }
  });
});

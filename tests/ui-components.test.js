import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// UI/UX unification phase 2 (owner request): badges, text inputs and the
// button variants are components, not per-screen one-offs. These guards pin
// the class contract so a future template cannot reintroduce a parallel
// badge or an input that bypasses the shared base. They are source-structure
// tests in the same style as the other ui-* guards: the deployed artifact is
// one HTML file plus runtime ESM modules, so the class contract lives in
// those sources rather than in a browser-only component tree.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const accountTabsSrc = readFileSync(new URL('../src/app/account-tabs.js', import.meta.url), 'utf8');

const SRC_DIR = fileURLToPath(new URL('../src', import.meta.url));
function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
const srcFiles = walk(SRC_DIR).filter(f => f.endsWith('.js'))
  .map(f => ({ name: f, text: readFileSync(f, 'utf8') }));
const deployedSources = [{ name: 'index.html', text: html }, ...srcFiles];
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));

// Class tokens from both HTML/template attributes (`class="…"`) and DOM
// assignments (`el.className = '…'`). Interpolated template expressions are
// left as inert tokens; whitespace-separated literal class names still scan.
function classTokenLists(source) {
  const out = [];
  for (const m of source.matchAll(/\bclass\s*=\s*(["'])(.*?)\1/gs)) out.push(m[2].split(/\s+/).filter(Boolean));
  for (const m of source.matchAll(/\bclassName\s*=\s*(["'])(.*?)\1/gs)) out.push(m[2].split(/\s+/).filter(Boolean));
  return out;
}
const deployedClassLists = deployedSources.flatMap(({ name, text }) =>
  classTokenLists(text).map(tokens => ({ name, tokens })));

describe('unified badge component', () => {
  it('the three legacy badge class names are gone from index.html and src/', () => {
    for (const { name, text } of deployedSources) {
      expect(text, `${name} must not contain cbadge`).not.toContain('cbadge');
      expect(text, `${name} must not contain acc-badge`).not.toContain('acc-badge');
    }
  });

  it('.bdg is the single badge base class and the standalone .badge class is gone', () => {
    expect(css).toMatch(/^\.bdg\s*\{/m);
    for (const { name, text } of deployedSources) {
      expect(text, `${name} must not reference .badge`).not.toMatch(/\.badge(?![\w-])/);
    }
    expect(deployedClassLists.filter(({ tokens }) => tokens.includes('badge'))).toEqual([]);
    expect(deployedClassLists.some(({ tokens }) => tokens.includes('bdg'))).toBe(true);
  });

  it('row and account badges are modifiers of .bdg, never standalone components', () => {
    for (const modifier of ['bdg-row', 'bdg-count', 'bdg-acc']) {
      expect(deployedClassLists.some(({ tokens }) => tokens.includes(modifier)), `${modifier} is used`).toBe(true);
    }
    expect(html).toContain('class="bdg bdg-row"');
    // the account tab bar lives in src/app/account-tabs.js (modularization)
    expect(accountTabsSrc).toContain("badge.className = 'bdg bdg-acc';");
  });
});

describe('unified text-input component', () => {
  it('.field participates in the shared text-control base rule', () => {
    expect(css).toMatch(/(?:^|[\s,])\.field\s*\{/);
    expect(css).toMatch(/(?:^|[\s,])\.field:focus\s*\{/);
  });

  it('every first-run, search, modal and settings-name input carries .field with its modifier', () => {
    const modifiers = ['setup-input', 'setup-input-alt', 'contact-filter', 'modal-input', 'settings-name-input'];
    for (const modifier of modifiers) {
      const uses = deployedClassLists.filter(({ tokens }) => tokens.includes(modifier));
      expect(uses.length, `${modifier} is used`).toBeGreaterThan(0);
      for (const { name, tokens } of uses) {
        expect(tokens, `${name}: ${tokens.join(' ')}`).toContain('field');
      }
    }
  });
});

describe('tokenised button variants', () => {
  // Collect every simple one-line CSS rule whose selector mentions the class.
  // The dimensional component rules are the scoped ones (.input-bar .tool /
  // .input-bar .send); tiny state rules such as .send.pulse are included too,
  // but cannot satisfy the token requirement by themselves.
  function bodiesFor(className) {
    const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(?:^|\\n)([^\\n{}]*' + escaped + '[^\\n{}]*)\\s*\\{([^{}]*)\\}', 'g');
    return [...css.matchAll(re)].map(m => ({ selector: m[1].trim(), body: m[2] }));
  }
  const measurementToken = /var\(--(?:touch|rad-[\w-]+|fs-[\w-]+)\)/;

  it('.tool, .send, .tab-btn and .folder-tab all use touch/radius/font tokens', () => {
    for (const className of ['.tool', '.send', '.tab-btn', '.folder-tab']) {
      const rules = bodiesFor(className);
      expect(rules.length, `${className} has CSS rules`).toBeGreaterThan(0);
      expect(rules.map(r => r.body).join('\n'), `${className} measurement tokens`).toMatch(measurementToken);
    }
  });
});

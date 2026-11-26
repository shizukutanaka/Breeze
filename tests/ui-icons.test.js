import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { ICON_SHAPES, createIcon, hydrateIcons, icon, iconSlot } from '../src/app/icons.js';

// UI/UX phase 3 guard: action/status glyphs come from one 24x24 stroke-icon
// dictionary. The browser cannot import ESM before first paint, so index.html
// carries a hand-maintained inline mirror; the mirror-drift risk is exactly
// the same shape as the crypto mirrors and is pinned here. These are source-
// structure tests in the style of tests/ui-components.test.js.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
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

function extractInlineIconShapes() {
  const marker = 'const _ICON_SHAPES = Object.freeze(';
  const markerAt = html.indexOf(marker);
  expect(markerAt, 'inline icon mirror marker').toBeGreaterThan(-1);
  const open = html.indexOf('{', markerAt);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = open; i < html.length; i++) {
    const ch = html[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return vm.runInNewContext('(' + html.slice(open, i + 1) + ')');
    }
  }
  throw new Error('unterminated inline icon dictionary');
}

describe('shared icon dictionary', () => {
  it('exposes a stroke-icon family whose shapes carry no presentation attributes', () => {
    expect(Object.keys(ICON_SHAPES).length).toBeGreaterThanOrEqual(25);
    for (const [name, shapes] of Object.entries(ICON_SHAPES)) {
      expect(name, `icon name ${name}`).toMatch(/^[a-z0-9-]+$/);
      expect(shapes, name).toMatch(/<(path|circle|line|polyline|polygon|rect)\b/);
      expect(shapes, name).not.toContain('<svg');
      expect(shapes, name).not.toMatch(/\s(?:fill|stroke|style)=/);
    }
  });

  it('returns SVG strings and sanitizer-safe slots through the component helpers', () => {
    expect(icon('check')).toMatch(/^<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">/);
    expect(icon('check', 'state-ico')).toContain('class="ico state-ico"');
    expect(icon('missing-icon')).toBe('');
    expect(iconSlot('check')).toBe('<span data-icon="check"></span>');
    expect(iconSlot('check', 'state-ico')).toBe('<span data-icon="check" data-icon-class="state-ico"></span>');
  });

  it('creates SVG DOM nodes and hydrates slots without innerHTML', () => {
    const doc = {
      createElementNS(ns, tag) {
        return {
          tag, attrs: {}, childNodes: [],
          setAttribute(k, v) { this.attrs[k] = v; },
          appendChild(child) { this.childNodes.push(child); },
        };
      },
    };
    const svg = createIcon('phone', 'state-ico', doc);
    expect(svg.attrs.class).toBe('ico state-ico');
    expect(svg.attrs.viewBox).toBe('0 0 24 24');
    expect(svg.childNodes).toHaveLength(1);
    expect(svg.childNodes[0].tag).toBe('path');

    let hydrated = null;
    const slot = {
      dataset: { icon: 'x', iconClass: '' }, ownerDocument: doc,
      matches: (sel) => sel === '[data-icon]',
      replaceWith(node) { hydrated = node; }, remove() {},
    };
    expect(hydrateIcons(slot)).toBe(1);
    expect(hydrated?.childNodes).toHaveLength(2);
  });

  it('keeps the inline mirror shapes identical to src/app/icons.js', () => {
    const inline = extractInlineIconShapes();
    expect(Object.keys(inline).sort()).toEqual(Object.keys(ICON_SHAPES).sort());
    for (const [name, shapes] of Object.entries(ICON_SHAPES)) {
      expect(inline[name], `mirror shape ${name}`).toBe(shapes);
    }
  });

  it('uses only dictionary names in static slots and dynamic slot calls', () => {
    const names = new Set(Object.keys(ICON_SHAPES));
    for (const { name, text } of deployedSources) {
      for (const match of text.matchAll(/\bdata-icon="([a-z0-9-]+)"/g)) {
        expect(names.has(match[1]), `${name}: unknown data-icon ${match[1]}`).toBe(true);
      }
      for (const match of text.matchAll(/\biconSlot\('([a-z0-9-]+)'/g)) {
        expect(names.has(match[1]), `${name}: unknown iconSlot ${match[1]}`).toBe(true);
      }
    }
    for (const match of html.matchAll(/\b_iconSlot\('([a-z0-9-]+)'/g)) {
      expect(names.has(match[1]), `index.html: unknown _iconSlot ${match[1]}`).toBe(true);
    }
  });
});

describe('inline SVG duplication is eliminated', () => {
  it('static markup contains icon slots, not inline SVG documents', () => {
    const staticMarkup = html.slice(html.indexOf('<body>'), html.indexOf('<script type="module">'));
    expect(staticMarkup).not.toContain('<svg');
    expect((staticMarkup.match(/\bdata-icon=/g) || []).length).toBeGreaterThanOrEqual(25);
  });

  it('no deployed module bypasses the dictionary with a handwritten SVG document', () => {
    for (const { name, text } of srcFiles) {
      if (name.endsWith('src/app/icons.js')) continue;
      expect(text, `${name} must not handwrite <svg`).not.toContain('<svg');
    }
    // index.html has exactly one SVG writer: the mirrored icon() component.
    expect((html.match(/<svg\s/g) || []).length).toBe(1);
    expect(html).toContain('function _icon(name, extraClass = \'\')');
  });

  it('no SVG shape string is duplicated between different dictionary entries', () => {
    const seen = new Map();
    for (const [name, shapes] of Object.entries(ICON_SHAPES)) {
      expect(seen.has(shapes), `${name} duplicates ${seen.get(shapes)}`).toBe(false);
      seen.set(shapes, name);
    }
  });
});

describe('functional emoji icons are replaced', () => {
  it('theme, close, status-prefix, group-avatar and call controls no longer write emoji glyphs', () => {
    const directGlyphWrite = /\.textContent\s*=\s*['"](?:☀|🌙|✕|📞|🎤|👥|🔐|🔒)['"]/;
    const exactPrefixLiteral = /['"](?:🚫 |📌 |🔇 |👥)['"]/;
    for (const { name, text } of deployedSources) {
      if (name.endsWith('src/app/emoji-picker.js')) continue;
      expect(text, `${name}: direct emoji control glyph`).not.toMatch(directGlyphWrite);
      expect(text, `${name}: exact emoji status/avatar literal`).not.toMatch(exactPrefixLiteral);
    }
  });

  it('the replacement rendering paths are wired through icons with accessible state text', () => {
    expect(html).toContain('function _setThemeIcon(btn)');
    expect(html).toContain('function _statusIcon(name, key)');
    expect(html).toContain("c.isGroup ? _iconSlot('users')");
    expect(html).toContain("_statusIcon('block', 'infoBlocked')");
    expect(html).toContain("_statusIcon('pin', 'infoPinned')");
    expect(html).toContain("_statusIcon('mute', 'infoMuted')");
    expect(readFileSync(new URL('../src/app/call.js', import.meta.url), 'utf8')).toContain("createIcon('phone')");
    expect(readFileSync(new URL('../src/app/group-call.js', import.meta.url), 'utf8')).toContain("createIcon('phone')");
    expect(readFileSync(new URL('../src/app/call-history.js', import.meta.url), 'utf8')).toContain("createIcon('phone')");
    expect(html).toContain('<span class="scroll-count"></span>');
    expect(html).not.toContain("_scrollFab.textContent = '↓'");
  });

  it('safeSetHTML hydrates sanitizer-safe slots after Trusted Types sanitization', () => {
    const fnAt = html.indexOf('function safeSetHTML(el, html)');
    expect(fnAt).toBeGreaterThan(-1);
    const body = html.slice(fnAt, html.indexOf('\n}', fnAt));
    expect(body).toContain('el.innerHTML = _ttPolicy.createHTML(html);');
    expect(body).toContain('_hydrateIcons(el);');
    expect(html).toContain('_hydrateIcons(document);');
  });
});

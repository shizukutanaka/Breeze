import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Accessibility (owner request): text must stay legible for low-vision users.
// Every text color (body / secondary / muted / accent green / danger red) is
// checked against every background it can sit on — the page background and
// the three translucent surfaces composited over it — in BOTH themes, using
// the real WCAG relative-luminance formula. The 4.5:1 floor is WCAG AA for
// normal text. Values are parsed from index.html at test time, never pinned
// as literals, so a future palette tweak that drops below AA fails here.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const accountTabsSrc = readFileSync(new URL('../src/app/account-tabs.js', import.meta.url), 'utf8');

// Extract the flat declaration block that follows a selector's first '{'
// at or after fromIndex (the auto-theme palette lives inside the
// prefers-color-scheme media block; a prefers-contrast override for the
// same selector sits earlier in the file and must not be picked up).
function blockAfter(selector, fromIndex = 0) {
  const start = html.indexOf(selector, fromIndex);
  expect(start, `selector ${selector}`).toBeGreaterThanOrEqual(0);
  const open = html.indexOf('{', start);
  const close = html.indexOf('}', open);
  return html.slice(open + 1, close);
}

function varsOf(block) {
  const vars = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) vars[m[1]] = m[2].trim();
  return vars;
}

const hex = h => {
  h = h.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const rgba = s => {
  const m = s.match(/rgba?\(([^)]+)\)/);
  const parts = m[1].split(',').map(v => parseFloat(v));
  return { rgb: parts.slice(0, 3), a: parts.length > 3 ? parts[3] : 1 };
};
const over = (fg, a, bg) => fg.map((c, i) => a * c + (1 - a) * bg[i]);
const lum = ([r, g, b]) => {
  const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (c1, c2) => {
  const [hi, lo] = [lum(c1), lum(c2)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
};

// Backgrounds a text color can actually sit on: --bg plus each surface
// (--s1/--s2/--s3 are translucent, so composite them over --bg first).
function backgrounds(vars) {
  const bg = hex(vars['--bg']);
  const out = { '--bg': bg };
  for (const s of ['--s1', '--s2', '--s3']) {
    const { rgb, a } = rgba(vars[s]);
    out[s] = over(rgb, a, bg);
  }
  return out;
}

const THEMES = {
  'dark (:root)': varsOf(blockAfter(':root {')),
  'light (.light)': varsOf(blockAfter('.light {')),
  'light (auto-theme)': varsOf(blockAfter(':root.auto-theme {', html.indexOf('@media (prefers-color-scheme: light)'))),
};
const TEXT_VARS = ['--t1', '--t2', '--t3', '--g', '--r'];
const AA = 4.5;

describe('text contrast (WCAG AA, computed from the shipped CSS)', () => {
  for (const [theme, vars] of Object.entries(THEMES)) {
    describe(theme, () => {
      const bgs = backgrounds(vars);
      for (const name of TEXT_VARS) {
        it(`${name} reaches ${AA}:1 on every background`, () => {
          expect(vars[name], `${theme} ${name} is defined`).toBeTruthy();
          const fg = hex(vars[name]);
          for (const [bgName, bg] of Object.entries(bgs)) {
            const ratio = contrast(fg, bg);
            expect(ratio, `${theme} ${name} ${vars[name]} on ${bgName} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
          }
        });
      }
    });
  }
});

describe('keyboard focus visibility', () => {
  it('a :focus-visible rule draws a solid outline of at least 2px', () => {
    const m = html.match(/:focus-visible\s*\{([^}]*)\}/);
    expect(m, ':focus-visible rule exists').toBeTruthy();
    const outline = m[1].match(/outline:\s*(\d+(?:\.\d+)?)px\s+solid/);
    expect(outline, ':focus-visible declares a solid outline').toBeTruthy();
    expect(parseFloat(outline[1])).toBeGreaterThanOrEqual(2);
  });
});

describe('muted-text size floor', () => {
  it('no rule pairs color: var(--t3) with a font-size below 12px (decorative shortcut badge exempt)', () => {
    const offenders = [];
    for (const m of html.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const [, selector, body] = m;
      if (!/color:\s*var\(--t3\)/.test(body)) continue;
      const size = body.match(/font-size:\s*(\d+(?:\.\d+)?)px/);
      if (size && parseFloat(size[1]) < 12 && !selector.includes('.acc-shortcut')) {
        offenders.push(`${selector.trim()} (${size[1]}px)`);
      }
    }
    expect(offenders, offenders.join('; ')).toEqual([]);
  });

  it('the account-tab shortcut badge is marked decorative (aria-hidden)', () => {
    // the account tab bar lives in src/app/account-tabs.js (modularization)
    expect(accountTabsSrc).toContain("shortcut.setAttribute('aria-hidden', 'true')");
  });
});

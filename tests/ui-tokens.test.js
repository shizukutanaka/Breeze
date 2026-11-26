import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// UI token guard (stage 1): spacing, type scale and the two new radii must be
// defined once in :root, with the migrated CSS consuming the tokens instead of
// restating their literal px values. This test intentionally reads the shipped
// single-file CSS rather than pinning snapshots of individual rules.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
expect(styleMatch, 'index.html contains a <style> block').toBeTruthy();
const css = styleMatch[1];

const rootStart = css.indexOf(':root {');
expect(rootStart, ':root block exists').toBeGreaterThanOrEqual(0);
const rootOpen = css.indexOf('{', rootStart);
const rootEnd = css.indexOf('}', rootOpen);
const rootBlock = css.slice(rootOpen + 1, rootEnd);

function varsOf(block) {
  const vars = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) vars[m[1]] = m[2].trim();
  return vars;
}

function lineOf(index) {
  return css.slice(0, index).split('\n').length;
}

const TOKENS = {
  '--sp-1': '4px',
  '--sp-2': '8px',
  '--sp-3': '12px',
  '--sp-4': '16px',
  '--sp-5': '24px',
  '--sp-6': '32px',
  '--sp-7': '48px',
  '--fs-caption': '12px',
  '--fs-sub': '13px',
  '--fs-body': '15px',
  '--fs-name': '16px',
  '--fs-title': '18px',
  '--fs-display': '22px',
  '--rad-sm': '8px',
  '--rad-bubble': '18px',
};

describe('CSS design tokens', () => {
  it('defines the spacing, font-size and radius tokens in :root', () => {
    const vars = varsOf(rootBlock);
    for (const [token, value] of Object.entries(TOKENS)) {
      expect(vars[token], `${token} is defined`).toBe(value);
    }
  });

  it('keeps every literal font-size at or above the 12px accessibility floor', () => {
    const offenders = [];
    for (const m of css.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px\b/gi)) {
      if (parseFloat(m[1]) < 12) offenders.push(`line ${lineOf(m.index)}: ${m[1]}px`);
    }
    expect(offenders, offenders.join('; ')).toEqual([]);
  });

  it('uses font tokens outside :root instead of repeating migrated literal sizes', () => {
    const migratedSizes = new Set(['12', '13', '15', '16', '18', '22']);
    const offenders = [];
    for (const m of css.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px\b/gi)) {
      const inRoot = m.index >= rootOpen && m.index < rootEnd;
      if (!inRoot && migratedSizes.has(m[1])) offenders.push(`line ${lineOf(m.index)}: ${m[1]}px`);
    }
    expect(offenders, offenders.join('; ')).toEqual([]);
  });
});

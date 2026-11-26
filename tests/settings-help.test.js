import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SETTINGS_HELP_MAP } from '../src/app/settings-help.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const panelStart = html.indexOf('function _renderSettingsPanel');
const panelEnd = html.indexOf('function openSettingsView()', panelStart);
const panel = html.slice(panelStart, panelEnd);

function inlineEnglish() {
  const start = html.indexOf('const _I = {');
  let depth = 0, raw = '';
  for (let i = html.indexOf('{', start); i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { raw = html.slice(html.indexOf('{', start), i + 1); break; } }
  }
  return (0, eval)('(' + raw + ')').en;
}

describe('settings help coverage', () => {
  it('covers every data-setting control rendered in the settings panel', () => {
    const rendered = [...panel.matchAll(/data-setting="([^"]+)"/g)].map((m) => m[1]).sort();
    expect(rendered.length).toBe(20);
    expect([...new Set(rendered)].sort()).toEqual(Object.keys(SETTINGS_HELP_MAP.settings).sort());
  });

  it('covers every labeled action button rendered in the settings panel', () => {
    const rendered = [...new Set([...panel.matchAll(/data-action="([^"]+)"/g)].map((m) => m[1]))].sort();
    expect(rendered).toEqual(Object.keys(SETTINGS_HELP_MAP.actions).sort());
    expect(rendered).toContain('autobackup-arm');
    expect(rendered).toContain('remove-relay');
  });

  it('is wired as a precached module and installed with the dialog deps', () => {
    expect(html).toContain("import { installSettingsHelp } from './src/app/settings-help.js'; window.__breezeSettingsHelp = { installSettingsHelp };");
    expect(html).toContain('globalThis.__breezeSettingsHelp?.installSettingsHelp({ t, esc, safeSetHTML, makeDialog:');
    const sw = readFileSync(join(root, 'sw.js'), 'utf8');
    expect(sw).toContain("'/src/app/settings-help.js'");
  });
});

describe('settings help translations', () => {
  const EN = inlineEnglish();
  const helpKeys = [...Object.values(SETTINGS_HELP_MAP.settings), ...Object.values(SETTINGS_HELP_MAP.actions), 'helpBtnLabel'].sort();
  const localeFiles = readdirSync(join(root, 'locales')).filter((f) => f.endsWith('.json')).sort();

  it('defines every description key in the inline English dictionary', () => {
    expect(helpKeys.length).toBe(36);
    for (const key of helpKeys) {
      expect(typeof EN[key], `${key} missing from inline English`).toBe('string');
      expect(EN[key].trim().length, `${key} empty in inline English`).toBeGreaterThan(0);
    }
  });

  it('ships exactly the English key set in all 50 locale JSONs, including every help key', () => {
    expect(localeFiles.length).toBe(50);
    const enKeys = Object.keys(EN).sort();
    for (const file of localeFiles) {
      const T = JSON.parse(readFileSync(join(root, 'locales', file), 'utf8'));
      expect(Object.keys(T).sort(), `${file} key set differs from English`).toEqual(enKeys);
      for (const key of helpKeys) expect(T[key]?.trim().length, `${file}.${key} missing or empty`).toBeGreaterThan(0);
    }
  });

  it('uses real Japanese rather than copying the English descriptions', () => {
    const ja = JSON.parse(readFileSync(join(root, 'locales', 'ja.json'), 'utf8'));
    for (const key of helpKeys) expect(ja[key], `ja.${key} copied English`).not.toBe(EN[key]);
    expect(ja.helpBtnLabel).toBe('この設定の説明を見る');
  });
});

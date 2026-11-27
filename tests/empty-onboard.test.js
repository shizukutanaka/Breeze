// Zero-contact onboarding (mask iteration 39): the first-run empty state is
// onboarding, not a chooser. It gets exactly one primary action — send an
// invite — because add-contact and migrate already have permanent entry points.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const EN_TEXT = 'Your conversations will appear here. Send an invite link to start your first one.';
const JA_TEXT = 'ここに会話が並びます。招待リンクを送って、最初の会話を始めましょう。';

function extractBracedBlock(src, start) {
  const open = src.indexOf('{', start);
  expect(open, `opening brace after offset ${start}`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced braces extracting block');
}

function extractFunction(name) {
  const start = INDEX.indexOf(`function ${name}(`);
  expect(start, `function ${name} present in index.html`).toBeGreaterThan(-1);
  return extractBracedBlock(INDEX, start);
}

function extractEnglishTable() {
  const start = INDEX.indexOf('const _I = {');
  expect(start, 'inline i18n table present').toBeGreaterThan(-1);
  const open = INDEX.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < INDEX.length; i++) {
    if (INDEX[i] === '{') depth++;
    else if (INDEX[i] === '}') {
      depth--;
      if (depth === 0) return (0, eval)(`(${INDEX.slice(open, i + 1)})`).en;
    }
  }
  throw new Error('unbalanced braces extracting _I');
}

function emptyStateBlock() {
  const render = extractFunction('renderContacts');
  const marker = render.indexOf('if (filtered.length === 0) {');
  expect(marker, 'filtered empty-state block present').toBeGreaterThan(-1);
  return extractBracedBlock(render, marker);
}

function finalElseBlock() {
  const empty = emptyStateBlock();
  const at = empty.lastIndexOf('else {');
  expect(at, 'final non-filter empty-state else present').toBeGreaterThan(-1);
  return extractBracedBlock(empty, at);
}

describe('renderContacts zero-contact onboarding', () => {
  it('uses the onboarding copy for zero contacts while retaining uiAddFirst for populated accounts', () => {
    const compact = finalElseBlock().replace(/\s+/g, ' ');
    expect(compact).toContain("text = contacts.length === 0 ? t('emptyOnboard') : t('uiAddFirst');");
  });

  it('offers exactly one primary invite action in the zero-contact case', () => {
    const branch = finalElseBlock();
    const compact = branch.replace(/\s+/g, ' ');
    expect(compact).toContain("{ label: t('btnInviteFriend'), primary: true, onClick: () => shareInvite() }");
    expect((branch.match(/onClick:/g) || []).length).toBe(1);
  });

  it('does not compete with add-contact or migrate actions in the zero-contact branch', () => {
    const branch = finalElseBlock();
    expect(branch).not.toContain('addContactTitle');
    expect(branch).not.toContain('_showAddContactPanel');
    expect(branch).not.toContain('btnMigrateApps');
    expect(branch).not.toContain('showMigratePanel');
  });

  it('leaves the search, unread, groups, and labels empty states intact', () => {
    const empty = emptyStateBlock();
    expect(empty).toContain("t('uiNoMatches'");
    expect(empty).toContain("t('uiAllCaughtUp')");
    expect(empty).toContain("t('uiNoGroups')");
    expect(empty).toContain("t('labelFilterEmpty'");
    expect(empty).toContain("t('labelNoneContacts')");
  });
});

describe('emptyOnboard i18n', () => {
  it('is present with exact en and ja copy', () => {
    const en = extractEnglishTable();
    expect(en.emptyOnboard).toBe(EN_TEXT);
    const ja = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', 'ja.json'), 'utf8'));
    expect(ja.emptyOnboard).toBe(JA_TEXT);
  });

  it('keeps every locale key set exactly equal to the inline en key set', () => {
    const en = extractEnglishTable();
    const enKeys = Object.keys(en).sort();
    const files = fs.readdirSync(path.join(ROOT, 'locales')).filter((f) => f.endsWith('.json')).sort();
    expect(files.length).toBe(107);
    for (const file of files) {
      const table = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', file), 'utf8'));
      expect(Object.keys(table).sort(), `${file} key set matches en`).toEqual(enKeys);
      if (file !== 'ja.json') expect(table.emptyOnboard, `${file} uses the English fallback`).toBe(EN_TEXT);
    }
  });
});

// Server-add invite handoff (mask iteration 37): adding a relay is only
// the means. Immediately after a successful add, the client offers the
// next step — inviting a friend — but only when the share module loaded,
// so a missing module can never strand the user in a dead-end dialog.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const EN_PROMPT = 'Server added. Next, invite a friend so you can start chatting.';
const JA_PROMPT = 'サーバーを追加しました。次に、友だちを招待して会話を始めましょう。';

function extractFunction(name) {
  const start = INDEX.indexOf(`function ${name}(`);
  expect(start, `function ${name} present in index.html`).toBeGreaterThan(-1);
  const open = INDEX.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < INDEX.length; i++) {
    if (INDEX[i] === '{') depth++;
    else if (INDEX[i] === '}') {
      depth--;
      if (depth === 0) return INDEX.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced braces extracting ${name}`);
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

describe('_addRelayFlow invite handoff', () => {
  it('asks whether to invite a friend after the success toast, using the invite button label', () => {
    const src = extractFunction('_addRelayFlow');
    const toastAt = src.indexOf("showToast(t('relayAdded', res.url), 'success');");
    expect(toastAt, 'success toast present').toBeGreaterThan(-1);
    const compact = src.slice(toastAt).replace(/\s+/g, ' ');
    expect(compact).toContain("showConfirm(t('relayAddedInvitePrompt'), { okText: t('btnInviteFriend') })");
  });

  it('calls shareInvite only when the confirm is accepted', () => {
    const src = extractFunction('_addRelayFlow');
    const compact = src.replace(/\s+/g, ' ');
    expect(compact).toMatch(/if \(await showConfirm\(t\('relayAddedInvitePrompt'\), \{ okText: t\('btnInviteFriend'\) \}\)\) \{ await shareInvite\(\); \}/);
  });

  it('gates the prompt on the share module being present', () => {
    const src = extractFunction('_addRelayFlow');
    const compact = src.replace(/\s+/g, ' ');
    const gateAt = compact.indexOf("if (typeof _shareTools !== 'undefined' && _shareTools) {");
    const promptAt = compact.indexOf("showConfirm(t('relayAddedInvitePrompt')");
    expect(gateAt, '_shareTools gate present').toBeGreaterThan(-1);
    expect(promptAt, 'invite prompt present').toBeGreaterThan(gateAt);
  });
});

describe('relayAddedInvitePrompt i18n', () => {
  it('is present with matching key sets in inline en and every locale file', () => {
    const en = extractEnglishTable();
    expect(en.relayAddedInvitePrompt).toBe(EN_PROMPT);
    const enKeys = Object.keys(en).sort();
    const files = fs.readdirSync(path.join(ROOT, 'locales')).filter((f) => f.endsWith('.json')).sort();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const table = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', file), 'utf8'));
      expect(table.relayAddedInvitePrompt, `${file} defines relayAddedInvitePrompt`).toBeDefined();
      expect(Object.keys(table).sort(), `${file} key set matches en`).toEqual(enKeys);
      if (file === 'ja.json') expect(table.relayAddedInvitePrompt).toBe(JA_PROMPT);
      // Backfilled 2026-11-27: every locale now holds a real translation of
      // this first-run path string, so the invariant is "differs from en"
      // (the previous pin froze the introduction state, English everywhere).
      else expect(table.relayAddedInvitePrompt).not.toBe(EN_PROMPT);
    }
  });
});

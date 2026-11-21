// Wave-8 defect fixes (2026-11-22 ledger, third audit S01–S08 + D16 stage 2) —
// wiring pins, following the repo's wave*-defects convention: the client halves
// live inside index.html's monolith closure, which no harness executes whole,
// so these pin the exact source shapes the fixes rely on. Worker behaviour is
// behaviour-tested in tests/worker.test.js / mailbox-*.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
const LOCALES = ['es', 'id', 'ja', 'ko', 'pt-BR', 'th', 'zh-TW'];

describe('S01 — group file/voice sends refuse honestly instead of pretending to send', () => {
  it('_sendFile refuses group chats before anything is rendered or stored', () => {
    const guard = "if (activeContact.isGroup) { showToast(t('groupNoFileVoice'), 'error'); return; }";
    expect(html).toContain(guard);
    const sendFile = html.slice(html.indexOf('async function _sendFile'));
    expect(sendFile.indexOf(guard)).toBeGreaterThan(-1);
    expect(sendFile.indexOf(guard)).toBeLessThan(sendFile.indexOf('appendMsg('));
  });

  it('the voice button refuses group chats before recording starts', () => {
    expect(html).toContain("if (activeContact.isGroup) { showToast(t('groupNoFileVoice'), 'error'); return; }");
    expect(html.split("showToast(t('groupNoFileVoice'), 'error')").length - 1).toBe(3);
  });

  it('the voice onstop path backstops a mid-recording switch to a group', () => {
    expect(html).toContain("if (activeContact?.isGroup) { showToast(t('groupNoFileVoice'), 'error'); return; }");
  });

  it('the refusal label exists in English and every locale', () => {
    expect(html).toContain("groupNoFileVoice: 'Files and voice messages can\\'t be sent in group chats yet',");
    for (const loc of LOCALES) {
      const json = readFileSync(new URL(`../locales/${loc}.json`, import.meta.url), 'utf8');
      expect(json, loc).toContain('"groupNoFileVoice"');
    }
  });

  it('the secondary-device group refusal is unchanged (still checked first)', () => {
    expect(html).toContain("if (activeContact.isGroup && _isSecondaryDevice) { showToast(t('groupPrimaryOnly'), 'error'); return; }");
  });
});

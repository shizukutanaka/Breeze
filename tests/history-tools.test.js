import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHistoryTools } from '../src/app/history-tools.js';
import { createDataPanels } from '../src/app/info-panels.js';
import * as parsers from '../src/app/import-parsers.js';

let D, tools, state, records, downloads;
const file = text => ({ text: async () => text });
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  downloads = [];
  state = { contact: { id: 'alice', name: 'Alice A' }, name: 'Me', alias: 'mine' };
  records = {
    identity: { name: 'Me', alias: 'mine', pubB64: 'PUBLIC', priv: 'SECRET', createdAt: 1 },
    contacts: [state.contact, { id: 'empty', name: 'Empty' }],
    messages: [
      { msgId: 'b', contactId: 'alice', ts: 2000, text: 'second', mine: false },
      { msgId: 'a', contactId: 'alice', ts: 1000, text: 'first', mine: true },
    ],
    audit: [{ type: 'settings' }], settings: { theme: 'dark' },
  };
  D = {
    db: () => ({ objectStoreNames: { contains: () => true } }),
    activeContact: () => state.contact, myName: () => state.name, myAlias: () => state.alias,
    dbGet: vi.fn(async (store, key) => store === 'identity' ? records.identity : store === 'settings' ? records.settings : records.messages.find(m => m.msgId === key)),
    dbGetAll: vi.fn(async store => records[store].slice()),
    dbGetByIndex: vi.fn(async (store, index, id) => records[store].filter(m => m.contactId === id)),
    dbPut: vi.fn(async (store, value) => { if (store === 'messages') records.messages.push(value); return true; }),
    openConversation: vi.fn(), auditLog: vi.fn(),
  };
  vi.stubGlobal('t', (key, ...args) => [key, ...args].join('|'));
  vi.stubGlobal('CONFIG', { VERSION: '3.6.1', MAX_MSG_LENGTH: 10000 });
  vi.stubGlobal('_dbg', vi.fn());
  vi.stubGlobal('showToast', vi.fn());
  vi.stubGlobal('downloadBlob', (blob, name) => downloads.push({ blob, name }));
  vi.stubGlobal('esc', esc);
  vi.stubGlobal('__breezeImportParsers', parsers);
  tools = createHistoryTools(D);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('history tools factory', () => {
  it('routes history and GDPR exports to ciphertext vault backups without reading plaintext', async () => {
    const ciphertext = { vaultBackupV: 1, accounts: [{ snapshot: { marker: { ct: 'ciphertext' } } }] };
    D.vault = { enabled: () => true, backup: vi.fn(async () => ciphertext) };
    expect(await tools.gdprExport()).toEqual(ciphertext);
    await tools.exportChat('/export html'); await tools.exportGdpr();
    expect(downloads).toHaveLength(2);
    expect(await downloads[0].blob.text()).toBe(JSON.stringify(ciphertext));
    expect(D.dbGetAll).not.toHaveBeenCalled();
    expect(D.dbGet).not.toHaveBeenCalled();
  });
  it('exposes an inert-until-called factory contract', () => {
    expect(Object.keys(createHistoryTools({})).sort()).toEqual(['exportChat', 'exportGdpr', 'gdprExport', 'importChat']);
    expect(D.dbGet).not.toHaveBeenCalled();
    expect(D.dbGetAll).not.toHaveBeenCalled();
  });

  it.each(['/export', '/export json', '/export unknown'])('preserves native JSON contents and filename for %s', async command => {
    await tools.exportChat(command);
    expect(downloads[0].name).toBe('breeze-Alice-A-2026-01-15.json');
    expect(downloads[0].blob.type).toBe('application/json');
    expect(await downloads[0].blob.text()).toBe(JSON.stringify({
      version: '3.6.1', contact: 'Alice A', messages: [
        { ts: 1000, text: 'first', mine: true, sender: 'Me' },
        { ts: 2000, text: 'second', mine: false, sender: 'Alice A' },
      ],
    }, null, 2));
    expect(D.auditLog).toHaveBeenCalledWith('settings', 'Export: ' + (command.slice(7).trim() || 'json'));
    expect(showToast).toHaveBeenCalledWith('toastExportedMessagesJSON|2', 'success');
  });

  it('exports all chats without requiring an active contact', async () => {
    state.contact = null;
    await tools.exportChat('/export all');
    expect(downloads[0].name).toBe('breeze-all-2026-01-15.json');
    expect(JSON.parse(await downloads[0].blob.text())).toEqual({
      version: '3.6.1', exportedAt: new Date().toISOString(),
      chats: { 'Alice A': [{ ts: 1000, text: 'first', mine: true }, { ts: 2000, text: 'second', mine: false }] },
    });
    expect(showToast).toHaveBeenCalledWith('toastExportedMessages|2|1', 'success');
  });

  it('preserves CSV quoting, newline handling, ordering and deleted-message filtering', async () => {
    records.messages[0].text = 'say "yes"\nnow';
    records.messages.push({ contactId: 'alice', ts: 3000, text: 'deleted', deleted: true });
    await tools.exportChat('/export csv');
    expect(downloads[0].name).toBe('breeze-Alice-A-2026-01-15.csv');
    expect(downloads[0].blob.type).toBe('text/csv');
    expect(await downloads[0].blob.text()).toBe('csvHeader\n"1970-01-01T00:00:01.000Z","Me","first"\n"1970-01-01T00:00:02.000Z","Alice A","say ""yes"" now"');
    expect(showToast).toHaveBeenCalledWith('toastExportedMessagesCSV|3', 'success');
  });

  it('preserves HTML escaping, sender attribution, file fallback and deleted filtering', async () => {
    state.contact.name = '<Alice>';
    records.messages[0].text = '<script>bad</script>';
    records.messages[0].senderName = '<Sender>';
    records.messages.push({ contactId: 'alice', ts: 3000, text: 'deleted', deleted: true });
    records.messages.push({ contactId: 'alice', ts: 4000, mine: false });
    await tools.exportChat('/export html');
    const html = await downloads[0].blob.text();
    expect(downloads[0].blob.type).toBe('text/html');
    expect(html).toContain('<title>&lt;Alice&gt;</title>');
    expect(html).toContain('<b>&lt;Sender&gt;</b>');
    expect(html).toContain('&lt;script&gt;bad&lt;/script&gt;');
    expect(html).toContain('htmlExportFileLabel');
    expect(html).not.toContain('deleted');
    expect(showToast).toHaveBeenCalledWith('toastExportedMessagesHTML|4', 'success');
  });

  it.each(['json', 'csv', 'html'])('refuses %s export with no contact', async format => {
    state.contact = null;
    await tools.exportChat('/export ' + format);
    expect(showToast).toHaveBeenCalledWith('toastOpenChat', 'error');
    expect(downloads).toEqual([]);
    expect(D.auditLog).not.toHaveBeenCalled();
  });

  it('exports empty histories without introducing content', async () => {
    records.messages = [];
    for (const format of ['json', 'csv', 'html', 'all']) await tools.exportChat('/export ' + format);
    expect(JSON.parse(await downloads[0].blob.text()).messages).toEqual([]);
    expect(await downloads[1].blob.text()).toBe('csvHeader');
    expect(JSON.parse(await downloads[3].blob.text()).chats).toEqual({});
  });

  it('preserves export storage failures as rejections to the command handler', async () => {
    D.dbGetByIndex.mockRejectedValue(new Error('read failed'));
    await expect(tools.exportChat('/export')).rejects.toThrow('read failed');
    expect(downloads).toEqual([]);
  });

  it.each([
    ['LINE', '2024/01/15 Mon\n14:23\tAlice\tHello!'],
    ['WhatsApp', '1/15/24, 2:23 PM - Alice: Hello!'],
    ['Telegram', JSON.stringify({ messages: [{ type: 'message', from: 'Alice', text: 'Hello!', date: '2024-01-15T14:23:00' }] })],
  ])('imports supported %s history and deduplicates on repeat', async (source, text) => {
    await tools.importChat(file(text));
    const imported = records.messages.filter(m => m.imported);
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({ contactId: 'alice', text: 'Hello!', mine: false, senderName: 'Alice' });
    expect(showToast).toHaveBeenCalledWith('toastImported|1|' + source, 'success');
    expect(D.openConversation).toHaveBeenCalledWith(state.contact);
    await tools.importChat(file(text));
    expect(records.messages.filter(m => m.imported)).toHaveLength(1);
    expect(showToast).toHaveBeenLastCalledWith('toastImported|0|' + source, 'success');
  });

  it('reads reassigned contact, name and alias bindings at call time', async () => {
    state.contact = { id: 'bob', name: 'Bob' };
    state.name = 'New Me'; state.alias = 'newalias';
    await tools.importChat(file('2024/01/15 Mon\n14:23\tnewalias\tHello!'));
    expect(records.messages.at(-1)).toMatchObject({ contactId: 'bob', mine: true, senderName: 'New Me' });
    await tools.exportChat('/export');
    expect(JSON.parse(await downloads[0].blob.text())).toMatchObject({ contact: 'Bob', messages: [{ sender: 'New Me' }] });
  });

  it('documents that native export reimport currently imports nothing', async () => {
    await tools.exportChat('/export');
    await tools.importChat(file(await downloads[0].blob.text()));
    expect(D.dbPut).not.toHaveBeenCalled();
    expect(D.openConversation).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenLastCalledWith('toastNoImportMsgs', 'error');
  });

  it('refuses import with no active contact before reading the file', async () => {
    state.contact = null;
    const input = { text: vi.fn() };
    await tools.importChat(input);
    expect(input.text).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('toastOpenChat', 'error');
  });

  it.each(['', 'not a history', '{invalid'])('leaves storage alone for empty or unsupported input %j', async text => {
    await tools.importChat(file(text));
    expect(D.dbPut).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('toastNoImportMsgs', 'error');
  });

  it('leaves import inert when the parser module is absent', async () => {
    vi.stubGlobal('__breezeImportParsers', undefined);
    await tools.importChat(file('2024/01/15 Mon\n14:23\tAlice\tHello!'));
    expect(D.dbPut).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('toastNoImportMsgs', 'error');
  });

  it('retains import error logging and stops before contact updates', async () => {
    D.dbPut.mockRejectedValue(new Error('write failed'));
    await tools.importChat(file('2024/01/15 Mon\n14:23\tAlice\tHello!'));
    expect(_dbg).toHaveBeenCalledWith(expect.any(Error), 'importChat');
    expect(D.openConversation).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('preserves GDPR projection, truncation, audit limit and counters', async () => {
    records.messages[0].text = 'x'.repeat(250);
    records.messages[0].fileData = 'SECRET FILE';
    records.messages[1].voice = 'SECRET VOICE';
    records.audit = Array.from({ length: 1002 }, (_, i) => i);
    const data = await tools.gdprExport();
    expect(data.identity).toEqual({ name: 'Me', alias: 'mine', pubB64: 'PUBLIC', createdAt: 1 });
    expect(data.messages[0].text).toHaveLength(200);
    expect(data.messages[0].hasFile).toBe(true);
    expect(data.messages[1].hasVoice).toBe(true);
    expect(data.auditLog).toEqual(records.audit.slice(-1000));
    expect(data).toMatchObject({ totalMessages: 2, totalContacts: 2, totalFiles: 2, settings: records.settings });
    expect(JSON.stringify(data)).not.toContain('SECRET');
    await tools.exportGdpr();
    expect(downloads[0].name).toBe('breeze-gdpr-export-2026-01-15.json');
    expect(JSON.parse(await downloads[0].blob.text())).toEqual(data);
    expect(D.auditLog).toHaveBeenCalledWith('settings', 'GDPR data export performed');
    expect(showToast).toHaveBeenCalledWith('toastGdprExport|2|2|2', 'success');
  });

  it('preserves empty GDPR exports and absent optional stores', async () => {
    records.identity = null; records.messages = []; records.contacts = [];
    D.db = () => ({ objectStoreNames: { contains: () => false } });
    expect(await tools.gdprExport()).toMatchObject({ identity: null, messages: [], contacts: [], auditLog: [], settings: null, totalMessages: 0, totalContacts: 0, totalFiles: 0 });
  });

  it('retains the newer data-panel API through the single history implementation', async () => {
    const panels = createDataPanels({ gdprExport: tools.gdprExport, runGdpr: tools.exportGdpr });
    expect(await panels.gdprExport()).toEqual(await tools.gdprExport());
    await panels.runGdpr();
    expect(JSON.parse(await downloads[0].blob.text())).toEqual(await tools.gdprExport());
    expect(D.auditLog).toHaveBeenCalledWith('settings', 'GDPR data export performed');
  });

  it('logs GDPR storage errors and does not download or audit success', async () => {
    D.dbGet.mockRejectedValue(new Error('read failed'));
    await tools.exportGdpr();
    expect(_dbg).toHaveBeenCalledWith(expect.any(Error), 'gdprExport');
    expect(showToast).toHaveBeenCalledWith('toastServerError', 'error');
    expect(downloads).toEqual([]);
    expect(D.auditLog).not.toHaveBeenCalled();
  });
});

describe('deployed history tools wiring', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  it('ships the bridge and precaches the module after the existing readiness gate', () => {
    expect(html).toContain("import { createHistoryTools } from './src/app/history-tools.js';");
    expect(html).toContain('window.__breezeHistoryTools = { createHistoryTools };');
    expect(html.indexOf('await _appModulesReady;')).toBeLessThan(html.indexOf('const _historyTools ='));
    expect(readFileSync(new URL('../sw.js', import.meta.url), 'utf8')).toContain("'/src/app/history-tools.js'");
    expect(html).toContain('await exportChat(val);');
    expect(html).toContain('gdprExport: () => _historyTools?.gdprExport(), runGdpr: () => exportGdpr(),');
    expect(html).toContain("_dataPanels?.runGdpr().catch(e2 => _dbg(e2, 'gdpr'))");
  });

  it('instantiates inert fallbacks without touching storage if the module is absent', async () => {
    vi.stubGlobal('__breezeHistoryTools', undefined);
    const start = html.indexOf('  const _historyTools =');
    const end = html.indexOf('  // QR CODE:', start);
    const create = new Function('D', `const { dbGet, dbGetAll, dbGetByIndex, dbPut, openConversation, auditLog } = D;\n${html.slice(start, end)}\nreturn { importChat, exportChat, exportGdpr };`);
    const fallback = create(D);
    await fallback.importChat(file('anything'));
    await fallback.exportChat('/export');
    await fallback.exportGdpr();
    expect(D.dbGet).not.toHaveBeenCalled();
    expect(D.dbGetAll).not.toHaveBeenCalled();
    expect(downloads).toEqual([]);
  });
});

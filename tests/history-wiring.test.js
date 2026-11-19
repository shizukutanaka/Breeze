// SHARE_PLAN stage 4 step 3 — history transfer wiring pins.
// The pure packing/validation logic is unit-tested in
// tests/history-sync.test.js (including the byte-identity round trip).
// These pins hold the deployed wiring to the design: chunks ride the
// self-sync channel, the receiver is gated on the verified device
// registry, and the import never overwrites local records.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

describe('history sync wiring (deployed inline)', () => {
  it('bridges the module and defines the sender/collection once', () => {
    expect(html).toContain("window.__breezeHistory = { chunkHistoryRecords, parseHistoryChunk, planHistoryImport, HISTORY_MAX_CHUNKS }");
    expect(html.match(/async function _sendHistoryTo\(/g)).toHaveLength(1);
    expect(html.match(/async function _collectHistory\(/g)).toHaveLength(1);
  });

  it('the sender encrypts chunks to the device and tags them historySync', () => {
    const start = html.indexOf('async function _sendHistoryTo(');
    const body = html.slice(start, start + 2200);
    expect(body).toContain('encryptFor(packed.chunks[i], devPub)');
    expect(body).toContain('selfSync: true, historySync: true');
    expect(body).toContain('hTid: tid, hIdx: i, hTotal: packed.chunks.length');
    expect(body).toContain('c.isGroup'); // groups excluded in this step
  });

  it('the receiver branch is gated on the verified registry and imports via the module', () => {
    const start = html.indexOf('msg.historySync');
    const body = html.slice(start - 200, start + 2600);
    expect(body).toContain('_myOtherDevices()');
    expect(body).toContain('historySync from non-account device — dropped');
    expect(body).toContain('H.parseHistoryChunk(text)');
    expect(body).toContain('H.planHistoryImport(all, target.id, existing)');
    expect(body).toContain("dbPut('settings', asm, key)"); // chunks survive a reload
  });

  it('the link flow offers the transfer and /history re-offers it', () => {
    expect(html).toContain("if (await showConfirm(t('histSendAsk')))");
    expect(html).toContain("if (val === '/history') {");
  });

  it('the new strings exist in English and Japanese', () => {
    for (const key of ['histSendAsk', 'histSent', 'histEmpty', 'histNoDevices', 'histReceived']) {
      expect(html, `en ${key}`).toContain(key + ':');
    }
    const ja = JSON.parse(readFileSync(new URL('../locales/ja.json', import.meta.url), 'utf8'));
    for (const key of ['histSendAsk', 'histSent', 'histEmpty', 'histNoDevices', 'histReceived']) {
      expect(typeof ja[key], `ja ${key}`).toBe('string');
      expect(ja[key].length, `ja ${key}`).toBeGreaterThan(3);
    }
  });

  it('the service worker precaches the module', () => {
    expect(sw).toContain("'/src/app/history-sync.js'");
  });
});

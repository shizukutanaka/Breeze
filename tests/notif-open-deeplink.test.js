// Notification-tap → conversation deep-link: two gaps left taps dead. (1) sw.js's
// notificationclick default action focused/opened '/' without ever forwarding
// data.contactId (a sha256 pseudonym the worker ships in the push payload).
// (2) index.html's ?open= handler resolved the param with a raw dbGet, which can
// never match a pseudonym. These guards pin both sides of the fixed wiring and
// exercise the REAL _pushContactId extracted from index.html.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname;
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
const sw = readFileSync(join(HERE, '..', 'sw.js'), 'utf8');

function loadPushContactId() {
  const start = html.indexOf('async function _pushContactId');
  const end = html.indexOf('async function _sha256hex', start);
  if (start < 0 || end < 0) throw new Error('_pushContactId not found');
  const contacts = [{ id: 'aliceId1234' }, { id: 'bobId5678' }];
  const dbGetAll = async () => contacts;
  const _dbg = () => {};
  const shaSrc = html.slice(html.indexOf('async function _sha256hex'), html.indexOf('// SENDER KEY')).trim();
  const _sha256hex = new Function('return ' + shaSrc)();
  // _contactHashCache is declared just above the function — include it in the eval.
  const src = 'let _contactHashCache = null;\n' + html.slice(start, end).trim();
  const _pushContactId = new Function('dbGetAll', '_sha256hex', '_dbg', src + '; return _pushContactId;')(dbGetAll, _sha256hex, _dbg);
  return { _pushContactId, _sha256hex };
}

describe('sw.js notificationclick default action deep-links the conversation', () => {
  it('posts open-contact to an existing same-origin client before focusing', () => {
    expect(sw).toContain("client.postMessage({ type: 'open-contact', contactId: data.contactId })");
  });
  it('opens /?open=<contactId> when no window exists (same-origin via safeAppUrl)', () => {
    expect(sw).toContain("'/?open=' + encodeURIComponent(data.contactId)");
    expect(sw).toContain('safeAppUrl(');
  });
});

describe('index.html resolves the pseudonym (not raw dbGet)', () => {
  it('?open= goes through _pushContactId', () => {
    expect(html).toContain('dbGet(\'contacts\', await _pushContactId(String(openId).slice(0, 64))');
  });
  it('the SW open-contact message is handled client-side', () => {
    expect(html).toContain("e.data?.type === 'open-contact' && e.data.contactId");
  });
});

describe('_pushContactId semantics', () => {
  it('resolves a sha256 pseudonym to the real contact id', async () => {
    const { _pushContactId, _sha256hex } = loadPushContactId();
    const pseudo = await _sha256hex('aliceId1234');
    expect(await _pushContactId(pseudo)).toBe('aliceId1234');
  });
  it('a raw id falls through unchanged (legacy payloads)', async () => {
    const { _pushContactId } = loadPushContactId();
    expect(await _pushContactId('bobId5678')).toBe('bobId5678');
  });
  it('an unknown value falls through unchanged (miss → dbGet miss → ignored)', async () => {
    const { _pushContactId } = loadPushContactId();
    expect(await _pushContactId('ffffffffffffffff')).toBe('ffffffffffffffff');
  });
});

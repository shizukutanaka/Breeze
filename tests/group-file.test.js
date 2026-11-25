// D25 wave 9 — group file transfer: wire round-trip, the sanitizer,
// the sender flow against fake deps, the encryptGroupMsg expansion
// measurement the size caps rest on, wiring pins, and the
// server-blindness audit. Follows tests/stickers.test.js conventions.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  GROUP_FILE_DATA_MAX, GROUP_FILE_RAW_MAX, GROUP_FILE_TEXT_MAX,
  sanitizeGroupFile, groupTextForFile, parseGroupFileText, sendGroupFile,
} from '../src/app/group-file.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const LOCALES = ['es', 'id', 'ja', 'ko', 'pt-BR', 'th', 'zh-TW'];

const B64 = (n) => Buffer.alloc(n, 7).toString('base64');
const FILE = { name: 'notes.txt', mime: 'text/plain', data: B64(300) };

describe('group file record sanitizer', () => {
  it('accepts a well-formed record and stamps the 1:1 file shape', () => {
    expect(sanitizeGroupFile(FILE)).toEqual({ type: 'file', ...FILE });
  });

  it('bounds the name, falls back for a missing name and a malformed mime', () => {
    expect(sanitizeGroupFile({ ...FILE, name: 'x'.repeat(300) }).name).toHaveLength(128);
    expect(sanitizeGroupFile({ ...FILE, name: '  ' }).name).toBe('file');
    expect(sanitizeGroupFile({ ...FILE, mime: 'not a mime' }).mime).toBe('application/octet-stream');
    expect(sanitizeGroupFile({ ...FILE, mime: 'image/png' }).mime).toBe('image/png');
  });

  it('rejects empty, malformed or oversized data', () => {
    expect(sanitizeGroupFile({ ...FILE, data: '' })).toBeNull();
    expect(sanitizeGroupFile({ ...FILE, data: 'AB C' })).toBeNull();
    expect(sanitizeGroupFile({ ...FILE, data: 'ABC' })).toBeNull(); // not a multiple of 4
    expect(sanitizeGroupFile({ ...FILE, data: B64(GROUP_FILE_RAW_MAX + 3) })).toBeNull();
    expect(sanitizeGroupFile(null)).toBeNull();
    expect(sanitizeGroupFile('x')).toBeNull();
  });

  it('the caps are mutually consistent (raw <-> base64 <-> wire text)', () => {
    expect(GROUP_FILE_DATA_MAX % 4).toBe(0);
    expect(GROUP_FILE_RAW_MAX).toBe(GROUP_FILE_DATA_MAX * 3 / 4);
    // Worst-case wire: 55 fixed JSON chars + 128-char name + 64-char mime + data.
    expect(GROUP_FILE_TEXT_MAX).toBeGreaterThanOrEqual(55 + 128 + 64 + GROUP_FILE_DATA_MAX);
  });
});

describe('group file wire text', () => {
  it('round-trips through the {gfile} document', () => {
    const wire = groupTextForFile(FILE);
    expect(wire.startsWith('{"gfile":')).toBe(true);
    expect(parseGroupFileText(wire)).toEqual({ type: 'file', ...FILE });
  });

  it('refuses to encode an oversized file and to parse foreign wires', () => {
    expect(groupTextForFile({ ...FILE, data: B64(GROUP_FILE_RAW_MAX + 3) })).toBeNull();
    expect(parseGroupFileText('hello')).toBeNull();
    expect(parseGroupFileText('{"stk":{}}')).toBeNull();
    expect(parseGroupFileText('{"gctl":{"x":1}}')).toBeNull();
    expect(parseGroupFileText('{"gfile":{"name":"a","mime":"text/plain","data":""}}')).toBeNull();
    expect(parseGroupFileText(null)).toBeNull();
  });
});

describe('encryptGroupMsg expansion (the measurement the caps rest on)', () => {
  // Length-faithful replica of the inline encryptGroupMsg: same padding
  // buckets, same arr() JSON encoding, same field set. Key derivation
  // does not affect length, so a zero key stands in for the HKDF output.
  const bucket = (n) => (n <= 256 ? 256 : n <= 1024 ? 1024 : Math.ceil(n / 4096) * 4096);
  async function ciphertextLength(wireText) {
    const raw = new TextEncoder().encode(wireText);
    const padded = new Uint8Array(bucket(raw.length + 2));
    new DataView(padded.buffer).setUint16(0, raw.length);
    padded.set(raw, 2);
    const key = await crypto.subtle.importKey('raw', new Uint8Array(32), { name: 'AES-GCM' }, false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, padded));
    return JSON.stringify({ v: 5, g: true, i: Array.from(iv), d: Array.from(ct), c: 1, ep: 0, cm: Array.from(new Uint8Array(32)) }).length;
  }

  it('a max-size group file stays inside the 256 KB relay payload cap', async () => {
    const wire = groupTextForFile({ name: 'big.bin', mime: 'application/octet-stream', data: B64(GROUP_FILE_RAW_MAX) });
    expect(wire).not.toBeNull();
    const len = await ciphertextLength(wire);
    expect(len).toBeLessThanOrEqual(256 * 1024);
    expect(len).toBeGreaterThan(200 * 1024); // sanity: the measurement is in the modelled range (~249K)
  });

  it('a small file is far below the cap', async () => {
    const len = await ciphertextLength(groupTextForFile(FILE));
    expect(len).toBeLessThan(16 * 1024);
  });
});

describe('sendGroupFile (fake deps)', () => {
  function fakeDeps() {
    const calls = { wires: [], stored: [], appended: [], toasts: [] };
    let ts = 1000;
    const D = {
      compressImage: async (f) => f,
      bufToB64: (ab) => Buffer.from(ab).toString('base64'),
      correctedNow: () => ++ts,
      lastTs: () => 0, setLastTs: () => {},
      myId: () => 'me', myName: () => 'Me',
      sendGroupTransport: async (contact, wire, ts2, msgId, onEncrypted) => { calls.wires.push(wire); await onEncrypted(); return true; },
      dbPut: async (store, rec) => { calls.stored.push([store, rec]); },
      dbGet: async () => null,
      appendMsg: (...a) => { calls.appended.push(a); },
      showToast: (msg, kind) => { calls.toasts.push([msg, kind]); },
      t: (k) => k, renderContacts: () => {}, dbg: () => {},
    };
    return { D, calls };
  }
  const contact = { id: 'g1', isGroup: true, name: 'G', members: [] };
  const mkFile = (bytes, name = 'a.bin', type = 'application/octet-stream') =>
    ({ name, type, arrayBuffer: async () => new Uint8Array(bytes).buffer });

  it('sends through the group transport and stores the sender record as a file', async () => {
    const { D, calls } = fakeDeps();
    await sendGroupFile(D, contact, mkFile([1, 2, 3, 4]));
    expect(calls.wires).toHaveLength(1);
    expect(parseGroupFileText(calls.wires[0])).toEqual({ type: 'file', name: 'a.bin', mime: 'application/octet-stream', data: 'AQIDBA==' });
    const rec = calls.stored.find(([s]) => s === 'messages')?.[1];
    expect(rec.mine).toBe(true);
    expect(JSON.parse(rec.fileData).data).toBe(parseGroupFileText(calls.wires[0]).data);
    expect(calls.appended).toHaveLength(1);
    expect(calls.toasts).toHaveLength(0);
  });

  it('refuses an oversized file honestly and sends nothing', async () => {
    const { D, calls } = fakeDeps();
    await sendGroupFile(D, contact, mkFile(new Array(GROUP_FILE_RAW_MAX + 1).fill(1)));
    expect(calls.wires).toHaveLength(0);
    expect(calls.toasts).toEqual([['groupFileTooLarge', 'error']]);
  });

  it('has no secondary-device refusal of its own (the transport is relay-capable)', () => {
    const src = readFileSync(new URL('../src/app/group-file.js', import.meta.url), 'utf8');
    expect(src).not.toContain('groupPrimaryOnly');
    expect(src).not.toContain('isSecondary');
  });
});

describe('wiring', () => {
  it('the module is bridged and precached', () => {
    expect(html).toContain("from './src/app/group-file.js'; window.__breezeGroupFile = {");
    expect(sw).toContain("'/src/app/group-file.js'");
  });

  it('_sendFile routes groups to the module instead of refusing them', () => {
    const sendFile = html.slice(html.indexOf('async function _sendFile'));
    expect(sendFile).toContain('await GF.sendGroupFile({');
    expect(sendFile.indexOf('await GF.sendGroupFile({')).toBeLessThan(sendFile.indexOf('await _compressImage(file); // v3.6'));
    expect(html).not.toContain('groupNoFileVoice');
  });

  it('the receiver parses {gfile} after stickers, under its own text cap', () => {
    expect(html).toContain("text.startsWith('{\"gfile\":') ? 69312 : 65536");
    expect(html).toContain('globalThis.__breezeGroupFile?.parseGroupFileText(text); if (gf) {');
    const handler = html.slice(html.indexOf('parseGroupStickerText(text)'), html.indexOf('parseGroupFileText(text)'));
    expect(handler.length).toBeGreaterThan(0); // file branch sits after the sticker branch
  });

  it('voice keeps an honest, voice-only refusal in every locale', () => {
    const voiceMod = readFileSync(new URL('../src/app/voice-input.js', import.meta.url), 'utf8');
    expect(html).toContain("groupNoVoice: 'Voice messages can\\'t be sent in group chats yet',");
    expect(voiceMod.split("showToast(t('groupNoVoice'), 'error')").length - 1).toBe(2);
    for (const loc of LOCALES) {
      const json = readFileSync(new URL(`../locales/${loc}.json`, import.meta.url), 'utf8');
      expect(json, loc).toContain('"groupNoVoice"');
      expect(json, loc).toContain('"groupFileTooLarge"');
      expect(json, loc).not.toContain('"groupNoFileVoice"');
    }
    expect(html).toContain('groupFileTooLarge:');
  });

  it('the relay never sees group file content or markers', () => {
    expect(worker).not.toContain('gfile');
    expect(worker).not.toContain('groupTextForFile');
    expect(worker).not.toContain('sanitizeGroupFile');
  });
});

// SHARE_PLAN stage 5 step 5 — stickers: pack format, wire payloads,
// wiring pins, and the server-blindness audit.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CAPS_STICKER, BUILTIN_PACK, sanitizeSticker, sanitizePack, parsePackFile,
  packToFile, buildStickerPayload, parseStickerPayload,
  groupTextForSticker, parseGroupStickerText, stickerLabel, createStickersUI,
} from '../src/app/stickers.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const mod = readFileSync(new URL('../src/app/stickers.js', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

const PNG = 'data:image/png;base64,' + 'A'.repeat(400);

describe('sticker references', () => {
  it('require exactly one of emoji / img', () => {
    expect(sanitizeSticker({ pack: 'p', id: 'a', emoji: '😂' })).toEqual({ pack: 'p', id: 'a', emoji: '😂' });
    expect(sanitizeSticker({ pack: 'p', id: 'a', img: PNG })).toEqual({ pack: 'p', id: 'a', img: PNG });
    expect(sanitizeSticker({ pack: 'p', id: 'a', emoji: '😂', img: PNG })).toBeNull();
    expect(sanitizeSticker({ pack: 'p', id: 'a' })).toBeNull();
    expect(sanitizeSticker({ pack: 'p', id: '', emoji: '😂' })).toBeNull();
  });

  it('reject unsafe or oversized images', () => {
    expect(sanitizeSticker({ pack: 'p', id: 'a', img: 'data:image/svg+xml;base64,AAAA' })).toBeNull();
    expect(sanitizeSticker({ pack: 'p', id: 'a', img: 'https://x/y.png' })).toBeNull();
    expect(sanitizeSticker({ pack: 'p', id: 'a', img: 'data:image/png;base64,' + 'A'.repeat(60000) })).toBeNull();
  });
});

describe('pack files are authorable JSON', () => {
  const pack = { id: 'mine', name: 'My pack', stickers: [{ id: 'wave', img: PNG }, { id: 'joy', emoji: '😂' }] };

  it('round-trips through the file format', () => {
    const text = packToFile(pack);
    expect(JSON.parse(text).format).toBe('breeze-stickers');
    expect(parsePackFile(text)).toEqual(pack);
  });

  it('refuses foreign formats and empty packs', () => {
    expect(parsePackFile('{"format":"other","v":1}')).toBeNull();
    expect(parsePackFile('{"format":"breeze-stickers","v":2,"name":"x","stickers":[{"id":"a","emoji":"😂"}]}')).toBeNull();
    expect(parsePackFile('not json')).toBeNull();
    expect(sanitizePack({ id: 'x', name: 'x', stickers: [] })).toBeNull();
    expect(sanitizePack({ id: 'x', name: 'x', stickers: [{ id: 'a', img: 'https://bad' }] })).toBeNull();
  });

  it('the built-in pack is all emoji', () => {
    expect(BUILTIN_PACK.stickers.length).toBe(12);
    expect(BUILTIN_PACK.stickers.every(s => s.emoji && !s.img)).toBe(true);
  });
});

describe('wire payloads', () => {
  const img = { pack: 'mine', id: 'wave', img: PNG };

  it('1:1 payload round-trips', () => {
    expect(parseStickerPayload(buildStickerPayload(img))).toEqual(img);
    expect(parseStickerPayload('{"type":"voice","v":1}')).toBeNull();
  });

  it('group text round-trips and ordinary text never parses as a sticker', () => {
    const wire = groupTextForSticker(img);
    expect(wire.startsWith('{"stk":')).toBe(true);
    expect(parseGroupStickerText(wire)).toEqual(img);
    expect(parseGroupStickerText('hello')).toBeNull();
    expect(parseGroupStickerText('{"gctl":{"x":1}}')).toBeNull();
    expect(stickerLabel(img)).toBe('🖼️');
    expect(stickerLabel({ emoji: '😂' })).toBe('😂');
  });
});

describe('stage 5 step 5 wiring + server-blindness audit', () => {
  it('the capability is advertised and gates sending', () => {
    expect(html).toContain("const CAPS_STICKER = 'sticker-v1';");
    expect(html).toContain('caps.push(CAPS_STICKER);');
    expect(CAPS_STICKER).toBe('sticker-v1');
  });

  it('the relay never sees sticker content (the flag alone is ferried, like isVoice)', () => {
    expect(worker).not.toContain('sticker-v1');
    expect(worker).not.toContain('sanitizeSticker');
    expect(worker).toContain('if (body.isSticker === true) msg.isSticker = true;');
  });

  it('1:1 stickers ride the voice-style envelope flag; groups ride {stk} text', () => {
    expect(mod).toContain('isSticker: true }, contact.pubB64)');
    expect(html).toContain('if (msg.isSticker) {');
    expect(html).toContain('__breezeStickers?.parseGroupStickerText(text)');
  });

  it('the module is bridged and precached', () => {
    expect(html).toContain("from './src/app/stickers.js';");
    expect(html).toContain('window.__breezeStickersUI = { createStickersUI };');
    expect(sw).toContain("'/src/app/stickers.js'");
  });
});

describe('createStickersUI', () => {
  function makeDeps(overrides = {}) {
    const db = { settings: new Map(), messages: [], contacts: new Map() };
    const sent = [];
    const fanOuts = [];
    const groupSends = [];
    const fallbacks = [];
    const toasts = [];
    let lastSendTs = 1000;
    const contact = overrides.contact ?? { id: 'bob123', pubB64: 'BOBPUB', name: 'Bob' };
    if (contact) db.contacts.set(contact.id, { ...contact });
    const deps = {
      dbGet: async (store, key) => store === 'settings' ? db.settings.get(key) : db.contacts.get(key),
      dbPut: async (store, val, key) => {
        if (store === 'settings') db.settings.set(key, val);
        else if (store === 'messages') db.messages.push(val);
        else if (store === 'contacts') db.contacts.set(val.id, val);
      },
      encryptFor: async (wire, pub) => `enc(${pub}):${wire}`,
      relaySend: async (id, env, pub) => { sent.push({ id, env, pub }); },
      fanOut: (c, wire, ts, extra, sfExtra) => { fanOuts.push({ c, wire, ts, extra, sfExtra }); },
      sendGroupTransport: async (c, wire, ts, msgId, onEnc) => {
        groupSends.push({ c, wire, ts, msgId });
        if (onEnc) await onEnc();
        return true;
      },
      fetchMemberCapsBatch: async () => ({ bob123: [CAPS_STICKER] }),
      sendTextFallback: async (text) => { fallbacks.push(text); },
      showToast: (msg, type) => { toasts.push({ msg, type }); },
      t: (k) => k,
      esc: (s) => String(s),
      safeSetHTML: () => {},
      appendMsg: () => {},
      downloadBlob: () => {},
      imgFromFile: async () => null,
      renderContactsThrottled: () => {},
      playSendSound: () => {},
      hapticSend: () => {},
      makeDialog: () => [null, ''],
      showDialog: () => {},
      wireDialogDismiss: () => {},
      domGet: () => null,
      correctedNow: () => 2000,
      dbg: () => {},
      activeContact: () => contact,
      myId: () => 'alice1',
      myName: () => 'Alice',
      myPubB64: () => 'ALICEPUB',
      lastSendTs: () => lastSendTs,
      setLastSendTs: (v) => { lastSendTs = v; },
      ...overrides,
    };
    return { deps, db, sent, fanOuts, groupSends, fallbacks, toasts, getLastTs: () => lastSendTs };
  }

  it('sends a 1:1 sticker over relaySend(isSticker:true) + fanOut when peer has sticker-v1', async () => {
    const h = makeDeps();
    const ui = createStickersUI(h.deps);
    const ok = await ui.send({ pack: 'mine', id: 'wave', img: PNG });
    expect(ok).toBe(true);
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].env.isSticker).toBe(true);
    expect(h.sent[0].env.ts).toBe(2000);
    expect(h.fanOuts).toHaveLength(1);
    expect(h.db.messages).toHaveLength(1);
    expect(h.db.messages[0].sticker).toEqual({ pack: 'mine', id: 'wave', img: PNG });
    expect(h.getLastTs()).toBe(2000);
  });

  it('falls back to text for emoji stickers and refuses image stickers when 1:1 peer lacks sticker-v1', async () => {
    const h1 = makeDeps({ fetchMemberCapsBatch: async () => ({ bob123: [] }) });
    expect(await createStickersUI(h1.deps).send({ pack: 'builtin', id: 'e0', emoji: '😂' })).toBe(true);
    expect(h1.fallbacks).toEqual(['😂']);
    expect(h1.sent).toHaveLength(0);

    const h2 = makeDeps({ fetchMemberCapsBatch: async () => ({ bob123: [] }) });
    expect(await createStickersUI(h2.deps).send({ pack: 'mine', id: 'wave', img: PNG })).toBe(false);
    expect(h2.toasts).toEqual([{ msg: 'stickersPeerNoCap', type: 'error' }]);
    expect(h2.sent).toHaveLength(0);
  });

  it('gates group stickers on all remote members having sticker-v1', async () => {
    const grpOk = { id: 'g1', isGroup: true, name: 'G', members: [{ id: 'alice1', caps: [] }, { id: 'bob123', caps: [CAPS_STICKER] }] };
    const h1 = makeDeps({ contact: grpOk });
    expect(await createStickersUI(h1.deps).send({ pack: 'mine', id: 'wave', img: PNG })).toBe(true);
    expect(h1.groupSends).toHaveLength(1);
    expect(parseGroupStickerText(h1.groupSends[0].wire)).toEqual({ pack: 'mine', id: 'wave', img: PNG });

    const grpNoCap = { id: 'g1', isGroup: true, name: 'G', members: [{ id: 'alice1', caps: [CAPS_STICKER] }, { id: 'bob123', caps: [] }] };
    const h2 = makeDeps({ contact: grpNoCap });
    expect(await createStickersUI(h2.deps).send({ pack: 'builtin', id: 'e0', emoji: '🔥' })).toBe(true);
    expect(h2.fallbacks).toEqual(['🔥']);

    const h3 = makeDeps({ contact: grpNoCap });
    expect(await createStickersUI(h3.deps).send({ pack: 'mine', id: 'wave', img: PNG })).toBe(false);
    expect(h3.toasts).toEqual([{ msg: 'stickersGroupNoCap', type: 'error' }]);
  });

  it('customPacks filters invalid stored packs', async () => {
    const h = makeDeps();
    h.db.settings.set('stickerPacks', [
      { id: 'mine', name: 'My pack', stickers: [{ id: 'a', emoji: '😂' }] },
      { id: '', name: 'bad', stickers: [] },
      null,
    ]);
    const packs = await createStickersUI(h.deps).customPacks();
    expect(packs).toEqual([{ id: 'mine', name: 'My pack', stickers: [{ id: 'a', emoji: '😂' }] }]);
  });
});

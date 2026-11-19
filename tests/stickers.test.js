// SHARE_PLAN stage 5 step 5 — stickers: pack format, wire payloads,
// wiring pins, and the server-blindness audit.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CAPS_STICKER, BUILTIN_PACK, sanitizeSticker, sanitizePack, parsePackFile,
  packToFile, buildStickerPayload, parseStickerPayload,
  groupTextForSticker, parseGroupStickerText, stickerLabel,
} from '../src/app/stickers.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
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

  it('the relay never sees sticker fields', () => {
    expect(worker).not.toContain('isSticker');
    expect(worker).not.toContain('sticker-v1');
  });

  it('1:1 stickers ride the voice-style envelope flag; groups ride {stk} text', () => {
    expect(html).toContain('isSticker: true }, contact.pubB64)');
    expect(html).toContain('if (msg.isSticker) {');
    expect(html).toContain('__breezeStickers?.parseGroupStickerText(text)');
  });

  it('the module is bridged and precached', () => {
    expect(html).toContain("from './src/app/stickers.js';");
    expect(sw).toContain("'/src/app/stickers.js'");
  });
});

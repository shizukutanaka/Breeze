// Breeze stage 5 step 5 — stickers.
// A sticker is either a big emoji (the built-in pack — nothing to
// transfer, both sides render the same glyph) or a small image from
// a sticker pack. Packs are user-authorable: the pack file format is
// plain JSON (below), importable/exportable as a file, and the app
// can also build a personal pack from images the user picks.
//
// Pack file format (author it in any text editor):
//   { "format": "breeze-stickers", "v": 1, "id": "mypack", "name": "My pack",
//     "stickers": [ { "id": "wave", "img": "data:image/png;base64,...." },
//                   { "id": "joy", "emoji": "😂" } ] }
// Each sticker carries exactly one of `emoji` / `img`. Images are
// data URLs capped at STICKER_IMG_MAX characters: the group receive
// path caps message text at 65,536 chars, and the sticker JSON has
// to fit inside it with room to spare.
//
// Distribution is E2EE like everything else: 1:1 stickers ride a
// dedicated envelope flag with a ratchet-encrypted JSON payload (the
// voice-message pattern), group stickers ride the sender-key text
// channel as a {stk} JSON document. Sending is capability-gated on
// 'sticker-v1' so un-upgraded peers never receive a payload they
// would render as garbage text: for the built-in emoji pack the
// fallback is sending the emoji as a plain message; image stickers
// refuse honestly instead of degrading into a broken file.

export const CAPS_STICKER = 'sticker-v1';
export const STICKER_IMG_MAX = 49152; // data-URL characters
export const STICKER_PACK_MAX = 64;   // stickers per pack
const IMG_RE = /^data:image\/(png|webp|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;

export const BUILTIN_PACK = {
  id: 'builtin', name: 'Emoji',
  stickers: ['😂', '❤️', '👍', '🎉', '😮', '😢', '🙏', '🔥', '👏', '😴', '🤔', '👀']
    .map((emoji, i) => ({ id: 'e' + i, emoji })),
};

export function sanitizeStickerImg(img) {
  if (typeof img !== 'string' || !img || img.length > STICKER_IMG_MAX) return '';
  const m = IMG_RE.exec(img);
  if (!m || m[2].length % 4 !== 0) return '';
  return img;
}

// A sticker reference: exactly one of emoji / img, ids bounded.
export function sanitizeSticker(s) {
  if (!s || typeof s !== 'object') return null;
  const pack = typeof s.pack === 'string' ? s.pack.slice(0, 64) : '';
  const id = typeof s.id === 'string' ? s.id.slice(0, 64) : '';
  if (!id) return null;
  const emoji = typeof s.emoji === 'string' ? s.emoji.slice(0, 16) : '';
  const img = sanitizeStickerImg(s.img);
  if (!!emoji === !!img) return null; // exactly one
  return { pack, id, ...(emoji ? { emoji } : { img }) };
}

export function sanitizePack(p) {
  if (!p || typeof p !== 'object') return null;
  const id = typeof p.id === 'string' ? p.id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48) : '';
  const name = typeof p.name === 'string' ? p.name.trim().slice(0, 48) : '';
  if (!id || !name || !Array.isArray(p.stickers)) return null;
  const stickers = [];
  for (const raw of p.stickers.slice(0, STICKER_PACK_MAX)) {
    const st = sanitizeSticker({ ...raw, pack: id });
    if (st) stickers.push({ id: st.id, ...(st.emoji ? { emoji: st.emoji } : { img: st.img }) });
  }
  if (!stickers.length) return null;
  return { id, name, stickers };
}

export function parsePackFile(text) {
  if (typeof text !== 'string') return null;
  let obj;
  try { obj = JSON.parse(text); } catch { return null; }
  if (!obj || obj.format !== 'breeze-stickers' || obj.v !== 1) return null;
  return sanitizePack(obj);
}

export function packToFile(pack) {
  const clean = sanitizePack(pack);
  if (!clean) return null;
  return JSON.stringify({ format: 'breeze-stickers', v: 1, id: clean.id, name: clean.name, stickers: clean.stickers }, null, 2);
}

// 1:1 wire payload (inside the ratchet ciphertext).
export function buildStickerPayload(sticker) {
  const clean = sanitizeSticker(sticker);
  if (!clean) return null;
  return JSON.stringify({ type: 'sticker', v: 1, ...clean });
}

export function parseStickerPayload(text) {
  if (typeof text !== 'string') return null;
  let obj;
  try { obj = JSON.parse(text); } catch { return null; }
  if (!obj || obj.type !== 'sticker' || obj.v !== 1) return null;
  return sanitizeSticker(obj);
}

// Group wire text (inside the sender-key ciphertext). The {stk}
// marker keeps it distinct from ordinary text and from {gctl}.
export function groupTextForSticker(sticker) {
  const clean = sanitizeSticker(sticker);
  if (!clean) return null;
  return JSON.stringify({ stk: clean });
}

export function parseGroupStickerText(text) {
  if (typeof text !== 'string' || !text.startsWith('{"stk":')) return null;
  let obj;
  try { obj = JSON.parse(text); } catch { return null; }
  if (!obj || typeof obj !== 'object' || !obj.stk) return null;
  return sanitizeSticker(obj.stk);
}

// What the message list / stored record shows as the text stand-in.
export function stickerLabel(sticker) {
  return sticker?.emoji || '🖼️';
}

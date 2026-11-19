// Breeze stage 5 step 4 — E2EE profile distribution.
// A profile (display name, avatar emoji, optional small photo) is
// shared ONLY as a ratchet-encrypted control payload to peers whose
// bundle advertises CAPS_PROFILE — the relay and the prekey bundle
// never see it in plaintext (the bundle carries just the capability
// string), and un-upgraded peers are never sent a payload they would
// render as a chat message. Pure logic; the host wires storage,
// distribution and rendering.
//
// The photo is a downscaled data URL (the host produces 96×96 JPEG,
// ~10-18 KB): big enough to recognize a face, small enough to ride a
// message deposit. Validation here is strict — the value lands in an
// <img src> on the receiving side, so only data:image/jpeg|png with a
// pure base64 body is accepted, length-capped.

export const CAPS_PROFILE = 'profile-v1';
export const PROFILE_NAME_MAX = 64;
export const PROFILE_EMOJI_MAX = 16;
export const PROFILE_IMG_MAX = 32768; // data-URL characters (~24 KB binary)
const IMG_RE = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/;

export function sanitizeProfileImg(img) {
  if (typeof img !== 'string' || !img || img.length > PROFILE_IMG_MAX) return '';
  const m = IMG_RE.exec(img);
  if (!m || m[2].length % 4 !== 0) return '';
  return img;
}

export function sanitizeProfile(p) {
  if (!p || typeof p !== 'object') return null;
  const name = typeof p.name === 'string' ? p.name.trim().slice(0, PROFILE_NAME_MAX) : '';
  if (!name) return null;
  return {
    name,
    emoji: typeof p.emoji === 'string' ? p.emoji.slice(0, PROFILE_EMOJI_MAX) : '',
    img: sanitizeProfileImg(p.img),
  };
}

export function buildProfilePayload(profile, pv) {
  const clean = sanitizeProfile(profile);
  if (!clean || !Number.isFinite(pv) || pv <= 0) return null;
  return JSON.stringify({ type: 'profile', v: 1, pv: Math.floor(pv), ...clean });
}

export function parseProfilePayload(text, now = Date.now()) {
  if (typeof text !== 'string') return null;
  let obj;
  try { obj = JSON.parse(text); } catch { return null; }
  if (!obj || obj.type !== 'profile' || obj.v !== 1) return null;
  if (!Number.isFinite(obj.pv) || obj.pv <= 0 || obj.pv > now + 5 * 60 * 1000) return null; // future-dated beyond clock slack
  const clean = sanitizeProfile(obj);
  if (!clean) return null;
  return { pv: Math.floor(obj.pv), ...clean };
}

// Apply only strictly newer profiles — a replayed or out-of-order
// deposit must not roll a contact's face back.
export function profileNewer(incoming, contact) {
  return !!incoming && incoming.pv > (contact?.profilePv || 0);
}

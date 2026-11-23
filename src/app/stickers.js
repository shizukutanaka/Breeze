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

// Host-side sticker picker, pack manager, and capability-gated send flow
// (stage 5 step 5, moved out of index.html in the line-budget pass — same
// factory pattern as createProfileUI and createLocationShare; pure shapes
// above stay host-agnostic).
export function createStickersUI(D) {
  async function _customStickerPacks() {
    const saved = await D.dbGet('settings', 'stickerPacks').catch(() => null);
    return (Array.isArray(saved) ? saved : []).map(p => sanitizePack(p)).filter(Boolean);
  }

  async function _downscaleSticker(file) {
    const im = await D.imgFromFile(file).catch(() => null);
    if (!im) return null;
    try {
      const scale = Math.min(1, 256 / Math.max(im.width, im.height));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(im.width * scale));
      cv.height = Math.max(1, Math.round(im.height * scale));
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      let out = cv.toDataURL('image/png');
      if (out.length > STICKER_IMG_MAX) out = cv.toDataURL('image/webp', 0.9);
      return out.length <= STICKER_IMG_MAX ? out : null;
    } catch { return null; }
  }

  async function _sendSticker(sticker) {
    const contact = D.activeContact();
    const clean = sanitizeSticker(sticker);
    if (!clean || !contact) return false;
    const label = stickerLabel(clean);
    let ts = D.correctedNow();
    const lastTs = D.lastSendTs();
    if (ts <= lastTs) ts = lastTs + 1;
    D.setLastSendTs(ts);
    const myId = D.myId();
    const myName = D.myName();
    const myPubB64 = D.myPubB64();
    const msgId = myId + ':' + ts;
    if (contact.isGroup) {
      const members = (contact.members || []).filter(m => m.id !== myId);
      if (!members.every(m => (m.caps || []).includes(CAPS_STICKER))) {
        if (clean.emoji) { await D.sendTextFallback(clean.emoji); return true; }
        D.showToast(D.t('stickersGroupNoCap'), 'error'); return false;
      }
      const wire = groupTextForSticker(clean);
      if (!wire) return false;
      const sent = await D.sendGroupTransport(contact, wire, ts, msgId, async () => {
        await D.dbPut('messages', { msgId, contactId: contact.id, text: label, mine: true, ts, sticker: clean, senderName: myName });
        D.appendMsg(label, true, ts, null, null, { msgId, sticker: clean, senderName: myName });
      });
      if (!sent) { D.showToast(D.t('toastSendFail'), 'error'); return false; }
    } else {
      const capsById = await D.fetchMemberCapsBatch([contact.id]);
      if (!(capsById[contact.id] || []).includes(CAPS_STICKER)) {
        if (clean.emoji) { await D.sendTextFallback(clean.emoji); return true; }
        D.showToast(D.t('stickersPeerNoCap'), 'error'); return false;
      }
      const wire = buildStickerPayload(clean);
      const enc = wire && await D.encryptFor(wire, contact.pubB64);
      if (!enc) { D.showToast(D.t('toastSendFail'), 'error'); return false; }
      await D.dbPut('messages', { msgId, contactId: contact.id, text: label, mine: true, ts, sticker: clean });
      D.appendMsg(label, true, ts, null, null, { msgId, sticker: clean });
      await D.relaySend(contact.id, { to: contact.id, from: myId, fromPub: myPubB64, fromName: myName, payload: enc, ts, isSticker: true }, contact.pubB64);
      D.fanOut(contact, wire, ts, { isSticker: true }, { isSticker: true, sfFor: contact.id, sfPub: contact.pubB64, sfName: contact.name });
    }
    contact.lastMsg = label; contact.lastMsgAt = ts;
    const stored = await D.dbGet('contacts', contact.id).catch(() => null);
    if (stored) { stored.lastMsg = label; stored.lastMsgAt = ts; await D.dbPut('contacts', stored); }
    D.renderContactsThrottled();
    D.playSendSound(); D.hapticSend();
    return true;
  }

  let _stickerPanel = null;
  async function _toggleStickerPanel() {
    if (_stickerPanel) { _stickerPanel.remove(); _stickerPanel = null; return; }
    if (!D.activeContact()) return;
    const packs = [BUILTIN_PACK, ...(await _customStickerPacks())];
    const panel = document.createElement('div');
    panel.className = 'emoji-picker';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', D.t('ttStickers'));
    const tabs = document.createElement('div');
    tabs.className = 'emoji-picker-tabs';
    const grid = document.createElement('div');
    grid.className = 'sticker-grid';
    const showPack = (pack) => {
      grid.replaceChildren();
      for (const st of pack.stickers) {
        const cell = document.createElement('button');
        cell.className = 'sticker-cell';
        if (st.img) { const im = document.createElement('img'); im.src = st.img; im.alt = st.id; cell.appendChild(im); }
        else { const sp = document.createElement('span'); sp.className = 'stk-emoji'; sp.textContent = st.emoji; cell.appendChild(sp); }
        cell.onclick = () => { _toggleStickerPanel(); _sendSticker({ pack: pack.id, ...st }).catch(e => D.dbg(e, 'sticker-send')); };
        grid.appendChild(cell);
      }
    };
    packs.forEach((pack, i) => {
      const b = document.createElement('button');
      b.textContent = pack.id === 'builtin' ? '😀' : '🖼️';
      b.title = pack.name;
      if (i === 0) b.className = 'active';
      b.onclick = () => { tabs.querySelectorAll('button').forEach(x => x.classList.remove('active')); b.classList.add('active'); showPack(pack); };
      tabs.appendChild(b);
    });
    const manage = document.createElement('button');
    manage.textContent = '⚙️'; manage.title = D.t('stickersTitle');
    manage.onclick = () => { _toggleStickerPanel(); _showStickersPanel().catch(e => D.dbg(e, 'stickers-panel')); };
    tabs.appendChild(manage);
    panel.append(tabs, grid);
    showPack(packs[0]);
    D.domGet('msg-input-bar')?.appendChild(panel);
    _stickerPanel = panel;
  }

  async function _showStickersPanel() {
    const packs = await _customStickerPacks();
    const [dlg, titleId] = D.makeDialog();
    const rows = packs.map((p, i) => `<div class="pf-photo-row"><span>${D.esc(p.name)} (${p.stickers.length})</span><button type="button" class="btn btn-g btn-sm stk-export" data-i="${i}">${D.esc(D.t('stickersExport'))}</button><button type="button" class="btn btn-g btn-sm stk-del" data-i="${i}">${D.esc(D.t('stickersDelete'))}</button></div>`).join('');
    D.safeSetHTML(dlg, `
      <h3 id="${titleId}" class="i-m-0-12">${D.esc(D.t('stickersTitle'))}</h3>
      ${rows || `<p class="i-tiny-meta">${D.esc(D.t('stickersEmpty'))}</p>`}
      <div class="pf-photo-row">
        <button type="button" class="btn btn-g btn-sm stk-add">${D.esc(D.t('stickersAddImages'))}</button>
        <button type="button" class="btn btn-g btn-sm stk-import">${D.esc(D.t('stickersImport'))}</button>
      </div>
      <input type="file" class="stk-files hidden" accept="image/*" multiple>
      <input type="file" class="stk-packfile hidden" accept="application/json,.json">
      <div class="dlg-btns"><button class="btn btn-p btn-sm" value="cancel">${D.esc(D.t('ok'))}</button></div>`);
    D.showDialog(dlg);
    const close = () => { dlg.close(); dlg.remove(); };
    dlg.querySelector('[value="cancel"]').onclick = close;
    D.wireDialogDismiss(dlg, close);
    const reload = () => { close(); _showStickersPanel().catch(e => D.dbg(e, 'stickers-panel')); };
    dlg.querySelector('.stk-add').onclick = () => dlg.querySelector('.stk-files').click();
    dlg.querySelector('.stk-import').onclick = () => dlg.querySelector('.stk-packfile').click();
    dlg.querySelector('.stk-files').onchange = async (e) => {
      const files = [...(e.target.files || [])];
      if (!files.length) return;
      const mine = packs.find(p => p.id === 'mine') || { id: 'mine', name: D.t('stickersMyPack'), stickers: [] };
      let added = 0;
      for (const f of files) {
        const img = await _downscaleSticker(f);
        if (!img) { D.showToast(D.t('stickersTooBig'), 'error'); continue; }
        mine.stickers.push({ id: 's' + Date.now().toString(36) + added, img });
        added++;
      }
      if (added) {
        const cleanMine = sanitizePack(mine);
        const next = packs.filter(p => p.id !== 'mine');
        if (cleanMine) next.push(cleanMine);
        await D.dbPut('settings', next, 'stickerPacks');
        D.showToast(D.t('stickersSaved'), 'success');
      }
      reload();
    };
    dlg.querySelector('.stk-packfile').onchange = async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const pack = parsePackFile(await f.text().catch(() => ''));
      if (!pack) { D.showToast(D.t('stickersBadPack'), 'error'); return; }
      await D.dbPut('settings', [...packs.filter(p => p.id !== pack.id), pack], 'stickerPacks');
      D.showToast(D.t('stickersSaved'), 'success');
      reload();
    };
    dlg.querySelectorAll('.stk-export, .stk-del').forEach(btn => btn.onclick = async () => {
      const pack = packs[+btn.dataset.i];
      if (!pack) return;
      if (btn.classList.contains('stk-del')) { await D.dbPut('settings', packs.filter(p => p.id !== pack.id), 'stickerPacks'); reload(); return; }
      const text = packToFile(pack);
      if (!text) return;
      D.downloadBlob(new Blob([text], { type: 'application/json' }), pack.id + '.bstick.json');
    });
  }

  return { send: _sendSticker, togglePanel: _toggleStickerPanel, showPanel: _showStickersPanel, customPacks: _customStickerPacks };
}

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

// Bidi controls (U+202A–U+202E, U+2066–U+2069) make a rendered name reverse
// or reorder — Trojan-Source-style spoofing (D27). The Worker's sanitizeString
// strips the same set, but profiles ride E2EE and never pass the Worker, so
// the strip has to happen here too.
export function stripBidi(s) {
  return typeof s === 'string' ? s.replace(/[\u202a-\u202e\u2066-\u2069]/g, '') : '';
}

export function sanitizeProfile(p) {
  if (!p || typeof p !== 'object') return null;
  const name = typeof p.name === 'string' ? stripBidi(p.name.trim()).slice(0, PROFILE_NAME_MAX) : '';
  if (!name) return null;
  return {
    name,
    emoji: typeof p.emoji === 'string' ? stripBidi(p.emoji).slice(0, PROFILE_EMOJI_MAX) : '',
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

// Host-side profile UI + distribution (stage 5 step 4, moved out of
// index.html in the line-budget pass): the /profile panel and the
// capability-gated E2EE fan-out live here; the pure shapes above
// stay host-agnostic.
export function createProfileUI(D) {
    async function _myProfile() {
      const P = { sanitizeProfile, buildProfilePayload };
      const saved = await D.dbGet('settings', 'profile').catch(() => null);
      if (saved) return { ...(P?.sanitizeProfile(saved) || { name: D.myName(), emoji: '', img: '' }), pv: saved.pv || 0 };
      const keys = await D.dbGet('identity', 'keys').catch(() => null);
      return { name: D.myName(), emoji: keys?.avatar || '', img: '', pv: 0 };
    }
    // contact id -> the profile version already delivered to it (this page
    // load); the contact record's profileSentPv carries it across reloads.
    const _sentPv = new Map();
    const _inFlight = new Set();
    // A profile must NEVER be the message that opens a session. The first
    // ratchet message carries the X3DH header exactly once, and receivers
    // treat a profile as a silent control payload: greeting a brand-new
    // contact therefore spent the header on a message the peer could drop
    // (unknown sender) or answer with its own greeting (two initiator
    // sessions, no responder) — and the first real message, and every one
    // after it, failed to decrypt. So: no session yet -> not sent now; the
    // caller retries after the first chat message (sendMessage), and each
    // version reaches a contact once.
    async function _sendProfileTo(contact) {
      const P = { sanitizeProfile, buildProfilePayload };
      if (!P || !contact?.pubB64 || contact.isGroup) return false;
      if (_inFlight.has(contact.id)) return false;
      _inFlight.add(contact.id);
      try {
        const prof = await _myProfile();
        const mark = prof.pv || 1;
        if ((_sentPv.get(contact.id) ?? contact.profileSentPv) === mark) return false;
        if (!(await D.hasSession(contact.id))) return false;
        const capsById = await D.fetchMemberCapsBatch([contact.id]);
        if (!(capsById[contact.id] || []).includes(CAPS_PROFILE)) return false;
        const wire = P.buildProfilePayload(prof, mark);
        if (!wire) return false;
        const enc = await D.encryptFor(wire, contact.pubB64);
        if (!enc) return false;
        await D.relaySend(contact.id, { to: contact.id, from: D.myId(), fromPub: D.myPubB64(), fromName: D.myName(), payload: enc, ts: Date.now(), isProfile: true }, contact.pubB64);
        _sentPv.set(contact.id, mark);
        contact.profileSentPv = mark;
        const rec = await D.dbGet('contacts', contact.id).catch(() => null);
        if (rec) { rec.profileSentPv = mark; await D.dbPut('contacts', rec); }
        return true;
      } catch(e) { D.dbg(e, 'profile-send'); return false; }
      finally { _inFlight.delete(contact.id); }
    }
    async function _showProfilePanel() {
      const prof = await _myProfile();
      const [dlg, titleId] = D.makeDialog();
      D.safeSetHTML(dlg, `
        <h3 id="${titleId}" class="i-m-0-12">${D.esc(D.t('profileTitle'))}</h3>
        <label class="i-tiny-meta">${D.esc(D.t('profileName'))}</label>
        <input type="text" class="pf-name i-input-full" maxlength="64" value="${D.esc(prof.name)}">
        <label class="i-tiny-meta">${D.esc(D.t('profileEmoji'))}</label>
        <input type="text" class="pf-emoji i-input-full" maxlength="16" value="${D.esc(prof.emoji)}">
        <label class="i-tiny-meta">${D.esc(D.t('profilePhoto'))}</label>
        <div class="pf-photo-row"><span class="pf-preview"></span>
          <button type="button" class="btn btn-g btn-sm pf-choose">${D.esc(D.t('profileChoose'))}</button>
          <button type="button" class="btn btn-g btn-sm pf-remove">${D.esc(D.t('profileRemove'))}</button>
        </div>
        <input type="file" class="pf-file hidden" accept="image/*">
        <label class="i-tiny-meta">${D.esc(D.t('profileIdLabel'))}</label>
        <div class="pf-photo-row"><input type="text" class="pf-id i-input-full" readonly value="${D.esc(D.myPubB64())}">
          <button type="button" class="btn btn-g btn-sm pf-copy-id">${D.esc(D.t('copy'))}</button>
        </div>
        <div class="dlg-btns">
          <button class="btn btn-o btn-sm" value="cancel">${D.esc(D.t('cancel'))}</button>
          <button class="btn btn-g btn-sm" value="ok">${D.esc(D.t('profileSave'))}</button>
        </div>`);
      D.showDialog(dlg);
      let img = prof.img || '';
      const preview = dlg.querySelector('.pf-preview');
      const showImg = () => {
        preview.replaceChildren();
        if (!img) { preview.textContent = '—'; return; }
        const im = document.createElement('img'); im.className = 'pf-photo'; im.src = img; preview.appendChild(im);
      };
      showImg();
      // The ID row: read-only (the key is the identity — it is shown and
      // copied, never edited here). Owner request: the ID must be checkable
      // from the profile, not only from the header's short-ID line.
      const idInput = dlg.querySelector('.pf-id');
      idInput.onclick = () => idInput.select();
      dlg.querySelector('.pf-copy-id').onclick = async () => {
        try { await navigator.clipboard.writeText(D.myPubB64()); D.showToast(D.t('toastCopied'), 'success'); }
        catch(e) { D.dbg(e, 'profile-copy-id'); idInput.select(); }
      };
      const fileInput = dlg.querySelector('.pf-file');
      dlg.querySelector('.pf-choose').onclick = () => fileInput.click();
      dlg.querySelector('.pf-remove').onclick = () => { img = ''; showImg(); };
      fileInput.onchange = async () => {
        const f = fileInput.files?.[0];
        if (!f) return;
        try { img = await D.downscaleAvatar(f); showImg(); } catch(e) { D.dbg(e, 'profile-photo'); }
      };
      return new Promise((resolve) => {
        const close = (val) => { dlg.close(); dlg.remove(); resolve(val); };
        dlg.querySelector('[value="ok"]').onclick = async () => {
          const clean = sanitizeProfile({ name: dlg.querySelector('.pf-name').value.trim() || D.myName(), emoji: dlg.querySelector('.pf-emoji').value.trim(), img });
          if (clean) {
            await _saveProfile(clean);
            D.showToast(D.t('profileSaved'), 'success');
          }
          close(true);
        };
        dlg.querySelector('[value="cancel"]').onclick = () => close(false);
        D.wireDialogDismiss(dlg, close);
      });
    }
    // THE profile save path — the panel above and the settings view's
    // display-name field both write through here, so the name lives in
    // exactly the same places no matter which door edited it: the
    // settings 'profile' record, the identity record's name, the live
    // myName, the header, and the E2EE fan-out.
    async function _saveProfile(clean) {
      await D.dbPut('settings', { ...clean, pv: Date.now() }, 'profile');
      if (clean.name !== D.myName()) {
        D.setMyName(clean.name);
        const stored = await D.dbGet('identity', 'keys');
        if (stored) { stored.name = clean.name; await D.dbPut('identity', stored, 'keys'); }
        D.domGet('msg-my-name').textContent = clean.name;
      }
      _distributeProfile().catch(e => D.dbg(e, 'profile-dist'));
      // The self card in the contact list renders from this same
      // record — refresh it now or it shows the pre-edit profile
      // until the next unrelated list render.
      if (D.refreshSelfCard) D.refreshSelfCard();
    }
    // Change ONLY the display name (the settings view's field): the
    // current emoji/photo ride along untouched via _myProfile, and the
    // write itself is _saveProfile — no second store, no second path.
    async function _setDisplayName(name) {
      const prof = await _myProfile();
      const clean = sanitizeProfile({ name, emoji: prof.emoji, img: prof.img });
      if (!clean) return false;
      await _saveProfile(clean);
      return true;
    }
    async function _distributeProfile() {
      const contacts = (await D.dbGetAll('contacts').catch(() => [])) || [];
      let sent = 0;
      for (const c of contacts) if (await _sendProfileTo(c)) sent++;
      return sent;
    }
  return { showPanel: _showProfilePanel, sendTo: _sendProfileTo, myProfile: _myProfile, setDisplayName: _setDisplayName };
}

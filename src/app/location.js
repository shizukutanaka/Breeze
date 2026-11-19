// Breeze stage 5 step 6 — location sharing.
// One-shot shares and live shares, both E2EE-only: 1:1 rides a
// dedicated envelope flag with a ratchet-encrypted payload (the
// voice/sticker pattern), groups ride the sender-key channel as a
// {loc} document. Sending is capability-gated on 'loc-v1'; a
// one-shot share to an un-upgraded peer degrades to a plain text
// message carrying the map link (same E2EE channel, readable
// everywhere), while live sharing refuses honestly — a text
// fallback cannot be live.
//
// Live shares collapse into ONE message: the record id is
// deterministic (`live:<senderId>:<sid>`) on both sides, updates
// rewrite that record in place, and a stopped update ends it.
// The sender side keeps sessions in memory only, so a reload ends
// sharing (fail-safe), the stop path clears the timer BEFORE the
// final stopped update goes out, and every share carries an
// `until` the receiver renders — a share that goes silent is
// visibly over, never silently stale.
//
// No map tiles are embedded: a tile server would learn the
// viewer's IP and the shared area. The card links out to
// OpenStreetMap, which the user opens by choice.

export const CAPS_LOC = 'loc-v1';
export const LIVE_INTERVAL_MS = 30000;
export const LIVE_DURATIONS_MIN = [15, 60, 480];

// Coordinates are rounded to 6 decimals (~0.1 m) — finer precision
// is GPS noise, coarser would misplace the pin.
export function sanitizeLoc(o) {
  if (!o || typeof o !== 'object') return null;
  const lat = Number(o.lat), lng = Number(o.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const acc = Number(o.acc);
  return {
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    ...(Number.isFinite(acc) && acc >= 0 && acc <= 100000 ? { acc: Math.round(acc) } : {}),
  };
}

function sanitizeLocationPayload(o) {
  if (!o || typeof o !== 'object') return null;
  const live = typeof o.live === 'string' ? o.live.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) : '';
  if (o.stopped === true) return live ? { live, stopped: true } : null;
  const loc = sanitizeLoc(o.loc);
  if (!loc) return null;
  const out = { loc };
  if (live) {
    out.live = live;
    out.seq = Number.isFinite(o.seq) ? Math.max(0, Math.floor(o.seq)) : 0;
    out.until = Number.isFinite(o.until) ? o.until : 0;
  }
  return out;
}

export function buildLocationPayload(p) {
  const clean = sanitizeLocationPayload(p);
  if (!clean) return null;
  return JSON.stringify({ type: 'location', v: 1, ...clean.loc, ...(clean.live ? { live: clean.live, seq: clean.seq, until: clean.until } : {}), ...(clean.stopped ? { live: clean.live, stopped: true } : {}) });
}

export function parseLocationPayload(text) {
  if (typeof text !== 'string') return null;
  let o;
  try { o = JSON.parse(text); } catch { return null; }
  if (!o || o.type !== 'location' || o.v !== 1) return null;
  return sanitizeLocationPayload({ loc: o, live: o.live, seq: o.seq, until: o.until, stopped: o.stopped });
}

export function groupTextForLocation(p) {
  const clean = sanitizeLocationPayload(p);
  if (!clean) return null;
  return JSON.stringify({ loc: clean });
}

export function parseGroupLocationText(text) {
  if (typeof text !== 'string' || !text.startsWith('{"loc":')) return null;
  let o;
  try { o = JSON.parse(text); } catch { return null; }
  if (!o || typeof o !== 'object' || !o.loc) return null;
  return sanitizeLocationPayload(o.loc);
}

export function osmUrl(loc) {
  return `https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=16/${loc.lat}/${loc.lng}`;
}

export function locLabel(loc) {
  return '📍 ' + loc.lat.toFixed(5) + ', ' + loc.lng.toFixed(5);
}

export function liveRecordId(senderId, sid) {
  return 'live:' + senderId + ':' + sid;
}

// Host-side engine (stage 5 step 6, moved out of index.html in the
// line-budget pass): geolocation capture, capability gating, the
// send paths, live-session management and the receive/render side.
// Sessions live in memory only — a reload ends sharing (fail-safe) —
// and stop clears the timer BEFORE the stopped update goes out.
export function createLocationShare(D) {
    const _liveShares = new Map();
    function _geoPos() {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) { reject(new Error('unsupported')); return; }
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: D.MS.SEC * 15, maximumAge: D.MS.SEC * 10 });
      });
    }
    async function _peerLocCap(contact) {
      if (contact.isGroup) return (contact.members || []).filter(m => m.id !== D.myId()).every(m => (m.caps || []).includes(CAPS_LOC));
      const capsById = await D.fetchMemberCapsBatch([contact.id]);
      return (capsById[contact.id] || []).includes(CAPS_LOC);
    }
    async function _sendLocationWire(contact, payload, ts, msgId) {
      const L = L;
      if (contact.isGroup) {
        const wire = L?.groupTextForLocation(payload);
        return wire ? D.sendGroupTransport(contact, wire, ts, msgId, null) : false;
      }
      const wire = L?.buildLocationPayload(payload);
      const enc = wire && await D.encryptFor(wire, contact.pubB64);
      if (!enc) return false;
      await D.relaySend(contact.id, { to: contact.id, from: D.myId(), fromPub: D.myPubB64(), fromName: D.myName(), payload: enc, ts, isLocation: true }, contact.pubB64);
      D.fanOut(contact, wire, ts, { isLocation: true }, { isLocation: true, sfFor: contact.id, sfPub: contact.pubB64, sfName: contact.name });
      return true;
    }
    async function _touchContact(contact, label, ts, alertText) {
      contact.lastMsg = label; contact.lastMsgAt = ts;
      if (D.activeId() !== contact.id) {
        contact.unread = (contact.unread || 0) + 1;
        if (alertText && D.shouldAlert(contact, alertText)) D.playNotif();
      }
      const stored = await D.dbGet('contacts', contact.id).catch(() => null);
      if (stored) { stored.lastMsg = label; stored.lastMsgAt = ts; stored.unread = contact.unread; await D.dbPut('contacts', stored); }
      D.renderContactsThrottled();
    }
    async function _shareLocationOnce() {
      const contact = D.activeContact();
      const L = L;
      if (!contact || !L) return;
      let pos;
      try { pos = await _geoPos(); } catch(e) { D.showToast(D.t(e?.code === 1 ? 'locDenied' : 'locUnavailable'), 'error'); return; }
      const loc = sanitizeLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
      if (!loc) { D.showToast(D.t('locUnavailable'), 'error'); return; }
      let ts = D.correctedNow();
      if (ts <= D.lastSendTs()) ts = D.lastSendTs() + 1;
      D.setLastSendTs(ts);
      const msgId = D.myId() + ':' + ts;
      if (!await _peerLocCap(contact)) { await D.sendTextFallback('📍 ' + osmUrl(loc)); return; }
      const label = locLabel(loc);
      await D.dbPut('messages', { msgId, contactId: contact.id, text: label, mine: true, ts, loc, ...(contact.isGroup ? { senderName: D.myName() } : {}) });
      D.appendMsg(label, true, ts, null, null, { msgId, loc, ...(contact.isGroup ? { senderName: D.myName() } : {}) });
      if (!await _sendLocationWire(contact, { loc }, ts, msgId)) { D.showToast(D.t('toastSendFail'), 'error'); return; }
      await _touchContact(contact, label, ts, null);
      D.playSendSound(); D.hapticSend();
    }
    async function _startLiveShare(contact, minutes) {
      const L = L;
      if (!L || _liveShares.has(contact.id)) { if (_liveShares.has(contact.id)) D.showToast(D.t('locLiveAlready'), 'info'); return; }
      if (contact.isGroup && D.isSecondary()) { D.showToast(D.t('groupPrimaryOnly'), 'error'); return; }
      if (!await _peerLocCap(contact)) { D.showToast(D.t(contact.isGroup ? 'locGroupNoCap' : 'locPeerNoCap'), 'error'); return; }
      let pos;
      try { pos = await _geoPos(); } catch(e) { D.showToast(D.t(e?.code === 1 ? 'locDenied' : 'locUnavailable'), 'error'); return; }
      const loc = sanitizeLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
      if (!loc) { D.showToast(D.t('locUnavailable'), 'error'); return; }
      const sid = Date.now().toString(36);
      const until = Date.now() + minutes * D.MS.MIN;
      const msgId = liveRecordId(D.myId(), sid);
      const ts = D.correctedNow();
      const sess = { sid, until, seq: 0, timer: null };
      _liveShares.set(contact.id, sess);
      await D.dbPut('messages', { msgId, contactId: contact.id, text: locLabel(loc), mine: true, ts, loc, liveUntil: until, ...(contact.isGroup ? { senderName: D.myName() } : {}) });
      if (D.activeId() === contact.id) D.appendMsg(locLabel(loc), true, ts, null, null, { msgId, loc, liveUntil: until, ...(contact.isGroup ? { senderName: D.myName() } : {}) });
      await _sendLocationWire(contact, { loc, live: sid, seq: 0, until }, ts, msgId);
      sess.timer = setInterval(() => { _liveTick(contact.id).catch(e => D.dbg(e, 'live-tick')); }, LIVE_INTERVAL_MS);
      D.intervals().push(sess.timer);
      _renderLiveChip();
      D.showToast(D.t('locLiveStarted'), 'success');
    }
    async function _liveTick(contactId) {
      const sess = _liveShares.get(contactId);
      if (!sess) return;
      if (Date.now() >= sess.until) { _stopLiveShare(contactId); return; }
      const contact = await D.dbGet('contacts', contactId).catch(() => null);
      if (!contact) { _stopLiveShare(contactId, true); return; }
      let pos;
      try { pos = await _geoPos(); } catch(e) { D.dbg(e, 'live-geo'); _stopLiveShare(contactId); return; }
      const L = L;
      const loc = sanitizeLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
      if (!loc) return;
      sess.seq++;
      const ts = D.correctedNow();
      const msgId = liveRecordId(D.myId(), sess.sid);
      const rec = await D.dbGet('messages', msgId).catch(() => null);
      if (rec) { rec.loc = loc; rec.ts = ts; rec.text = locLabel(loc); await D.dbPut('messages', rec); _rerenderLocBubble(rec); }
      await _sendLocationWire(contact, { loc, live: sess.sid, seq: sess.seq, until: sess.until }, ts, msgId);
    }
    function _stopLiveShare(contactId, silent) {
      const sess = _liveShares.get(contactId);
      if (!sess) return;
      clearInterval(sess.timer);
      _liveShares.delete(contactId);
      _renderLiveChip();
      (async () => {
        const L = L;
        const msgId = liveRecordId(D.myId(), sess.sid);
        const rec = await D.dbGet('messages', msgId).catch(() => null);
        if (rec) { rec.liveEnded = true; await D.dbPut('messages', rec); _rerenderLocBubble(rec); }
        if (!silent) {
          const contact = await D.dbGet('contacts', contactId).catch(() => null);
          if (contact) await _sendLocationWire(contact, { live: sess.sid, stopped: true }, D.correctedNow(), msgId);
          D.showToast(D.t('locLiveStopped'), 'info');
        }
      })().catch(e => D.dbg(e, 'live-stop'));
    }
    function _locCardInner(rec) {
      const L = L;
      const loc = L?.sanitizeLoc(rec.loc);
      if (!loc) return '';
      const liveLine = rec.liveUntil ? (rec.liveEnded || Date.now() > rec.liveUntil
        ? `<div class="i-tiny-meta">${D.esc(D.t('locLiveEnded'))}</div>`
        : `<div class="i-tiny-meta">🔴 ${D.esc(D.t('locLiveUntil', new Date(rec.liveUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })))}</div>`) : '';
      const accLine = loc.acc ? `<div class="i-tiny-meta">±${loc.acc} m</div>` : '';
      return `<div>📍 <b>${D.esc(locLabel(loc).slice(2))}</b></div>${accLine}${liveLine}<a href="${D.esc(osmUrl(loc))}" target="_blank" rel="noopener noreferrer">${D.esc(D.t('locOpenMap'))} ↗</a>`;
    }
    function _rerenderLocBubble(rec) {
      if (D.activeId() !== rec.contactId) return;
      const card = document.querySelector(`[data-msgid="${rec.msgId}"] .msg-loc`);
      if (card) D.safeSetHTML(card, _locCardInner(rec));
    }
    async function _applyLocation(contactId, senderId, p, ts, senderName) {
      const L = L;
      if (!L || !p) return;
      if (p.live) {
        const msgId = liveRecordId(senderId, p.live);
        const existing = await D.dbGet('messages', msgId).catch(() => null);
        if (p.stopped) {
          if (existing && !existing.liveEnded) { existing.liveEnded = true; await D.dbPut('messages', existing); _rerenderLocBubble(existing); }
          return;
        }
        if (existing?.liveEnded) return; // a stopped share stays stopped
        if (existing && p.seq < (existing.liveSeq || 0)) return; // out-of-order update
        const rec = { msgId, contactId, text: locLabel(p.loc), mine: false, ts, loc: p.loc, liveUntil: p.until, liveSeq: p.seq, ...(senderName ? { senderName } : {}) };
        await D.dbPut('messages', rec);
        if (!existing) {
          const contact = await D.dbGet('contacts', contactId).catch(() => null);
          if (contact) await _touchContact(contact, rec.text, ts, rec.text);
          if (D.activeId() === contactId) D.appendMsg(rec.text, false, ts, null, null, { msgId, loc: p.loc, liveUntil: p.until, ...(senderName ? { senderName } : {}) });
        } else _rerenderLocBubble(rec);
        return;
      }
      const msgId = senderId + ':' + ts;
      if (D.replayCache().has(msgId)) return;
      D.replayCache().add(msgId);
      if (await D.dbGet('messages', msgId)) return;
      const label = locLabel(p.loc);
      await D.dbPut('messages', { msgId, contactId, text: label, mine: false, ts, loc: p.loc, ...(senderName ? { senderName } : {}) });
      const contact = await D.dbGet('contacts', contactId).catch(() => null);
      if (contact) await _touchContact(contact, label, ts, label);
      if (D.activeId() === contactId) D.appendMsg(label, false, ts, null, null, { msgId, loc: p.loc, ...(senderName ? { senderName } : {}) });
    }
    function _renderLiveChip() {
      document.querySelector('#live-chip')?.remove();
      const sess = D.activeContact() && _liveShares.get(D.activeId());
      if (!sess) return;
      const chip = document.createElement('div');
      chip.id = 'live-chip';
      chip.className = 'live-chip';
      const label = document.createElement('span');
      label.textContent = '📍 ' + D.t('locLiveUntil', new Date(sess.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      const btn = document.createElement('button');
      btn.className = 'btn btn-o btn-sm';
      btn.textContent = D.t('locStop');
      btn.onclick = () => _stopLiveShare(D.activeId());
      chip.append(label, btn);
      D.domGet('msg-input-bar')?.before(chip);
    }
    async function _showLocationPanel() {
      if (!D.activeContact()) return;
      const contact = D.activeContact();
      const [dlg, titleId] = D.makeDialog();
      D.safeSetHTML(dlg, `
        <h3 id="${titleId}" class="i-m-0-12">${D.esc(D.t('locTitle'))}</h3>
        <div class="dlg-btns">
          <button class="btn btn-p btn-sm loc-once">${D.esc(D.t('locSendOnce'))}</button>
          <button class="btn btn-g btn-sm loc-live-15">${D.esc(D.t('locLive15'))}</button>
          <button class="btn btn-g btn-sm loc-live-60">${D.esc(D.t('locLive60'))}</button>
          <button class="btn btn-g btn-sm loc-live-480">${D.esc(D.t('locLive480'))}</button>
          <button class="btn btn-g btn-sm" value="cancel">${D.esc(D.t('cancel'))}</button>
        </div>`);
      D.showDialog(dlg);
      const close = () => { dlg.close(); dlg.remove(); };
      dlg.querySelector('[value="cancel"]').onclick = close;
      D.wireDialogDismiss(dlg, close);
      dlg.querySelector('.loc-once').onclick = () => { close(); _shareLocationOnce().catch(e => D.dbg(e, 'loc-once')); };
      for (const [cls, min] of [['loc-live-15', 15], ['loc-live-60', 60], ['loc-live-480', 480]]) {
        dlg.querySelector('.' + cls).onclick = () => { close(); _startLiveShare(contact, min).catch(e => D.dbg(e, 'loc-live')); };
      }
    }


  return { showPanel: _showLocationPanel, applyLocation: _applyLocation, renderLiveChip: _renderLiveChip, locCardInner: _locCardInner };
}

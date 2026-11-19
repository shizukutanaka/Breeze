// ============================================================================
// GROUP VOICE CALLS — small-scale full mesh (SHARE_PLAN stage 5 step 2).
// Audio only; video is a later step. No SFU and no new server surface:
//   - call control (invite / join / leave) rides the group's existing
//     sender-key channel as {gctl} payloads (the host app routes them
//     here and never renders them as chat);
//   - media legs are ordinary pairwise WebRTC connections, one per
//     other participant, signaled through per-pair rooms
//     ('gcall:<groupId>:<a>:<b>') — a namespace the 1:1 call manager
//     never polls, so the two systems cannot cross-talk;
//   - every leg's signals go through the same negotiated E2EE wrap as
//     1:1 calls (createCallSignal, stage 5 step 1).
// Join protocol: the joiner offers to everyone already in the call;
// existing members only answer. Simultaneous joins can make both
// sides offer — the smaller member id's offer wins, deterministically.
// The roster is learned from control messages; an offer from a member
// not in the roster is itself proof of presence and is adopted.
// Mesh math caps a call at MAX_PARTICIPANTS (each client holds one
// connection per other participant; audio keeps that cheap, and the
// cap keeps it honest on mobile uplinks).
// ============================================================================

import { createCallSignal } from './call.js';

export const GCALL_MAX_PARTICIPANTS = 8;

export function gcallPairRoom(groupId, a, b) {
  return 'gcall:' + groupId + ':' + [a, b].sort().join(':');
}

// Who should I offer to when entering? Everyone the roster already
// holds (except me), up to the mesh cap.
export function planOffers(rosterIds, myId) {
  return rosterIds.filter(id => id !== myId).slice(0, GCALL_MAX_PARTICIPANTS - 1);
}

// Glare: both sides offered. The smaller id's offer wins; the other
// side closes its PC and answers. Returns 'accept-theirs' | 'keep-mine'.
export function resolveGlare(myId, peerId) {
  return peerId < myId ? 'accept-theirs' : 'keep-mine';
}

export function createGroupCallManager(D) {
  const _sig = createCallSignal({ encryptFor: D.encryptFor, decryptFrom: D.decryptFrom, enabled: () => CONFIG.CALL_E2E_SIGNAL });
  let _state = 'idle'; // idle | ringing | in
  let _group = null, _callId = null;
  let _roster = new Map(); // memberId -> member {id, pubB64, name}
  let _legs = new Map();   // memberId -> { pc, audio, offered }
  let _stream = null, _poll = null, _timer = null, _startedAt = 0, _hadPeer = false;
  let _pending = null;     // { group, callId, roster } while ringing

  const roomFor = (memberId) => gcallPairRoom(_group.id, D.myId(), memberId);
  const memberOf = (id) => _roster.get(id) || _group?.members?.find(m => m.id === id) || { id, pubB64: null, name: id };

  function _showOverlay(mode) {
    _hideOverlay();
    const ov = document.createElement('div');
    ov.id = 'gcall-overlay'; ov.className = 'call-overlay';
    const st = document.createElement('div'); st.className = 'call-state'; st.id = 'gcall-state';
    st.textContent = mode === 'ringing' ? t('gcallIncoming') : t('calling');
    const nm = document.createElement('div'); nm.className = 'call-name'; nm.textContent = (_group?.name || '').slice(0, 64);
    const tm = document.createElement('div'); tm.className = 'call-timer'; tm.id = 'gcall-timer'; tm.textContent = '00:00';
    const list = document.createElement('div'); list.className = 'call-name'; list.id = 'gcall-list';
    const actions = document.createElement('div'); actions.className = 'call-actions';
    if (mode === 'ringing') {
      const join = document.createElement('button');
      join.className = 'call-btn-accept'; join.textContent = '📞'; join.setAttribute('aria-label', t('gcallJoin'));
      join.onclick = () => { joinPending(); };
      const dec = document.createElement('button');
      dec.className = 'call-btn-end'; dec.textContent = '✕'; dec.setAttribute('aria-label', t('close'));
      dec.onclick = () => { _pending = null; _state = 'idle'; _hideOverlay(); };
      actions.append(join, dec);
    } else {
      const mute = document.createElement('button');
      mute.className = 'call-btn-mute'; mute.textContent = '🎤'; mute.setAttribute('aria-label', t('mute'));
      mute.onclick = () => { if (_stream) for (const tr of _stream.getAudioTracks()) tr.enabled = !tr.enabled; mute.classList.toggle('muted'); };
      const leave = document.createElement('button');
      leave.className = 'call-btn-end'; leave.textContent = '✕'; leave.setAttribute('aria-label', t('gcallLeave'));
      leave.onclick = () => endCall(true);
      actions.append(mute, leave);
    }
    ov.append(st, nm, tm, list, actions);
    document.body.appendChild(ov);
    _updateList();
  }
  function _hideOverlay() { _DOM.get('gcall-overlay')?.remove(); }
  function _updateList() {
    const el = _DOM.get('gcall-list');
    if (el) el.textContent = [..._roster.values()].map(m => (m.name || m.id)).join(' · ') || t('gcallWaiting');
    const st = _DOM.get('gcall-state');
    if (st && _state === 'in') st.textContent = t('calling');
  }

  // Call control rides the group's sender-key channel (the host passes
  // the primitives in): key distribution awaited, one ciphertext for
  // all members, flagged gctl so receivers route it here instead of
  // rendering it as chat. Primary device only, like group send.
  async function _sendControl(group, obj) {
    if (D.isSecondary()) return false;
    try {
      const members = (group.members || []).filter(m => m.id !== D.myId());
      for (const m of members) await D.distributeSenderKey(group.id, m.pubB64).catch(e => _dbg(e, 'sk-dist'));
      const ct = await D.encryptGroupMsg(group.id, JSON.stringify(obj));
      if (!ct) return false;
      const ts = Date.now();
      for (const m of members) {
        try { await D.relaySend(m.id, { to: m.id, from: D.myId(), fromPub: D.myPubB64(), fromName: D.myName(), payload: ct, ts, groupId: group.id, groupName: group.name, isGroupSK: true, gctl: true }, m.pubB64); }
        catch(e) { _dbg(e, 'gctl-send'); }
      }
      return true;
    } catch(e) { _dbg(e, 'gctl-send'); return false; }
  }

  async function _media() {
    _stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return _stream;
  }

  function _newLeg(member, offered) {
    const pc = new RTCPeerConnection(D.iceConfig());
    for (const tr of _stream.getTracks()) pc.addTrack(tr, _stream);
    const audio = document.createElement('audio');
    audio.autoplay = true;
    pc.ontrack = (e) => { audio.srcObject = e.streams[0]; _DOM.get('gcall-overlay')?.appendChild(audio); };
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      if (e.candidate.type === 'host' && e.candidate.address && !e.candidate.address.includes('.local')) return;
      _sig.wrap(member.pubB64, e.candidate).then(d => { if (d != null) D.signal(roomFor(member.id), 'gcall-ice', d); }).catch(err => _dbg(err, 'gcall-ice'));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') { _hadPeer = true; _updateList(); }
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') _closeLeg(member.id);
    };
    const leg = { pc, audio, offered };
    _legs.set(member.id, leg);
    return leg;
  }
  function _closeLeg(memberId) {
    const leg = _legs.get(memberId);
    if (!leg) return;
    try { leg.pc.close(); } catch(e) { _dbg(e, 'gcall-close'); }
    leg.audio?.remove();
    _legs.delete(memberId);
  }

  async function _offerTo(member) {
    if (_legs.has(member.id) || !member.pubB64) return;
    try {
      await _sigLearn(member);
      const leg = _newLeg(member, true);
      const offer = await leg.pc.createOffer();
      await leg.pc.setLocalDescription(offer);
      const data = await _sig.wrap(member.pubB64, { sdp: offer, callId: _callId });
      if (data != null) D.signal(roomFor(member.id), 'gcall-offer', data);
    } catch(e) { _dbg(e, 'gcall-offer'); }
  }
  async function _answerTo(member, sdp) {
    try {
      await _sigLearn(member);
      const leg = _newLeg(member, false);
      await leg.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await leg.pc.createAnswer();
      await leg.pc.setLocalDescription(answer);
      const data = await _sig.wrap(member.pubB64, answer);
      if (data != null) D.signal(roomFor(member.id), 'gcall-answer', data);
    } catch(e) { _dbg(e, 'gcall-answer'); }
  }
  async function _sigLearn(member) {
    try { const byId = await D.fetchCaps([member.id]); _sig.noteCaps(member.pubB64, byId?.[member.id] || []); }
    catch(e) { _dbg(e, 'gcall-caps'); }
  }

  function _startPoll() {
    _poll = setInterval(async () => {
      if (_state !== 'in') return;
      for (const member of [..._roster.values()]) {
        if (member.id === D.myId() || !member.pubB64) continue;
        try {
          const resp = await D.signalAwait(roomFor(member.id), 'poll');
          if (!resp.ok) continue;
          const data = await resp.json();
          for (const s of (data.messages || [])) {
            if (s.sender === D.myId()) continue;
            if (s.type === 'gcall-offer') {
              const obj = await _sig.unwrap(member.pubB64, s.data);
              if (!obj || obj.callId !== _callId || !obj.sdp) continue;
              if (!_roster.has(member.id)) { _roster.set(member.id, member); _updateList(); }
              if (_roster.size > GCALL_MAX_PARTICIPANTS) continue;
              const existing = _legs.get(member.id);
              if (existing?.offered) {
                if (resolveGlare(D.myId(), member.id) === 'keep-mine') continue;
                _closeLeg(member.id);
              } else if (existing) continue;
              await _answerTo(member, obj.sdp);
            } else if (s.type === 'gcall-answer') {
              const leg = _legs.get(member.id);
              const ans = leg && await _sig.unwrap(member.pubB64, s.data);
              if (ans && typeof ans === 'object' && leg.pc.signalingState === 'have-local-offer') await leg.pc.setRemoteDescription(new RTCSessionDescription(ans));
            } else if (s.type === 'gcall-ice') {
              const leg = _legs.get(member.id);
              const cand = leg && await _sig.unwrap(member.pubB64, s.data);
              if (cand && typeof cand === 'object') await leg.pc.addIceCandidate(cand).catch(e => _dbg(e, 'gcall-ICE'));
            } else if (s.type === 'gcall-end') {
              _closeLeg(member.id);
            }
          }
        } catch(e) { _dbg(e, 'gcall-poll'); }
      }
    }, MS.SEC);
    D.intervals.push(_poll);
  }

  async function _enter(group, callId, rosterIds) {
    _group = group; _callId = callId; _state = 'in'; _hadPeer = false;
    _roster = new Map();
    _roster.set(D.myId(), { id: D.myId(), pubB64: D.myPubB64(), name: D.myName() });
    for (const id of rosterIds) if (id !== D.myId()) _roster.set(id, memberOf(id));
    try { await _media(); } catch(e) { _dbg(e, 'gcall-media'); showToast(t('micDenied'), 'error'); _teardown(); return; }
    _showOverlay('in');
    _startedAt = Date.now();
    _timer = setInterval(() => {
      const el = _DOM.get('gcall-timer');
      if (el) { const s = Math.floor((Date.now() - _startedAt) / 1000); el.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
    }, MS.SEC);
    D.intervals.push(_timer);
    _startPoll();
    for (const id of planOffers([..._roster.keys()], D.myId())) await _offerTo(memberOf(id));
    // Nobody came: do not poll forever.
    setTimeout(() => { if (_state === 'in' && !_hadPeer) endCall(true); }, 5 * MS.MIN);
  }

  function _teardown() {
    if (_poll) { clearInterval(_poll); _poll = null; }
    if (_timer) { clearInterval(_timer); _timer = null; }
    for (const id of [..._legs.keys()]) _closeLeg(id);
    if (_stream) { for (const tr of _stream.getTracks()) tr.stop(); _stream = null; }
    _state = 'idle'; _group = null; _callId = null; _roster = new Map(); _pending = null;
    _hideOverlay();
  }

  async function start(group) {
    if (_state !== 'idle' || !group?.isGroup || D.isBusy()) return;
    if (D.isSecondary()) { showToast(t('groupPrimaryOnly'), 'error'); return; }
    const callId = D.myId() + ':' + Date.now().toString(36);
    const ok = await _sendControl(group, { gctl: 'invite', callId });
    if (!ok) { showToast(t('toastSendFail'), 'error'); return; }
    await _enter(group, callId, [D.myId()]);
  }

  function endCall(notify) {
    if (_state !== 'in') { _teardown(); return; }
    const group = _group, callId = _callId;
    if (notify && group) _sendControl(group, { gctl: 'leave', callId }).catch(e => _dbg(e, 'gcall-leave'));
    for (const member of _roster.values()) if (member.id !== D.myId()) D.signal(roomFor(member.id), 'gcall-end');
    _teardown();
  }

  // Inbound control from the host app (sender-key group channel).
  function route(group, member, obj) {
    if (!obj || member.id === D.myId()) return;
    if (obj.gctl === 'invite') {
      if (_state !== 'idle' || D.isBusy()) return;
      _state = 'ringing';
      _pending = { group, callId: obj.callId, roster: [member.id] };
      _group = group;
      _showOverlay('ringing');
      // Someone who never answers should not ring forever.
      setTimeout(() => { if (_state === 'ringing' && _pending?.callId === obj.callId) { _pending = null; _state = 'idle'; _hideOverlay(); } }, CONFIG.CALL_TIMEOUT_MS);
    } else if (obj.gctl === 'join') {
      if (_state === 'ringing' && _pending?.callId === obj.callId) {
        if (!_pending.roster.includes(member.id)) _pending.roster.push(member.id);
      } else if (_state === 'in' && obj.callId === _callId) {
        if (!_roster.has(member.id)) {
          if (_roster.size >= GCALL_MAX_PARTICIPANTS) return;
          _roster.set(member.id, member); _updateList();
        }
      }
    } else if (obj.gctl === 'leave') {
      if (_state === 'in' && obj.callId === _callId) {
        _closeLeg(member.id);
        _roster.delete(member.id);
        _updateList();
        if (_hadPeer && _roster.size <= 1) endCall(false);
      } else if (_state === 'ringing' && _pending?.callId === obj.callId) {
        _pending.roster = _pending.roster.filter(id => id !== member.id);
        if (!_pending.roster.length) { _pending = null; _state = 'idle'; _hideOverlay(); }
      }
    }
  }

  async function joinPending() {
    const p = _pending; _pending = null;
    if (!p) return;
    const ok = await _sendControl(p.group, { gctl: 'join', callId: p.callId });
    if (!ok) { _state = 'idle'; _hideOverlay(); showToast(t('toastSendFail'), 'error'); return; }
    await _enter(p.group, p.callId, p.roster);
  }

  return { start, endCall, route, joinPending, state: () => _state };
}

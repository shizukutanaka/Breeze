import { safeName } from './lookalike-names.js';
import { createIcon } from './icons.js';

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
//
// D25 wave 12 — linked devices hold seats too (seat-device addressing):
//   - a participant is an ACCOUNT; the seat is the device of that
//     account which joined. invite and join payloads carry `dev` (the
//     seat device's pub) and `seat: 1` (the new-generation marker).
//     Signals wrap to the seat pub, so a secondary device opens them
//     with its own ratchet session. A claimed dev is only adopted
//     after verification against the account root's SIGNED device
//     registry (host dep devicesFor); anything unverifiable falls
//     back to the root pub — which is also the pre-wave-12 behaviour.
//     dev === root pub is exactly the legacy path (primary seat).
//   - control reaches linked devices through the host's group-live
//     deposit copies (the same ciphertext, gctl flag preserved), and
//     a secondary sends control under its account root (acctRoot),
//     exactly like group messages since wave 6.
//   - one account, one seat, LAST join wins: if my other device joins
//     a call I am in, I stand down silently (no leave control — the
//     account stays seated, on the device last touched). While it
//     rings here, an own-account join elsewhere stops the ring.
//   - generation gate: a seat on a LINKED device works only when
//     every other participant's client is new-generation (seat
//     marker seen). An old-generation join is refused honestly
//     (gcallGenGate) instead of producing one-way audio. Primary
//     seats are not gated: root addressing IS the legacy behaviour.
// ============================================================================

import { createCallSignal } from './call.js';

export const GCALL_MAX_PARTICIPANTS = 8;

export function gcallPairRoom(groupId, a, b) {
  return 'gcall:' + groupId + ':' + [a, b].sort().join(':');
}

// Bounded-concurrency map: at most n workers in flight, results in
// input order. The host's group fan-out uses it (stage 5 step 3) so a
// 1,000-member deposit storm runs 8-wide instead of strictly serial.
export async function poolMap(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, worker));
  return out;
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
  // Wave 12 seat state: memberId -> { dev, gen } from the latest
  // invite/join (dev is a CLAIM until verified), memberId -> verified
  // seat pub cache, and the set of MY account's device ids (signal
  // senders to skip in pair rooms — a sibling device polls the same
  // rooms during a seat handover).
  let _seatInfo = new Map(), _seatPubs = new Map(), _myDeviceIds = new Set();

  // Account identity (wave 12): a participant is the account; the seat
  // is this device. The deps fall back to the device identity when the
  // host does not provide the account bindings (older hosts/tests).
  const acctId = () => (D.myAccountId ? D.myAccountId() : D.myId());
  const acctPub = () => (D.myAccountPub ? D.myAccountPub() : D.myPubB64());
  const seatIsSecondary = () => D.myPubB64() !== acctPub();

  const roomFor = (memberId) => gcallPairRoom(_group.id, acctId(), memberId);
  const memberOf = (id) => _roster.get(id) || _group?.members?.find(m => m.id === id) || { id, pubB64: null, name: id };

  function _showOverlay(mode) {
    _hideOverlay();
    const ov = document.createElement('div');
    ov.id = 'gcall-overlay'; ov.className = 'call-overlay';
    const st = document.createElement('div'); st.className = 'call-state'; st.id = 'gcall-state';
    st.textContent = mode === 'ringing' ? t('gcallIncoming') : t('calling');
    const nm = document.createElement('div'); nm.className = 'call-name'; nm.textContent = safeName(_group?.name).slice(0, 64);
    const tm = document.createElement('div'); tm.className = 'call-timer'; tm.id = 'gcall-timer'; tm.textContent = '00:00';
    const list = document.createElement('div'); list.className = 'call-name'; list.id = 'gcall-list';
    const actions = document.createElement('div'); actions.className = 'call-actions';
    if (mode === 'ringing') {
      const join = document.createElement('button');
      join.className = 'call-btn-accept'; join.replaceChildren(createIcon('phone')); join.setAttribute('aria-label', t('gcallJoin'));
      join.onclick = () => { joinPending(); };
      const dec = document.createElement('button');
      dec.className = 'call-btn-end'; dec.replaceChildren(createIcon('x')); dec.setAttribute('aria-label', t('close'));
      dec.onclick = () => { _pending = null; _state = 'idle'; _hideOverlay(); };
      actions.append(join, dec);
    } else {
      const mute = document.createElement('button');
      mute.className = 'call-btn-mute'; mute.replaceChildren(createIcon('mic')); mute.setAttribute('aria-label', t('mute'));
      mute.onclick = () => { if (_stream) for (const tr of _stream.getAudioTracks()) tr.enabled = !tr.enabled; mute.classList.toggle('muted'); };
      const leave = document.createElement('button');
      leave.className = 'call-btn-end'; leave.replaceChildren(createIcon('x')); leave.setAttribute('aria-label', t('gcallLeave'));
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
    if (el) el.textContent = [..._roster.values()].map(m => (safeName(m.name) || m.id)).join(' · ') || t('gcallWaiting');
    const st = _DOM.get('gcall-state');
    if (st && _state === 'in') st.textContent = t('calling');
  }

  // Seat bookkeeping (wave 12): the latest invite/join from a member
  // names its seat device (dev) and its generation (seat marker). The
  // dev stays a claim here; _seatPubOf verifies before any use.
  function _noteSeat(member, obj) {
    const dev = typeof obj.dev === 'string' ? obj.dev : null;
    const prev = _seatInfo.get(member.id);
    _seatInfo.set(member.id, { dev, gen: !!obj.seat });
    if (prev && prev.dev !== dev) _seatPubs.delete(member.id);
  }

  // The pub this member's signals wrap to (wave 12 §4): the claimed
  // seat dev, but ONLY when it is the member's root pub itself or a
  // device pub on the root's SIGNED registry (host dep devicesFor,
  // which falls back to [root] when unverifiable). Anything else —
  // no claim, unverifiable claim, registry unavailable — wraps to
  // the root pub, byte-identical to the pre-wave-12 behaviour.
  async function _seatPubOf(member) {
    if (!member?.pubB64) return null;
    if (_seatPubs.has(member.id)) return _seatPubs.get(member.id);
    const dev = _seatInfo.get(member.id)?.dev;
    let seat = member.pubB64;
    if (dev && dev !== member.pubB64 && D.devicesFor) {
      try {
        const devs = await D.devicesFor(member);
        if (Array.isArray(devs) && devs.includes(dev)) seat = dev;
      } catch(e) { _dbg(e, 'gcall-seat-verify'); }
    }
    _seatPubs.set(member.id, seat);
    return seat;
  }

  // Call control rides the group's sender-key channel (the host passes
  // the primitives in): key distribution awaited, one ciphertext for
  // all members, flagged gctl so receivers route it here instead of
  // rendering it as chat. Wave 12: linked devices send too — the
  // envelope names the account root (acctRoot) like group messages,
  // sender keys are also distributed to members' verified devices
  // (host group-live), and the same ciphertext is copied to those
  // device mailboxes so invites ring on every device of every member.
  async function _sendControl(group, obj) {
    try {
      const members = (group.members || []).filter(m => m.id !== acctId());
      for (const m of members) {
        await D.distributeSenderKey(group.id, m.pubB64, false, (group.members || []).length).catch(e => _dbg(e, 'sk-dist'));
        try { await D.distributeKeyDevices?.(group.id, m, false, (group.members || []).length); } catch(e) { _dbg(e, 'sk-dist-dev'); }
      }
      try { await D.distributeOwnKeyDevices?.(group.id, (group.members || []).length); } catch(e) { _dbg(e, 'sk-dist-own'); }
      const ct = await D.encryptGroupMsg(group.id, JSON.stringify(obj));
      if (!ct) return false;
      const authorFields = await D.authorFields?.(group.id, ct);
      const ts = Date.now();
      for (const m of members) {
        try { await D.relaySend(m.id, { to: m.id, from: D.myId(), fromPub: D.myPubB64(), fromName: D.myName(), ...(D.acctRoot?.() ? { acctRoot: D.acctRoot() } : {}), payload: ct, ts, groupId: group.id, groupName: group.name, isGroupSK: true, gctl: true, ...authorFields }, m.pubB64); }
        catch(e) { _dbg(e, 'gctl-send'); }
      }
      try { await D.depositControlCopies?.(members, ct, { ts, groupId: group.id, groupName: group.name, ...authorFields }); } catch(e) { _dbg(e, 'gctl-copies'); }
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
      _seatPubOf(member).then(seat => seat && _sig.wrap(seat, e.candidate)).then(d => { if (d != null) D.signal(roomFor(member.id), 'gcall-ice', d); }).catch(err => _dbg(err, 'gcall-ice'));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') { _hadPeer = true; leg.connectedAt = Date.now(); _updateList(); }
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') _closeLeg(member.id);
    };
    const leg = { pc, audio, offered };
    _legs.set(member.id, leg);
    return leg;
  }
  function _closeLeg(memberId) {
    const leg = _legs.get(memberId);
    if (!leg) return;
    // Stage 6 step 3: sample before close, like the 1:1 path.
    if (leg.connectedAt) { try { D.noteCallSample?.(leg.pc, Math.floor((Date.now() - leg.connectedAt) / 1000)); } catch(e) { _dbg(e, 'gcall-sample'); } }
    try { leg.pc.close(); } catch(e) { _dbg(e, 'gcall-close'); }
    leg.audio?.remove();
    _legs.delete(memberId);
  }

  async function _offerTo(member) {
    if (_legs.has(member.id) || !member.pubB64) return;
    try {
      await _sigLearn(member);
      const seat = await _seatPubOf(member);
      if (!seat) return;
      const leg = _newLeg(member, true);
      const offer = await leg.pc.createOffer();
      await leg.pc.setLocalDescription(offer);
      const data = await _sig.wrap(seat, { sdp: offer, callId: _callId });
      if (data != null) D.signal(roomFor(member.id), 'gcall-offer', data);
    } catch(e) { _dbg(e, 'gcall-offer'); }
  }
  async function _answerTo(member, sdp) {
    try {
      await _sigLearn(member);
      const seat = await _seatPubOf(member);
      if (!seat) return;
      const leg = _newLeg(member, false);
      await leg.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await leg.pc.createAnswer();
      await leg.pc.setLocalDescription(answer);
      const data = await _sig.wrap(seat, answer);
      if (data != null) D.signal(roomFor(member.id), 'gcall-answer', data);
    } catch(e) { _dbg(e, 'gcall-answer'); }
  }
  // Learn the seat's advertised caps (its own /prekey advertisement,
  // keyed by the seat device id) so the wrap can encrypt to it. For a
  // primary seat this is exactly the pre-wave-12 learn (root id/pub).
  async function _sigLearn(member) {
    try {
      const seat = await _seatPubOf(member);
      if (!seat) return;
      const seatId = seat.slice(0, 12);
      const byId = await D.fetchCaps([seatId]);
      _sig.noteCaps(seat, byId?.[seatId] || []);
    }
    catch(e) { _dbg(e, 'gcall-caps'); }
  }

  function _startPoll() {
    _poll = setInterval(async () => {
      if (_state !== 'in') return;
      for (const member of [..._roster.values()]) {
        if (member.id === acctId() || !member.pubB64) continue;
        try {
          const resp = await D.signalAwait(roomFor(member.id), 'poll');
          if (!resp.ok) continue;
          const data = await resp.json();
          for (const s of (data.messages || [])) {
            if (_myDeviceIds.has(s.sender)) continue; // my own devices' posts (a sibling polls the same rooms)
            if (s.type === 'gcall-offer') {
              const obj = await _sig.unwrap(await _seatPubOf(member), s.data);
              if (!obj || obj.callId !== _callId || !obj.sdp) continue;
              if (!_roster.has(member.id)) { _roster.set(member.id, member); _updateList(); }
              if (_roster.size > GCALL_MAX_PARTICIPANTS) continue;
              const existing = _legs.get(member.id);
              if (existing?.offered) {
                if (resolveGlare(acctId(), member.id) === 'keep-mine') continue;
                _closeLeg(member.id);
              } else if (existing) {
                // Wave 12: a repeated offer against a leg I already
                // answered (signalingState 'stable') means my answer
                // was lost — most likely eaten by my other device
                // polling this same room during a seat handover.
                // Re-answer on a fresh leg instead of wedging the
                // pair until someone rejoins.
                if (existing.pc.signalingState !== 'stable') continue;
                _closeLeg(member.id);
              }
              await _answerTo(member, obj.sdp);
            } else if (s.type === 'gcall-answer') {
              const leg = _legs.get(member.id);
              const ans = leg && await _sig.unwrap(await _seatPubOf(member), s.data);
              if (ans && typeof ans === 'object' && leg.pc.signalingState === 'have-local-offer') await leg.pc.setRemoteDescription(new RTCSessionDescription(ans));
            } else if (s.type === 'gcall-ice') {
              const leg = _legs.get(member.id);
              const cand = leg && await _sig.unwrap(await _seatPubOf(member), s.data);
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
    _roster.set(acctId(), { id: acctId(), pubB64: acctPub(), name: D.myName() });
    for (const id of rosterIds) if (id !== acctId()) _roster.set(id, memberOf(id));
    // The signal senders this account posts under (every verified
    // device id) — pair-room polls must never consume a sibling's
    // signals as if they were the peer's.
    _myDeviceIds = new Set([D.myId(), acctId()]);
    if (D.devicesFor) {
      try {
        const devs = await D.devicesFor({ id: acctId(), pubB64: acctPub() });
        if (Array.isArray(devs)) for (const p of devs) _myDeviceIds.add(p.slice(0, 12));
      } catch(e) { _dbg(e, 'gcall-mydevs'); }
    }
    try { await _media(); } catch(e) { _dbg(e, 'gcall-media'); showToast(t('micDenied'), 'error'); _teardown(); return; }
    _showOverlay('in');
    _startedAt = Date.now();
    _timer = setInterval(() => {
      const el = _DOM.get('gcall-timer');
      if (el) { const s = Math.floor((Date.now() - _startedAt) / 1000); el.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
    }, MS.SEC);
    D.intervals.push(_timer);
    _startPoll();
    for (const id of planOffers([..._roster.keys()], acctId())) await _offerTo(memberOf(id));
    // Wave 12 (§3.4 mitigation): pair-room polls are destructive
    // reads, and during a seat handover my own other device can eat
    // an answer meant for me. A few seconds after entering, re-send
    // the offer ONCE to any leg still waiting for its answer.
    const enteredCallId = callId;
    setTimeout(async () => {
      if (_state !== 'in' || _callId !== enteredCallId) return;
      for (const [memberId, leg] of [..._legs.entries()]) {
        if (!leg.offered || leg.resent || leg.pc.signalingState !== 'have-local-offer') continue;
        leg.resent = true;
        try {
          const member = memberOf(memberId);
          const seat = await _seatPubOf(member);
          if (!seat) continue;
          const offer = await leg.pc.createOffer();
          await leg.pc.setLocalDescription(offer);
          const data = await _sig.wrap(seat, { sdp: offer, callId: _callId });
          if (data != null) D.signal(roomFor(memberId), 'gcall-offer', data);
        } catch(e) { _dbg(e, 'gcall-reoffer'); }
      }
    }, 3 * MS.SEC);
    // Nobody came: do not poll forever.
    setTimeout(() => { if (_state === 'in' && !_hadPeer) endCall(true); }, 5 * MS.MIN);
  }

  function _teardown() {
    if (_poll) { clearInterval(_poll); _poll = null; }
    if (_timer) { clearInterval(_timer); _timer = null; }
    for (const id of [..._legs.keys()]) _closeLeg(id);
    if (_stream) { for (const tr of _stream.getTracks()) tr.stop(); _stream = null; }
    _state = 'idle'; _group = null; _callId = null; _roster = new Map(); _pending = null;
    _seatInfo = new Map(); _seatPubs = new Map(); _myDeviceIds = new Set();
    _hideOverlay();
  }

  async function start(group) {
    if (_state !== 'idle' || !group?.isGroup || D.isBusy()) return;
    const callId = acctId() + ':' + Date.now().toString(36);
    const ok = await _sendControl(group, { gctl: 'invite', callId, seat: 1, dev: D.myPubB64() });
    if (!ok) { showToast(t('toastSendFail'), 'error'); return; }
    await _enter(group, callId, [acctId()]);
  }

  function endCall(notify) {
    if (_state !== 'in') { _teardown(); return; }
    const group = _group, callId = _callId;
    if (notify && group) _sendControl(group, { gctl: 'leave', callId }).catch(e => _dbg(e, 'gcall-leave'));
    for (const member of _roster.values()) if (member.id !== acctId()) D.signal(roomFor(member.id), 'gcall-end');
    _teardown();
  }

  // Inbound control from the host app (sender-key group channel).
  function route(group, member, obj) {
    if (!obj) return;
    if (member.id === acctId()) {
      // Control from MY OWN account (the host attributes my other
      // devices' sends to my roster entry). My own echo (same device
      // pub) is ignored, and my account never rings me. A join from
      // my other device takes the seat (wave 12 last-wins): stand
      // down WITHOUT sending leave — the account stays in the call.
      if (obj.dev && obj.dev === D.myPubB64()) return;
      if (obj.gctl === 'join' || obj.gctl === 'leave') {
        if (_state === 'in' && obj.callId === _callId) _teardown();
        else if (_state === 'ringing' && _pending?.callId === obj.callId) { _pending = null; _state = 'idle'; _hideOverlay(); }
      }
      return;
    }
    if (obj.gctl === 'invite') {
      if (_state !== 'idle' || D.isBusy()) return;
      _noteSeat(member, obj);
      _state = 'ringing';
      _pending = { group, callId: obj.callId, roster: [member.id] };
      _group = group;
      _showOverlay('ringing');
      // Someone who never answers should not ring forever.
      setTimeout(() => { if (_state === 'ringing' && _pending?.callId === obj.callId) { _pending = null; _state = 'idle'; _hideOverlay(); } }, CONFIG.CALL_TIMEOUT_MS);
    } else if (obj.gctl === 'join') {
      const prevDev = _seatInfo.get(member.id)?.dev;
      _noteSeat(member, obj);
      if (_state === 'ringing' && _pending?.callId === obj.callId) {
        if (!_pending.roster.includes(member.id)) _pending.roster.push(member.id);
      } else if (_state === 'in' && obj.callId === _callId) {
        // Generation gate (wave 12): my seat is a linked device and
        // this member's client is old-generation (no seat marker) —
        // its signals would wrap to my account root, which this
        // device cannot open. Leave honestly instead of sitting in
        // one-way audio.
        if (seatIsSecondary() && !obj.seat) { showToast(t('gcallGenGate'), 'error'); endCall(true); return; }
        // The seat moved to another of their devices mid-call: drop
        // the leg to the old seat; the new seat's offer re-creates it.
        if (prevDev !== undefined && prevDev !== (obj.dev || null) && _legs.has(member.id)) _closeLeg(member.id);
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
    // Generation gate (wave 12): from a LINKED device, join only when
    // every known participant is new-generation. An old-generation
    // participant wraps its signals to my account root, which this
    // device cannot open — the call would be one-way audio, so refuse
    // honestly instead of joining broken.
    if (seatIsSecondary() && p.roster.some(id => !_seatInfo.get(id)?.gen)) {
      _state = 'idle'; _hideOverlay(); showToast(t('gcallGenGate'), 'error'); return;
    }
    const ok = await _sendControl(p.group, { gctl: 'join', callId: p.callId, seat: 1, dev: D.myPubB64() });
    if (!ok) { _state = 'idle'; _hideOverlay(); showToast(t('toastSendFail'), 'error'); return; }
    await _enter(p.group, p.callId, p.roster);
  }

  return { start, endCall, route, joinPending, state: () => _state };
}

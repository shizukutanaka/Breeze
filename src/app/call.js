// ============================================================================
// 1:1 VOICE / VIDEO CALLS — the call state machine (idle / calling / ringing
// / connected), its RTCPeerConnection lifecycle, the signal-room polling and
// the call overlay UI, extracted from index.html's initMessenger closure
// (modularization: index.html carries a hard line budget in validate.sh,
// and this subsystem is ~370 lines of it).
//
// Why a factory: these were closure functions sharing closure state. The
// state itself moved in (it was only ever touched inside this block); what
// the block used from the surrounding closure arrives via the deps object
// D — stable references destructured below (the call-signal wrap/unwrap,
// the signal room plumbing, the retry-interval registry, the abort
// controller, the settings object), plus the REASSIGNED identity bindings
// behind accessors (D.myId() / D.myPubB64() / D.myName() read live values).
// Top-level app globals (CONFIG, MS, _DOM, t, showToast, _dbg, API and the
// top-level _turnCredential) resolve from the global scope, exactly as
// they did inline. The window.* handlers the inline block installed
// (acceptCall / endCall / toggleCallMute / toggleCallCamera) are installed
// by the factory body, at instantiation, as before. Behaviour is
// unchanged — this is a move, not a rewrite.
// ============================================================================

export function createCallManager(D) {
  const { _wrapCallSignal, _unwrapCallSignal, _signal, _signalAwait, relaySend, _intervals, _ac, _settings } = D;

  let _callState = 'idle'; // idle | calling | ringing | connected
  let _callPC = null;
  let _callStream = null;    // local media stream
  let _callRemoteStream = null;
  let _callContact = null;
  let _callStartTime = 0;
  let _callTimerInterval = null;

  function getCallICEConfig() {
    const cfg = {
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
        { urls: 'stun:stun.services.mozilla.com' },
      ],
      iceCandidatePoolSize: CONFIG.ICE_CANDIDATE_POOL_SIZE,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    };
    if (_turnCredential?.iceServers) {
      // v3.6: Server returns full iceServers array (STUN + TURN combined)
      cfg.iceServers = _turnCredential.iceServers;
    } else if (_turnCredential?.urls) {
      // Legacy: single TURN server
      cfg.iceServers.push({ urls: _turnCredential.urls, username: _turnCredential.username, credential: _turnCredential.credential });
    }
    // v3.6: Privacy mode — force relay to hide both peers' IPs
    if (_settings.relayOnly) {
      cfg.iceTransportPolicy = 'relay';
      _dbg(null, 'ICE: relay-only mode (IP hidden from peers)');
    }
    return cfg;
  }

  // v3.6: Fresh ECDSA P-256 certificate per session (prevents fingerprinting)
  let _rtcCert = null;
  async function getRTCCertificate() {
    if (_rtcCert) return _rtcCert;
    try {
      _rtcCert = await RTCPeerConnection.generateCertificate({
        name: 'ECDSA', namedCurve: 'P-256'
      });
      _dbg(null, 'RTC: fresh ECDSA certificate generated');
    } catch(e) { _dbg(e, 'rtc-cert'); }
    return _rtcCert;
  }

  // v3.6: Detect safe DataChannel message size
  // v3.4: Screen Wake Lock for calls (prevents screen dimming during calls)
  let _wakeLock = null;
  async function acquireWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        _wakeLock = await navigator.wakeLock.request('screen');
        _wakeLock.addEventListener('release', () => { _wakeLock = null; });
        _dbg(null, 'Wake lock acquired');
      }
    } catch(e) { _dbg(e, 'wake-lock'); }
  }
  function releaseWakeLock() {
    try { _wakeLock?.release(); _wakeLock = null; } catch(e) { _dbg(e, 'wake-release'); }
  }
  // Re-acquire wake lock when tab becomes visible again (auto-released on hide)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && _callState !== 'idle') acquireWakeLock();
  }, { signal: _ac.signal });

  async function startCall(contact, withVideo) {
    if (_callState !== 'idle' || !contact || contact.isGroup) return;
    _callContact = contact;
    _callState = 'calling';
    showCallUI('calling', contact.name, withVideo);
    await acquireWakeLock();

    try {
      _callStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo });
      _callPC = new RTCPeerConnection(getCallICEConfig());

      _callStream.getTracks().forEach(t => _callPC.addTrack(t, _callStream));

      // v3: Prefer Opus for audio, VP9 for video (better quality at lower bitrate)
      try {
        for (const transceiver of _callPC.getTransceivers()) {
          const kind = transceiver.sender.track?.kind;
          if (kind === 'audio') {
            const codecs = RTCRtpReceiver.getCapabilities?.('audio')?.codecs || [];
            const opus = codecs.filter(c => c.mimeType === 'audio/opus');
            const rest = codecs.filter(c => c.mimeType !== 'audio/opus');
            if (opus.length && transceiver.setCodecPreferences) transceiver.setCodecPreferences([...opus, ...rest]);
          }
          if (kind === 'video') {
            const codecs = RTCRtpReceiver.getCapabilities?.('video')?.codecs || [];
            const vp9 = codecs.filter(c => c.mimeType === 'video/VP9');
            const vp8 = codecs.filter(c => c.mimeType === 'video/VP8');
            const rest = codecs.filter(c => !['video/VP9','video/VP8'].includes(c.mimeType));
            if ((vp9.length || vp8.length) && transceiver.setCodecPreferences) transceiver.setCodecPreferences([...vp9, ...vp8, ...rest]);
          }
        }
      } catch(e) { _dbg(e, 'codec-pref'); }

      _callRemoteStream = new MediaStream();
      _callPC.ontrack = (e) => {
        e.streams[0].getTracks().forEach(t => _callRemoteStream.addTrack(t));
        const remoteAudio = _DOM.get('call-remote-audio');
        const remoteVideo = _DOM.get('call-remote-video');
        if (remoteVideo && withVideo) { remoteVideo.srcObject = _callRemoteStream; remoteVideo.classList.remove('hidden'); }
        else if (remoteAudio) remoteAudio.srcObject = _callRemoteStream;
      };

      _callPC.onicecandidate = (e) => {
        if (e.candidate && API) {
          // v3.6: IP privacy — filter host + srflx in relay-only mode
          if (e.candidate.type === 'host' && e.candidate.address && !e.candidate.address.includes('.local')) return;
          if (_settings.relayOnly && (e.candidate.type === 'srflx' || e.candidate.type === 'prflx')) return;
          const room = 'call:' + [D.myId(), contact.id].sort().join(':');
          _wrapCallSignal(contact.pubB64, e.candidate).then(d => { if (d != null) _signal(room, 'call-ice', d); }).catch(err => _dbg(null, 'ICE signal wrap failed:', err?.message));
        }
      };

      _callPC.onconnectionstatechange = () => {
        if (_callPC.connectionState === 'connected' && _callState === 'calling') {
          _callState = 'connected';
          _callStartTime = Date.now();
          updateCallUI('connected');
          _callTimerInterval = setInterval(updateCallTimer, MS.SEC);
        }
        if (_callPC.connectionState === 'disconnected' || _callPC.connectionState === 'failed') {
          endCall();
        }
      };

      const offer = await _callPC.createOffer();
      await _callPC.setLocalDescription(offer);

      const room = 'call:' + [D.myId(), contact.id].sort().join(':');
      const offerSignal = await _wrapCallSignal(contact.pubB64, { sdp: offer, video: withVideo });
      if (offerSignal == null) { _dbg(null, 'call-offer encrypt failed'); endCall(); return; }
      await _signal(room, 'call-offer', offerSignal);

      // Also notify via msg relay (so recipient's poll detects the call)
      const callNotif = await _wrapCallSignal(contact.pubB64, { sdp: offer, video: withVideo });
      if (callNotif != null) await relaySend(contact.id, { to: contact.id, from: D.myId(), fromPub: D.myPubB64(), fromName: D.myName(),
        payload: callNotif, ts: Date.now(), isCall: true, isVideoCall: withVideo }, contact.pubB64);

      // Poll for answer
      pollCallSignals(contact, room);

    } catch(e) {
      _dbg(e, 'call');
      showToast(t('micDenied'), 'error');
      endCall();
    }
  }

  async function handleCallOffer(contact, offerData) {
    try {
      if (_callState !== 'idle') return; // busy
      // Authenticate the offer before showing any ringing UI: when CALL_E2E_SIGNAL is ON a
      // forged/relay-injected offer fails to decrypt → null → silently ignored (no fake ring).
      const parsed = await _unwrapCallSignal(contact.pubB64, offerData);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      _callContact = contact;
      _callState = 'ringing';
      showCallUI('ringing', contact.name, parsed.video);
  
      // Store offer for when user accepts
      window._pendingCallOffer = { contact, sdp: parsed.sdp, video: parsed.video };
    
    } catch(_e) { _dbg(_e, 'handleCallOffer'); }
  }

  async function acceptCall() {
    const pending = window._pendingCallOffer;
    if (!pending || _callState !== 'ringing') return;
    _callState = 'calling';
    updateCallUI('connecting');

    try {
      _callStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: pending.video });
      _callPC = new RTCPeerConnection(getCallICEConfig());

      _callStream.getTracks().forEach(t => _callPC.addTrack(t, _callStream));

      _callRemoteStream = new MediaStream();
      _callPC.ontrack = (e) => {
        e.streams[0].getTracks().forEach(t => _callRemoteStream.addTrack(t));
        const remoteAudio = _DOM.get('call-remote-audio');
        const remoteVideo = _DOM.get('call-remote-video');
        if (remoteVideo && pending.video) { remoteVideo.srcObject = _callRemoteStream; remoteVideo.classList.remove('hidden'); }
        else if (remoteAudio) remoteAudio.srcObject = _callRemoteStream;
      };

      _callPC.onicecandidate = (e) => {
        if (e.candidate && API) {
          // v3.6: IP privacy — filter host + srflx in relay-only mode
          if (e.candidate.type === 'host' && e.candidate.address && !e.candidate.address.includes('.local')) return;
          if (_settings.relayOnly && (e.candidate.type === 'srflx' || e.candidate.type === 'prflx')) return;
          const room = 'call:' + [D.myId(), pending.contact.id].sort().join(':');
          _wrapCallSignal(pending.contact.pubB64, e.candidate).then(d => { if (d != null) _signal(room, 'call-ice', d); }).catch(err => _dbg(null, 'ICE signal wrap failed (incoming):', err?.message));
        }
      };

      _callPC.onconnectionstatechange = () => {
        if (_callPC.connectionState === 'connected') {
          _callState = 'connected';
          _callStartTime = Date.now();
          updateCallUI('connected');
          _callTimerInterval = setInterval(updateCallTimer, MS.SEC);
        }
        if (_callPC.connectionState === 'disconnected' || _callPC.connectionState === 'failed') endCall();
      };

      await _callPC.setRemoteDescription(new RTCSessionDescription(pending.sdp));
      const answer = await _callPC.createAnswer();
      await _callPC.setLocalDescription(answer);

      const room = 'call:' + [D.myId(), pending.contact.id].sort().join(':');
      const answerSignal = await _wrapCallSignal(pending.contact.pubB64, answer);
      if (answerSignal == null) { _dbg(null, 'call-answer encrypt failed'); endCall(); return; }
      await _signal(room, 'call-answer', answerSignal);

      pollCallSignals(pending.contact, room);
    } catch(e) {
      _dbg(e, 'call-accept');
      endCall();
    }
    window._pendingCallOffer = null;
  }

  function endCall() {
    if (_callState === 'idle') return; // guard double-call
    if (_callStream) { _callStream.getTracks().forEach(t => t.stop()); _callStream = null; }
    if (_callPC) { try { _callPC.close(); } catch(e) { _dbg(e); } _callPC = null; }
    // Null srcObject before removing elements — without this, the browser keeps a
    // live MediaStream reference on the detached DOM nodes, leaving the camera/mic
    // indicator LED on even after getTracks().forEach(t => t.stop()).
    const remAudio = _DOM.get('call-remote-audio');
    const remVideo = _DOM.get('call-remote-video');
    if (remAudio) remAudio.srcObject = null;
    if (remVideo) remVideo.srcObject = null;
    _callRemoteStream = null;
    clearInterval(_callTimerInterval);
    releaseWakeLock();
    // Signal end
    if (_callContact && API) {
      const room = 'call:' + [D.myId(), _callContact.id].sort().join(':');
      _signal(room, 'call-end');
    }
    _callState = 'idle';
    _callContact = null;
    window._pendingCallOffer = null;
    hideCallUI();
  }

  function pollCallSignals(contact, room) {
    const poll = setInterval(async () => {
      if (_callState === 'idle') { clearInterval(poll); return; }
      try {
        const resp = await _signalAwait(room, 'poll');
        if (!resp.ok) return;
        const data = await resp.json();
        for (const s of (data.messages || [])) {
          if (s.sender === D.myId()) continue;
          if (s.type === 'call-answer' && _callPC && _callPC.signalingState === 'have-local-offer') {
            // Authenticate before setRemoteDescription: a forged answer (relay-injected,
            // carrying the attacker's DTLS fingerprint) fails to decrypt → null → dropped,
            // so the DTLS handshake can only complete with the pinned peer (closes call MITM).
            const ans = await _unwrapCallSignal(contact.pubB64, s.data);
            if (ans && typeof ans === 'object' && !Array.isArray(ans)) await _callPC.setRemoteDescription(new RTCSessionDescription(ans));
          }
          if (s.type === 'call-ice' && _callPC) {
            const cand = await _unwrapCallSignal(contact.pubB64, s.data);
            if (cand && typeof cand === 'object' && !Array.isArray(cand)) await _callPC.addIceCandidate(cand).catch(e => _dbg(e, 'call-ICE'));
          }
          if (s.type === 'call-end') { endCall(); clearInterval(poll); return; }
          if (s.type === 'call-offer' && _callState === 'idle') { handleCallOffer(contact, s.data); }
        }
      } catch(e) { _dbg(e); }
    }, 1000);
    _intervals.push(poll);
    // Timeout: end call after 60s if not connected
    setTimeout(() => { if (_callState === 'calling' || _callState === 'ringing') endCall(); }, CONFIG.CALL_TIMEOUT_MS);
  }

  // Call UI
  function showCallUI(state, name, withVideo) {
    hideCallUI();
    const overlay = document.createElement('div');
    overlay.id = 'call-overlay';
    overlay.className = 'call-overlay';

    const stateEl = document.createElement('div');
    stateEl.className = 'call-state'; stateEl.id = 'call-state';
    stateEl.textContent = state === 'ringing' ? t('incoming') : t('calling');

    const nameEl = document.createElement('div');
    nameEl.className = 'call-name'; nameEl.textContent = (name || '').slice(0, 64);

    const timerEl = document.createElement('div');
    timerEl.className = 'call-timer'; timerEl.id = 'call-timer'; timerEl.textContent = '00:00';

    const video = document.createElement('video');
    video.id = 'call-remote-video'; video.className = 'call-video hidden';
    video.autoplay = true; video.playsInline = true;

    const audio = document.createElement('audio');
    audio.id = 'call-remote-audio'; audio.autoplay = true;

    const actions = document.createElement('div');
    actions.className = 'call-actions';
    if (state === 'ringing') {
      const acceptBtn = document.createElement('button');
      acceptBtn.className = 'call-btn-accept'; acceptBtn.textContent = '📞'; acceptBtn.setAttribute('aria-label', t('incoming'));
      acceptBtn.onclick = () => acceptCall();
      actions.appendChild(acceptBtn);
    }
    const endBtn = document.createElement('button');
    endBtn.className = 'call-btn-end'; endBtn.textContent = '✕'; endBtn.setAttribute('aria-label', t('close'));
    endBtn.onclick = () => endCall();
    actions.appendChild(endBtn);

    const secondary = document.createElement('div');
    secondary.className = 'call-actions-secondary';
    const muteBtn = document.createElement('button');
    muteBtn.id = 'call-mute-btn'; muteBtn.className = 'call-btn-sm'; muteBtn.textContent = t('mute');
    muteBtn.onclick = () => toggleCallMute();
    secondary.appendChild(muteBtn);
    if (withVideo) {
      const camBtn = document.createElement('button');
      camBtn.id = 'call-cam-btn'; camBtn.className = 'call-btn-sm'; camBtn.textContent = t('uiCameraOff');
      camBtn.onclick = () => toggleCallCamera();
      secondary.appendChild(camBtn);
    }

    overlay.append(stateEl, nameEl, timerEl, video, audio, actions, secondary);
    document.body.appendChild(overlay);
  }

  function updateCallUI(state) {
    const el = _DOM.get('call-state');
    if (el) {
      if (state === 'connected') el.textContent = t('uiConnected');
      else if (state === 'connecting') el.textContent = t('uiConnecting');
    }
  }

  function updateCallTimer() {
    const el = _DOM.get('call-timer');
    if (!el || !_callStartTime) return;
    const s = Math.floor((Date.now() - _callStartTime) / 1000);
    el.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function hideCallUI() { _DOM.get('call-overlay')?.remove(); }

  // Make global for onclick handlers
  window.acceptCall = acceptCall;
  window.endCall = endCall;

  window.toggleCallMute = () => {
    if (!_callStream) return;
    const track = _callStream.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; }
    const btn = _DOM.get('call-mute-btn');
    if (btn) btn.textContent = track?.enabled ? t('mute') : t('unmute');
  };

  window.toggleCallCamera = () => {
    if (!_callStream) return;
    const track = _callStream.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; }
    const btn = _DOM.get('call-cam-btn');
    if (btn) btn.textContent = track?.enabled ? t('camOff') : t('camOn');
  };
  return { startCall, handleCallOffer, acceptCall, endCall, pollCallSignals, getCallICEConfig, state: () => _callState };
}

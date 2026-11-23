// Voice message recording (MediaRecorder + AnalyserNode waveform) and
// Speech-to-Text (Web Speech API) extracted from index.html.
//
// Instantiated inside initMessenger with closure bindings injected via D.
// Absent module ⇒ inert stub in index.html so the rest of the app still boots.

export function createVoiceInput(D) {
  const {
    DOM, config, haptic, t, showToast, safeSetHTML, dbg, autoHeight,
    encryptFor, relaySend, fanOut, dbPut, appendMsg, renderContacts,
    correctedNow, genMsgId,
    activeContact, myId, myPubB64, myName,
  } = D;

  let _mediaRecorder = null;
  let _audioChunks = [];
  let _recTimer = null;
  let _recStartTs = 0;

  // v3.3: Voice message recording
  const voiceBtn = DOM.get('b-msg-voice');
  if (voiceBtn) {
    voiceBtn.addEventListener('click', async () => {
      const contact = activeContact();
      if (!contact) return;
      haptic.tap();
      if (_mediaRecorder && _mediaRecorder.state === 'recording') {
        _mediaRecorder.stop();
        voiceBtn.textContent = '🎤';
        voiceBtn.classList.remove('voice-recording');
        voiceBtn.setAttribute('aria-pressed', 'false');
        DOM.get('voice-rec-indicator')?.remove();
        clearInterval(_recTimer); _recTimer = null;
        return;
      }
      // Voice still has no group transport — refuse BEFORE recording, not after a full take is recorded.
      if (contact.isGroup) { showToast(t('groupNoVoice'), 'error'); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        _audioChunks = [];
        _mediaRecorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm',
        });
        _mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) _audioChunks.push(e.data); };

        let _audioCtx = null, _analyser = null, _waveRaf = null;
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) {
            _audioCtx = new AudioCtx();
            const source = _audioCtx.createMediaStreamSource(stream);
            _analyser = _audioCtx.createAnalyser();
            _analyser.fftSize = 64;
            source.connect(_analyser);
          }
        } catch {}

        _mediaRecorder.onstop = async () => {
          stream.getTracks().forEach(tr => tr.stop());
          if (_waveRaf) cancelAnimationFrame(_waveRaf);
          if (_audioCtx) try { _audioCtx.close(); } catch {}
          _audioCtx = null; _analyser = null;
          const blob = new Blob(_audioChunks, { type: _mediaRecorder.mimeType });
          if (blob.size < 100) return; // Too short
          const maxSize = config.FILE_MAX;
          if (blob.size > maxSize) { showToast(t('toastVoiceLong'), 'error'); return; }
          const file = new File([blob], 'voice-' + Date.now() + '.webm', { type: blob.type });
          const reader = new FileReader();
          reader.onload = async () => {
            const b64 = reader.result.split(',')[1];
            const filePayload = JSON.stringify({ name: file.name, type: file.type, size: file.size, data: b64 });
            try {
              // Backstop: the chat may have been switched to a group while recording — refuse honestly.
              const cur = activeContact();
              if (cur?.isGroup) { showToast(t('groupNoVoice'), 'error'); return; }
              if (!cur) return;
              const encrypted = await encryptFor(filePayload, cur.pubB64);
              if (!encrypted) { dbg(null, 'encrypt failed'); return; }
              const ts = correctedNow();
              const text = '🎤 Voice (' + Math.ceil(blob.size / 1024) + 'KB)';
              await dbPut('messages', { msgId: genMsgId(), contactId: cur.id, text, mine: true, ts, fileData: filePayload });
              cur.lastMsg = text; cur.lastMsgAt = ts;
              await dbPut('contacts', cur);
              await relaySend(cur.id, { to: cur.id, from: myId(), fromPub: myPubB64(), fromName: myName(), payload: encrypted, ts, isFile: true }, cur.pubB64);
              fanOut(cur, filePayload, ts, { isFile: true },
                { isFile: true, sfFor: cur.id, sfPub: cur.pubB64, sfName: cur.name });
              appendMsg(text, true, ts, null, filePayload, { msgId: genMsgId() });
              renderContacts();
              haptic.success();
            } catch (err) { dbg(err, 'voice-send'); showToast(t('toastSendFailed'), 'error'); }
          };
          reader.readAsDataURL(blob);
        };
        _mediaRecorder.start();
        _recStartTs = Date.now();
        voiceBtn.textContent = '⏹';
        voiceBtn.classList.add('voice-recording');
        voiceBtn.setAttribute('aria-pressed', 'true');
        haptic.send();
        // v3.6: Recording indicator with timer + waveform
        const bar = DOM.get('msg-input-bar');
        if (bar) {
          const ind = document.createElement('div');
          ind.id = 'voice-rec-indicator';
          ind.className = 'voice-rec-ind';
          safeSetHTML(ind, '<span class="rec-dot"></span><span class="rec-timer">0:00</span><span class="rec-wave"><span></span><span></span><span></span><span></span><span></span></span>');
          bar.insertBefore(ind, bar.firstChild);
          _recTimer = setInterval(() => {
            const s = Math.floor((Date.now() - _recStartTs) / 1000);
            const timerEl = ind.querySelector('.rec-timer');
            if (timerEl) timerEl.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
          }, 500);
          if (_analyser) {
            const bars = ind.querySelectorAll('.rec-wave span');
            const dataArray = new Uint8Array(_analyser.frequencyBinCount);
            const updateWave = () => {
              _analyser.getByteFrequencyData(dataArray);
              for (let i = 0; i < bars.length; i++) {
                const val = dataArray[i * 2 + 2] || 0;
                bars[i].style.height = Math.max(4, val / 8) + 'px';
              }
              _waveRaf = requestAnimationFrame(updateWave);
            };
            updateWave();
          }
        }
        setTimeout(() => { if (_mediaRecorder?.state === 'recording') _mediaRecorder.stop(); }, config.VOICE_MAX_MS);
      } catch (err) { dbg(err, 'voice'); showToast(t('toastMicDenied'), 'error'); }
    });
  }

  // v3.3: AI — Speech-to-Text (Web Speech API)
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const sttBtn = DOM.get('b-msg-stt');
  let _sttActive = false;
  let _recognition = null;
  if (SpeechRecognition && sttBtn) {
    sttBtn.classList.remove('hidden');
    _recognition = new SpeechRecognition();
    _recognition.continuous = false;
    _recognition.interimResults = true;
    _recognition.lang = navigator.language || 'en-US';
    _recognition.onresult = (ev) => {
      const input = DOM.get('msg-input');
      let final = '', interim = '';
      for (let i = 0; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) final += ev.results[i][0].transcript;
        else interim += ev.results[i][0].transcript;
      }
      input.value = final || interim;
      autoHeight(input);
    };
    _recognition.onend = () => {
      _sttActive = false;
      sttBtn.classList.remove('color-g', 'color-r');
      sttBtn.classList.add('color-t3');
      sttBtn.textContent = '🗣';
      sttBtn.setAttribute('aria-pressed', 'false');
    };
    _recognition.onerror = (e) => {
      _sttActive = false;
      sttBtn.classList.remove('color-g', 'color-r');
      sttBtn.classList.add('color-t3');
      if (e.error !== 'no-speech') showToast(t('toastServerError') + ': ' + e.error, 'error');
    };
    sttBtn.addEventListener('click', () => {
      if (_sttActive) { _recognition.stop(); _sttActive = false; return; }
      _sttActive = true;
      sttBtn.classList.remove('color-g', 'color-t3');
      sttBtn.classList.add('color-r');
      sttBtn.textContent = '🔴';
      sttBtn.setAttribute('aria-pressed', 'true');
      _recognition.start();
    });
  }

  // Release mic and clear timers on account switch without firing onstop.
  function cleanup() {
    if (_mediaRecorder && _mediaRecorder.state === 'recording') {
      try {
        const mrStream = _mediaRecorder.stream;
        _mediaRecorder.onstop = null;
        _mediaRecorder.stop();
        if (mrStream) mrStream.getTracks().forEach(tr => tr.stop());
      } catch (e) { dbg(e); }
    }
    if (_recTimer) { clearInterval(_recTimer); _recTimer = null; }
    if (_sttActive && _recognition) {
      try { _recognition.stop(); } catch (e) { dbg(e); }
      _sttActive = false;
    }
  }

  return { cleanup };
}

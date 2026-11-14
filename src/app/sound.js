// ============================================================================
// NOTIFICATION SOUND + HAPTICS — the Web Audio notification chime, the send
// pop, and the Vibration API patterns, extracted from index.html's top
// level (modularization: index.html carries a hard line budget in
// validate.sh). These only ever used true globals (localStorage,
// AudioContext, navigator), resolved exactly as they did inline; index.html
// keeps call-time bridge wrappers under the original names. Behaviour is
// unchanged — this is a move, not a rewrite.
// ============================================================================

export function createSoundHelper() {
  function playNotif() {
    if (localStorage.getItem('brz-notif-sound') === '0') return;
    try {
      // v3: Improved notification sound (soft chime, two-tone ascending)
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const g = ac.createGain();
      g.connect(ac.destination);
      g.gain.setValueAtTime(0.12, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.3); // Fade out
      const o1 = ac.createOscillator(); o1.type = 'sine'; o1.frequency.value = 830;
      o1.connect(g); o1.start(ac.currentTime); o1.stop(ac.currentTime + 0.12);
      const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = 1245;
      o2.connect(g); o2.start(ac.currentTime + 0.12); o2.stop(ac.currentTime + 0.25);
      // v3.6: Haptic feedback via unified helper
      haptic.notify();
    } catch(e) { _dbg(e); }
  }

  // v3.3: Send confirmation sound (soft pop)
  function playSendSound() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const g = ac.createGain();
      g.connect(ac.destination);
      g.gain.setValueAtTime(0.06, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.15);
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = 1400;
      o.connect(g); o.start(ac.currentTime); o.stop(ac.currentTime + 0.1);
    } catch(e) { _dbg(e); }
  }

  // v3.6: Haptic feedback via the Vibration API (mobile browsers); silent no-op on desktop.
  const haptic = {
    tap:     () => { try { navigator.vibrate?.(8); } catch {} },           // Light tap (button press)
    send:    () => { try { navigator.vibrate?.([6, 30, 6]); } catch {} },   // Double-tap (message sent)
    success: () => { try { navigator.vibrate?.([8, 40, 12]); } catch {} },  // Success pattern
    error:   () => { try { navigator.vibrate?.([30, 20, 30]); } catch {} }, // Error buzz
    notify:  () => { try { navigator.vibrate?.([12, 50, 8, 50, 12]); } catch {} }, // Notification
  };
  return { playNotif, playSendSound, haptic };
}

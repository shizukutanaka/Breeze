// ============================================================================
// SETTINGS VIEW — the controller behind the dedicated #settings-view screen,
// extracted from index.html's initMessenger closure (modularization: the
// markup already lives in settings-panel.js; this module owns rendering that
// markup, its delegated controls, and the open/close history behaviour).
// Everything it used inline arrives through deps, with reassigned closure
// bindings behind getters. Behaviour is unchanged — this is a move, not a
// rewrite.
// ============================================================================

export function createSettingsView(deps) {
  // The settings panel used to render into #msg-messages (the chat log,
  // role="log"): it stacked into the conversation, never entered history,
  // and on desktop there was no button that reached it at all. It now
  // renders into the dedicated #settings-view screen; opening pushes a
  // history entry so Back (browser or the view's own button) returns to
  // exactly what was on screen before. Every entry point — the /settings
  // command, the mobile Settings tab, the sidebar-head button, the
  // ?settings shortcut — funnels through open().
  let _settingsViewOpen = false;

  // Automatic-backup status line: the module owns the state machine
  // (src/app/backup.js getAutoBackupStatus); Settings only words it.
  function autoBackupStatusText(st) {
    if (!st) return '';
    switch (st.state) {
      case 'off': return deps.t('autoBackupOff');
      case 'ineligible': return deps.t('toastRecoveryNoneBackup');
      case 'noserver': return deps.t('autoBackupNoServer');
      case 'needpass': return deps.t('autoBackupNeedPass');
      case 'error': return deps.t('autoBackupError');
      case 'pending': return deps.t('autoBackupPending');
      case 'ok': return deps.t('autoBackupLast', new Date(st.lastOkAt).toLocaleString());
      default: return deps.t('autoBackupNever');
    }
  }

  function renderPanel(d) {
    const renderSettings = globalThis.__breezeSettingsPanel?.settingsPanelHtml;
    if (!renderSettings) return;
    const settings = deps.settings();
    deps.safeSetHTML(d, renderSettings({
      t: deps.t, esc: deps.esc, myName: deps.myName(),
      hideReadReceipts: deps.privacyHideReadReceipts(), readReceiptDelay: !!settings.readReceiptDelay,
      hideTyping: deps.privacyHideTyping(), relayOnly: settings.relayOnly, ktBlock: settings.ktBlockOnTamper,
      showPeerName: settings.showPeerName !== false, callHistoryLog: settings.callHistoryLog !== false,
      notifSound: localStorage.getItem('brz-notif-sound') !== '0', sendSound: localStorage.getItem('brz-send-sound') !== '0',
      focus: deps._focusActive(), focusStrict: settings.focusStrict, autoLock: localStorage.getItem('brz-autolock') === '1',
      notifPerm: typeof Notification !== 'undefined' && Notification.permission === 'granted', autoBackup: settings.autoBackup !== false,
      fanout: deps._fanoutCount(), powerMode: ['auto', 'normal', 'saver', 'emergency'].includes(settings.powerMode) ? settings.powerMode : 'auto',
      relays: deps.homeRelays().map(r => ({ label: r.label || r.url, url: r.url, origin: deps.isOriginRelay(r), blocked: deps._relayBlockedUrls.has(r.url), status: typeof deps._relayStatusText === 'function' ? deps._relayStatusText(r) : '' })),
      localRoom: typeof deps.localRoom === 'function' ? deps.localRoom() : null,
      tabCalls: settings.tabCalls !== false, tabContacts: settings.tabContacts !== false,
      tabSelf: settings.tabSelf !== false, tabSettings: settings.tabSettings !== false, tabOrder: deps._validTabOrder(),
    }));
    // (The add-account door is the account tab bar — renderAccountTabs
    // renders it for a single account too, so Settings needs no button.)
    // SHARE_PLAN stage 4 step 1: the invite / migrate doors — the same
    // flows as /invite and /migrate, on buttons (src/app/share.js).
    d.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-action="invite-friend"]')) { deps.haptic.tap(); deps.shareInvite(); return; }
      if (ev.target.closest('[data-action="migrate-apps"]')) { deps.haptic.tap(); deps.showMigratePanel(); }
    });
    // Display name: writes through the profile module's own save path
    // (_profileUI.setDisplayName → the same _saveProfile the /profile
    // panel's OK button uses) — Settings keeps no name store of its own
    // and the two editors can never drift apart.
    d.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('[data-action="save-display-name"]');
      if (!btn) return;
      deps.haptic.tap();
      const input = d.querySelector('.settings-name-input');
      const name = input?.value.trim() || '';
      if (!name) { input?.focus(); return; }
      if (await deps._profileUI?.setDisplayName(name)) deps.showToast(deps.t('profileSaved'), 'success');
    });
    const syncTabOrderRows = () => {
      const list = d.querySelector('[data-tab-order-list]'); if (!list) return;
      const order = deps._validTabOrder();
      for (const k of order) { const row = list.querySelector(`[data-order-tab="${k}"]`); if (row) list.appendChild(row); }
      order.forEach((k, i) => list.querySelector(`[data-order-tab="${k}"]`)?.querySelectorAll('[data-action="tab-move"]').forEach(btn => { btn.disabled = btn.dataset.dir === '-1' ? i === 0 : i === order.length - 1; }));
    };
    const saveTabOrder = (order) => { deps.settings().tabOrder = order.slice(); deps.saveSettings(); deps._applyTabOrder(); syncTabOrderRows(); };
    const moveTab = (key, dir) => {
      const order = deps._validTabOrder(), from = order.indexOf(key), to = from + dir;
      if (from < 0 || to < 0 || to >= order.length) return;
      [order[from], order[to]] = [order[to], order[from]];
      saveTabOrder(order);
    };
    d.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-action="tab-move"]'); if (!btn) return;
      deps.haptic.tap(); moveTab(btn.dataset.tab, parseInt(btn.dataset.dir, 10));
    });
    let dragTab = '';
    const clearTabDrag = () => { dragTab = ''; d.querySelectorAll('.dragging,.drag-over').forEach(row => row.classList.remove('dragging', 'drag-over')); };
    d.addEventListener('dragstart', (ev) => {
      const row = ev.target.closest('[data-order-tab]'); if (!row) return;
      dragTab = row.dataset.orderTab; row.classList.add('dragging');
      if (ev.dataTransfer) { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', dragTab); }
    });
    d.addEventListener('dragend', clearTabDrag);
    d.addEventListener('dragover', (ev) => {
      const row = ev.target.closest('[data-order-tab]'); if (!dragTab || !row) return;
      ev.preventDefault();
      if (row.dataset.orderTab === dragTab) return;
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
      d.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      row.classList.add('drag-over');
    });
    d.addEventListener('drop', (ev) => {
      const row = ev.target.closest('[data-order-tab]'); if (!dragTab || !row) return;
      ev.preventDefault();
      const order = deps._validTabOrder(), from = order.indexOf(dragTab);
      if (from < 0 || !order.includes(row.dataset.orderTab)) { clearTabDrag(); return; }
      const rect = row.getBoundingClientRect();
      let to = order.indexOf(row.dataset.orderTab) + (((ev.clientX - rect.left) > rect.width / 2) !== (document.dir === 'rtl') ? 1 : 0);
      const [moved] = order.splice(from, 1); if (from < to) to--;
      order.splice(Math.max(0, Math.min(to, order.length)), 0, moved);
      saveTabOrder(order); clearTabDrag();
    });
    // Stage-2 step 5: home-relay management. Adding a relay is the
    // step-4 pin ceremony pointed at a second relay (attest, show
    // the fingerprint, confirm, then pin); removal is local
    // bookkeeping — the relay keeps whatever it already holds, it
    // simply stops being called home.
    d.addEventListener('click', async (ev) => {
      const addBtn = ev.target.closest('[data-action="add-relay"]');
      if (addBtn) { deps.haptic.tap(); await deps._addRelayFlow(); return; }
      const stopRoomBtn = ev.target.closest('[data-action="stop-local-room"]');
      if (stopRoomBtn) { deps.haptic.tap(); await deps.stopLocalRoom(); return; }
      const inviteRoomBtn = ev.target.closest('[data-action="invite-from-room"]');
      if (inviteRoomBtn) { deps.haptic.tap(); deps.shareInvite(); return; }
      const rmBtn = ev.target.closest('[data-action="remove-relay"]');
      if (!rmBtn) return;
      deps.haptic.tap();
      const url = rmBtn.dataset.url;
      if (!await deps.showConfirm(deps.t('relayRemoveConfirm', url), { danger: true, okText: deps.t('relayRemoveBtn') })) return;
      await deps.removeHomeRelay(url);
      deps.showToast(deps.t('relayRemoved', url), 'success');
    });
    // v3.6: Event delegation for settings toggles (no inline onchange)
    d.addEventListener('change', (ev) => {
      const cb = ev.target;
      const s = cb.dataset.setting;
      if (!s) return;
      deps.haptic.tap();
      // One sensible default each — a menu of durations was a requirement nobody asked for.
      // `/focus N` still exists for anyone who wants an exact number of minutes.
      if (s === 'auto-backup') { deps.settings().autoBackup = cb.checked; deps.saveSettings(); return; }
      if (s === 'show-peer-name') { deps.settings().showPeerName = cb.checked; deps.saveSettings(); deps.renderContacts(); const current = deps.activeContact(); if (current) deps._setConvName(current); return; } if (s === 'call-history-log') { deps.settings().callHistoryLog = cb.checked; deps.saveSettings(); return; }
      if (s.startsWith('tab-vis-')) { const k = s.slice(8); deps.settings()[{ calls: 'tabCalls', contacts: 'tabContacts', self: 'tabSelf', settings: 'tabSettings' }[k]] = cb.checked; deps.saveSettings(); deps._applyTabVisibility(); if (!cb.checked && k === 'contacts' && deps.listTab() === 'contacts') deps._showChatsTab(); if (!cb.checked && k === 'calls' && deps.listTab() === 'calls') deps._showChatsTab(); if (!cb.checked && k === 'settings') deps.closeSettingsView(); return; }
      if (s === 'rr-delay') { deps.settings().readReceiptDelay = cb.checked ? 120 : 0; deps.saveSettings(); return; }
      if (s === 'fanout') { const n = parseInt(cb.value, 10); deps.settings().fanout = [1, 2, 3].includes(n) ? n : 2; deps.saveSettings(); return; }
      if (s === 'power-mode') { deps.settings().powerMode = ['auto', 'normal', 'saver', 'emergency'].includes(cb.value) ? cb.value : 'auto'; deps.saveSettings(); return; }
      if (s === 'focus') {
        deps.settings().focusUntil = cb.checked ? Date.now() + 60 * deps.MS.MIN : 0;
        if (!cb.checked) deps.settings().focusStrict = false;
        deps.saveSettings(); deps._updateFocusBanner();
        return;
      }
      if (s === 'focus-strict') { deps.settings().focusStrict = cb.checked; deps.saveSettings(); deps._updateFocusBanner(); return; }
      if (s === 'hide-rr') { localStorage.setItem('brz-hide-rr', cb.checked ? '1' : '0'); deps.setPrivacyHideReadReceipts(cb.checked); window._privacyHideReadReceipts = cb.checked; }
      else if (s === 'hide-typing') { localStorage.setItem('brz-hide-typing', cb.checked ? '1' : '0'); deps.setPrivacyHideTyping(cb.checked); window._privacyHideTyping = cb.checked; }
      else if (s === 'relay-only') { localStorage.setItem('brz-relay-only', cb.checked ? '1' : '0'); deps.settings().relayOnly = cb.checked; } else if (s === 'kt-block') { deps.settings().ktBlockOnTamper = cb.checked; deps.saveSettings(); }
      else if (s === 'notif-sound') { localStorage.setItem('brz-notif-sound', cb.checked ? '1' : '0'); }
      else if (s === 'send-sound') { localStorage.setItem('brz-send-sound', cb.checked ? '1' : '0'); }
      else if (s === 'notif-perm') { if (cb.checked) { if (typeof Notification === 'undefined') { cb.checked = false; } else Notification.requestPermission().then(p => { if (p !== 'granted') cb.checked = false; }).catch(() => { cb.checked = false; }); } }
      else if (s === 'auto-lock') { localStorage.setItem('brz-autolock', cb.checked ? '1' : '0'); }
    });
    // Relay fingerprints fill in async (a pin is a public key; the
    // fingerprint is derived from it). A keyless entry — a legacy
    // origin with no relay identity key — keeps the placeholder.
    for (const r of deps.homeRelays()) {
      if (!r.pin) continue;
      deps.relayFingerprint(r.pin).then(fp => {
        const el = d.querySelector(`[data-relay-fp="${r.url}"]`);
        if (el) el.textContent = fp;
      }).catch(e => deps._dbg(e, 'relay-fp'));
    }
    // Automatic-backup status fills in async (the state record lives
    // in the settings store). The arm button appears only in the two
    // states a passphrase entry can fix.
    const fillAutoBackupStatus = () => {
      deps.getAutoBackupStatus().then(st => {
        const el = d.querySelector('[data-autobackup-status]');
        if (el) el.textContent = autoBackupStatusText(st);
        const arm = d.querySelector('[data-action="autobackup-arm"]');
        if (arm) arm.closest('.settings-action-row')?.classList.toggle('hidden', !(st && (st.state === 'needpass' || st.state === 'error')));
      }).catch(e => deps._dbg(e, 'autobackup-status'));
    };
    fillAutoBackupStatus();
    d.addEventListener('click', async (ev) => {
      if (ev.target.closest('[data-action="migrate-device"]')) { deps.haptic.tap(); deps.showMigrationGuide(); return; }
      if (ev.target.closest('[data-action="autobackup-arm"]')) { deps.haptic.tap(); if (await deps.armAutoBackup()) fillAutoBackupStatus(); }
    });
  }

  function open() {
    const view = deps._DOM.get('settings-view');
    const body = deps._DOM.get('settings-body');
    if (!view || !body) return;
    body.replaceChildren();
    const d = document.createElement('div');
    d.className = 'settings-panel';
    body.appendChild(d);
    deps._renderSettingsPanel(d); deps._setActiveTab('settings');
    if (!_settingsViewOpen) {
      _settingsViewOpen = true;
      view.classList.remove('hidden');
      history.pushState({ breezeSettings: true }, '');
    }
  }

  function close() {
    if (!_settingsViewOpen) return;
    _settingsViewOpen = false;
    deps._DOM.get('settings-view')?.classList.add('hidden');
    deps._setActiveTab(deps.listTab());
  }

  function isOpen() { return _settingsViewOpen; }

  return { renderPanel, open, close, isOpen };
}

// Settings-panel help affordances. Pure UI wiring: the host supplies the
// dialog primitives and translations; this module only decorates the panel
// after renders and opens one explanatory dialog per control/action.

export const SETTINGS_HELP_MAP = Object.freeze({
  settings: Object.freeze({
    'auto-backup': 'helpSetAutoBackup',
    'auto-lock': 'helpSetAutoLock',
    'call-history-log': 'helpSetCallHistoryLog',
    fanout: 'helpSetFanout',
    focus: 'helpSetFocus',
    'focus-strict': 'helpSetFocusStrict',
    'hide-rr': 'helpSetHideRr',
    'hide-typing': 'helpSetHideTyping',
    'kt-block': 'helpSetKtBlock',
    'notif-perm': 'helpSetNotifPerm',
    'notif-sound': 'helpSetNotifSound',
    'power-mode': 'helpSetPowerMode',
    'relay-only': 'helpSetRelayOnly',
    'rr-delay': 'helpSetRrDelay',
    'send-sound': 'helpSetSendSound',
    'show-peer-name': 'helpSetShowPeerName',
    'tab-vis-calls': 'helpSetTabVisCalls',
    'tab-vis-contacts': 'helpSetTabVisContacts',
    'tab-vis-self': 'helpSetTabVisSelf',
    'tab-vis-settings': 'helpSetTabVisSettings',
  }),
  actions: Object.freeze({
    'add-relay': 'helpSetAddRelay',
    'autobackup-arm': 'helpSetAutobackupArm',
    backup: 'helpSetBackup',
    'cloudflare-quickstart': 'helpSetCloudflareQuick',
    'cloudflare-save': 'helpSetCloudflareSave',
    'cloudflare-verify': 'helpSetCloudflareVerify',
    'cloudflare-setup': 'helpSetCloudflareSetup',
    'cloudflare-disconnect': 'helpSetCloudflareDisconnect',
    'invite-friend': 'helpSetInviteFriend',
    'migrate-apps': 'helpSetMigrateApps',
    'migrate-device': 'helpSetMigrateDevice',
    'remove-relay': 'helpSetRemoveRelay',
    restore: 'helpSetRestore',
    'restore-file': 'helpSetRestoreFile',
    'save-display-name': 'helpSetSaveDisplayName',
  }),
});

const HELP_BUTTON_CLASS = 'settings-help-btn';

export function installSettingsHelp(D) {
  const cleanText = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const rowFor = (el) => el?.dataset?.setting ? (el.closest('label') || el) : el;
  const labelText = (row, control) => {
    if (!control?.dataset?.setting || !row?.childNodes) return cleanText(row?.textContent);
    const direct = [...row.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ');
    return cleanText(direct) || cleanText(row.textContent);
  };
  const hitFor = (el) => {
    const setting = el?.dataset?.setting;
    if (setting && SETTINGS_HELP_MAP.settings[setting]) return { id: 'setting:' + setting, key: SETTINGS_HELP_MAP.settings[setting] };
    const action = el?.dataset?.action;
    if (action && SETTINGS_HELP_MAP.actions[action]) return { id: 'action:' + action, key: SETTINGS_HELP_MAP.actions[action] };
    return null;
  };
  const decoratedButton = (row, id) => {
    let n = row?.nextSibling;
    while (n && n.nodeType === 3 && !n.textContent.trim()) n = n.nextSibling;
    return n && n.nodeType === 1 && n.classList?.contains(HELP_BUTTON_CLASS) && n.dataset.helpFor === id ? n : null;
  };

  function showHelp(title, key) {
    const [dlg, titleId] = D.makeDialog();
    D.safeSetHTML(dlg, `<div class="modal-title" id="${titleId}">${D.esc(title)}</div>
      <div class="modal-desc settings-help-desc"></div>
      <div class="modal-actions"><button class="btn btn-g btn-sm" value="cancel">${D.esc(D.t('ok'))}</button></div>`);
    dlg.querySelector('.settings-help-desc').textContent = D.t(key);
    D.showDialog(dlg);
    dlg.querySelector('[value="cancel"]')?.focus();
    let settled = false;
    const close = () => { if (settled) return; settled = true; dlg.close(); dlg.remove(); };
    D.wireDialogDismiss(dlg, close);
  }

  function decorate(root) {
    for (const el of root.querySelectorAll('[data-setting],[data-action]')) {
      const hit = hitFor(el);
      if (!hit) continue;
      const row = rowFor(el);
      if (!row?.parentNode) continue;
      const prior = decoratedButton(row, hit.id);
      if (prior) { prior.classList.toggle('hidden', row.classList?.contains('hidden')); continue; }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-o btn-sm ' + HELP_BUTTON_CLASS;
      btn.textContent = '?';
      btn.dataset.helpFor = hit.id;
      btn.classList.toggle('hidden', row.classList?.contains('hidden'));
      btn.setAttribute('aria-label', D.t('helpBtnLabel'));
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        showHelp(labelText(row, el), hit.key);
      });
      row.parentNode.insertBefore(btn, row.nextSibling);
    }
  }

  const panel = () => D.domGet?.('settings-body');
  const scan = () => { const body = panel(); if (body) decorate(body); };
  let observer = null;
  scan();
  const body = panel();
  if (body && typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(scan);
    observer.observe(body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }
  return { decorate: scan, showHelp, disconnect: () => observer?.disconnect() };
}

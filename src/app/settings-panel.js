// Settings-screen markup (UI/UX stage 4): grouped sections and row-shaped
// controls. Pure presentation — the caller passes the current values and all
// behaviour stays in the existing delegated handlers in index.html.

const POWER_MODES = Object.freeze([
  ['auto', 'powerAuto'],
  ['normal', 'powerNormal'],
  ['saver', 'powerSaver'],
  ['emergency', 'powerEmergency'],
]);

export function settingsPanelHtml(v) {
  const { t, esc } = v;
  const ico = (name) => `<span data-icon="${name}" data-icon-class="settings-ico" aria-hidden="true"></span>`;
  const chevron = '<span class="settings-chevron" aria-hidden="true"></span>';
  const section = (title, body, extra = '', attrs = '') => `<section class="settings-section${extra}"${attrs}><h2>${esc(title)}</h2><div class="settings-card">${body}</div></section>`;
  const check = (setting, icon, label, checked) => `<div class="settings-row"><label class="settings-row-main i-cur">${ico(icon)}<span class="settings-row-label">${esc(label)}</span><input type="checkbox" data-setting="${setting}"${checked ? ' checked' : ''}></label></div>`;
  const action = (act, icon, label, extra = '') => `<div class="settings-row settings-action-row${extra}" data-action-row="${act}"><button type="button" class="settings-action-main" data-action="${act}">${ico(icon)}<span class="settings-row-label">${esc(label)}</span>${chevron}</button></div>`;
  const options = (pairs, selected) => pairs.map(([value, key]) => `<option value="${value}"${selected === value ? ' selected' : ''}>${esc(t(key))}</option>`).join('');
  const selectRow = (setting, icon, label, inner) => `<div class="settings-row"><label class="settings-row-main i-cur">${ico(icon)}<span class="settings-row-label">${esc(label)}</span><select data-setting="${setting}">${inner}</select></label></div>`;

  const relayRows = v.relays.map((r) => {
    const fp = `<span class="settings-row-sub" data-relay-fp="${esc(r.url)}">…</span>${r.blocked ? ' ⚠' : ''}`;
    const rm = r.origin ? '' : `<button type="button" class="btn btn-o btn-sm" data-action="remove-relay" data-url="${esc(r.url)}">${esc(t('relayRemoveBtn'))}</button>`;
    return `<div class="settings-row settings-relay-row">${ico('globe')}<span class="settings-row-label"><span>${esc(r.label)}${r.origin ? ' ' + esc(t('relayOriginTag')) : ''}</span>${fp}</span><span class="settings-row-value">${rm}</span></div>`;
  }).join('');

  const fanoutOpts = [1, 2, 3].map((n) => `<option value="${n}"${v.fanout === n ? ' selected' : ''}>${n}</option>`).join('');
  const cloudflare = `<div class="settings-note">${esc(t('cfNote'))}</div><div class="settings-note">${esc(t('cfGuideText'))} <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener noreferrer">${esc(t('cfCreateTokenLink'))}</a></div>`
    + `<div class="settings-row settings-row-stack"><label class="settings-row-main">${ico('lock')}<span class="settings-row-label">${esc(t('cfTokenLabel'))}</span><input type="password" class="field cloudflare-token-input" autocomplete="off" placeholder="${esc(t('cfTokenPlaceholder'))}"></label></div>`
    + action('cloudflare-quickstart', 'check', t('cfQuickSetup'))
    + action('cloudflare-save', 'check', t('cfSave'))
    + action('cloudflare-verify', 'check', t('cfVerify'))
    + action('cloudflare-setup', 'globe', t('cfSetup'))
    + action('cloudflare-disconnect', 'x', t('cfDisconnect'), ' settings-danger-row')
    + '<div class="settings-status" data-cloudflare-status></div><div class="settings-status" data-cloudflare-setup-status></div>';

  return `<section class="settings-profile"><div class="settings-profile-card">${ico('user')}<label class="settings-profile-main"><span>${esc(t('yourDisplayName'))}</span><input type="text" class="field settings-name-input" maxlength="64" value="${esc(v.myName)}"></label><button type="button" class="btn btn-g btn-sm" data-action="save-display-name">${esc(t('profileSave'))}</button></div></section>`
    + section(t('settingsPrivacy'),
      check('hide-rr', 'lock', t('hideReadReceipts'), v.hideReadReceipts)
      + check('rr-delay', 'clock', t('rrDelayLabel'), v.readReceiptDelay)
      + check('hide-typing', 'message', t('hideTyping'), v.hideTyping)
      + check('kt-block', 'warning', t('ktBlockLabel'), v.ktBlock)
      + check('show-peer-name', 'user', t('showPeerNameLabel'), v.showPeerName)
      + check('call-history-log', 'phone', t('callHistoryLogLabel'), v.callHistoryLog))
    + section(t('settingsSound'),
      check('notif-sound', 'message', t('notifSound'), v.notifSound)
      + check('send-sound', 'send', t('sendSound'), v.sendSound))
    + section(t('settingsNotif'),
      check('focus', 'mute', t('focusLabel'), v.focus)
      + check('focus-strict', 'mute', t('focusStrictLabel'), v.focusStrict)
      + check('notif-perm', 'check', t('enableNotif'), v.notifPerm))
    + section(t('settingsShare'),
      action('invite-friend', 'send', t('btnInviteFriend'))
      + action('migrate-apps', 'users', t('btnMigrateApps')))
    + section(t('settingsAccounts'), check('auto-lock', 'lock', t('autoLockLabel'), v.autoLock))
    + section(t('settingsBackup'),
      action('backup', 'archive', t('backupBtn'))
      + action('restore', 'arrow-down', t('restoreBtn'))
      + action('restore-file', 'arrow-down', t('restoreFileBtn'))
      + check('auto-backup', 'check', t('autoBackupLabel'), v.autoBackup)
      + `<div class="settings-row settings-status-row">${ico('clock')}<span class="settings-row-label settings-status" data-autobackup-status>…</span></div>`
      + action('autobackup-arm', 'lock', t('autoBackupArmBtn'), ' hidden')
      + action('migrate-device', 'arrow-up', t('migrateDeviceBtn')))
    + section(t('settingsRelays'), relayRows
      + action('add-relay', 'plus', t('relayAddBtn'))
      + selectRow('fanout', 'users', t('relayFanoutLabel'), fanoutOpts)
      + selectRow('power-mode', 'sun', t('powerModeLabel'), options(POWER_MODES, v.powerMode))
      + check('relay-only', 'lock', t('relayOnly'), v.relayOnly))
    + section(t('tabBarSection'), `<div class="settings-note">${esc(t('tabChatsAlways'))}</div>`
      + check('tab-vis-calls', 'phone', t('tabShowCalls'), v.tabCalls)
      + check('tab-vis-contacts', 'users', t('tabShowContacts'), v.tabContacts)
      + check('tab-vis-self', 'user', t('tabShowSelf'), v.tabSelf)
      + check('tab-vis-settings', 'settings', t('tabShowSettings'), v.tabSettings))
    + section(t('settingsCloudflare'), cloudflare, ' settings-section-advanced', ' data-cloudflare-section')
    + `<div class="settings-note settings-end">${esc(t('settingsImmediate'))}</div>`;
}

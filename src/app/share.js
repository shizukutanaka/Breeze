// ============================================================================
// SHARE / MIGRATE SURFACING — the invite and migration flows that used to be
// reachable only by typing slash commands (/invite, /qr, /newgroup,
// /migrate, /import), packaged as UI-callable tools so normal screens can
// offer them directly (SHARE_PLAN stage 4 step 1: surfacing, not new
// features — every behaviour here IS the corresponding command's behaviour,
// behind a door).
//
// Why a factory: the flows run on initMessenger closure functions
// (generateInviteMessage / createGroupInviteLink / importChat) and the QR
// bridge const, which arrive via the deps object D. Top-level app globals
// (t, showToast, showPrompt, safeSetHTML, esc, uid, _dbg) resolve from the
// global scope, exactly as they did inline (src/app/qr.js precedent).
// Absent module ⇒ the doors stay inert, never a boot failure.
// ============================================================================

export function createShareTools(D) {

  // /invite: copy the invite message, confirm, then offer the native share
  // sheet where one exists. The command handler additionally drops a centre
  // line into the open conversation; behind a button the toast is the
  // confirmation (same text, t('uiInviteCopied')).
  async function shareInvite() {
    try {
      const { msg } = D.generateInviteMessage();
      navigator.clipboard?.writeText(msg);
      showToast(t('uiInviteCopied'), 'success');
      if (navigator.share) {
        try { await navigator.share({ title: 'Breeze', text: msg }); } catch(e) { _dbg(e, 'share-invite-native'); }
      }
    } catch(e) { _dbg(e, 'share-invite'); }
  }

  // /qr: the QR modal over the same invite URL.
  function showInviteQR() {
    const { url } = D.generateInviteMessage();
    D.showQRModal(url);
  }

  // /newgroup with no argument: prompt for the group name, then the
  // existing invite-link creation (which copies the link, renders it into
  // the conversation and offers the share sheet itself).
  async function createGroupInvite() {
    try {
      const name = await showPrompt(t('groupNamePrompt'), '', { placeholder: t('groupNamePh') });
      if (!name) return;
      await D.createGroupInviteLink(name);
    } catch(e) { _dbg(e, 'share-group-invite'); }
  }

  // /import: pick a history file and hand it to importChat, which owns the
  // no-open-conversation refusal and the parse/import behaviour.
  function pickImportFile() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.txt,.json,.zip';
    input.onchange = async (ev) => { if (ev.target.files[0]) await D.importChat(ev.target.files[0]); };
    input.click();
  }

  // The migration guide as one flow: the guide itself (t('migrateHtml') —
  // the /migrate body) on top, and the four flows it describes as buttons
  // below it, one tap per step. Dialog mechanics follow showPrompt /
  // showConfirm (native <dialog>: focus trap, ESC, backdrop close).
  function showMigratePanel() {
    const dlg = document.createElement('dialog');
    const titleId = 'mdl-' + uid();
    dlg.setAttribute('aria-labelledby', titleId);
    safeSetHTML(dlg, `<div class="modal-title" id="${titleId}">${esc(t('btnMigrateApps'))}</div>
      <div class="cmd-section i-scroll-300" data-guide></div>
      <button class="btn btn-g i-w100 i-mb8" data-act="invite">${esc(t('btnCopyInvite'))}</button>
      <button class="btn btn-o i-w100 i-mb8" data-act="qr">${esc(t('btnInviteQr'))}</button>
      <button class="btn btn-o i-w100 i-mb8" data-act="group">${esc(t('btnGroupInvite'))}</button>
      <button class="btn btn-o i-w100 i-mb8" data-act="import">${esc(t('btnImportHistory'))}</button>
      <button class="btn btn-o i-w100" data-act="close">${esc(t('uiClose'))}</button>`);
    safeSetHTML(dlg.querySelector('[data-guide]'), t('migrateHtml'));
    document.body.appendChild(dlg);
    dlg.showModal();
    const close = () => { dlg.close(); dlg.remove(); };
    dlg.addEventListener('close', () => dlg.remove()); // ESC key
    dlg.addEventListener('click', (e) => { // Click outside (::backdrop)
      const rect = dlg.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) close();
    });
    // Copying the invite keeps the panel open (the remaining steps are
    // still on it); the other flows replace it.
    dlg.querySelector('[data-act="invite"]').onclick = () => { shareInvite(); };
    dlg.querySelector('[data-act="qr"]').onclick = () => { close(); showInviteQR(); };
    dlg.querySelector('[data-act="group"]').onclick = () => { close(); createGroupInvite(); };
    dlg.querySelector('[data-act="import"]').onclick = () => { close(); pickImportFile(); };
    dlg.querySelector('[data-act="close"]').onclick = () => close();
  }

  return { shareInvite, showInviteQR, createGroupInvite, pickImportFile, showMigratePanel };
}

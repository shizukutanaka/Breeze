// v3.6: Native <dialog> modal (auto inert bg, focus trap, ESC, ::backdrop) replacing browser prompt() and hand-rolled overlay divs/z-index/ARIA/focus-trap JS.
// Shared dismiss wiring for the modal <dialog> helpers: the cancel
// button, Esc (the 'close' event), and a backdrop click all resolve
// with the dialog's cancel value (null, or false for showConfirm).
export function createDialogs({ uid, esc, t, safeSetHTML }) {
  function _makeDialog() {
    const dlg = document.createElement('dialog');
    const titleId = 'mdl-' + uid();
    dlg.setAttribute('aria-labelledby', titleId);
    return [dlg, titleId];
  }
  function _showDialog(dlg) { document.body.appendChild(dlg); dlg.showModal(); }
  function _wireDialogDismiss(dlg, close, cancelVal = null) {
    dlg.querySelector('[value="cancel"]').onclick = () => close(cancelVal);
    dlg.addEventListener('close', () => close(cancelVal));
    dlg.addEventListener('click', (e) => {
      const rect = dlg.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) close(cancelVal);
    });
  }

  function showPrompt(title, defaultVal = '', opts = {}) {
    return new Promise(resolve => {
      const [dlg, titleId] = _makeDialog(); // a11y: accessible name from the title; showModal() handles the rest
      safeSetHTML(dlg, `<div class="modal-title" id="${titleId}">${esc(title)}</div>
      <input class="field modal-input" type="${opts.type || 'text'}" value="${esc(defaultVal)}" placeholder="${esc(opts.placeholder || '')}" autocomplete="${esc(opts.autocomplete || 'off')}" aria-labelledby="${titleId}">
      <div class="modal-actions">
        <button class="btn btn-o btn-sm" value="cancel">${t('cancel')}</button>
        <button class="btn btn-g btn-sm" value="ok">${opts.okText || t('ok')}</button>
      </div>`);
      _showDialog(dlg); // Auto: inert bg, focus trap, top-layer, ESC to close
      const input = dlg.querySelector('.modal-input');
      input.focus(); input.select();
      const close = (val) => { dlg.close(); dlg.remove(); resolve(val); };
      dlg.querySelector('[value="ok"]').onclick = () => close(input.value);
      _wireDialogDismiss(dlg, close);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') close(input.value); });
    });
  }

  function showConfirm(title, opts = {}) {
    return new Promise(resolve => {
      const [dlg, titleId] = _makeDialog(); if (opts.defaultCancel) dlg.classList.add('group-protection-confirm');
      safeSetHTML(dlg, `<div class="modal-title" id="${titleId}">${esc(title)}</div>
      ${opts.desc ? `<div class="modal-desc">${esc(opts.desc)}</div>` : ''}
      <div class="modal-actions">
        <button class="btn btn-o btn-sm" value="cancel">${t('cancel')}</button>
        <button class="btn ${opts.danger ? 'btn-r' : 'btn-g'} btn-sm" value="ok">${opts.okText || t('ok')}</button>
      </div>`);
      _showDialog(dlg);
      dlg.querySelector(opts.defaultCancel ? '[value="cancel"]' : '[value="ok"]').focus();
      const close = (val) => { dlg.close(); dlg.remove(); resolve(val); };
      dlg.querySelector('[value="ok"]').onclick = () => close(true);
      _wireDialogDismiss(dlg, close, false);
    });
  }

  return { makeDialog: _makeDialog, showDialog: _showDialog, wireDialogDismiss: _wireDialogDismiss, showPrompt, showConfirm };
}

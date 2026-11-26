// Landing-link handling for the setup screen: group invites, 1-to-1 invites,
// and Web Share Target intake. index.html keeps only the bridge and the
// deferred call; the URL-supplied display name is written through textContent
// only, never HTML.
export function applyLandingLinks({ addKey, addName, joinToken, shareText, apiReady, postAPIRaw, DOM, t, dbg, getActiveContact }) {
  // If arriving via ?join=token, show group info on the setup screen. This is
  // intentionally async and therefore wins over the add fronting below simply
  // by the add fronting not running when a join token exists.
  if (joinToken && apiReady?.()) {
    postAPIRaw('/group/info', { token: joinToken })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const title = DOM.get('msg-setup-title');
        const desc = DOM.get('msg-setup-desc');
        const btn = DOM.get('b-msg-setup');
        if (title) title.textContent = t('joinGroup', data.name);
        if (desc) desc.textContent = t('invitedBy', data.creatorName, data.members.length);
        if (btn) btn.textContent = t('joinBtn');
      })
      .catch(e => dbg(e));
  }

  // A 1-to-1 invite (?add=@alias or ?add=pubkey&name=X) previously looked
  // identical to an unsolicited first visit even though boot auto-adds the
  // inviter after identity creation. Front that fact on the primary action.
  if (!joinToken && addKey) {
    const cleanName = typeof addName === 'string' ? addName.trim() : '';
    const displayName = cleanName || (addKey.startsWith('@') ? addKey : null);
    const title = DOM.get('msg-setup-title');
    const desc = DOM.get('msg-setup-desc');
    const btn = DOM.get('b-msg-setup-random');
    if (title) title.textContent = displayName ? t('inviteTitle', displayName) : t('inviteTitleAnon');
    if (desc) desc.textContent = t('inviteDesc');
    if (btn) btn.textContent = t('inviteBtn');
  }

  // Web Share Target intake: keep the text for initMessenger's conversation
  // paste path, and paste immediately only if a conversation is already open.
  if (shareText) {
    sessionStorage.setItem('brz-shared-text', shareText);
    history.replaceState(null, '', '/');
    setTimeout(() => {
      const input = DOM.get('msg-input');
      if (input && getActiveContact()) { input.value = shareText; input.focus(); }
    }, 1000);
  }
}

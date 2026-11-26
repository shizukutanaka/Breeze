// ============================================================================
// ACCOUNT TAB BAR — the multi-account switcher strip (one tab per account,
// the unread badges, the long-press rename / avatar / delete menu, and the
// add-account door), extracted from index.html's top level (modularization:
// index.html carries a hard line budget in validate.sh). Everything it used
// arrives through deps, resolved exactly as it was inline; index.html keeps
// a call-time bridge wrapper under the original name. Behaviour is
// unchanged — this is a move, not a rewrite.
// ============================================================================

export function createAccountTabs(deps) {
  function renderAccountTabs() {
    const accs = deps.getAccounts();
    // The tab bar is also the ONE door to adding an account, so it renders
    // for a single account too (one tab + the "+" button). With no accounts
    // at all there is nothing to switch between and nothing to add to yet.
    if (!accs.length) return;

    const tabs = deps.container();
    if (!tabs) return;
    if (!tabs.parentElement) {
      const sidebar = deps._DOM.get('msg-sidebar');
      if (sidebar) sidebar.insertBefore(tabs, sidebar.firstChild);
    }
    // The sidebar lives inside #msg-main, which is hidden while the SETUP screen shows — and a
    // freshly created account always starts on setup, because its database has no identity yet.
    // Rendering the switcher only there meant creating an account trapped you in it: no visible
    // way back, only the undiscoverable Ctrl+1..9. When setup is showing, mirror the bar into
    // #v-msg (the shared parent of setup and main) so switching is always reachable.
    {
      const setupVisible = !deps._DOM.get('msg-setup')?.classList.contains('hidden');
      const host = deps._DOM.get('v-msg');
      if (setupVisible && host && tabs.parentElement !== host) host.insertBefore(tabs, host.firstChild);
      else if (!setupVisible) {
        const sb = deps._DOM.get('msg-sidebar');
        if (sb && tabs.parentElement !== sb) sb.insertBefore(tabs, sb.firstChild);
      }
    }

    const activeId = deps.getActiveAccountId();
    tabs.replaceChildren();

    for (let idx = 0; idx < accs.length; idx++) {
      const acc = accs[idx];
      const tab = document.createElement('div');
      const isActive = acc.id === activeId;
      tab.className = 'acc-tab' + (isActive ? ' active' : '');
      tab.textContent = acc.avatar || acc.name?.[0] || '?';
      tab.title = acc.name + (idx < 9 ? ` (Ctrl+${idx + 1})` : '');
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.setAttribute('aria-label', acc.name);
      tab.tabIndex = isActive ? 0 : -1;

      // Keyboard shortcut hint (1-9)
      if (idx < 9) {
        const shortcut = document.createElement('span');
        shortcut.className = 'acc-shortcut';
        shortcut.setAttribute('aria-hidden', 'true');
        shortcut.textContent = idx + 1;
        tab.appendChild(shortcut);
      }

      // Unread badge — check from cross-account cache
      const unreadCount = deps.unread()[acc.id] || 0;
      if (unreadCount > 0 && !isActive) {
        const badge = document.createElement('span');
        badge.className = 'bdg bdg-acc';
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        tab.appendChild(badge);
      }

      if (!isActive) tab.onclick = () => deps.switchAccount(acc.id);
      // Long press / right-click context menu
      tab.oncontextmenu = async (e) => {
        e.preventDefault();
        const avatars = ['🌊', '🔥', '🌙', '⭐', '🌿', '🎯', '💎', '🦊', '🐱', '🎵', '🚀', '💼', '🏠', '🎮', '🔒'];
        const action = await deps.showContextMenu(e.clientX, e.clientY, [
          { label: deps.t('rename'), action: 'rename' },
          { label: deps.t('chooseAvatar'), action: 'avatar' },
          '---',
          accs.length > 1 ? { label: deps.t('deleteAccount') || 'Delete', action: 'delete', danger: true } : null,
        ].filter(Boolean));
        if (action === 'rename') {
          const newName = await deps.showPrompt(deps.t('newName'), acc.name);
          if (newName) { acc.name = newName; deps.saveAccounts(accs); renderAccountTabs(); }
        } else if (action === 'avatar') {
          const choice = await deps.showPrompt(deps.t('chooseAvatar'), acc.avatar || '👤', { placeholder: deps.t('avatarPlaceholder') });
          if (choice) { acc.avatar = choice.slice(0, 2); deps.saveAccounts(accs); renderAccountTabs(); }
        } else if (action === 'delete' && accs.length > 1) {
          if (deps.vaultEnabled()) { await deps.vaultCommand('/vault disable'); return; }
          if (!await deps.showConfirm(deps.t('deleteAccount'), { danger: true, okText: deps.t('delete') })) return;
          const i = accs.indexOf(acc);
          accs.splice(i, 1);
          deps.saveAccounts(accs);
          indexedDB.deleteDatabase(acc.dbName || 'breeze-acc-' + acc.id);
          delete deps.unread()[acc.id];
          if (acc.id === activeId) deps.switchAccount(accs[0].id);
          else renderAccountTabs();
        }
      };
      tabs.appendChild(tab);
    }

    // Add button
    const addBtn = document.createElement('div');
    addBtn.className = 'acc-add';
    addBtn.textContent = '+';
    addBtn.title = deps.t('addAccountBtn');
    addBtn.setAttribute('aria-label', deps.t('addAccountBtn'));
    // Found sweeping for the same "aria-label present, but not actually focusable" gap
    // showMsgMenu had: a <div> with a real aria-label reads as a labeled control to a
    // screen reader, but with no tabIndex a keyboard user cannot even Tab to it, let
    // alone activate it with Enter/Space. Same fix pattern as deps.showContextMenu/showMsgMenu.
    addBtn.tabIndex = 0;
    addBtn.setAttribute('role', 'button');
    addBtn.onclick = deps.addAccount;
    addBtn.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addBtn.click(); } };
    tabs.appendChild(addBtn);
  }

  return { renderAccountTabs };
}

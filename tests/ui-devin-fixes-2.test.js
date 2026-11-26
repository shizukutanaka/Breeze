import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Devin UI/UX audit fixes, batch 2 — the structural findings (every one
// verified against the code before fixing):
//  (a) Settings is a dedicated view (#settings-view) with a history
//      entry, not a panel rendered into the chat log; the sidebar head
//      carries a settings button so desktop can reach it too. The
//      /settings command, the mobile Settings tab and the ?settings
//      shortcut all funnel through openSettingsView().
//  (b) The header name opens the SAME profile panel as the self card
//      (the separate prompt-based avatar/bio editor is gone), and saving
//      the profile refreshes the self card.
//  (c) First run: account creation is the one primary action; the
//      restore entries are folded behind a "Restore an existing account"
//      expander. The /keywrap tip is a persistent card, not a 10s toast.
//  (d) Adding the first contact shows a one-time backup reminder card
//      (flag in settings); the account tab bar — the one add-account
//      door — renders for a single account too.
//  (e) Add-contact is a dialog with three explicit choices (add /
//      invite / create group), each with its own form; the group form
//      needs no "group:Name" typing rule.
//  (f) The chat header gains search + a conversation menu onto the
//      existing commands, and "/" in the input opens a suggestion
//      popover of the /help command list.
//  (g) The self card is the first child INSIDE the scrollable contact
//      list, so it scrolls away instead of pinning screen height.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const profileSrc = readFileSync(new URL('../src/app/profile.js', import.meta.url), 'utf8');
const settingsPanelSrc = readFileSync(new URL('../src/app/settings-panel.js', import.meta.url), 'utf8');
const ja = JSON.parse(readFileSync(new URL('../locales/ja.json', import.meta.url), 'utf8'));

function sliceBetween(startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start);
  expect(start, startMarker).toBeGreaterThan(-1);
  expect(end, endMarker).toBeGreaterThan(start);
  return html.slice(start, end);
}

// ── (a) settings view ───────────────────────────────────────────────
describe('(a) settings is a dedicated view with history', () => {
  it('the settings view markup exists inside the main UI', () => {
    const view = html.indexOf('id="settings-view"');
    expect(view).toBeGreaterThan(html.indexOf('<div id="msg-main"'));
    expect(view).toBeLessThan(html.indexOf('</main>'));
    expect(html).toContain('id="settings-body"');
    expect(html).toContain('id="b-settings-back"');
  });

  it('the sidebar head has a settings entry button (desktop door)', () => {
    expect(html).toContain('id="b-msg-settings"');
    expect(html).toContain("_DOM.get('b-msg-settings')?.addEventListener('click', () => openSettingsView());");
  });

  it('openSettingsView renders into the view and pushes a history entry', () => {
    const fn = sliceBetween('function openSettingsView()', 'function closeSettingsView()');
    expect(fn).toContain("_DOM.get('settings-body')");
    expect(fn).toContain('_renderSettingsPanel(d)');
    expect(fn).toContain("history.pushState({ breezeSettings: true }, '');");
    expect(fn).not.toContain('msg-messages');
  });

  it('Back closes the view (popstate + the view back button)', () => {
    expect(html).toContain("window.addEventListener('popstate', () => { if (_settingsViewOpen) closeSettingsView(); }, { signal: _ac.signal });");
    const fn = sliceBetween("_DOM.get('b-settings-back')?.addEventListener('click'", "window.addEventListener('popstate', () => { if (_settingsViewOpen)");
    expect(fn).toContain('history.back()');
    expect(fn).toContain('closeSettingsView()');
  });

  it('the /settings command opens the view instead of rendering into the chat log', () => {
    const branch = sliceBetween("if (val === '/settings') {", "if (val === '/clear') {");
    expect(branch).toContain('openSettingsView();');
    expect(branch).not.toContain('_cmdPanelEl');
  });

  it('the settings panel no longer renders into #msg-messages', () => {
    const fn = sliceBetween('function _renderSettingsPanel(d)', 'function openSettingsView()');
    expect(fn).not.toContain('_cmdPanelEl');
    expect(fn).not.toContain('box.appendChild');
    // The panel content itself survived the move (privacy + backup rows);
    // after the stage-4 extraction that markup lives in the module.
    expect(settingsPanelSrc).toContain("check('hide-rr'");
    expect(settingsPanelSrc).toContain("action('backup'");
  });

  it('settings has no add-account button (the tab bar is the one door)', () => {
    const fn = sliceBetween('function _renderSettingsPanel(d)', 'function openSettingsView()');
    expect(fn).not.toContain('data-action="add-account"');
  });
});

// ── (b) one profile editor ──────────────────────────────────────────
describe('(b) profile editing is unified on the profile panel', () => {
  it('the header name opens the profile panel', () => {
    const fn = sliceBetween("_DOM.get('msg-my-name')?.addEventListener('click'", '// Show avatar in name display');
    expect(fn).toContain('_profileUI?.showPanel()');
    expect(fn).not.toContain('showPrompt');
  });

  it('saving the profile refreshes the self card', () => {
    expect(profileSrc).toContain('if (D.refreshSelfCard) D.refreshSelfCard();');
    expect(html).toContain('refreshSelfCard: () => { renderSelfCard()');
  });
});

// ── (c) first-run simplification + keywrap card ─────────────────────
describe('(c) first run leads with one primary action', () => {
  it('creation stays the big CTA and the restore entries sit in the expander', () => {
    const setup = sliceBetween('<div id="msg-setup"', '<!-- Main UI -->');
    // The one big CTA is now the random-ID start (2026-11-25); the named
    // phrase-mode creation is the secondary button below it. Exactly one
    // primary CTA on the screen, as before.
    expect(setup).toContain('class="btn btn-g setup-cta" id="b-msg-setup-random"');
    expect(setup).toContain('class="btn btn-o setup-restore" id="b-msg-setup"');
    expect(setup.split('setup-cta')).toHaveLength(2);
    expect(setup).toContain('id="b-msg-setup-restore-toggle"');
    expect(setup).toContain('data-i18n="setupRestoreToggle"');
    const more = setup.indexOf('id="setup-restore-more"');
    expect(more).toBeGreaterThan(-1);
    for (const id of ['b-msg-setup-restore', 'b-msg-setup-phrase', 'b-msg-setup-simple-restore']) {
      expect(setup.indexOf(`id="${id}"`), id).toBeGreaterThan(more);
    }
    // The alternative create modes stay outside the restore expander.
    expect(setup.indexOf('id="b-msg-setup-simple"')).toBeLessThan(more);
    // The disposable creation entry is gone entirely (2026-11-25).
    expect(setup).not.toContain('b-msg-setup-none');
    expect(setup).not.toContain('setupDisposable');
  });

  it('the toggle wires aria-expanded to the expander', () => {
    const fn = sliceBetween("_DOM.get('b-msg-setup-restore-toggle')?.addEventListener('click'", '// Recovery plan step 2');
    expect(fn).toContain("classList.toggle('hidden')");
    expect(fn).toContain("setAttribute('aria-expanded'");
  });

  it('the keywrap tip is a persistent card with an action, not a timed toast', () => {
    expect(html).not.toContain("showToast(t('keywrapSuggestion'), 'info', 10000)");
    const fn = sliceBetween('function _showKeywrapCard()', 'function _showBackupNudgeCard()');
    expect(fn).toContain("t('keywrapSuggestion')");
    expect(fn).toContain("go.dataset.action = 'keywrap-open'");
    expect(fn).toContain("dismiss.dataset.action = 'dismiss-card'");
    expect(html).toContain("if (e.target.closest('[data-action=\"keywrap-open\"]'))");
    expect(html).toContain("_runCommand('/keywrap')");
  });
});

// ── (d) backup nudge + account door ─────────────────────────────────
describe('(d) first-contact backup nudge and the always-visible account door', () => {
  it('addContact shows the nudge once, flag first', () => {
    const fn = sliceBetween('async function addContact(', '// Stage-2 step 6: the contact-settings carrier');
    expect(fn).toContain('if (!_settings.backupNudgeShown)');
    expect(fn.indexOf('_settings.backupNudgeShown = true;')).toBeLessThan(fn.indexOf('_showBackupNudgeCard();'));
    expect(fn).toContain('all.length === 1');
  });

  it('the flag has a default and the card offers the real backup action', () => {
    expect(html).toContain('backupNudgeShown: false');
    const fn = sliceBetween('function _showBackupNudgeCard()', '// Bottom tab bar: page navigation');
    expect(fn).toContain("go.dataset.action = 'backup'");
    expect(fn).toContain("t('backupNudgeTitle')");
    expect(fn).toContain("t('backupNudgeBody')");
  });

  it('the account tab bar renders for a single account', () => {
    const fn = sliceBetween('function renderAccountTabs()', '// Cross-account unread tracking');
    expect(fn).toContain('if (!accs.length) return;');
    expect(fn).not.toContain('accs.length <= 1');
    expect(fn).toContain("addBtn.className = 'acc-add'");
  });
});

// ── (e) add-contact dialog ──────────────────────────────────────────
describe('(e) add-contact is a three-choice dialog', () => {
  const fn = sliceBetween('function _showAddContactPanel()', 'async function resolveAndAdd(');

  it('offers the three explicit choices', () => {
    expect(fn).toContain('data-choice="add"');
    expect(fn).toContain('data-choice="invite"');
    expect(fn).toContain('data-choice="group"');
    expect(fn).toContain("t('addOptionContact')");
    expect(fn).toContain("t('btnInviteFriend')");
    expect(fn).toContain("t('addOptionGroup')");
  });

  it('is a real dialog on the shared helpers', () => {
    expect(fn).toContain('_makeDialog()');
    expect(fn).toContain('_showDialog(dlg)');
    expect(fn).toContain('_wireDialogDismiss(dlg, close)');
  });

  it('the group form creates through the same group: dispatch', () => {
    expect(fn).toContain("done('group:' + name)");
    expect(fn).toContain("dlg.querySelector('.group-input')");
  });

  it('the invite choice runs the existing share flow', () => {
    expect(fn).toContain('shareInvite()');
  });
});

// ── (f) chat header menu + slash popover ────────────────────────────
describe('(f) chat header search/menu and slash suggestions', () => {
  it('the header carries search and menu buttons, revealed with a conversation', () => {
    expect(html).toContain('id="b-msg-search"');
    expect(html).toContain('id="b-msg-menu"');
    expect(html).toContain("_DOM.get('b-msg-search')?.classList.remove('hidden');");
    expect(html).toContain("_DOM.get('b-msg-menu')?.classList.remove('hidden');");
  });

  it('the search button opens the existing search bar', () => {
    expect(html).toContain("_DOM.get('b-msg-search')?.addEventListener('click', () => openSearchBar());");
  });

  it('menu items run the existing commands (poll seeds the input instead)', () => {
    const fn = sliceBetween("_DOM.get('b-msg-menu')?.addEventListener('click'", '// Clear conversation');
    expect(fn).toContain('showContextMenu(');
    for (const cmd of ['/security', '/mute', '/pin']) {
      expect(fn).toContain(`_runCommand('${cmd}')`);
    }
    expect(fn).toContain("input.value = '/poll '");
    expect(fn).toContain("t('menuSecurity')");
    expect(fn).toContain("t('menuMute')");
    expect(fn).toContain("t('menuPoll')");
  });

  it('typing / opens the suggestion popover from the /help command set', () => {
    expect(html).toContain('const _SLASH_COMMANDS = [');
    const fn = sliceBetween("_DOM.get('msg-input')?.addEventListener('input', (e) => {\n    const input = e.target;\n    const m = ", '// v3.1: Shared image-preview');
    expect(fn).toContain("pk.id = 'slash-picker'");
    expect(fn).toContain('_SLASH_COMMANDS.filter(');
    expect(fn).toContain("input.value = item.dataset.cmd + ' '");
  });

  it('Tab accepts and Enter/Escape dismiss the slash popover', () => {
    expect(html).toContain("if (e.key === 'Tab' && _DOM.get('slash-picker')) {");
    expect(html).toContain("if (e.key === 'Enter') {\n      _DOM.get('slash-picker')?.remove();");
  });
});

// ── (g) self card inside the scrollable list ────────────────────────
describe('(g) the self card scrolls with the contact list', () => {
  it('the card element is the first child of the list container', () => {
    const list = html.indexOf('id="msg-contacts"');
    const card = html.indexOf('id="msg-self-card"');
    const skeleton = html.indexOf('class="skeleton skeleton-contact"');
    expect(card).toBeGreaterThan(list);
    expect(card).toBeLessThan(skeleton);
  });

  it('renderContacts re-seats the card at the top of every render', () => {
    const fn = sliceBetween('async function renderContacts()', 'function updateFaviconBadge');
    expect(fn).toContain("frag.insertBefore(selfCard, frag.firstChild);");
    expect(fn).toContain('el.replaceChildren(frag);');
  });
});

// ── i18n ────────────────────────────────────────────────────────────
describe('new strings exist in English and Japanese', () => {
  it('all batch-2 keys are defined in EN and translated in JA', () => {
    for (const key of ['setupRestoreToggle', 'addOptionContact', 'addOptionGroup', 'keywrapProtectBtn', 'backupNudgeTitle', 'backupNudgeBody', 'ariaConvMenu', 'menuSecurity', 'menuMute', 'menuPoll']) {
      expect(html, `en ${key}`).toContain(key + ':');
      expect(typeof ja[key], `ja ${key}`).toBe('string');
      expect(ja[key], `ja ${key} is a real translation`).not.toBe('');
    }
  });

  it('the removed prompt-editor keys are gone (dead keys stay deleted)', () => {
    expect(html).not.toContain('avatarEmojiPrompt:');
    expect(html).not.toContain('bioPrompt:');
    expect(ja.avatarEmojiPrompt).toBeUndefined();
    expect(ja.bioPrompt).toBeUndefined();
  });
});

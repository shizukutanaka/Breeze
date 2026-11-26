import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Bottom tab bar (UI/UX phase 1A + the 2026-11-25 expansions, owner
// requests): on narrow (mobile) screens the list view gains a LINE-style
// bottom tab bar — Chats / Calls / Contacts / My card / Settings. The bar
// rides the EXISTING views, not a parallel router: Chats, Contacts and
// Calls are three modes of the one sidebar list (_listTab — recency +
// folder filters vs friends by name vs the on-device call history from
// src/app/call-history.js), My card opens the existing profile panel,
// and Settings opens the settings view through the same synthetic-Enter
// path as the ?settings shortcut (_openSettingsFromUrl). Bar visibility
// is CSS-derived from .sidebar.hidden. Which optional tabs exist is a
// Settings choice (_settings.tabCalls / tabContacts / tabSelf /
// tabSettings, all default on); the Chats tab is always shown, and
// hiding the tab of the screen you are on returns you to Chats. The
// Calls tab arrived together with the call history itself (the 'calls'
// IDB store, DB v6): before that the app kept no call record anywhere,
// so there was no calls screen for a tab to open.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ja = JSON.parse(readFileSync(new URL('../locales/ja.json', import.meta.url), 'utf8'));
const settingsPanelSrc = readFileSync(new URL('../src/app/settings-panel.js', import.meta.url), 'utf8');

const barStart = html.indexOf('<nav id="msg-tabbar"');
const bar = html.slice(barStart, html.indexOf('</nav>', barStart));
const slice = (from, to) => html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)));

describe('bottom tab bar markup', () => {
  it('exists inside the main UI with exactly five tabs, calls second', () => {
    expect(barStart).toBeGreaterThan(html.indexOf('<div id="msg-main"'));
    expect(barStart).toBeLessThan(html.indexOf('</main>'));
    expect(bar.match(/data-action="tab-/g)).toHaveLength(5);
    expect(bar).toContain('data-action="tab-chats"');
    expect(bar).toContain('data-action="tab-calls"');
    expect(bar).toContain('data-action="tab-contacts"');
    expect(bar).toContain('data-action="tab-self"');
    expect(bar).toContain('data-action="tab-settings"');
    expect(bar.indexOf('data-action="tab-chats"')).toBeLessThan(bar.indexOf('data-action="tab-calls"'));
    expect(bar.indexOf('data-action="tab-calls"')).toBeLessThan(bar.indexOf('data-action="tab-contacts"'));
  });
  it('chats starts as the current page (navigation semantics, not tabs)', () => {
    expect(bar).toContain('class="tab-btn active" id="tab-chats"');
    expect(bar).toContain('role="navigation"');
    expect(bar).not.toContain('role="tablist"');
    expect(bar).not.toContain('role="tab"');
    expect(bar).not.toContain('aria-selected');
    expect(bar).toContain('aria-current="page" data-action="tab-chats"');
    expect(bar.match(/aria-current="page"/g)).toHaveLength(1);
  });
  it('the landmark is labelled as the main navigation', () => {
    expect(bar).toContain('data-i18n-aria="ariaMainNav"');
    expect(html).toContain("ariaMainNav: 'Main navigation'");
    expect(ja.ariaMainNav).toBe('メインナビゲーション');
  });
  it('labels use i18n keys defined in English and translated in Japanese', () => {
    expect(bar).toContain('data-i18n="tabChats"');
    expect(bar).toContain('data-i18n="tabCalls"');
    expect(bar).toContain('data-i18n="tabSelf"');
    expect(bar).toContain('data-i18n="ariaContacts"');
    expect(bar).toContain('data-i18n="helpSettings"');
    expect(html).toContain("tabChats: 'Chats'");
    expect(html).toContain("tabCalls: 'Calls'");
    expect(html).toContain("tabSelf: 'My card'");
    expect(html).toContain("ariaContacts: 'Contacts'");
    expect(html).toContain("helpSettings: 'Settings'");
    expect(ja.tabChats).toBe('トーク');
    expect(ja.tabCalls).toBe('通話');
    expect(ja.tabSelf).toBe('自分のカード');
    expect(ja.ariaContacts).toBe('連絡先');
    expect(ja.helpSettings).toBe('設定');
  });
  it('the chats tab carries the unread badge, styled like the folder badges', () => {
    expect(bar).toContain('<span class="bdg" id="tab-badge-chats"></span>');
    expect(html).toContain('<span class="bdg" id="badge-all"></span>');
    expect(html).toContain('.bdg {');
    expect(html).toContain('.bdg:empty { display: none }');
  });
  it('the calls tab carries the missed-call badge in the same badge slot', () => {
    expect(bar).toContain('<span class="bdg" id="tab-badge-calls"></span>');
  });
});

describe('bottom tab bar visibility (CSS-derived from the existing view state)', () => {
  it('is hidden by default (wide screens never show it)', () => {
    expect(html).toContain('#msg-tabbar { display: none }');
  });
  it('shows only under the narrow width breakpoint, regardless of UA', () => {
    const css = html.slice(html.indexOf('/* ── Bottom tab bar'), html.indexOf('/* Hide scrollbars on mobile'));
    const mqAt = css.indexOf('@media (max-width: 640px)');
    const flexAt = css.indexOf('#msg-tabbar { display: flex');
    expect(mqAt).toBeGreaterThan(-1);
    expect(flexAt).toBeGreaterThan(mqAt);
    expect(css.slice(flexAt)).toContain('position: fixed');
    // Width alone decides: no .is-mobile (UA class) gate on the bar's rules.
    expect(css).not.toContain('.is-mobile #msg-tabbar');
    expect(css).not.toContain('.is-mobile #msg-main:has(.sidebar.hidden) #msg-tabbar');
    expect(css).not.toContain('.is-mobile .contact-list');
  });
  it('hides whenever the sidebar is hidden (chat or settings panel open)', () => {
    expect(html).toContain('#msg-main:has(.sidebar.hidden) #msg-tabbar { display: none }');
  });
  it('the active tab is marked with the accent color variable', () => {
    expect(html).toContain('.tab-btn.active { color: var(--g) }');
  });
  it('contacts mode hides the chat folder tabs and the label filter bar', () => {
    expect(html).toContain('#msg-sidebar.list-contacts .folder-tabs, #msg-sidebar.list-contacts .label-filter { display: none }');
  });
  it('calls mode hides the folder tabs, the label filter and the contact search box', () => {
    expect(html).toContain('#msg-sidebar.list-calls .folder-tabs, #msg-sidebar.list-calls .label-filter, #msg-sidebar.list-calls .contact-filter-wrap { display: none }');
  });
});

describe('bottom tab bar wiring', () => {
  it('clicks route through the document-level data-action delegation', () => {
    expect(html).toContain('if (e.target.closest(\'[data-action="tab-chats"]\')) { _showChatsTab(); return; }');
    expect(html).toContain('if (e.target.closest(\'[data-action="tab-calls"]\')) { _showCallsTab(); return; }');
    expect(html).toContain('if (e.target.closest(\'[data-action="tab-contacts"]\')) { _showContactsTab(); return; }');
    expect(html).toContain('if (e.target.closest(\'[data-action="tab-self"]\')) { _showSelfTab(); return; }');
    expect(html).toContain('if (e.target.closest(\'[data-action="tab-settings"]\')) { _showSettingsTab(); return; }');
  });
  it('_setActiveTab moves aria-current across every tab in _TAB_IDS', () => {
    expect(html).toContain("const _TAB_IDS = { chats: 'tab-chats', calls: 'tab-calls', contacts: 'tab-contacts', self: 'tab-self', settings: 'tab-settings' };");
    const fn = slice('function _setActiveTab(which)', 'function _applyTabVisibility()');
    expect(fn).toContain("el.setAttribute('aria-current', 'page')");
    expect(fn).toContain("el.removeAttribute('aria-current')");
    expect(fn).not.toContain('aria-selected');
  });
  it('the three list tabs switch the one sidebar list between its three modes', () => {
    const fn = slice('function _showListTab(mode)', 'function _showChatsTab()');
    expect(fn).toContain('_listTab = mode; _setActiveTab(mode);');
    expect(fn).toContain("sb?.classList.remove('hidden');");
    expect(fn).toContain("sb?.classList.toggle('list-contacts', mode === 'contacts');");
    expect(fn).toContain("sb?.classList.toggle('list-calls', mode === 'calls');");
    expect(fn).toContain("_DOM.get('b-msg-back')?.classList.add('hidden'); renderContacts();");
    expect(html).toContain("function _showChatsTab() { _showListTab('chats'); }");
    expect(html).toContain("function _showContactsTab() { _showListTab('contacts'); } function _showCallsTab() { _showListTab('calls'); }");
    expect(html).toContain("let _listTab = 'chats';");
  });
  it('calls mode hands the list surface to the call-history module', () => {
    expect(html).toContain("if (_listTab === 'calls') { await globalThis.__breezeCallHistoryUI?.render(); return; }");
  });
  it('contacts mode reuses the list: friends only, name order, no time sections', () => {
    const fn = slice('async function renderContacts()', 'function updateFaviconBadge');
    expect(fn).toContain("if (_listTab === 'contacts') return !c.archived && !c.isGroup;");
    expect(fn).toContain("const _effSort = _listTab === 'contacts' ? 'name' : _contactSort;");
    expect(fn).toContain("if (_effSort === 'name') contacts.sort((a, b) => _collator.compare(contactDisplayName(a), contactDisplayName(b)));");
    expect(fn).toContain("&& _effSort === 'recent' && !_contactFilter");
  });
  it('the chats tab badge rides the same total unread as the folder badges', () => {
    const fn = slice('async function renderContacts()', 'function updateFaviconBadge');
    expect(fn).toContain("const b4 = _DOM.get('tab-badge-chats');");
    expect(fn).toContain("if (b4) b4.textContent = totalUnread > 0 ? totalUnread : '';");
  });
  it('the settings tab opens the settings panel via the existing synthetic-Enter path', () => {
    const fn = slice('function _showSettingsTab()', '// Returning to the list');
    // Same mechanism as _openSettingsFromUrl: value + Enter keydown on #msg-input.
    expect(fn).toContain("input.value = '/settings';");
    expect(fn).toContain("input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));");
    expect(html).toContain("input.value = '/settings'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));");
  });
  it('the settings tab reveals the chat area on narrow screens like opening a conversation', () => {
    const fn = slice('function _showSettingsTab()', '// Returning to the list');
    expect(fn).toContain('if (window.innerWidth <= 640) {');
    expect(fn).toContain("_DOM.get('msg-sidebar')?.classList.add('hidden');");
    expect(fn).toContain("_DOM.get('b-msg-back')?.classList.remove('hidden');");
  });
  it('opening the settings view from any entry point marks the settings tab current', () => {
    const fn = slice('function openSettingsView()', 'function closeSettingsView()');
    expect(fn).toContain("_renderSettingsPanel(d); _setActiveTab('settings');");
  });
  it('closing the settings view restores the list tab that is showing', () => {
    const fn = slice('function closeSettingsView()', "_DOM.get('b-msg-settings')");
    expect(fn).toContain('_setActiveTab(_listTab);');
  });
  it('the my card tab opens the profile panel and restores the list tab when it closes', () => {
    const fn = slice('function _showSelfTab()', 'function _showSettingsTab()');
    expect(fn).toContain("_setActiveTab('self');");
    expect(fn).toContain('const p = _profileUI?.showPanel();');
    expect(fn).toContain("if (_activeTab === 'self') _setActiveTab(_listTab);");
  });
  it('returning to the list re-selects the list tab that is showing', () => {
    expect(html).toContain("_DOM.get('b-msg-back')?.addEventListener('click', () => _setActiveTab(_listTab), { signal: _ac.signal });");
    expect(html).toContain("window.addEventListener('popstate', () => { if (window.innerWidth <= 640) _setActiveTab(_listTab); }, { signal: _ac.signal });");
  });
});

describe('tab visibility settings (Settings → Bottom tabs)', () => {
  it('the optional tabs default to shown and chats has no off switch', () => {
    expect(html).toContain('tabCalls: true, tabContacts: true, tabSelf: true, tabSettings: true, callHistoryLog: true,');
    expect(html).not.toContain('_settings.tabChats');
    expect(html).not.toContain("data-setting=\"tab-vis-chats\"");
  });
  it('the settings panel offers one checkbox per optional tab plus the always-shown note', () => {
    expect(settingsPanelSrc).toContain("section(t('tabBarSection')");
    expect(settingsPanelSrc).toContain("t('tabChatsAlways')");
    expect(settingsPanelSrc).toContain("check('tab-vis-calls'");
    expect(settingsPanelSrc).toContain("check('tab-vis-contacts'");
    expect(settingsPanelSrc).toContain("check('tab-vis-self'");
    expect(settingsPanelSrc).toContain("check('tab-vis-settings'");
    expect(settingsPanelSrc).toContain("t('tabShowCalls')");
    expect(settingsPanelSrc).toContain("t('tabShowContacts')");
    expect(settingsPanelSrc).toContain("t('tabShowSelf')");
    expect(settingsPanelSrc).toContain("t('tabShowSettings')");
    expect(ja.tabBarSection).toBe('下部タブ');
    expect(ja.tabChatsAlways).toBe('トークは常に表示されます');
    expect(ja.tabShowCalls).toBe('通話タブを表示');
    expect(ja.tabShowContacts).toBe('連絡先タブを表示');
    expect(ja.tabShowSelf).toBe('自分のカードタブを表示');
    expect(ja.tabShowSettings).toBe('設定タブを表示');
  });
  it('the privacy section offers the call-history recording switch', () => {
    expect(settingsPanelSrc).toContain("check('call-history-log'");
    expect(settingsPanelSrc).toContain("t('callHistoryLogLabel')");
    expect(html).toContain("if (s === 'call-history-log') { _settings.callHistoryLog = cb.checked; saveSettings(); return; }");
    expect(ja.callHistoryLogLabel).toBe('この端末に通話履歴を残す');
  });
  it('toggling a checkbox persists and re-applies the bar immediately', () => {
    const handler = slice("if (s === 'show-peer-name')", "if (s === 'rr-delay')");
    expect(handler).toContain("if (s.startsWith('tab-vis-')) {");
    expect(handler).toContain('saveSettings(); _applyTabVisibility();');
  });
  it('hiding the tab of the screen you are on returns you to chats', () => {
    const handler = slice("if (s === 'show-peer-name')", "if (s === 'rr-delay')");
    expect(handler).toContain("if (!cb.checked && k === 'contacts' && _listTab === 'contacts') _showChatsTab();");
    expect(handler).toContain("if (!cb.checked && k === 'calls' && _listTab === 'calls') _showChatsTab();");
    expect(handler).toContain("if (!cb.checked && k === 'settings') closeSettingsView();");
  });
  it('_applyTabVisibility hides exactly the tabs whose setting is off, and runs at wiring time', () => {
    const fn = slice('function _applyTabVisibility()', 'function _showListTab(mode)');
    expect(fn).toContain("const vis = { calls: _settings.tabCalls, contacts: _settings.tabContacts, self: _settings.tabSelf, settings: _settings.tabSettings };");
    expect(fn).toContain("classList.toggle('hidden', vis[k] === false);");
    expect(html.match(/_applyTabVisibility\(\);/g)).toHaveLength(2); // wiring time + the settings change handler line
  });
  it('settings stays reachable with its tab hidden (the header gear keeps its own door)', () => {
    expect(html).toContain("_DOM.get('b-msg-settings')?.addEventListener('click', () => openSettingsView());");
  });
});

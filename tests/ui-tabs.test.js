import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Bottom tab bar (UI/UX phase 1A, owner request): on narrow (mobile) screens
// the list view gains a LINE-style bottom tab bar — Contacts / Settings.
// The bar must ride the EXISTING view state, not a parallel router: it is
// visible only while the sidebar (contact list) is shown, the Contacts tab
// restores exactly the state the back button restores, and the Settings tab
// opens the settings panel through the same synthetic-Enter path as the
// ?settings shortcut (_openSettingsFromUrl).
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ja = JSON.parse(readFileSync(new URL('../locales/ja.json', import.meta.url), 'utf8'));

const barStart = html.indexOf('<nav id="msg-tabbar"');
const bar = html.slice(barStart, html.indexOf('</nav>', barStart));

describe('bottom tab bar markup', () => {
  it('exists inside the main UI with exactly two tabs', () => {
    expect(barStart).toBeGreaterThan(html.indexOf('<div id="msg-main"'));
    expect(barStart).toBeLessThan(html.indexOf('</main>'));
    expect(bar.match(/data-action="tab-/g)).toHaveLength(2);
    expect(bar).toContain('data-action="tab-contacts"');
    expect(bar).toContain('data-action="tab-settings"');
  });
  it('contacts starts as the active tab', () => {
    expect(bar).toContain('class="tab-btn active" id="tab-contacts"');
    expect(bar).toContain('aria-selected="true" data-action="tab-contacts"');
    expect(bar).toContain('aria-selected="false" data-action="tab-settings"');
  });
  it('labels reuse existing i18n keys (no new keys introduced)', () => {
    expect(bar).toContain('data-i18n="ariaContacts"');
    expect(bar).toContain('data-i18n="helpSettings"');
    // Both keys already exist in the English reference and the Japanese locale.
    expect(html).toContain("ariaContacts: 'Contacts'");
    expect(html).toContain("helpSettings: 'Settings'");
    expect(ja.ariaContacts).toBe('連絡先');
    expect(ja.helpSettings).toBe('設定');
  });
});

describe('bottom tab bar visibility (CSS-derived from the existing view state)', () => {
  it('is hidden by default (wide screens never show it)', () => {
    expect(html).toContain('#msg-tabbar { display: none }');
  });
  it('shows only under the mobile width breakpoint', () => {
    const css = html.slice(html.indexOf('/* ── Bottom tab bar'), html.indexOf('/* Hide scrollbars on mobile'));
    const mqAt = css.indexOf('@media (max-width: 640px)');
    const flexAt = css.indexOf('.is-mobile #msg-tabbar { display: flex');
    expect(mqAt).toBeGreaterThan(-1);
    expect(flexAt).toBeGreaterThan(mqAt);
    expect(css.slice(flexAt)).toContain('position: fixed');
  });
  it('hides whenever the sidebar is hidden (chat or settings panel open)', () => {
    expect(html).toContain('.is-mobile #msg-main:has(.sidebar.hidden) #msg-tabbar { display: none }');
  });
  it('the active tab is marked with the accent color variable', () => {
    expect(html).toContain('.tab-btn.active { color: var(--g) }');
  });
});

describe('bottom tab bar wiring', () => {
  it('clicks route through the document-level data-action delegation', () => {
    expect(html).toContain('if (e.target.closest(\'[data-action="tab-contacts"]\')) { _showContactsTab(); return; }');
    expect(html).toContain('if (e.target.closest(\'[data-action="tab-settings"]\')) { _showSettingsTab(); return; }');
  });
  it('the contacts tab restores the list view (same state as the back button)', () => {
    const fn = html.slice(html.indexOf('function _showContactsTab()'), html.indexOf('function _showSettingsTab()'));
    expect(fn).toContain("_DOM.get('msg-sidebar')?.classList.remove('hidden');");
    expect(fn).toContain("_DOM.get('b-msg-back')?.classList.add('hidden');");
    expect(fn).toContain("_setActiveTab('contacts');");
  });
  it('the settings tab opens the settings panel via the existing synthetic-Enter path', () => {
    const fn = html.slice(html.indexOf('function _showSettingsTab()'), html.indexOf('// Returning to the list'));
    // Same mechanism as _openSettingsFromUrl: value + Enter keydown on #msg-input.
    expect(fn).toContain("input.value = '/settings';");
    expect(fn).toContain("input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));");
    expect(html).toContain("input.value = '/settings'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));");
  });
  it('the settings tab reveals the chat area on narrow screens like opening a conversation', () => {
    const fn = html.slice(html.indexOf('function _showSettingsTab()'), html.indexOf('// Returning to the list'));
    expect(fn).toContain('if (window.innerWidth <= 640) {');
    expect(fn).toContain("_DOM.get('msg-sidebar')?.classList.add('hidden');");
    expect(fn).toContain("_DOM.get('b-msg-back')?.classList.remove('hidden');");
  });
  it('returning to the list re-selects the contacts tab', () => {
    expect(html).toContain("_DOM.get('b-msg-back')?.addEventListener('click', () => _setActiveTab('contacts'));");
    expect(html).toContain("window.addEventListener('popstate', () => { if (window.innerWidth <= 640) _setActiveTab('contacts'); }, { signal: _ac.signal });");
  });
});

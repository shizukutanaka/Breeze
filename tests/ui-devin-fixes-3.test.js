import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

// Devin UI/UX audit fixes, batch 3 (finishing pass):
//  a. Page-side listeners that outlived account switches now carry
//     { signal: _ac.signal } like their neighbours (send / attach /
//     more-panel / chat-back).
//  b. The bottom bar is page navigation, not a tablist: role="navigation"
//     and aria-current="page" on the current button instead of
//     role="tab" / aria-selected.
//  c. #b-msg-nrn exposes aria-pressed, and the first-run recovery dialogs
//     label their inputs with visible text, not placeholder/aria alone.
//  d. Keyboard reachability: the attach file input is visually hidden but
//     focusable, there is exactly one (localized) skip link, the sidebar
//     name / short-ID activate with Enter/Space, and Escape out of the
//     "+" panel returns focus to the "+" button.
//  e. The 12 keys earlier batches left in English (ariaMoreActions,
//     timeYesterday + batch 2's ten) are translated in all 48 locales
//     that had the fallback; the new skipToContent key ships translated
//     in all 50.
//  f. .msg-layout lets 100dvh win over 100vh (fallback first), and the
//     bottom bar's visibility depends on width alone, not the UA class.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const localeNames = readdirSync(new URL('../locales', import.meta.url)).filter(f => f.endsWith('.json'));
const locales = Object.fromEntries(localeNames.map(f => [f.replace('.json', ''), JSON.parse(readFileSync(new URL('../locales/' + f, import.meta.url), 'utf8'))]));

const slice = (from, to) => html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)));

describe('batch 3a: page-side listeners are abortable via _ac', () => {
  it('the attach (file input) change listener carries the signal', () => {
    const fn = slice("_DOM.get('msg-file')?.addEventListener('change'", '// v3.5: Extracted file send logic');
    expect(fn).toContain('}, { signal: _ac.signal });');
  });
  it('the send button click listeners carry the signal', () => {
    const main = slice("_DOM.get('b-msg-send')?.addEventListener('click', () => {\n    const input", "_DOM.get('b-msg-nrn')?.addEventListener");
    expect(main).toContain('}, { signal: _ac.signal });');
    expect(html).toContain("_DOM.get('b-msg-send')?.addEventListener('click', () => _closeMorePanel(), { signal: _ac.signal });");
  });
  it('the more-panel click listener carries the signal', () => {
    const fn = slice("_DOM.get('msg-more-panel')?.addEventListener('click'", "document.addEventListener('click', (e) => {\n    const p = _DOM.get('msg-more-panel');");
    expect(fn).toContain('}, { signal: _ac.signal });');
  });
  it('the chat back button click listeners carry the signal', () => {
    const main = slice("_DOM.get('b-msg-back')?.addEventListener('click', () => {\n    // v3.6", '\n  });');
    expect(main).toContain('}, { signal: _ac.signal });');
    expect(html).toContain("_DOM.get('b-msg-back')?.addEventListener('click', () => _setActiveTab('contacts'), { signal: _ac.signal });");
  });
});

describe('batch 3b: bottom bar uses navigation semantics', () => {
  const bar = slice('<nav id="msg-tabbar"', '</nav>');
  it('the bar is a navigation landmark, not a tablist', () => {
    expect(bar).toContain('role="navigation"');
    expect(bar).not.toContain('role="tablist"');
    expect(bar).not.toContain('role="tab"');
    expect(bar).not.toContain('aria-selected');
  });
  it('contacts starts as the one current page', () => {
    expect(bar).toContain('aria-current="page" data-action="tab-contacts"');
    expect(bar.match(/aria-current="page"/g)).toHaveLength(1);
  });
  it('_setActiveTab moves aria-current instead of aria-selected', () => {
    const fn = slice('function _setActiveTab(which)', 'function _showContactsTab()');
    expect(fn).toContain("c.setAttribute('aria-current', 'page')");
    expect(fn).toContain("s.setAttribute('aria-current', 'page')");
    expect(fn).toContain("c.removeAttribute('aria-current')");
    expect(fn).toContain("s.removeAttribute('aria-current')");
    expect(fn).not.toContain('aria-selected');
  });
});

describe('batch 3c: aria-pressed on NRN and visible labels in setup dialogs', () => {
  it('the NRN toggle starts unpressed and _updateNrnButton keeps aria-pressed in sync', () => {
    expect(html).toContain('id="b-msg-nrn" aria-pressed="false"');
    const fn = slice('function _updateNrnButton()', 'function _updateFocusBanner()');
    expect(fn).toContain("b.setAttribute('aria-pressed', _noReplyNeeded ? 'true' : 'false')");
  });
  it('the recovery-phrase creation dialog labels its passphrase input visibly', () => {
    expect(html).toContain('<label class="modal-desc">${esc(t(\'recoveryPassLabel\'))}<input class="modal-input" type="password"');
  });
  it('the phrase-restore dialog labels the phrase and passphrase fields visibly', () => {
    expect(html).toContain('<label class="modal-desc">${esc(t(\'recoveryPhraseLabel\'))}<textarea class="modal-input rp-phrase"');
    expect(html).toContain('<label class="modal-desc">${esc(t(\'recoveryPassLabel\'))}<input class="modal-input rp-pass"');
  });
  it('both simple-recovery dialogs label the account and passphrase fields visibly', () => {
    expect(html.match(/<label class="modal-desc">\$\{esc\(t\('simpleAccountLabel'\)\)\}<input class="modal-input rp-account"/g)).toHaveLength(2);
    expect(html.match(/<label class="modal-desc">\$\{esc\(t\('simplePassLabel'\)\)\}<input class="modal-input rp-pass"/g)).toHaveLength(2);
  });
});

describe('batch 3d: keyboard reachability', () => {
  it('the attach file input is visually hidden but focusable, with a visible focus ring on its label', () => {
    expect(html).toContain('<input type="file" id="msg-file" class="sr-only"');
    expect(html).not.toContain('<input type="file" id="msg-file" class="hidden"');
    expect(html).toContain('label.tool:focus-within { outline: 2px solid var(--g); outline-offset: 2px }');
  });
  it('there is exactly one skip link, localized, aiming at a focusable #msg-main', () => {
    expect(html.match(/class="skip-to-content"/g)).toHaveLength(1);
    expect(html).toContain('<a href="#msg-main" class="skip-to-content" data-i18n="skipToContent">Skip to content</a>');
    expect(html).not.toContain('<a href="#msg-messages"');
    expect(html).toContain('<div id="msg-main" class="hidden" tabindex="-1">');
    expect(html).toContain("skipToContent: 'Skip to content',");
  });
  it('the sidebar name and short ID are keyboard-activatable buttons', () => {
    expect(html).toContain('<span id="msg-my-name" class="name clickable" role="button" tabindex="0"');
    expect(html).toContain('<div id="msg-short-id" class="sidebar-id" role="button" tabindex="0"');
    // A dedicated delegation (the S04 selector stays exactly the four
    // message actions wave 8 fixed) re-dispatches Enter/Space as a click.
    expect(html).toContain("const el = e.target.closest?.('#msg-my-name,#msg-short-id');");
    expect(html).toContain("const el = e.target.closest?.('[data-action=\"retry-msg\"],[data-action=\"reply-scroll\"],[data-action=\"react\"],[data-action=\"vote\"]');");
  });
  it('Escape out of the "+" panel returns focus to the "+" button', () => {
    const esc = slice("document.addEventListener('keydown', (e) => {\n    if (e.key !== 'Escape') return;", "_DOM.get('b-msg-send')?.addEventListener('click', () => _closeMorePanel()");
    expect(esc).toContain("_closeMorePanel();");
    expect(esc).toContain("_DOM.get('b-msg-more')?.focus();");
  });
});

describe('batch 3e: the newest keys are translated in every locale', () => {
  const EN = {
    ariaMoreActions: 'More actions', timeYesterday: 'Yesterday',
    setupRestoreToggle: 'Restore an existing account', addOptionContact: 'Add a contact',
    addOptionGroup: 'Create a group', keywrapProtectBtn: 'Protect with a passphrase',
    backupNudgeTitle: 'Back up your account',
    backupNudgeBody: 'A backup is the only way back into this account if you lose this device. It only takes a moment.',
    ariaConvMenu: 'Conversation menu', menuSecurity: 'Check safety number',
    menuMute: 'Mute notifications', menuPoll: 'Create a poll', skipToContent: 'Skip to content',
  };
  it('no locale keeps any of the 13 keys at the English value', () => {
    for (const [lang, table] of Object.entries(locales)) {
      for (const [k, v] of Object.entries(EN)) {
        expect(table[k], lang + '.' + k).toBeTruthy();
        expect(table[k], lang + '.' + k).not.toBe(v);
      }
    }
  });
  it('ja translates the new skip key too', () => {
    expect(locales.ja.skipToContent).toBe('コンテンツへスキップ');
  });
  it('every locale file keeps the identical key set', () => {
    const ref = Object.keys(locales.ja).sort().join(',');
    for (const [lang, table] of Object.entries(locales)) {
      expect(Object.keys(table).sort().join(','), lang).toBe(ref);
    }
  });
});

describe('batch 3f: zoom-safe layout', () => {
  it('.msg-layout declares 100vh as the fallback and lets 100dvh win', () => {
    expect(html).toContain('height: calc(100vh - 100px); height: calc(100dvh - 100px);');
    expect(html).not.toContain('height: calc(100dvh - 100px); height: calc(100vh - 100px);');
  });
  it('the bottom bar shows by width alone (no UA-class gate)', () => {
    const css = html.slice(html.indexOf('/* ── Bottom tab bar'), html.indexOf('/* Hide scrollbars on mobile'));
    expect(css).toContain('#msg-tabbar { display: flex');
    expect(css).not.toContain('.is-mobile #msg-tabbar');
    expect(css).not.toContain('.is-mobile .contact-list');
  });
});

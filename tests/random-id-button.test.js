// Random-ID start (2026-11-25) — the first screen's primary action.
//
// What is pinned here:
//   1. The setup screen leads with ONE primary CTA, "Start with a random
//      ID", with an optional display-name field in front of it (labelled
//      yourDisplayName). The named phrase-mode creation is secondary;
//      the disposable entry is gone (see recovery-disposable.test.js).
//   2. The button is wired to _runSetupCreate('random'), which reads
//      ONLY the random flow's name field (empty → the existing
//      'Anonymous' default), claims no alias, and creates through
//      createIdentity's existing random generation path (executed for
//      real in recovery-disposable.test.js).
//   3. The setup copy is plain language: no "Identity = crypto key", no
//      "ECDH + AES-256" — in EN, JA, and every shipped locale.
//   4. The display name can also be changed from the settings view, and
//      it writes through the profile module's own save path
//      (_profileUI.setDisplayName → _saveProfile — the same function the
//      /profile panel's OK button uses). The behavioural half executes
//      the real src/app/profile.js against mock deps.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProfileUI } from '../src/app/profile.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
const profileSrc = readFileSync(join(HERE, '..', 'src', 'app', 'profile.js'), 'utf8');
const ja = JSON.parse(readFileSync(join(HERE, '..', 'locales', 'ja.json'), 'utf8'));
const LOCALES = readdirSync(join(HERE, '..', 'locales')).filter(x => x.endsWith('.json'));
const locale = (f) => JSON.parse(readFileSync(join(HERE, '..', 'locales', f), 'utf8'));

function sliceBetween(startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start);
  expect(start, startMarker).toBeGreaterThan(-1);
  expect(end, endMarker).toBeGreaterThan(start);
  return html.slice(start, end);
}
const setup = sliceBetween('<div id="msg-setup"', '<!-- Main UI -->');

// ── (1) the setup screen ────────────────────────────────────────────
describe('setup screen — the random-ID start is the primary action', () => {
  it('the random button is the one big CTA, with its name field in front of it', () => {
    expect(setup).toContain('id="msg-name-random"');
    expect(setup).toContain('data-i18n-ph="yourDisplayName"');
    expect(setup).toContain('class="btn btn-g setup-cta" id="b-msg-setup-random"');
    expect(setup).toContain('data-i18n="setupRandom"');
    // The name field belongs to the random flow: it precedes the button,
    // and the button precedes the named (phrase-mode) creation form.
    expect(setup.indexOf('id="msg-name-random"')).toBeLessThan(setup.indexOf('id="b-msg-setup-random"'));
    expect(setup.indexOf('id="b-msg-setup-random"')).toBeLessThan(setup.indexOf('id="msg-name"'));
    // Exactly one primary CTA on the screen.
    expect(setup.split('setup-cta')).toHaveLength(2);
    expect(setup).toContain('class="btn btn-o setup-restore" id="b-msg-setup"');
  });

  it('the disposable creation entry is not offered', () => {
    expect(setup).not.toContain('b-msg-setup-none');
    expect(setup).not.toContain('setupDisposable');
  });
});

// ── (2) wiring ──────────────────────────────────────────────────────
describe('random start — wiring', () => {
  it('the button runs the shared create flow in random mode', () => {
    expect(html).toContain("_DOM.get('b-msg-setup-random')?.addEventListener('click', () => { _runSetupCreate('random'); }, { signal: _ac.signal });");
    // Enter in the name field starts too (enterkeyhint="done").
    const key = sliceBetween("_DOM.get('msg-name-random')?.addEventListener('keydown'", "_DOM.get('msg-name')?.addEventListener('keydown'");
    expect(key).toContain("_DOM.get('b-msg-setup-random')?.click()");
  });

  it('random mode reads only its own name field, defaults like the form, and claims no alias', () => {
    const fn = sliceBetween('async function _runSetupCreate(disposable', 'if (!await createIdentity(name, alias, disposable)) return;');
    expect(fn).toContain("disposable === 'random' ? _DOM.get('msg-name-random')?.value.trim().slice(0, 64) || 'Anonymous'");
    expect(fn).toContain("disposable === 'random' ? '' :");
    // (The slice ends AT the shared `await createIdentity(name, alias,
    // disposable)` call — every mode, random included, funnels into it.)
  });
});

// ── (3) plain-language copy ─────────────────────────────────────────
describe('setup copy — plain language, no key jargon', () => {
  it('EN says the app makes the ID; the jargon strings are gone', () => {
    expect(html).toContain("featNoRegSub: 'The app creates your ID automatically'");
    expect(html).toContain("featEncryptSub: 'No one else can read your messages'");
    expect(html).toContain("setupRandom: 'Start with a random ID'");
    expect(html).toContain("yourDisplayName: 'Your name (display name)'");
    expect(html).not.toContain('Identity = crypto key');
    expect(html).not.toContain('ECDH + AES-256');
  });

  it('JA carries the real plain-language translations', () => {
    expect(ja.setupRandom).toBe('ランダムIDで始める');
    expect(ja.yourDisplayName).toBe('あなたの名前（表示名）');
    expect(ja.featNoRegSub).toBe('アプリが自動でIDを作ります');
    expect(ja.featEncryptSub).toBe('ほかの誰にも読まれません');
    expect(ja.noCreditCard).toBe('クレジットカード不要。メール不要。登録も不要。');
    // The keywrap card no longer talks about an "IDキー".
    expect(ja.keywrapSuggestion).not.toContain('IDキー');
    expect(ja.keywrapSuggestion).toContain('パスフレーズ');
  });

  it('every locale carries the new keys and the de-jargoned feature lines', () => {
    expect(LOCALES.length).toBe(50);
    for (const f of LOCALES) {
      const loc = locale(f);
      expect(typeof loc.setupRandom, `${f} setupRandom`).toBe('string');
      expect(typeof loc.yourDisplayName, `${f} yourDisplayName`).toBe('string');
      expect(loc.featNoRegSub, `${f} featNoRegSub`).not.toContain('= ');
      expect(loc.featEncryptSub, `${f} featEncryptSub`).not.toContain('ECDH');
    }
    // Spot-check two real translations of the rewritten lines.
    expect(locale('de.json').featNoRegSub).toBe('Die App erstellt deine ID automatisch');
    expect(locale('ko.json').featEncryptSub).toBe('다른 누구도 내 메시지를 읽을 수 없습니다');
  });
});

// ── (4) display name from the settings view ─────────────────────────
describe('settings view — display name editing shares the profile save path', () => {
  it('the settings panel renders a name field and a save button', () => {
    const panel = sliceBetween('function _renderSettingsPanel(d)', 'function openSettingsView()');
    expect(panel).toContain('class="settings-name-input"');
    expect(panel).toContain('data-action="save-display-name"');
    expect(panel).toContain("t('yourDisplayName')");
    expect(panel).toContain("value=\"${esc(myName)}\"");
  });

  it('the save button delegates to the profile module — no second store', () => {
    const panel = sliceBetween('function _renderSettingsPanel(d)', 'function openSettingsView()');
    expect(panel).toContain("_profileUI?.setDisplayName(name)");
    expect(panel).toContain("showToast(t('profileSaved'), 'success')");
    expect(profileSrc).toContain('setDisplayName: _setDisplayName');
    // One save path: the panel OK handler and setDisplayName both land
    // in _saveProfile, which is the only writer of the profile record.
    expect(profileSrc).toContain('await _saveProfile(clean);');
    expect(profileSrc.split("D.dbPut('settings', { ...clean, pv: Date.now() }, 'profile')")).toHaveLength(2);
  });

  it('setDisplayName writes the same places the profile panel writes', async () => {
    const stores = {
      settings: new Map([['profile', { name: 'Old Name', emoji: '🌊', img: '', pv: 5 }]]),
      identity: new Map([['keys', { pubB64: 'XXXX', name: 'Old Name' }]]),
      contacts: new Map(),
    };
    let currentName = 'Old Name';
    let refreshed = 0;
    const headerEl = { textContent: 'Old Name' };
    const D = {
      dbGet: async (s, k) => stores[s].get(k) ?? null,
      dbPut: async (s, v, k) => { stores[s].set(k, v); return true; },
      dbGetAll: async () => [],
      myName: () => currentName,
      setMyName: (v) => { currentName = v; },
      myId: () => 'testid00000',
      myPubB64: () => 'XXXX',
      domGet: () => headerEl,
      t: (k) => k, esc: (s) => s, dbg: () => {}, showToast: () => {},
      refreshSelfCard: () => { refreshed++; },
    };
    const ui = createProfileUI(D);
    expect(await ui.setDisplayName('New Name')).toBe(true);
    // The profile record: name changed, emoji/photo preserved, pv bumped.
    const prof = stores.settings.get('profile');
    expect(prof.name).toBe('New Name');
    expect(prof.emoji).toBe('🌊');
    expect(prof.pv).toBeGreaterThan(5);
    // The identity record and the live/header name follow, as the panel's
    // save has always done.
    expect(stores.identity.get('keys').name).toBe('New Name');
    expect(currentName).toBe('New Name');
    expect(headerEl.textContent).toBe('New Name');
    expect(refreshed).toBe(1);
    // An empty name is refused and writes nothing.
    expect(await ui.setDisplayName('   ')).toBe(false);
    expect(stores.settings.get('profile').name).toBe('New Name');
  });
});

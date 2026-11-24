import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

// Input bar cleanup (UI/UX phase 1B, owner request): the composer row used to
// carry nine controls, so the everyday bar now keeps only the "+" button, the
// textarea, the emoji button and send. The secondary actions (attach, voice,
// dictation, location, stickers, no-reply) live in a grid panel the "+"
// button opens above the bar. The moved controls keep their ids and their
// existing handlers — only their place in the DOM and the panel's show/hide
// changed — so this test pins the layout, the panel contents and the wiring.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ja = JSON.parse(readFileSync(new URL('../locales/ja.json', import.meta.url), 'utf8'));

const barStart = html.indexOf('<div id="msg-input-bar"');
const bar = html.slice(barStart, html.indexOf('<!-- Bottom tab bar'));
const panelStart = bar.indexOf('id="msg-more-panel"');
const panelEnd = bar.indexOf('id="b-msg-more"');
const panel = bar.slice(panelStart, panelEnd);
const MOVED = ['id="msg-file"', 'id="b-msg-voice"', 'id="b-msg-stt"', 'id="b-msg-loc"', 'id="b-msg-sticker"', 'id="b-msg-nrn"'];

describe('input bar row keeps only the everyday controls', () => {
  it('the bar exists and the panel sits inside it, before the "+" button', () => {
    expect(barStart).toBeGreaterThan(-1);
    expect(panelStart).toBeGreaterThan(-1);
    expect(panelEnd).toBeGreaterThan(panelStart);
  });
  it('every moved control lives inside the panel, nowhere else in the bar', () => {
    for (const id of MOVED) {
      const at = bar.indexOf(id);
      expect(at, id).toBeGreaterThan(panelStart);
      expect(at, id).toBeLessThan(panelEnd);
      expect(bar.indexOf(id, at + 1), id + ' duplicated').toBe(-1);
    }
  });
  it('the textarea, emoji and send stay in the bar row (after the panel)', () => {
    for (const id of ['id="msg-input"', 'id="b-msg-emoji"', 'id="b-msg-send"']) {
      expect(bar.indexOf(id), id).toBeGreaterThan(panelEnd);
    }
  });
  it('the "+" button carries the toggle contract', () => {
    const btn = bar.slice(panelEnd, bar.indexOf('id="msg-input"'));
    expect(btn).toContain('data-action="more-panel"');
    expect(btn).toContain('aria-expanded="false"');
    expect(btn).toContain('aria-controls="msg-more-panel"');
    expect(btn).toContain('data-i18n-aria="ariaMoreActions"');
  });
  it('the panel starts hidden', () => {
    expect(panel).toContain('class="more-panel hidden"');
  });
});

describe('"+" panel contents', () => {
  it('has one labelled grid item per moved control', () => {
    expect(panel.match(/class="more-item"/g)).toHaveLength(6);
    expect(panel.match(/class="more-label"/g)).toHaveLength(6);
  });
  it('labels reuse existing i18n keys', () => {
    for (const key of ['ttAttach', 'ariaVoice', 'ariaDict', 'ttLocation', 'ttStickers', 'nrnBadge']) {
      expect(panel, key).toContain(`data-i18n="${key}"`);
    }
  });
  it('the panel is a full-width row of the bar and empty cells never render', () => {
    expect(html).toContain('.more-panel { flex: 0 0 100%');
    // The dictation item hides while its button is .hidden (no SpeechRecognition).
    expect(html).toContain('.more-item:has(> .hidden) { display: none }');
  });
});

describe('"+" panel wiring', () => {
  it('the "+" button routes through the document-level data-action delegation', () => {
    expect(html).toContain('if (e.target.closest(\'[data-action="more-panel"]\')) { _toggleMorePanel(); return; }');
  });
  it('toggle flips the hidden class and mirrors aria-expanded', () => {
    const fn = html.slice(html.indexOf('function _toggleMorePanel()'), html.indexOf("_DOM.get('msg-more-panel')?.addEventListener"));
    expect(fn).toContain("const open = !p.classList.toggle('hidden');");
    expect(fn).toContain("_DOM.get('b-msg-more')?.setAttribute('aria-expanded', open ? 'true' : 'false');");
  });
  it('closes on an outside tap and on Escape', () => {
    expect(html).toContain("if (!_DOM.get('msg-input-bar')?.contains(e.target)) _closeMorePanel();");
    expect(html).toContain("document.addEventListener('keydown', (e) => { if (e.key === 'Escape') _closeMorePanel(); }, { signal: _ac.signal });");
  });
  it('closes after a one-shot item, but voice/dictation taps keep it open', () => {
    const handler = html.slice(html.indexOf("_DOM.get('msg-more-panel')?.addEventListener"), html.indexOf("document.addEventListener('click', (e) => {\n    const p = _DOM.get('msg-more-panel');"));
    expect(handler).toContain("if (e.target.closest('#b-msg-voice, #b-msg-stt')) return;");
    expect(handler).toContain('_closeMorePanel();');
    // A tap anywhere in the cell that missed the control (the text under
    // an icon, or the cell padding) forwards to the control itself.
    expect(handler).toContain("const control = item.querySelector('button, label');");
    expect(handler).toContain('if (control && !control.contains(e.target)) { control.click(); return; }');
  });
  it('closes on send and when the emoji picker opens', () => {
    expect(html).toContain("_DOM.get('b-msg-send')?.addEventListener('click', () => _closeMorePanel());");
    expect(html).toContain("_DOM.get('b-msg-emoji')?.addEventListener('click', () => _closeMorePanel());");
  });
  it('the location button finally opens the location panel (it shipped unwired)', () => {
    expect(html).toContain("_DOM.get('b-msg-loc')?.addEventListener('click', () => { _locUI?.showPanel().catch(e => _dbg(e, 'loc-panel')); });");
  });
});

describe('"+" panel i18n', () => {
  it('the one new key exists in English and in Japanese (real translation)', () => {
    expect(html).toContain("ariaMoreActions: 'More actions'");
    expect(ja.ariaMoreActions).toBe('その他の機能');
  });
  it('every shipped locale carries the new key (no missing-key fallback)', () => {
    const dir = new URL('../locales/', import.meta.url);
    const files = readdirSync(dir).filter(f => f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(40);
    for (const f of files) {
      const loc = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
      expect(typeof loc.ariaMoreActions, f).toBe('string');
      expect(loc.ariaMoreActions.length, f).toBeGreaterThan(0);
    }
  });
});

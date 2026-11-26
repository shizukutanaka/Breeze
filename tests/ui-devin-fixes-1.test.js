import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Devin UI/UX audit fixes, batch 1 (every finding verified against the
// code before fixing):
//  (a) Voice / dictation buttons keep their line icons: state changes swap
//      two SVGs via .hidden instead of overwriting textContent with emoji.
//  (b) The undefined .btn-p class is gone; dialog primary actions use
//      .btn-g and cancel/secondary actions use .btn-o.
//  (c) The armed "no reply needed" state shows as a dot on the "+" button,
//      and an outside tap no longer closes the panel mid-recording.
//  (d) A tap anywhere in a "+" panel cell activates its control; the nrn
//      tile uses the same .tool class as the other tiles.
//  (e) Live P2P acks update the shared .msg-status element (shape-coded);
//      no legacy .delivery-state badge is created any more.
//  (f) The away presence dot uses var(--y) and a distinct (square) shape.
//  (g) The orphaned declaration block after .poll-opt:active is merged
//      back into .poll-opt, so min-height: var(--touch) applies again.
//  (h) Touch targets: failed-status retry >= 24px (44px on coarse
//      pointers, together with .btn-sm / .folder-tab / .acc-tab), the
//      send button is 44px, and .msg-copy has a wider hit area.
//  (i) JS scrolling and the voice waveform honor prefers-reduced-motion;
//      the duplicated reduced-motion CSS rule is removed.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const voiceSrc = readFileSync(new URL('../src/app/voice-input.js', import.meta.url), 'utf8');
const chatSearchSrc = readFileSync(new URL('../src/app/chat-search.js', import.meta.url), 'utf8');
const profileSrc = readFileSync(new URL('../src/app/profile.js', import.meta.url), 'utf8');
const locationSrc = readFileSync(new URL('../src/app/location.js', import.meta.url), 'utf8');
const stickersSrc = readFileSync(new URL('../src/app/stickers.js', import.meta.url), 'utf8');

// First CSS rule body for an exact selector anchored at a line start
// (same helper shape as tests/ui-status-icons.test.js).
function ruleBody(selector) {
  const re = new RegExp('(^|\\n)' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{');
  const m = html.match(re);
  expect(m, `rule ${selector}`).toBeTruthy();
  const open = html.indexOf('{', m.index);
  return html.slice(open + 1, html.indexOf('}', open));
}
function sliceBetween(startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start);
  expect(start, startMarker).toBeGreaterThan(-1);
  expect(end, endMarker).toBeGreaterThan(start);
  return html.slice(start, end);
}
function buttonChunk(id) {
  const at = html.indexOf(`id="${id}"`);
  expect(at, id).toBeGreaterThan(-1);
  return html.slice(at, html.indexOf('</button>', at));
}

// ── (a) voice / dictation icons survive state changes ───────────────
describe('(a) voice and dictation buttons swap SVGs instead of emoji text', () => {
  it('voice-input.js never writes emoji into the buttons textContent', () => {
    expect(voiceSrc).not.toMatch(/textContent = '(🎤|⏹|🗣|🔴)'/);
    expect(voiceSrc).not.toContain("textContent = '");
  });

  it('voice-input.js swaps icons through the shared helper', () => {
    expect(voiceSrc).toContain('function _setBtnIcon(btn, activeCls, active)');
    expect(voiceSrc).toContain("_setBtnIcon(voiceBtn, 'ico-stop', true)");
    expect(voiceSrc).toContain("_setBtnIcon(voiceBtn, 'ico-stop', false)");
    expect(voiceSrc).toContain("_setBtnIcon(sttBtn, 'ico-rec', true)");
    expect(voiceSrc).toContain("_setBtnIcon(sttBtn, 'ico-rec', false)");
  });

  it('both buttons carry a second, initially hidden state icon', () => {
    expect(buttonChunk('b-msg-voice')).toContain('data-icon-class="ico-stop hidden"');
    expect(buttonChunk('b-msg-stt')).toContain('data-icon-class="ico-rec hidden"');
  });
});

// ── (b) no undefined .btn-p ─────────────────────────────────────────
describe('(b) dialog buttons use defined classes: primary btn-g, cancel btn-o', () => {
  it('btn-p appears nowhere in the shipped sources', () => {
    for (const [name, src] of Object.entries({ html, profileSrc, locationSrc, stickersSrc })) {
      expect(src.includes('btn-p'), name).toBe(false);
    }
  });

  it('profile dialog: Save is btn-g, Cancel is btn-o', () => {
    expect(profileSrc).toContain('class="btn btn-g btn-sm" value="ok"');
    expect(profileSrc).toContain('class="btn btn-o btn-sm" value="cancel"');
  });

  it('location dialog: Send Once is btn-g, Cancel is btn-o', () => {
    expect(locationSrc).toContain('class="btn btn-g btn-sm loc-once"');
    expect(locationSrc).toContain('class="btn btn-o btn-sm" value="cancel"');
  });
});

// ── (c) nrn state visible from the bar; recording keeps its panel ───
describe('(c) no-reply-needed state and the recording guard', () => {
  it('_updateNrnButton mirrors the armed state onto the "+" button', () => {
    const src = sliceBetween('function _updateNrnButton', 'function _updateFocusBanner');
    expect(src).toContain("_DOM.get('b-msg-more')");
    expect(src).toContain("more.classList.toggle('nrn-on', _noReplyNeeded)");
  });

  it('the "+" button shows a dot while nrn is armed', () => {
    expect(ruleBody('#b-msg-more.nrn-on::after')).toContain('background: var(--g)');
    expect(ruleBody('#b-msg-more')).toContain('position: relative');
  });

  it('an outside tap does not close the panel while recording or dictating', () => {
    expect(html).toContain("if (_DOM.get('b-msg-voice')?.classList.contains('voice-recording')) return;");
    expect(html).toContain("if (_DOM.get('b-msg-stt')?.getAttribute('aria-pressed') === 'true') return;");
  });
});

// ── (d) whole panel cell is the tap target ──────────────────────────
describe('(d) "+" panel cells forward any tap to their control', () => {
  it('the panel handler forwards taps that missed the control', () => {
    expect(html).toContain("const control = item.querySelector('button, label');");
    expect(html).toContain('if (control && !control.contains(e.target)) { control.click(); return; }');
  });

  it('the nrn tile matches the other tiles (.tool, not a .btn)', () => {
    const at = html.indexOf('id="b-msg-nrn"');
    const start = html.lastIndexOf('<button', at);
    expect(html.slice(start, at)).toContain('class="tool"');
    expect(html.slice(start, at)).not.toContain('btn');
  });
});

// ── (e) P2P acks use the shared shape-coded status element ──────────
describe('(e) updateDeliveryState updates .msg-status, creating no badge', () => {
  it('no .delivery-state remains in markup, CSS or the ack path', () => {
    expect(html).not.toContain('delivery-state');
  });

  it('the ack path sets the delivered/read classes on .msg-status', () => {
    const src = sliceBetween('function updateDeliveryState', '// v3: BINARY FILE CHUNK');
    expect(src).toContain('[data-msgid="${msgId}"] .msg-status');
    expect(src).toContain("statusEl.classList.add('delivered');");
    expect(src).toContain("statusEl.classList.add('read');");
    expect(src).not.toContain('createElement');
  });
});

// ── (f) away presence dot ───────────────────────────────────────────
describe('(f) away presence dot uses var(--y) and its own shape', () => {
  it('.presence-dot.away is a var(--y) rounded square, no hardcoded amber', () => {
    const body = ruleBody('.presence-dot.away');
    expect(body).toContain('background: var(--y)');
    expect(body).toContain('border-radius: 2px');
    expect(html).not.toContain('#f59e0b');
  });
});

// ── (g) poll option CSS is well-formed again ────────────────────────
describe('(g) .poll-opt carries its layout declarations in the rule itself', () => {
  it('min-height: var(--touch) is inside the .poll-opt rule', () => {
    const body = ruleBody('.poll-opt');
    expect(body).toContain('min-height: var(--touch)');
    expect(body).toContain('position: relative');
    expect(body).toContain('display: flex');
  });

  it('no orphaned declaration block dangles after .poll-opt:active', () => {
    expect(html).not.toMatch(/\.poll-opt:active \{[^}]*\}\n  position: relative;/);
  });
});

// ── (h) touch targets ───────────────────────────────────────────────
describe('(h) touch targets meet the size floor', () => {
  it('the failed-status retry is at least 24px', () => {
    const body = ruleBody('.msg-status.failed');
    expect(body).toContain('min-width: 24px');
    expect(body).toContain('min-height: 24px');
  });

  it('coarse pointers get 44px minimums on the small controls', () => {
    const block = sliceBetween('@media (pointer: coarse)', '\n}');
    for (const sel of ['.btn-sm', '.folder-tab', '.acc-tab', '.msg-status.failed', '.msg-copy']) {
      expect(block, sel).toContain(sel);
    }
    expect(block).toContain('min-height: 44px');
    expect(block).toContain('min-width: 44px');
  });

  it('the send button is 44px and .msg-copy has a wider hit area', () => {
    const send = ruleBody('.input-bar .send');
    expect(send).toContain('width: calc(var(--touch) - 4px)');
    expect(send).toContain('height: calc(var(--touch) - 4px)');
    const touch = html.match(/--touch:\s*(\d+)px/);
    expect(touch).not.toBeNull();
    expect(Number(touch[1]) - 4).toBe(44);
    const copy = ruleBody('.msg-copy');
    expect(copy).toContain('min-width: 32px');
    expect(copy).toContain('min-height: 32px');
  });
});

// ── (i) reduced motion in JS ────────────────────────────────────────
describe('(i) JS motion honors prefers-reduced-motion', () => {
  it('index.html defines the helpers and no literal smooth scroll remains', () => {
    expect(html).toContain('const _prefersReducedMotion = ');
    expect(html).toContain('const _scrollBehavior = ');
    expect(html).not.toContain("behavior: 'smooth'");
    expect(html.match(/behavior: _scrollBehavior\(\)/g).length).toBeGreaterThanOrEqual(4);
  });

  it('chat search scrolls through the same helper', () => {
    expect(chatSearchSrc).toContain('_scrollBehavior');
    expect(chatSearchSrc).not.toContain("behavior: 'smooth'");
  });

  it('the voice waveform loop is gated on the preference', () => {
    expect(voiceSrc).toContain("!window.matchMedia('(prefers-reduced-motion: reduce)').matches");
  });

  it('the reduced-motion CSS rule exists exactly once', () => {
    expect(html.match(/@media \(prefers-reduced-motion: reduce\)/g)).toHaveLength(1);
  });
});

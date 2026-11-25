import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// UI/UX phase 3 (owner requests): unified line icons + status displays that
// do not rely on color alone.
//  (a) Every action button in the composer, the "+" panel, the chat header
//      and the bottom tab bar renders the shared stroke-icon family (.ico
//      inline SVG, currentColor) instead of an emoji glyph. Ids, handlers
//      and aria labels are untouched — only the visible glyph changed.
//  (b) Delivery states are shape-coded, not just color/opacity-coded:
//      sent = one check, deposited = one check inside a ring, delivered =
//      two checks, read = two checks on a filled chip, failed = cross on a
//      filled chip. The live P2P ack path updates the same .msg-status
//      element, so it is shape-coded too.
//  (c) Status text is real text: >= 12px, no opacity dimming, and every
//      status color pairing reaches WCAG AA 4.5:1, computed with the same
//      relative-luminance math as tests/ui-contrast.test.js. This closes
//      the two leftovers PR #519 deferred: light --y as small-glyph text
//      color, and the 10px + opacity .ts rules.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// ── contrast helpers (same math as ui-contrast.test.js) ─────────────
function blockAfter(selector, fromIndex = 0) {
  const start = html.indexOf(selector, fromIndex);
  expect(start, `selector ${selector}`).toBeGreaterThanOrEqual(0);
  const open = html.indexOf('{', start);
  const close = html.indexOf('}', open);
  return html.slice(open + 1, close);
}
function varsOf(block) {
  const vars = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) vars[m[1]] = m[2].trim();
  return vars;
}
const hex = h => {
  h = h.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const rgba = s => {
  const m = s.match(/rgba?\(([^)]+)\)/);
  const parts = m[1].split(',').map(v => parseFloat(v));
  return { rgb: parts.slice(0, 3), a: parts.length > 3 ? parts[3] : 1 };
};
const over = (fg, a, bg) => fg.map((c, i) => a * c + (1 - a) * bg[i]);
const lum = ([r, g, b]) => {
  const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (c1, c2) => {
  const [hi, lo] = [lum(c1), lum(c2)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
};
function backgrounds(vars) {
  const bg = hex(vars['--bg']);
  const out = { '--bg': bg };
  for (const s of ['--s1', '--s2', '--s3']) {
    const { rgb, a } = rgba(vars[s]);
    out[s] = over(rgb, a, bg);
  }
  return out;
}
const THEMES = {
  'dark (:root)': varsOf(blockAfter(':root {')),
  'light (.light)': varsOf(blockAfter('.light {')),
  'light (auto-theme)': varsOf(blockAfter(':root.auto-theme {', html.indexOf('@media (prefers-color-scheme: light)'))),
};
const AA = 4.5;

// First CSS rule body for an exact selector anchored at a line start, so
// theme overrides ('.light .msg-status.failed { … }') are not mistaken for
// the base rule.
function ruleBody(selector) {
  const re = new RegExp('(^|\\n)' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{');
  const m = html.match(re);
  expect(m, `rule ${selector}`).toBeTruthy();
  const open = html.indexOf('{', m.index);
  return html.slice(open + 1, html.indexOf('}', open));
}
function hasBaseRule(selector) {
  const re = new RegExp('(^|\\n)' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{');
  return re.test(html);
}
function fontSizeOf(selector) {
  const m = ruleBody(selector).match(/font-size:\s*(\d+(?:\.\d+)?)px/);
  expect(m, `${selector} declares a font-size`).toBeTruthy();
  return parseFloat(m[1]);
}

// ── (a) line icons ──────────────────────────────────────────────────
const EMOJI_GLYPHS = ['📎', '🎤', '🗣', '📍', '🎨', '🕊', '😀', '📞', '📹', '⏱', '🗑', '👥', '⚙'];
function sliceBetween(startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start);
  expect(start, startMarker).toBeGreaterThan(-1);
  expect(end, endMarker).toBeGreaterThan(start);
  return html.slice(start, end);
}

describe('action buttons use the shared line-icon family, not emoji', () => {
  it('the .ico family is CSS-driven: currentColor stroke, no fill', () => {
    const body = ruleBody('.ico');
    expect(body).toContain('stroke: currentColor');
    expect(body).toContain('fill: none');
  });

  it('no emoji glyph remains in the chat header, composer or tab bar markup', () => {
    const regions = [
      sliceBetween('<div id="msg-conv-header"', '<div id="msg-messages"'),
      sliceBetween('<div id="msg-input-bar"', '<!-- Bottom tab bar'),
      sliceBetween('<nav id="msg-tabbar"', '</nav>'),
    ];
    for (const region of regions) {
      for (const glyph of EMOJI_GLYPHS) {
        expect(region.includes(glyph), `glyph ${glyph}`).toBe(false);
      }
    }
  });

  it('every target button renders an inline SVG icon and keeps its aria hook', () => {
    const targets = [
      ['b-msg-back', 'ariaBack'], ['b-msg-call', 'ariaCall'], ['b-msg-video', 'ariaVideoCall'],
      ['b-msg-timer', 'ariaTimer'], ['b-msg-clear', 'ariaClearChat'],
      ['b-msg-voice', 'ariaVoice'], ['b-msg-stt', 'ariaDict'], ['b-msg-loc', 'ttLocation'],
      ['b-msg-sticker', 'ttStickers'], ['b-msg-nrn', 'nrnAria'],
      ['b-msg-more', 'ariaMoreActions'], ['b-msg-emoji', 'ttEmoji'], ['b-msg-send', 'send'],
      ['tab-contacts', 'ariaContacts'], ['tab-settings', 'helpSettings'],
    ];
    for (const [id, ariaKey] of targets) {
      const at = html.indexOf(`id="${id}"`);
      expect(at, id).toBeGreaterThan(-1);
      const end = html.indexOf('</button>', at);
      const chunk = html.slice(at, end);
      expect(chunk, id).toContain('<svg class="ico"');
      expect(chunk, id).toContain(`data-i18n-aria="${ariaKey}"`);
    }
    // The attach control is a <label> wrapping the hidden file input; the
    // icon sits before the input inside the same label.
    const label = sliceBetween('<label class="tool"', '</label>');
    expect(label).toContain('<svg class="ico"');
    expect(label).toContain('id="msg-file"');
  });

  it('the timer button shows its duration in a text label next to the clock icon', () => {
    const at = html.indexOf('id="b-msg-timer"');
    const chunk = html.slice(at, html.indexOf('</button>', at));
    expect(chunk).toContain('<span class="timer-label"></span>');
    // The click handler writes the label span, never the whole button (which
    // would erase the icon), and never an emoji glyph.
    expect(html).toContain("timerLbl.textContent = _disappearTimer === 0 ? '' : labels[next];");
    expect(html).not.toContain("btn.textContent = _disappearTimer");
  });
});

// ── (b) shape-coded delivery states ─────────────────────────────────
describe('delivery states differ by shape, not only by color or opacity', () => {
  it('sent renders one check; delivered and read render two', () => {
    expect(html).toContain("meta.failed ? '✗' : meta.readAt || meta.ack ? '✓✓' : '✓'");
  });

  it('deposited is a ringed check (border circle), unlike the bare sent check', () => {
    const body = ruleBody('.msg-status.deposited');
    expect(body).toContain('border:');
    expect(body).toContain('border-radius: 50%');
  });

  it('read is a filled chip, unlike the bare delivered checks', () => {
    expect(ruleBody('.msg-status.read')).toContain('background: var(--blue)');
  });

  it('failed is a filled chip, unlike any check state', () => {
    expect(ruleBody('.msg-status.failed')).toContain('background: var(--r)');
  });

  it('no .msg-status rule dims by opacity any more', () => {
    for (const sel of ['.msg-status', '.msg-status.sent', '.msg-status.deposited', '.msg-status.delivered', '.msg-status.read', '.msg-status.failed']) {
      if (!hasBaseRule(sel)) continue; // per-state rules for sent/delivered need not exist
      expect(ruleBody(sel), sel).not.toContain('opacity');
    }
  });

  it('the P2P ack path updates the shared .msg-status element, creating no legacy badge', () => {
    const src = sliceBetween('function updateDeliveryState', '// v3: BINARY FILE CHUNK');
    expect(src).toContain('.msg-status');
    expect(src).toContain("statusEl.classList.add('delivered');");
    expect(src).toContain("statusEl.classList.add('read');");
    expect(src).toContain("statusEl.textContent = '✓✓';");
    expect(src).not.toContain('delivery-state');
    expect(src).not.toContain('createElement');
  });
});

// ── (c) status text size + contrast floor ───────────────────────────
describe('status text is at least 12px with no opacity dimming', () => {
  it('.ts, .msg-status and .msg-timer-badge all meet the floor', () => {
    for (const sel of ['.ts', '.msg-status', '.msg-timer-badge']) {
      expect(fontSizeOf(sel), sel).toBeGreaterThanOrEqual(12);
      expect(ruleBody(sel), sel).not.toContain('opacity');
    }
    expect(fontSizeOf('.compact .ts')).toBeGreaterThanOrEqual(12);
    expect(fontSizeOf('.ts.expanded')).toBeGreaterThanOrEqual(12);
  });

  it('the timer badge inherits the bubble text color on own messages', () => {
    expect(ruleBody('.msg.me .msg-timer-badge')).toContain('color: inherit');
  });
});

describe('status colors reach WCAG AA (same math as ui-contrast)', () => {
  for (const [theme, vars] of Object.entries(THEMES)) {
    it(`${theme}: --y (timer badge / warning text) reaches ${AA}:1 on every background`, () => {
      const fg = hex(vars['--y']);
      for (const [bgName, bg] of Object.entries(backgrounds(vars))) {
        const ratio = contrast(fg, bg);
        expect(ratio, `${theme} --y ${vars['--y']} on ${bgName} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
      }
    });

    it(`${theme}: the read chip pairs black glyphs with --blue at ${AA}:1 or better`, () => {
      const ratio = contrast(hex('#000000'), hex(vars['--blue']));
      expect(ratio, `${theme} #000 on --blue ${vars['--blue']} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
      expect(ruleBody('.msg-status.read')).toContain('color: #000');
    });

    it(`${theme}: the failed chip pairs its glyph color with --r at ${AA}:1 or better`, () => {
      const light = theme !== 'dark (:root)';
      const glyph = light ? '#ffffff' : '#000000';
      const ratio = contrast(hex(glyph), hex(vars['--r']));
      expect(ratio, `${theme} ${glyph} on --r ${vars['--r']} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
    });
  }

  it('light themes flip the failed-chip glyph to white', () => {
    expect(html).toContain('.light .msg-status.failed { color: #fff }');
    expect(html).toContain(':root.auto-theme .msg-status.failed { color: #fff }');
  });
});

// ── presence: readable without color ────────────────────────────────
describe('presence is announced, not just colored', () => {
  it('the contact row aria-label names online AND offline (existing keys)', () => {
    expect(html).toContain("isOnline ? ', ' + t('statusOnline') : ', ' + t('statusOffline')");
  });

  it('the dot itself is an img-role span labelled with the state text', () => {
    expect(html).toContain('class="presence-dot ${presenceClass}" role="img" aria-label="${presenceTitle}"');
    expect(html).toContain("presenceTitle = t('statusOffline');");
  });

  it('the offline dot is hollow (shape), not just a dimmer fill', () => {
    const body = ruleBody('.presence-dot.offline');
    expect(body).toContain('background: transparent');
    expect(body).toContain('border:');
  });
});

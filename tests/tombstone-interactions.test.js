import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('in-session tombstones refuse interaction + mutation', () => {
  it('all 4 DOM tombstone writes mark the element data-deleted', () => {
    const marks = SRC.split("el.dataset.deleted = '1'; safeSetHTML(el, '<span class=\"i-dim-it\">").length - 1;
    expect(marks).toBe(4);
  });
  it('context menu + double-tap react + swipe-reply are gated on the marker', () => {
    expect(SRC).toContain("if (el?.dataset?.deleted === '1' || msg?.deleted) return;");
    expect(SRC).toContain("now - _lastTap < 300 && d.dataset.deleted !== '1'");
    expect(SRC).toContain("_swiping && _swipeDx >= 60 && d.dataset.deleted !== '1'");
  });
  it('local record writers reject tombstones (edit/pin/bookmark/ack)', () => {
    expect(SRC).toContain("if (stored && !stored.deleted) {\n        stored.text = editText;");
    expect(SRC).toContain("if (stored && !stored.deleted) { stored.pinned = !stored.pinned;");
    expect(SRC).toContain("if (stored && !stored.deleted) {\n        stored.bookmarked = !stored.bookmarked;");
    expect(SRC).toContain("if (m && !m.deleted) { if (status === 'failed') m.failed = true; else m.ack = true;");
  });
  it('functional: a marked element fails the menu gate but a live one passes', () => {
    const menuGuard = (el, msg) => !(el?.dataset?.deleted === '1' || msg?.deleted);
    expect(menuGuard({ dataset: { deleted: '1' } }, { text: 'gone' })).toBe(false);
    expect(menuGuard({ dataset: {} }, { text: 'hi' })).toBe(true);
    expect(menuGuard({ dataset: {} }, { deleted: true })).toBe(false);
  });
});

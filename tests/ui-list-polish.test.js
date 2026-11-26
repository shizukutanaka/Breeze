import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// UI/UX round 2 (owner request): the contact list reads like LINE —
// calendar-based timestamps instead of "3h"/"2d" compact relative text,
// unread rows are emphasised (not just badged), and a self profile card
// sits at the top of the list so your own name/ID are one tap from the
// profile panel.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Evaluate the real listTime() out of index.html with stubbed t/MS so the
// calendar bucketing is tested as behaviour, not as source text. Dates are
// built with the local-time Date constructor, so the expectations hold in
// any timezone the suite runs in.
function loadListTime() {
  const start = html.indexOf('function listTime(ts, now = Date.now()) {');
  const end = html.indexOf('function getTimeSection(ts) {', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const src = html.slice(start, end);
  const msSrc = html.match(/const MS = Object\.freeze\(\{[^}]*\}\);/)[0];
  const t = (k) => (k === 'timeYesterday' ? 'Yesterday' : k);
  return new Function('t', `${msSrc}\n${src}\nreturn listTime;`)(t);
}
const listTime = loadListTime();
const hhmm = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

describe('listTime — LINE-style calendar buckets', () => {
  it('today shows HH:MM, including a message from 00:00 today', () => {
    const now = new Date(2026, 5, 15, 0, 30).getTime();
    const ts = new Date(2026, 5, 15, 0, 0);
    expect(listTime(ts.getTime(), now)).toBe(hhmm(ts));
    const later = new Date(2026, 5, 15, 23, 59);
    expect(listTime(later.getTime(), new Date(2026, 5, 15, 23, 59).getTime())).toBe(hhmm(later));
  });

  it('yesterday shows "Yesterday" — 23:59 yesterday is NOT today even minutes later', () => {
    const now = new Date(2026, 5, 15, 0, 30).getTime();
    const ts = new Date(2026, 5, 14, 23, 59).getTime();
    expect(listTime(ts, now)).toBe('Yesterday');
    // …and 00:00 yesterday is still "Yesterday" late the next day.
    const start = new Date(2026, 5, 14, 0, 0).getTime();
    expect(listTime(start, new Date(2026, 5, 15, 23, 59).getTime())).toBe('Yesterday');
  });

  it('crossing midnight into a new year: Dec 31 23:59 is "Yesterday" on Jan 1', () => {
    const now = new Date(2026, 0, 1, 0, 30).getTime();
    const ts = new Date(2025, 11, 31, 23, 59).getTime();
    expect(listTime(ts, now)).toBe('Yesterday');
  });

  it('earlier this year shows M/D', () => {
    const now = new Date(2026, 5, 15, 12, 0).getTime();
    expect(listTime(new Date(2026, 5, 13, 9, 0).getTime(), now)).toBe('6/13');
    expect(listTime(new Date(2026, 0, 1, 0, 0).getTime(), now)).toBe('1/1');
  });

  it('last year or older shows YYYY/M/D', () => {
    const now = new Date(2026, 0, 1, 12, 0).getTime();
    expect(listTime(new Date(2025, 11, 30, 23, 59).getTime(), now)).toBe('2025/12/30');
    expect(listTime(new Date(2023, 2, 5, 8, 0).getTime(), now)).toBe('2023/3/5');
  });

  it('empty timestamp renders empty', () => {
    expect(listTime(0)).toBe('');
    expect(listTime(undefined)).toBe('');
  });

  it('renderContacts renders lastTime through listTime', () => {
    expect(html).toContain("const lastTime = c.lastMsgAt ? listTime(c.lastMsgAt) : '';");
  });
});

describe('unread rows are emphasised, not only badged', () => {
  it('the row carries an unread class while unread > 0', () => {
    expect(html).toContain("(c.unread > 0 ? ' unread' : '')");
    expect(html).toContain("${c.unread > 0 ? `<span class=\"bdg bdg-row\">${c.unread}</span>` : ''}");
  });
  it('CSS bolds the name/preview and accents the time for unread rows', () => {
    expect(html).toContain('.contact.unread .info .name { font-weight: 700 }');
    expect(html).toContain('.contact.unread .info .preview { color: var(--t1); font-weight: 600 }');
    expect(html).toContain('.contact.unread .meta .time { color: var(--g); font-weight: 700 }');
  });
});

describe('self profile card at the top of the contact list', () => {
  it('the card element sits at the top of the contact list', () => {
    // Batch-2 fix (g): the card moved INSIDE the scrollable list as its
    // first child (it scrolls away instead of pinning screen height), so
    // "top of the list" now means: after the list opens, before the
    // first skeleton row.
    const card = html.indexOf('id="msg-self-card"');
    const list = html.indexOf('id="msg-contacts"');
    const skeleton = html.indexOf('class="skeleton skeleton-contact"');
    expect(card).toBeGreaterThan(-1);
    expect(card).toBeGreaterThan(list);
    expect(card).toBeLessThan(skeleton);
  });

  it('renderContacts refreshes the card on every render', () => {
    const rc = html.indexOf('async function renderContacts() {');
    expect(html.slice(rc, rc + 200)).toContain('renderSelfCard()');
  });

  it('the card shows the profile name/avatar and the short ID (alias wins, as in the sidebar header)', () => {
    expect(html).toContain('await _profileUI.myProfile()');
    expect(html).toContain("myAlias ? '@' + myAlias : myShortId");
  });

  it('tapping the card opens the existing profile panel', () => {
    expect(html).toContain("_profileUI?.showPanel().catch(e => _dbg(e, 'self-card-panel'))");
  });
});

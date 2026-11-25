import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function tabTitleBlock() {
  const startMarker = 'function updateTabTitle()';
  const endMarker = '_intervals.push(setInterval(updateTabTitle, CONFIG.POLL_UNREAD_MS));';
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw Error('tab title markers moved');
  return html.slice(start, end + endMarker.length);
}

describe('tab title unread counter', () => {
  it('counts the rendered unread badges instead of the impossible descendant selector', () => {
    const block = tabTitleBlock();
    expect(block).toContain("querySelectorAll('.cbadge')");
    expect(block).not.toContain("'.contact .unread'");
  });

  it('keeps updating the title and application badge', () => {
    const block = tabTitleBlock();
    expect(block).toContain('_updateTitle(total)');
    expect(block).toContain('navigator.setAppBadge(total)');
    expect(block).toContain('navigator.clearAppBadge()');
  });

  it('uses the same selector as the other unread-counting sites', () => {
    const block = tabTitleBlock();
    const match = block.match(/querySelectorAll\('([^']+)'\)/);
    expect(match).not.toBeNull();
    expect(match[1]).toBe('.cbadge');

    const outsideBlock = html.replace(block, '');
    const otherOccurrences = outsideBlock.match(/querySelectorAll\('\.cbadge'\)/g) || [];
    expect(otherOccurrences.length).toBeGreaterThanOrEqual(2);
  });
});

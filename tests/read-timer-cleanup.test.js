import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function cleanupBlock() {
  const startMarker = '_messengerCleanup = () => {';
  const endMarker = '_outbox.clear();';
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw Error('cleanup markers moved');
  return html.slice(start, end + endMarker.length);
}

function openConversationBlock() {
  const startMarker = '_readTimer = setTimeout(fire,';
  const start = html.indexOf(startMarker);
  if (start < 0) throw Error('read receipt scheduling moved');
  // Include the surrounding block: look backwards for the pre-clear.
  return html.slice(Math.max(0, start - 2000), start + 500);
}

describe('read receipt timer cleanup on account switch', () => {
  it('clears the pending delayed read receipt timer in _messengerCleanup', () => {
    const block = cleanupBlock();
    expect(block).toContain('clearTimeout(_readTimer)');
    expect(block).toContain('_readTimer = null');
  });

  it('clears ALL six per-account timeout timers', () => {
    const block = cleanupBlock();
    for (const name of ['_presenceTimer', '_pollTimer', '_retryTimer', '_typingTimeout', '_focusTimer', '_readTimer']) {
      expect(block).toContain(`clearTimeout(${name})`);
    }
  });

  it('leaves the openConversation scheduling side untouched', () => {
    const block = openConversationBlock();
    expect(block).toContain('_readTimer = setTimeout(fire,');
    expect(block).toContain('if (_readTimer) { clearTimeout(_readTimer); _readTimer = null; }');
  });
});

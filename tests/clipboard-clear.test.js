// KeePass/Bitwarden-style clipboard hygiene: secret-bearing copies (drop #key URLs,
// revealed drop plaintext, group join tokens) auto-clear after ~30s. Source-level pins
// only — clipboard APIs are not available under jsdom.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('clipboard auto-clear for secret-bearing copies', () => {
  it('defines _copySensitive with a ~30s timed clear', () => {
    expect(html).toMatch(/async function _copySensitive\(text\)/);
    expect(html).toMatch(/_clipGen/); // generation counter: an outdated pending clear is a no-op
    expect(html).toMatch(/MS\.SEC \* 30/); // ~30s (Bitwarden default; KeePass 12-20s)
  });

  it('read-back guard: only clears if the clipboard still holds our text', () => {
    const body = html.match(/async function _copySensitive\(text\) \{([^}]+)\}/)?.[1];
    expect(body).toMatch(/readText\(\) === text/); // never erase a foreign copy
    expect(body).toMatch(/writeText\(''\)/); // clears by overwriting with empty string
  });

  it.each([
    ['drop revealed plaintext', /_copySensitive\(plaintext\)/],
    ['drop URL initial copy', /await _copySensitive\(dropUrl\)/],
    ['drop URL click-to-copy', /_copySensitive\(_copyUrl\)/],
    ['group join token link', /_copySensitive\(joinUrl\)/],
  ])('%s uses _copySensitive', (name, re) => {
    expect(html, `${name} must route through _copySensitive`).toMatch(re);
  });

  it('identity-only copies are NOT auto-cleared (pubkey, ?add=/alias links, message text)', () => {
    for (const arg of ['myPubB64', 'addUrl', 'link', 'msg.text']) {
      expect(html, `_copySensitive(${arg}) would wrongly expire identity text`).not.toMatch(
        new RegExp(`_copySensitive\\(${arg.replace('.', '\\.')}\\)`));
    }
  });
});

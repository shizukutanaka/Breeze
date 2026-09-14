// Electron's desktop/main.js does `require('electron')` as its very first line, which
// throws outside a real Electron process — so its navigation-origin check is extracted
// into desktop/nav-guard.js (path + URL only, both Node builtins) purely so it can be
// unit-tested directly. See that file's header for the two-layer string-prefix bug this
// guards: the original `url.startsWith(appOrigin)` treated any hostname that merely had
// the real origin as a text prefix as same-origin, and the first attempt at a fix for
// file:// URLs (comparing pathnames with the same startsWith approach one directory
// level down) had the identical flaw.
import { describe, it, expect } from 'vitest';
import { isAllowedNavigation } from '../desktop/nav-guard.js';

describe('isAllowedNavigation — remote (https) mode', () => {
  const current = 'https://breeze.pages.dev/index.html';

  it('allows navigation within the same origin', () => {
    expect(isAllowedNavigation(current, 'https://breeze.pages.dev/other?x=1')).toBe(true);
  });

  it('rejects a hostname that merely has the real origin as a text prefix', () => {
    // The exact bypass a startsWith(appOrigin) check falls for.
    expect(isAllowedNavigation(current, 'https://breeze.pages.dev.attacker.example/phish')).toBe(false);
  });

  it('rejects an unrelated origin', () => {
    expect(isAllowedNavigation(current, 'https://evil.com/')).toBe(false);
  });

  it('rejects a scheme downgrade to http on the same host', () => {
    expect(isAllowedNavigation(current, 'http://breeze.pages.dev/')).toBe(false);
  });

  it('rejects a different port on the same host', () => {
    expect(isAllowedNavigation(current, 'https://breeze.pages.dev:8443/')).toBe(false);
  });
});

describe('isAllowedNavigation — local (file://) mode', () => {
  const current = 'file:///home/user/Breeze/index.html';

  it('allows another file in the same directory', () => {
    expect(isAllowedNavigation(current, 'file:///home/user/Breeze/manifest.json')).toBe(true);
  });

  it('allows a file in a subdirectory', () => {
    expect(isAllowedNavigation(current, 'file:///home/user/Breeze/assets/x.png')).toBe(true);
  });

  it('allows navigating to itself', () => {
    expect(isAllowedNavigation(current, current)).toBe(true);
  });

  it('rejects a file outside the app directory entirely', () => {
    expect(isAllowedNavigation(current, 'file:///etc/passwd')).toBe(false);
  });

  it('rejects a sibling directory whose name has the app directory as a text prefix', () => {
    // The exact bypass the first (unshipped) fix attempt fell for one level down:
    // "/home/user/Breeze-evil" textually starts with "/home/user/Breeze".
    expect(isAllowedNavigation(current, 'file:///home/user/Breeze-evil/x.html')).toBe(false);
  });

  it('rejects a path-traversal attempt back out of the directory', () => {
    expect(isAllowedNavigation(current, 'file:///home/user/Breeze/../../etc/passwd')).toBe(false);
  });
});

describe('isAllowedNavigation — mixed protocols and malformed input', () => {
  it('rejects file:// navigating to https://', () => {
    expect(isAllowedNavigation('file:///home/user/Breeze/index.html', 'https://evil.com/')).toBe(false);
  });

  it('rejects https:// navigating to file://', () => {
    expect(isAllowedNavigation('https://breeze.pages.dev/', 'file:///etc/passwd')).toBe(false);
  });

  it('returns false rather than throwing on an unparseable URL', () => {
    expect(isAllowedNavigation('https://breeze.pages.dev/', 'not a url at all')).toBe(false);
    expect(isAllowedNavigation('not a url at all', 'https://breeze.pages.dev/')).toBe(false);
  });
});

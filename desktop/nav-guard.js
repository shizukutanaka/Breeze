'use strict';
/**
 * Pure navigation-origin check for the Electron main process's `will-navigate` handler.
 * Extracted from main.js into its own dependency-free module (path + URL only, both
 * Node builtins) so it can be unit-tested directly — main.js itself `require`s
 * 'electron' at load time, which throws outside a real Electron process and makes the
 * file as a whole impossible to import from a plain Node/vitest test.
 *
 * This exists because the same bug class — a string-prefix check standing in for a
 * real boundary comparison — was found, and then nearly reintroduced one level deeper
 * while fixing it, in the same sitting:
 *   1. `url.startsWith(appOrigin)` treats "https://real.example.com.attacker.tld" as
 *      same-origin, because it textually starts with "https://real.example.com".
 *   2. The first fix, `target.pathname.startsWith(path.dirname(current.pathname))`,
 *      has the identical flaw one directory level down: "/home/user/Breeze-evil"
 *      textually starts with "/home/user/Breeze".
 * path.relative() is what actually answers "is target inside this directory" — a path
 * outside it comes back starting with '..' or as a second absolute path.
 */
const path = require('path');

function isAllowedNavigation(currentUrlString, targetUrlString) {
  try {
    const current = new URL(currentUrlString);
    const target = new URL(targetUrlString);
    if (current.protocol === 'file:' && target.protocol === 'file:') {
      // Node's URL.origin serializes EVERY file:// URL to the literal string "null",
      // so an origin comparison is meaningless here — compare the real filesystem path.
      const rel = path.relative(path.dirname(current.pathname), target.pathname);
      return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
    }
    return target.origin === current.origin;
  } catch {
    return false;
  }
}

// Gate for shell.openExternal() — the only URLs the renderer may hand to the OS are
// web links and our own deep-link scheme. Everything else is refused: an unvalidated
// openExternal is a renderer→OS launch primitive (file:/// launches Finder/Explorer at
// a path, custom scheme handlers run third-party apps, e.g. a crafted `zoommtg://` or
// `ms-appx:` link fires a real executable with no further confirmation).
//   - http:/https: — chat links, the intended UX.
//   - mailto: — renderMarkdown turns email addresses into mailto: anchors; the OS
//     handler is the user's own mail client (compose window), same class as the
//     browser handoff. Refusing it silently dead-ends an existing feature.
//   - breeze: — our protocol handler resolves back into this app (join/add deep links
//     pasted in chat legitimately round-trip through the OS).
// String-prefix checks are NOT a substitute ("httpx://evil" passes startsWith('http')).
// Protocol-relative "//host" and bare hostnames parse as path-less → treated as denied:
// openExternal can't resolve those meaningfully anyway.
const EXTERNAL_ALLOWED_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'breeze:']);

function isAllowedExternalUrl(urlString) {
  try {
    return EXTERNAL_ALLOWED_SCHEMES.has(new URL(urlString).protocol);
  } catch {
    return false;
  }
}

module.exports = { isAllowedNavigation, isAllowedExternalUrl };

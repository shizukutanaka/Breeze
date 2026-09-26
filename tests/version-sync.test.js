// One logical version, seven hand-maintained copies: index.html's CONFIG, sw.js's
// cache-busting VERSION, manifest.json, package.json, build.sh's artifact label,
// the Worker's health advertisement, and desktop/package.json's Electron build
// version (feeds artifact names + auto-update labels). They MUST move together — index.html
// compares health.version to CONFIG.VERSION and toasts "update available" to
// every connected user on any mismatch, so drift is a user-visible false alarm
// (or a missed real one), not a nit.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const at = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

const versions = {
  'index.html CONFIG.VERSION':      at('index.html').match(/\bVERSION:\s*'([^']+)'/)?.[1],
  'sw.js VERSION':                  at('sw.js').match(/const VERSION = '([^']+)'/)?.[1],
  'manifest.json version':          JSON.parse(at('manifest.json')).version,
  'package.json version':           JSON.parse(at('package.json')).version,
  'build.sh VERSION':               at('build.sh').match(/^VERSION="([^"]+)"/m)?.[1],
  '_worker.js health version':      at('_worker.js').match(/version:\s*'([^']+)'/)?.[1],
  'desktop/package.json version':   JSON.parse(at('desktop/package.json')).version,
};

describe('version strings stay in sync across all copies', () => {
  for (const [where, v] of Object.entries(versions)) {
    it(`${where} parses`, () => expect(v, `could not extract version from ${where}`).toMatch(/^\d+\.\d+\.\d+$/));
  }
  it('all seven agree', () => {
    const distinct = [...new Set(Object.values(versions))];
    expect(distinct, JSON.stringify(versions, null, 2)).toHaveLength(1);
  });
});

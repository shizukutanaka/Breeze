// One logical version, six hand-maintained copies: index.html's CONFIG, sw.js's
// cache-busting VERSION, manifest.json, package.json, build.sh's artifact label,
// and the Worker's health advertisement. They MUST move together — index.html
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
};

describe('version strings stay in sync across all copies', () => {
  for (const [where, v] of Object.entries(versions)) {
    it(`${where} parses`, () => expect(v, `could not extract version from ${where}`).toMatch(/^\d+\.\d+\.\d+$/));
  }
  it('all six agree', () => {
    const distinct = [...new Set(Object.values(versions))];
    expect(distinct, JSON.stringify(versions, null, 2)).toHaveLength(1);
  });
});

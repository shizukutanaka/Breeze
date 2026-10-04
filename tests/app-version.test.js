// Pin: the app version is written into _worker.js (health response +
// X-Breeze-Version header) and both build scripts — each is a hand-maintained
// copy that drifts on release (the dist/ manifests already shipped a release
// behind once). Everything must equal index.html's CONFIG.VERSION.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(join(root, f), 'utf8');
const appVersion = read('index.html').match(/VERSION:\s*'([^']+)'/)[1];

describe('every version literal equals CONFIG.VERSION', () => {
  it('_worker.js /api/health `version` field', () => {
    expect(read('_worker.js').match(/version:\s*'([^']+)'/)[1]).toBe(appVersion);
  });

  it('_worker.js X-Breeze-Version response header', () => {
    expect(read('_worker.js').match(/'X-Breeze-Version':\s*'([^']+)'/)[1]).toBe(appVersion);
  });

  it.each(['build.sh', 'build-all.sh'])('%s VERSION variable', f => {
    expect(read(f).match(/^VERSION="([^"]+)"/m)[1]).toBe(appVersion);
  });
});

// SHARE_PLAN stage 6 step 4 — one-command version bumps.
// The version used to live in a dozen places edited by hand (and
// drifted: the dist manifests sat a full release behind). Now
// tools/bump-version.mjs rewrites every site from one argument,
// --check reports any disagreement, and the Release workflow
// refuses a tag that disagrees with the tree. These pins cover
// the sites the older parity tests did not reach and the tool's
// own site list.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const appVersion = read('index.html').match(/VERSION: '([^']+)'/)[1];
const tool = read('tools/bump-version.mjs');
const releaseYml = read('.github/workflows/release.yml');

describe('every version site agrees (the full dozen)', () => {
  it('build-all.sh and the worker health literal carry the app version', () => {
    expect(read('build-all.sh')).toContain(`VERSION="${appVersion}"`);
    expect(read('_worker.js')).toContain(`version: '${appVersion}',`);
    expect(read('deploy.sh')).toContain(`"v${appVersion}"`);
  });

  it('the page footer carries the app version and is a bump site (R06)', () => {
    expect(read('index.html')).toContain(`Breeze v${appVersion} — P2P encrypted messenger`);
    expect(tool).toContain('Breeze v(\\d+\\.\\d+\\.\\d+)');
  });

  it('the bump tool knows every site', () => {
    for (const f of ['index.html', 'sw.js', 'manifest.json', 'package.json', 'desktop/package.json', 'mobile/package.json', 'tauri/package.json', 'tauri/src-tauri/tauri.conf.json', 'tauri/src-tauri/Cargo.toml', 'build-all.sh', 'build.sh', '_worker.js', 'deploy.sh']) {
      expect(tool).toContain(`file: '${f}'`);
    }
    expect(tool).toContain("arg === '--check'");
  });

  it('the Release workflow refuses a mismatched label', () => {
    expect(releaseYml).toContain('node tools/bump-version.mjs --check');
    expect(releaseYml).toContain('Release label');
    expect(releaseYml).toContain('!= "$APP"');
  });
});

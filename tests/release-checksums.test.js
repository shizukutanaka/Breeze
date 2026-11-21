// Release checksum generator (tools/release-checksums.sh): SHA256SUMS.txt
// must cover EVERY release asset. Regression pin for the measured v3.7.1
// defect — the shipped SHA256SUMS.txt was 84 bytes (one line, the self-host
// ZIP) while the Release carried 11 downloads, because the packager wrote
// it before the desktop job attached its installers and nothing ever
// regenerated it.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'tools', 'release-checksums.sh');

function fixtureDir() {
  const dir = mkdtempSync(join(tmpdir(), 'breeze-sums-'));
  writeFileSync(join(dir, 'breeze-v9.9.9.zip'), 'zip-bytes');
  writeFileSync(join(dir, 'Breeze-9.9.9-win.exe'), 'exe-bytes');
  writeFileSync(join(dir, 'Breeze-9.9.9-mac.dmg'), 'dmg-bytes');
  return dir;
}

describe('tools/release-checksums.sh', () => {
  it('covers every asset except SHA256SUMS.txt itself, and sha256sum -c passes', () => {
    const dir = fixtureDir();
    execFileSync('bash', [SCRIPT, dir], { encoding: 'utf8' });
    const sums = readFileSync(join(dir, 'SHA256SUMS.txt'), 'utf8').trim().split('\n');
    expect(sums).toHaveLength(3);
    const names = sums.map(l => l.replace(/^[0-9a-f]{64}  /, '')).sort();
    expect(names).toEqual(['Breeze-9.9.9-mac.dmg', 'Breeze-9.9.9-win.exe', 'breeze-v9.9.9.zip']);
    // The verification command the release notes publish must pass.
    execFileSync('sha256sum', ['-c', 'SHA256SUMS.txt'], { cwd: dir, encoding: 'utf8' });
  });

  it('regeneration replaces a stale sums file and picks up assets attached later', () => {
    const dir = fixtureDir();
    execFileSync('bash', [SCRIPT, dir], { encoding: 'utf8' });
    // Simulate the desktop job attaching another installer afterwards.
    writeFileSync(join(dir, 'Breeze-9.9.9-linux-x86_64.AppImage'), 'appimage-bytes');
    execFileSync('bash', [SCRIPT, dir], { encoding: 'utf8' });
    const sums = readFileSync(join(dir, 'SHA256SUMS.txt'), 'utf8').trim().split('\n');
    expect(sums).toHaveLength(4);
    expect(sums.join('\n')).toContain('Breeze-9.9.9-linux-x86_64.AppImage');
    execFileSync('sha256sum', ['-c', 'SHA256SUMS.txt'], { cwd: dir, encoding: 'utf8' });
  });

  it('the release workflow regenerates the sums over the full asset set', () => {
    const yml = readFileSync(join(ROOT, '.github', 'workflows', 'release.yml'), 'utf8');
    expect(yml).toContain('needs: desktop');
    expect(yml).toContain('tools/release-checksums.sh release-assets');
    expect(yml).toContain('release-assets/SHA256SUMS.txt');
  });
});

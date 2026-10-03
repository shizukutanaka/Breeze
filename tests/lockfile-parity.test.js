// Every directory that declares a package.json must ship its package-lock.json:
// build.sh (`cd desktop && npm ci`), mobile/scripts/build-mobile.sh (`npm ci`)
// and dist/snap/snapcraft.yaml (`npm ci`) all use `npm ci`, which hard-fails
// with EUSAGE when no lockfile exists. desktop/ and mobile/ shipped none —
// every clean-clone desktop/mobile/snap build died at the dependency step.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function packageJsonDirs() {
  return execSync(
    "find . -name package.json -not -path './node_modules/*' -not -path '*/node_modules/*' -not -path './.git/*'",
    { encoding: 'utf8' }
  ).trim().split('\n').map(p => path.dirname(p).replace(/^\.\//, '') || '.');
}

describe('npm ci contract: lockfile next to every package.json', () => {
  for (const dir of packageJsonDirs()) {
    it(`${dir} has package-lock.json`, () => {
      expect(fs.existsSync(path.join(dir, 'package-lock.json'))).toBe(true);
    });
  }

  it('no package.json is nested under node_modules scan noise', () => {
    const dirs = packageJsonDirs();
    expect(dirs).toContain('.');
    expect(dirs).toContain('desktop');
    expect(dirs).toContain('mobile');
  });
});

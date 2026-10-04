// npm metadata contract: every package.json must declare the MIT license
// (the repo's LICENSE file — absent metadata makes npm report UNLICENSED),
// the repository URL (provenance), and desktop/ the author (electron-builder
// uses `author` for the Windows installer's Publisher field — blank meant a
// blank publisher in the NSIS installer).
import { describe, it, expect } from 'vitest';
import fs from 'fs';

const pkgs = Object.fromEntries(
  ['.', 'desktop', 'mobile', 'tauri'].map(d => [
    d,
    JSON.parse(fs.readFileSync(d === '.' ? 'package.json' : `${d}/package.json`, 'utf8')),
  ])
);

describe('package.json metadata parity', () => {
  for (const [dir, p] of Object.entries(pkgs)) {
    it(`${dir}: license is MIT`, () => expect(p.license).toBe('MIT'));
    it(`${dir}: repository points at the GitHub repo`, () => {
      expect(p.repository?.type).toBe('git');
      expect(p.repository?.url).toBe('https://github.com/shizukutanaka/Breeze.git');
    });
    it(`${dir}: homepage + bugs declared`, () => {
      expect(p.homepage).toBeTruthy();
      expect(p.bugs).toContain('github.com');
    });
  }

  it('desktop author is non-empty (NSIS Publisher field)', () => {
    expect(pkgs.desktop.author).toBeTruthy();
  });

  it('MIT matches the LICENSE file', () => {
    expect(fs.readFileSync('LICENSE', 'utf8')).toContain('MIT License');
  });
});

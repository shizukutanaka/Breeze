// Packaged Linux builds must be able to place voice/video calls and ship
// the same web assets as the other channels. Two observed defect classes:
// 1. Missing camera/mic grants — macOS entitlements (#373) had the same class;
//    snap strict confinement needs camera+audio-record plugs and flatpak needs
//    the pipewire socket for the camera portal. Without them calls are dead.
// 2. Partial asset copies — every packaging path that hand-picks files must
//    carry index.html + sw.js + manifest.json + _headers + icons + locales/
//    (locales omission = English-only; _headers omission = CSP-guard falls back
//    to an unsafe-inline policy).
import { describe, it, expect } from 'vitest';
import fs from 'fs';

const snap = fs.readFileSync('dist/snap/snapcraft.yaml', 'utf8');
const flatpak = fs.readFileSync('dist/flatpak/com.breeze.Messenger.yml', 'utf8');
const winget = fs.readFileSync('dist/winget/Breeze.Messenger.yaml', 'utf8');

describe('snap camera/mic plugs (calls dead without them)', () => {
  it('declares camera + audio-record plugs', () => {
    expect(snap).toMatch(/^ +- camera$/m);
    expect(snap).toMatch(/^ +- audio-record$/m);
    expect(snap).toMatch(/^ +- audio-playback$/m);
  });
});

describe('flatpak camera/mic (portal needs pipewire)', () => {
  it('finish-args grant pipewire + pulseaudio', () => {
    expect(flatpak).toContain('--socket=pipewire');
    expect(flatpak).toContain('--socket=pulseaudio');
  });
});

describe('hand-picked asset copies are complete (locales, headers, icons)', () => {
  it('flatpak build-commands copy every required root asset', () => {
    for (const f of ['index.html', 'sw.js', 'manifest.json', '_headers', 'icon-192.png', 'icon-512.png']) {
      expect(flatpak, f).toContain(` ${f} `);
    }
    expect(flatpak).toMatch(/cp -r locales/);
  });

  it('snap override-build stages every required root asset', () => {
    for (const f of ['index.html', 'sw.js', 'manifest.json', '_headers', 'icon-192.png', 'icon-512.png']) {
      expect(snap, f).toContain(`../${f}`);
    }
    expect(snap).toMatch(/cp -r \.\.\/locales/);
  });
});

describe('winget installer URL is version-scoped', () => {
  it('pins a tagged release (latest/download can never match a frozen sha256)', () => {
    const url = winget.match(/InstallerUrl: (\S+)/)[1];
    expect(url).not.toContain('latest/download');
    expect(url).toMatch(/releases\/download\/v\d+\.\d+\.\d+\/Breeze-\d+\.\d+\.\d+-win-x64\.exe$/);
  });
});

// Pin: every packaging manifest carries the SAME version + app id as the app
// itself. The dist/ release manifests drifted a full release behind (3.5.0
// while the app shipped 3.6.1, including a dead v3.5.0 git tag ref) — a stale
// wrapper version stamps the wrong version onto store artifacts and updaters.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const json = p => JSON.parse(readFileSync(join(root, p), 'utf8'));

const appVersion = readFileSync(join(root, 'index.html'), 'utf8')
  .match(/VERSION:\s*'([^']+)'/)[1];

describe('wrapper manifests carry the app version', () => {
  const VERSIONED = [
    ['package.json', d => d.version],
    ['desktop/package.json', d => d.version],
    ['mobile/package.json', d => d.version],
    ['tauri/package.json', d => d.version],
    ['tauri/src-tauri/tauri.conf.json', d => d.version],
  ];
  for (const [file, get] of VERSIONED) {
    it(`${file} == ${appVersion}`, () => {
      expect(get(json(file))).toBe(appVersion);
    });
  }

  it('tauri/src-tauri/Cargo.toml package version matches', () => {
    const cargo = readFileSync(join(root, 'tauri/src-tauri/Cargo.toml'), 'utf8');
    expect(cargo.match(/\[package\][\s\S]*?version\s*=\s*"([^"]+)"/)[1]).toBe(appVersion);
  });
});

describe('wrapper manifests share one application id', () => {
  it('electron appId == tauri identifier == capacitor appId', () => {
    const electron = json('desktop/package.json').build.appId;
    const tauri = json('tauri/src-tauri/tauri.conf.json').identifier;
    const capacitor = json('mobile/capacitor.config.json').appId;
    expect(electron).toBe('com.breeze.messenger');
    expect(tauri).toBe(electron);
    expect(capacitor).toBe(electron);
  });
});

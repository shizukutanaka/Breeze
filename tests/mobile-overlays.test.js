// The res/ overlay pipeline documented in mobile/README.md was dead code:
// res/ did not exist, so the overlay loop in build-mobile.sh was a no-op and
// the iOS path had no apply step at all. Pin the overlay files and the wiring
// that activates them.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const NSC = 'mobile/res/android/xml/network_security_config.xml';
const STRINGS = 'mobile/res/android/values/strings.xml';
const ADDITIONS = 'mobile/res/ios/Info.plist.additions';
const build = fs.readFileSync('mobile/scripts/build-mobile.sh', 'utf8');
const capacitor = JSON.parse(fs.readFileSync('mobile/capacitor.config.json', 'utf8'));

describe('android overlay files exist and are hardened', () => {
  it('network_security_config denies cleartext globally', () => {
    expect(fs.existsSync(NSC)).toBe(true);
    const nsc = fs.readFileSync(NSC, 'utf8');
    expect(nsc).toContain('cleartextTrafficPermitted="false"');
  });

  it('strings.xml app_name matches capacitor appName', () => {
    const s = fs.readFileSync(STRINGS, 'utf8');
    const name = s.match(/name="app_name">([^<]+)</)[1];
    expect(name).toBe(capacitor.appName);
  });
});

describe('ios overlay file exists', () => {
  it('declares ITSAppUsesNonExemptEncryption (export-compliance)', () => {
    const a = fs.readFileSync(ADDITIONS, 'utf8');
    expect(a).toMatch(/^ITSAppUsesNonExemptEncryption bool false$/m);
  });
});

describe('build-mobile.sh actually applies the overlays', () => {
  it('applies resource directories and a multiline manifest idempotently', () => {
    const dir = fs.mkdtempSync(join(tmpdir(), 'breeze-overlays-'));
    try {
      for (const rel of ['scripts', 'res', 'node_modules', 'bin', 'android/app/src/main/res', 'android/app/build/outputs/apk']) {
        fs.mkdirSync(join(dir, rel), { recursive: true });
      }
      fs.copyFileSync(resolve('mobile/scripts/build-mobile.sh'), join(dir, 'scripts/build-mobile.sh'));
      fs.cpSync(resolve('mobile/res/android'), join(dir, 'res/android'), { recursive: true });
      const manifest = join(dir, 'android/app/src/main/AndroidManifest.xml');
      fs.writeFileSync(manifest, '<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n    <application\n        android:allowBackup="true">\n    </application>\n</manifest>\n');
      for (const name of ['node', 'npx', 'java']) {
        fs.writeFileSync(join(dir, 'bin', name), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
      }
      fs.writeFileSync(join(dir, 'android/gradlew'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
      fs.writeFileSync(join(dir, 'android/app/build/outputs/apk/test.apk'), 'fixture');
      const run = () => execFileSync('bash', [join(dir, 'scripts/build-mobile.sh'), 'android', 'debug'], {
        env: { ...process.env, PATH: join(dir, 'bin') + ':' + process.env.PATH }, encoding: 'utf8',
      });
      run();
      run();
      expect(fs.readFileSync(manifest, 'utf8').match(/android:networkSecurityConfig=/g)).toHaveLength(1);
      expect(fs.existsSync(join(dir, 'android/app/src/main/res/xml/network_security_config.xml'))).toBe(true);
      expect(fs.existsSync(join(dir, 'android/app/src/main/res/values/strings.xml'))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('wires networkSecurityConfig into AndroidManifest (idempotent)', () => {
    expect(build).toContain('grep -q networkSecurityConfig');
    expect(build).toContain('android:networkSecurityConfig="@xml/network_security_config"');
  });

  it('applies Info.plist.additions on the iOS path', () => {
    expect(build).toContain('Info.plist.additions');
    expect(build).toContain('PlistBuddy');
  });
});

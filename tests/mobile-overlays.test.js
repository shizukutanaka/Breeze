// The res/ overlay pipeline documented in mobile/README.md was dead code:
// res/ did not exist, so the overlay loop in build-mobile.sh was a no-op and
// the iOS path had no apply step at all. Pin the overlay files and the wiring
// that activates them.
import { describe, it, expect } from 'vitest';
import fs from 'fs';

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
  it('wires networkSecurityConfig into AndroidManifest (idempotent)', () => {
    expect(build).toContain('grep -q networkSecurityConfig');
    expect(build).toContain('android:networkSecurityConfig="@xml/network_security_config"');
  });

  it('applies Info.plist.additions on the iOS path', () => {
    expect(build).toContain('Info.plist.additions');
    expect(build).toContain('PlistBuddy');
  });
});

// Pin: the Electron macOS build signs with Hardened Runtime — under it, camera
// access requires the entitlement AND TCC requires the Info.plist usage string
// to even prompt. The plist once had camera=false (video calls dead on signed
// builds) and extendInfo carried no usage descriptions (TCC can't prompt —
// hardened runtime kills the access). Keep entitlement, usage string, and the
// app's call features in agreement.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const plist = readFileSync(join(root, 'desktop/entitlements.mac.plist'), 'utf8');
const pkg = JSON.parse(readFileSync(join(root, 'desktop/package.json'), 'utf8'));

const granted = key =>
  new RegExp(`<key>com\\.apple\\.security\\.device\\.${key}</key>\\s*<true/>`).test(plist);
const denied = key =>
  new RegExp(`<key>com\\.apple\\.security\\.device\\.${key}</key>\\s*<false/>`).test(plist);

const ei = pkg.build.mac.extendInfo;

describe('macOS call permissions (hardened runtime + TCC)', () => {
  it('camera + audio-input entitlements granted — calls need both', () => {
    expect(granted('camera')).toBe(true);
    expect(granted('audio-input')).toBe(true);
    expect(denied('camera')).toBe(false);
    expect(denied('audio-input')).toBe(false);
  });

  it('Info.plist carries the usage descriptions TCC prompts with', () => {
    expect(ei.NSCameraUsageDescription?.length).toBeGreaterThan(0);
    expect(ei.NSMicrophoneUsageDescription?.length).toBeGreaterThan(0);
  });

  it('entitlement and usage string stay in agreement', () => {
    // An entitlement without a usage string can't prompt; a usage string
    // without the entitlement is denied by the hardened runtime.
    expect(granted('camera')).toBe(!!ei.NSCameraUsageDescription);
    expect(granted('audio-input')).toBe(!!ei.NSMicrophoneUsageDescription);
  });
});

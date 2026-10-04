// tauri.conf.json references icons/32x32.png, 128x128.png, 128x128@2x.png,
// icon.icns, icon.ico (bundle.icon) and icons/icon.png (trayIcon.iconPath),
// but the icons/ directory shipped empty — `cargo tauri build` fails at
// bundling with "icon file not found". Pin every referenced icon to exist
// with a valid format and matching dimensions.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const CONF = JSON.parse(fs.readFileSync('tauri/src-tauri/tauri.conf.json', 'utf8'));
const DIR = 'tauri/src-tauri';

const pngSize = p => {
  const b = fs.readFileSync(p);
  expect(b.slice(1, 4).toString('latin1'), p).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

describe('every icon path in tauri.conf.json exists', () => {
  const paths = [...CONF.bundle.icon, CONF.app.trayIcon.iconPath];
  for (const rel of paths) {
    it(rel, () => {
      const p = path.join(DIR, rel);
      expect(fs.existsSync(p), p).toBe(true);
      expect(fs.statSync(p).size, p).toBeGreaterThan(0);
    });
  }

  it('PNG icons match their declared dimensions', () => {
    for (const [rel, dim] of [['icons/32x32.png', 32], ['icons/128x128.png', 128], ['icons/128x128@2x.png', 256]]) {
      const [w, h] = pngSize(path.join(DIR, rel));
      expect(w, rel).toBe(dim);
      expect(h, rel).toBe(dim);
    }
  });

  it('binary formats carry valid magic', () => {
    const ico = fs.readFileSync(path.join(DIR, 'icons/icon.ico'));
    expect(ico.readUInt32LE(0)).toBe(0x00010000); // reserved=0, type=icon
    const icns = fs.readFileSync(path.join(DIR, 'icons/icon.icns'));
    expect(icns.slice(0, 4).toString('latin1')).toBe('icns');
  });
});

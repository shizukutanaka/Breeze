// Electron's desktop/main.js does `require('electron')` as its first line, which throws
// outside a real Electron process — so the persisted-bounds visibility check lives in
// desktop/bounds-guard.js (pure math, no imports). A saved x/y that points where a
// monitor no longer exists (undocked laptop, rearranged displays) makes the window
// open fully invisible — the app looks dead (tray icon only) until bounds.json is
// deleted by hand. These pin the overlap rule the restore relies on.
import { describe, it, expect } from 'vitest';
import { isVisibleBounds } from '../desktop/bounds-guard.js';
import { readFileSync } from 'node:fs';

const PRIMARY = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };
const LEFT = { workArea: { x: -1920, y: 0, width: 1920, height: 1080 } };

describe('isVisibleBounds', () => {
  it('ships the new boot dependency in packaged desktop builds', () => {
    const pkg = JSON.parse(readFileSync('desktop/package.json', 'utf8'));
    expect(pkg.build.files).toContain('bounds-guard.js');
  });
  it('accepts a rectangle fully inside the primary display', () => {
    expect(isVisibleBounds({ x: 100, y: 100, width: 960, height: 720 }, [PRIMARY])).toBe(true);
  });

  it('accepts a rectangle that only partially overlaps a display', () => {
    // Most of the window off the right edge is still reachable — keep the saved spot.
    expect(isVisibleBounds({ x: 1900, y: 100, width: 960, height: 720 }, [PRIMARY])).toBe(true);
  });

  it('rejects a rectangle entirely on a disconnected display', () => {
    // Saved while a left monitor existed; only the primary remains → off-screen.
    expect(isVisibleBounds({ x: -1500, y: 100, width: 960, height: 720 }, [PRIMARY])).toBe(false);
  });

  it('accepts the same rectangle when the left display is connected again', () => {
    expect(isVisibleBounds({ x: -1500, y: 100, width: 960, height: 720 }, [PRIMARY, LEFT])).toBe(true);
  });

  it('rejects a rectangle below every display', () => {
    expect(isVisibleBounds({ x: 100, y: 2000, width: 960, height: 720 }, [PRIMARY])).toBe(false);
  });

  it('rejects missing coordinates so the caller uses default placement', () => {
    expect(isVisibleBounds({ x: undefined, y: undefined, width: 960, height: 720 }, [PRIMARY])).toBe(false);
  });

  it('rejects corrupt non-number dimensions instead of restoring garbage', () => {
    expect(isVisibleBounds({ x: 0, y: 0, width: 'wide', height: 720 }, [PRIMARY])).toBe(false);
  });
});

'use strict';
/**
 * Off-screen restore guard for persisted window bounds.
 *
 * bounds.json remembers the last window position; a saved x/y that points where a
 * monitor no longer exists (laptop undocked, display rearranged, resolution change)
 * makes the window open fully invisible — the app looks dead (tray icon only) until
 * bounds.json is deleted by hand. Keep the saved position only when the rectangle
 * still overlaps a connected display's work area; otherwise fall back to the OS's
 * default placement.
 *
 * Its own dependency-free module for the same reason as nav-guard.js / csp-guard.js:
 * main.js requires('electron') as its first line, which throws outside a real
 * Electron process, so logic that needs unit tests must live somewhere importable.
 */

/**
 * @param {{x?: number, y?: number, width: number, height: number}} bounds
 * @param {{workArea: {x: number, y: number, width: number, height: number}}[]} displays
 * @returns {boolean} true when the bounds rectangle overlaps at least one display's
 *   work area (i.e. restoring it leaves the window at least partially visible).
 */
function isVisibleBounds(bounds, displays) {
  if (bounds.x === undefined || bounds.y === undefined) return false;
  if (typeof bounds.width !== 'number' || typeof bounds.height !== 'number') return false;
  return displays.some(d => {
    const a = d.workArea;
    return bounds.x < a.x + a.width && bounds.x + bounds.width > a.x &&
           bounds.y < a.y + a.height && bounds.y + bounds.height > a.y;
  });
}

module.exports = { isVisibleBounds };

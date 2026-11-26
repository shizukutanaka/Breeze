import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = readFileSync(resolve(ROOT, 'index.html'), 'utf8');

function extractUpdateFaviconBadge() {
  const start = HTML.indexOf('function updateFaviconBadge(count)');
  expect(start).toBeGreaterThan(-1);
  const end = HTML.indexOf('\n  let _notifRequested', start);
  expect(end).toBeGreaterThan(start);
  return HTML.slice(start, end);
}

describe('browser tab favicon', () => {
  it('ships root favicon.ico matching desktop/icon.ico', () => {
    const rootIco = resolve(ROOT, 'favicon.ico');
    const desktopIco = resolve(ROOT, 'desktop/icon.ico');
    expect(existsSync(rootIco)).toBe(true);
    expect(readFileSync(rootIco).equals(readFileSync(desktopIco))).toBe(true);
  });

  it('updateFaviconBadge uses icon-192.png instead of wave emoji SVG', () => {
    const src = extractUpdateFaviconBadge();
    expect(src).not.toContain('🌊');
    expect(src).not.toContain('data:image/svg+xml');

    const link = { rel: 'icon', type: '', href: '' };
    const createdImages = [];
    const drawCalls = [];
    const fillTextCalls = [];
    const fakeDoc = {
      querySelector: (sel) => (sel === 'link[rel="icon"]' ? link : null),
      createElement: (tag) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: () => ({
              imageSmoothingEnabled: true,
              drawImage: (...args) => drawCalls.push(args),
              beginPath: () => {},
              arc: () => {},
              fill: () => {},
              fillText: (...args) => fillTextCalls.push(args),
            }),
            toDataURL: () => 'data:image/png;base64,BADGED',
          };
        }
        return { rel: '', type: '', href: '' };
      },
      head: { appendChild: () => {} },
    };
    class FakeImage {
      constructor() {
        this.complete = false;
        this.naturalWidth = 0;
        this.onload = null;
        this._src = '';
        createdImages.push(this);
      }
      set src(v) { this._src = v; }
      get src() { return this._src; }
    }

    const fn = new Function('document', 'Image', `${src}; return updateFaviconBadge;`)(fakeDoc, FakeImage);

    // count === 0 restores icon-192.png directly
    fn(0);
    expect(link.href).toBe('icon-192.png');
    expect(link.type).toBe('image/png');

    // count > 0 before image finishes loading keeps icon-192.png and starts loading it
    fn(3);
    expect(link.href).toBe('icon-192.png');
    expect(createdImages.length).toBe(1);
    expect(createdImages[0].src).toBe('icon-192.png');

    // Once image loads, redraws badge over icon-192.png
    createdImages[0].complete = true;
    createdImages[0].naturalWidth = 192;
    createdImages[0].onload();
    expect(drawCalls.length).toBe(1);
    expect(drawCalls[0][0]).toBe(createdImages[0]);
    expect(fillTextCalls[0][0]).toBe('3');
    expect(link.href).toBe('data:image/png;base64,BADGED');

    // Returning to 0 restores icon-192.png
    fn(0);
    expect(link.href).toBe('icon-192.png');
  });
});

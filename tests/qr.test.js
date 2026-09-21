import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import jsQR from 'jsqr';

// generateQR lives inline in index.html (the deployed artifact). We slice the real
// source and run it against a fake canvas that records the raster, then decode the
// pixels with jsQR — the same tripwire style as mirror-drift.test.js, because the
// hand-rolled encoder previously produced plausibly-looking but UNSCANNABLE codes
// (broken finder core, transposed format info, mask over reserved cells, wrong EC
// block table). If this function is ever edited, the decode assertions below are
// the only thing standing between us and shipping decorative QRs again.
const html = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'),
  'utf8',
);
const src = html.match(/function generateQR\(text\) \{[\s\S]*?\n    return canvas;\n  \}/)[0];

// Minimal canvas stand-in: records which pixels generateQR fills black.
function rasterize(text) {
  const fakeCtxFactory = (canvas) => ({
    fillStyle: null,
    fillRect(x, y, w, h) {
      if (this.fillStyle === '#000000') {
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++)
          canvas._pix[yy * canvas.width + xx] = 0;
      }
    },
  });
  const document = {
    createElement() {
      const c = { _pix: null };
      Object.defineProperty(c, 'width', { set(v) { c._w = v; if (c._h) c._pix = new Uint8Array(v * c._h).fill(255); }, get() { return c._w; } });
      Object.defineProperty(c, 'height', { set(v) { c._h = v; if (c._w) c._pix = new Uint8Array(c._w * v).fill(255); }, get() { return c._h; } });
      c.getContext = () => fakeCtxFactory(c);
      return c;
    },
  };
  const gen = new Function('document', 'TextEncoder', 'return ' + src)(document, TextEncoder);
  const canvas = gen(text);
  const rgba = new Uint8ClampedArray(canvas.width * canvas.height * 4);
  for (let i = 0; i < canvas.width * canvas.height; i++) {
    const v = canvas._pix[i];
    rgba[i * 4] = v; rgba[i * 4 + 1] = v; rgba[i * 4 + 2] = v; rgba[i * 4 + 3] = 255;
  }
  return { rgba, w: canvas.width, h: canvas.height };
}

describe('generateQR — output actually decodes (regression for the unscannable-QR bug)', () => {
  const cases = [
    ['short payload (v1)', 'HELLO'],
    ['invite URL shape (~85B, v5)', 'https://breeze.app/?add=QUJDQUJDQUJDQUJDQUJDQUJDQUJDQUJDQUJDQUJDQUJDQUJDQUJD&name=Alice'],
    ['verify payload (C13)', 'breeze-verify:v1:12345 67890 12345 67890 12345 67890'],
    ['v7 boundary — 3 alignment patterns + version info', 'x'.repeat(120)],
    ['v8 (~200B)', 'y'.repeat(200)],
    ['v10 max capacity (271B)', 'z'.repeat(271)],
  ];
  for (const [name, text] of cases) {
    it(`decodes a ${name}`, () => {
      const { rgba, w, h } = rasterize(text);
      const res = jsQR(rgba, w, h);
      expect(res).not.toBeNull();
      expect(res.data).toBe(text);
    });
  }
});

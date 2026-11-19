// Bridge-resolution pin (2026-11-20). The module blocks in
// index.html publish window.__breeze* bridges whose values are
// bare identifiers; every one of them must be imported in the
// same block or defined there. The location bridge shipped
// referencing sanitizeLoc & friends without importing them —
// the ReferenceError aborted the block, silently killing the
// location bridge (and everything after it in the block) in
// EVERY form, web included, while harness tests that inject the
// factory directly stayed green. Found by actually launching
// the packaged desktop app headlessly.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const blocks = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((m) => m[1]);

describe('module bridges resolve every identifier they publish', () => {
  it('finds module blocks and bridges', () => {
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.join('')).toContain('window.__breezeLocation');
  });

  it('no bridge publishes an unimported, undefined identifier', () => {
    const unresolved = [];
    for (const b of blocks) {
      const imported = new Set();
      for (const m of b.matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
        for (const part of m[1].split(',')) {
          const name = part.trim().split(/\s+as\s+/).pop().trim();
          if (name) imported.add(name);
        }
      }
      const defined = new Set(
        [...b.matchAll(/(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]),
      );
      for (const m of b.matchAll(/window\.(__breeze\w+)\s*=\s*\{([^}]*)\}/g)) {
        for (const part of m[2].split(',')) {
          const entry = part.trim();
          if (!entry) continue;
          // `key: value` entries carry their own value; only bare
          // identifiers (shorthand properties) need resolution.
          if (entry.includes(':')) continue;
          const name = entry.trim();
          if (name && !imported.has(name) && !defined.has(name)) unresolved.push(`${m[1]} -> ${name}`);
        }
      }
    }
    expect(unresolved).toEqual([]);
  });
});

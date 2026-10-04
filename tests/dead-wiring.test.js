// Tests for tools/dead-wiring.mjs — the gate that catches id lookups wired to
// elements that don't exist. The lookup scanner must cover ALL THREE string
// spellings (', ", `) for BOTH _DOM.get and getElementById: the earlier
// single-quote-only scan let a lone `getElementById("x")` or `_DOM.get(`x`)`
// slip through — the same blind spot i18n-check had for t("key").
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectDeclaredIds, collectLookups, deadWirings } from '../tools/dead-wiring.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');

describe('dead-wiring — lookup spellings', () => {
  it('detects _DOM.get and getElementById in all three quote styles', () => {
    const src = `
      <div id="real-1"></div>
      <script>
        _DOM.get('missing-1');
        _DOM.get("missing-2");
        _DOM.get(\`missing-3\`);
        document.getElementById('missing-4');
        document.getElementById("missing-5");
        document.getElementById(\`missing-6\`);
        _DOM.get('real-1');
      </script>`;
    const dead = deadWirings(src).map(([id]) => id).sort();
    expect(dead).toEqual(['missing-1', 'missing-2', 'missing-3', 'missing-4', 'missing-5', 'missing-6']);
  });

  it('does not flag dynamically-computed lookup strings', () => {
    const src = `<div id="dur-1"></div><script>
      _DOM.get(\`dur-\${x}\`);
      _DOM.get('dur-' + x);
      getElementById(id);
    </script>`;
    expect(deadWirings(src)).toEqual([]);
  });
});

describe('dead-wiring — declaration spellings', () => {
  it('counts markup, template-literal, runtime-assign and setAttribute ids', () => {
    const src = `
      <div id="a-1"></div>
      <div id='a-2'></div>
      safeSetHTML(el, \`<div id="a-3">\`);
      el.id = 'a-4';
      el.id = "a-5";
      el.setAttribute('id', 'a-6');`;
    const have = collectDeclaredIds(src);
    for (const id of ['a-1', 'a-2', 'a-3', 'a-4', 'a-5', 'a-6']) expect(have.has(id)).toBe(true);
  });
});

describe('dead-wiring — real file verdict', () => {
  it('index.html has zero dead literal lookups', () => {
    expect(deadWirings(html)).toEqual([]);
  });

  it('every literal lookup in index.html resolves (consistency check on the live file)', () => {
    const want = collectLookups(html);
    const have = collectDeclaredIds(html);
    const missing = [...want.keys()].filter((id) => !have.has(id));
    expect(missing).toEqual([]);
    expect(want.size).toBeGreaterThan(50); // sanity: the scan actually found lookups
  });
});

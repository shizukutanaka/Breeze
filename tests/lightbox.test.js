import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createLightbox } from '../src/app/lightbox.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function makeNode(tag) {
  const classes = new Set();
  const listeners = {};
  const children = [];
  const node = {
    tagName: tag.toUpperCase(),
    className: '',
    src: '',
    alt: '',
    decoding: '',
    style: {},
    dataset: {},
    children,
    removed: false,
    classList: {
      add(...cs) { cs.forEach(c => classes.add(c)); },
      remove(...cs) { cs.forEach(c => classes.delete(c)); },
      contains(c) { return classes.has(c); },
    },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    emit(type, ev) { (listeners[type] || []).forEach(fn => fn(ev)); },
    appendChild(child) { children.push(child); return child; },
    remove() { node.removed = true; },
  };
  return node;
}

describe('src/app/lightbox.js — createLightbox', () => {
  const savedDescriptors = {};
  const setGlobal = (k, value) => {
    if (!(k in savedDescriptors)) {
      savedDescriptors[k] = Object.getOwnPropertyDescriptor(globalThis, k);
    }
    Object.defineProperty(globalThis, k, { value, configurable: true, writable: true });
  };

  afterEach(() => {
    for (const [k, desc] of Object.entries(savedDescriptors)) {
      if (desc === undefined) delete globalThis[k];
      else Object.defineProperty(globalThis, k, desc);
      delete savedDescriptors[k];
    }
  });

  function setup({ withIO = true } = {}) {
    const bodyChildren = [];
    const docListeners = { keydown: [] };
    let ioCallback = null;
    const unobserved = [];

    setGlobal('document', {
      createElement: (tag) => makeNode(tag),
      addEventListener: (type, fn) => { (docListeners[type] ||= []).push(fn); },
      removeEventListener: (type, fn) => {
        docListeners[type] = (docListeners[type] || []).filter(f => f !== fn);
      },
      body: { appendChild: (el) => { bodyChildren.push(el); } },
    });

    if (withIO) {
      setGlobal('IntersectionObserver', class MockIO {
        constructor(cb, opts) { ioCallback = cb; this.opts = opts; }
        observe() {}
        unobserve(el) { unobserved.push(el); }
      });
    } else {
      setGlobal('IntersectionObserver', undefined);
    }

    return { bodyChildren, docListeners, getIoCallback: () => ioCallback, unobserved };
  }

  it('rejects unsafe URL schemes and accepts blob:, data:, https:', () => {
    const { bodyChildren } = setup();
    const { showLightbox } = createLightbox({ t: (k) => k });
    showLightbox('');
    showLightbox('javascript:alert(1)');
    showLightbox('http://example.com/a.png');
    expect(bodyChildren).toHaveLength(0);

    showLightbox('https://example.com/a.png');
    showLightbox('blob:https://example.com/123');
    showLightbox('data:image/png;base64,AA==');
    expect(bodyChildren).toHaveLength(3);
    expect(bodyChildren[0].className).toBe('lightbox');
    expect(bodyChildren[0].children[0].alt).toBe('fullSizeImage');
  });

  it('cleans up DOM and keydown listener on Escape, backdrop click, and image error', () => {
    const { bodyChildren, docListeners } = setup();
    const { showLightbox } = createLightbox({ t: (k) => k });

    showLightbox('https://example.com/1.png');
    expect(docListeners.keydown).toHaveLength(1);
    docListeners.keydown[0]({ key: 'Escape' });
    expect(bodyChildren[0].removed).toBe(true);
    expect(docListeners.keydown).toHaveLength(0);

    showLightbox('https://example.com/2.png');
    const lb2 = bodyChildren[1];
    lb2.onclick({ target: lb2 });
    expect(lb2.removed).toBe(true);
    expect(docListeners.keydown).toHaveLength(0);

    showLightbox('https://example.com/3.png');
    const lb3 = bodyChildren[2];
    lb3.children[0].onerror();
    expect(lb3.removed).toBe(true);
    expect(docListeners.keydown).toHaveLength(0);
  });

  it('wires touch pinch/double-tap zoom when isTouch is true', () => {
    const { bodyChildren } = setup();
    const { showLightbox } = createLightbox({ t: (k) => k, isTouch: true });
    showLightbox('https://example.com/touch.png');
    const img = bodyChildren[0].children[0];
    expect(img.classList.contains('i-no-touch')).toBe(true);

    img.emit('touchend', { touches: [] });
    img.emit('touchend', { touches: [] });
    expect(img.style.transform).toBe('scale(2.5)');
  });

  it('lazy image observer swaps dataset.src into src and unobserves on intersect', () => {
    const { getIoCallback, unobserved } = setup({ withIO: true });
    const { observer } = createLightbox({ t: (k) => k });
    expect(observer).not.toBeNull();
    const img = makeNode('img');
    img.dataset.src = 'https://example.com/lazy.png';
    getIoCallback()([{ isIntersecting: true, target: img }]);
    expect(img.src).toBe('https://example.com/lazy.png');
    expect(img.dataset.src).toBeUndefined();
    expect(unobserved).toContain(img);
  });

  it('wiring: index.html exposes window.__breezeLightbox and delegates showLightbox/_imgObserver', () => {
    expect(html).toContain("import { createLightbox } from './src/app/lightbox.js'; window.__breezeLightbox = { createLightbox };");
    expect(html).toContain('globalThis.__breezeLightbox?.createLightbox({ t, isTouch: IS_TOUCH, signal: _ac.signal })');
  });
});

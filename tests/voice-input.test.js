import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createVoiceInput } from '../src/app/voice-input.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function makeEl(id = '') {
  const classes = new Set();
  const attrs = {};
  const listeners = {};
  const children = [];
  const el = {
    id,
    textContent: '',
    value: '',
    className: '',
    style: {},
    firstChild: null,
    classList: {
      add(...cs) { cs.forEach(c => classes.add(c)); },
      remove(...cs) { cs.forEach(c => classes.delete(c)); },
      contains(c) { return classes.has(c); },
    },
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return attrs[k]; },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    async click() { for (const fn of (listeners.click || [])) await fn(); },
    insertBefore(child) { children.unshift(child); el.firstChild = children[0] || null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    remove() { el._removed = true; },
  };
  return el;
}

describe('src/app/voice-input.js — createVoiceInput', () => {
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

  function setup({ contact, speechRecognition = null, mediaRecorderImpl = null } = {}) {
    const voiceBtn = makeEl('b-msg-voice');
    const sttBtn = makeEl('b-msg-stt');
    sttBtn.classList.add('hidden');
    const input = makeEl('msg-input');
    const bar = makeEl('msg-input-bar');
    const elems = { 'b-msg-voice': voiceBtn, 'b-msg-stt': sttBtn, 'msg-input': input, 'msg-input-bar': bar };

    let curContact = contact;
    const toasts = [];
    const puts = [];
    const relaySends = [];
    const fanOuts = [];
    const appended = [];
    let rendered = 0;
    let autoHeightCalled = 0;
    const haptics = [];

    setGlobal('window', { SpeechRecognition: speechRecognition });
    setGlobal('document', { createElement: () => makeEl() });
    const trackStopped = { count: 0 };
    const stream = { getTracks: () => [{ stop: () => { trackStopped.count++; } }] };
    setGlobal('navigator', {
      language: 'en-US',
      mediaDevices: { getUserMedia: async () => stream },
    });
    if (mediaRecorderImpl) {
      setGlobal('MediaRecorder', mediaRecorderImpl);
    }

    const ui = createVoiceInput({
      DOM: { get: (id) => elems[id] || null },
      config: { FILE_MAX: 50 * 1024 * 1024, VOICE_MAX_MS: 120000 },
      haptic: { tap: () => haptics.push('tap'), send: () => haptics.push('send'), success: () => haptics.push('success') },
      t: (k) => k,
      showToast: (msg, type) => toasts.push({ msg, type }),
      safeSetHTML: () => {},
      dbg: () => {},
      autoHeight: () => { autoHeightCalled++; },
      encryptFor: async (payload) => 'enc:' + payload,
      relaySend: async (id, body, pub) => { relaySends.push({ id, body, pub }); },
      fanOut: (...args) => { fanOuts.push(args); },
      dbPut: async (store, rec) => { puts.push({ store, rec }); },
      appendMsg: (...args) => { appended.push(args); },
      renderContacts: () => { rendered++; },
      correctedNow: () => 1700000000000,
      genMsgId: () => 'm-1',
      activeContact: () => curContact,
      myId: () => 'me-id',
      myPubB64: () => 'me-pub',
      myName: () => 'Me',
    });

    return {
      ui, voiceBtn, sttBtn, input, elems, toasts, puts, relaySends, fanOuts, appended,
      haptics, trackStopped,
      setContact: (c) => { curContact = c; },
      rendered: () => rendered,
      autoHeightCalled: () => autoHeightCalled,
    };
  }

  it('refuses group chats before starting MediaRecorder', async () => {
    let gumCalled = false;
    const h = setup({ contact: { id: 'grp-1', isGroup: true, name: 'Team' } });
    globalThis.navigator.mediaDevices.getUserMedia = async () => { gumCalled = true; return { getTracks: () => [] }; };
    await h.voiceBtn.click();
    expect(gumCalled).toBe(false);
    expect(h.toasts).toEqual([{ msg: 'groupNoVoice', type: 'error' }]);
  });

  it('records and sends an encrypted 1:1 voice note with relaySend + fanOut', async () => {
    let recorder;
    class FakeMediaRecorder {
      static isTypeSupported() { return true; }
      constructor(stream, opts) {
        this.stream = stream;
        this.mimeType = opts.mimeType;
        this.state = 'inactive';
        recorder = this;
      }
      start() { this.state = 'recording'; }
      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob([new Uint8Array(256)]) });
        if (this.onstop) this._stopDone = this.onstop();
      }
    }
    class FakeFileReader {
      readAsDataURL() {
        this.result = 'data:audio/webm;base64,QUJDRA==';
        this._done = this.onload?.();
      }
    }
    setGlobal('FileReader', FakeFileReader);
    setGlobal('File', class FakeFile {
      constructor(parts, name, opts) { this.name = name; this.type = opts.type; this.size = 256; }
    });

    const contact = { id: 'bob', pubB64: 'bob-pub', name: 'Bob', isGroup: false };
    const h = setup({ contact, mediaRecorderImpl: FakeMediaRecorder });
    await h.voiceBtn.click();
    expect(recorder.state).toBe('recording');
    expect(h.voiceBtn.getAttribute('aria-pressed')).toBe('true');

    await h.voiceBtn.click();
    await recorder._stopDone;
    await new Promise(r => setTimeout(r, 0));

    expect(h.trackStopped.count).toBe(1);
    expect(h.relaySends).toHaveLength(1);
    expect(h.relaySends[0].body.isFile).toBe(true);
    expect(h.fanOuts).toHaveLength(1);
    expect(h.puts.some(p => p.store === 'messages')).toBe(true);
    expect(h.puts.some(p => p.store === 'contacts')).toBe(true);
    expect(h.appended).toHaveLength(1);
    expect(h.rendered()).toBe(1);
    expect(h.haptics).toContain('success');
  });

  it('backstops a mid-recording switch to a group chat without encrypting or sending', async () => {
    let recorder;
    class FakeMediaRecorder {
      static isTypeSupported() { return true; }
      constructor(stream, opts) {
        this.stream = stream;
        this.mimeType = opts.mimeType;
        this.state = 'inactive';
        recorder = this;
      }
      start() { this.state = 'recording'; }
      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob([new Uint8Array(256)]) });
        if (this.onstop) this._stopDone = this.onstop();
      }
    }
    class FakeFileReader {
      readAsDataURL() {
        this.result = 'data:audio/webm;base64,QUJDRA==';
        this._done = this.onload?.();
      }
    }
    setGlobal('FileReader', FakeFileReader);
    setGlobal('File', class FakeFile {
      constructor(parts, name, opts) { this.name = name; this.type = opts.type; this.size = 256; }
    });

    const h = setup({ contact: { id: 'bob', pubB64: 'bob-pub', name: 'Bob', isGroup: false }, mediaRecorderImpl: FakeMediaRecorder });
    await h.voiceBtn.click();
    // Switch active contact to a group mid-recording
    h.setContact({ id: 'grp-1', isGroup: true, name: 'Team' });
    await h.voiceBtn.click();
    await recorder._stopDone;
    await new Promise(r => setTimeout(r, 0));

    expect(h.toasts).toEqual([{ msg: 'groupNoVoice', type: 'error' }]);
    expect(h.relaySends).toHaveLength(0);
    expect(h.fanOuts).toHaveLength(0);
  });

  it('cleanup() stops an active recording without firing onstop or sending', async () => {
    let recorder;
    class FakeMediaRecorder {
      static isTypeSupported() { return true; }
      constructor(stream, opts) {
        this.stream = stream;
        this.mimeType = opts.mimeType;
        this.state = 'inactive';
        recorder = this;
      }
      start() { this.state = 'recording'; }
      stop() {
        this.state = 'inactive';
        if (this.onstop) this.onstop();
      }
    }
    const contact = { id: 'bob', pubB64: 'bob-pub', name: 'Bob', isGroup: false };
    const h = setup({ contact, mediaRecorderImpl: FakeMediaRecorder });
    await h.voiceBtn.click();
    expect(recorder.state).toBe('recording');

    h.ui.cleanup();
    expect(recorder.state).toBe('inactive');
    expect(recorder.onstop).toBeNull();
    expect(h.trackStopped.count).toBe(1);
    expect(h.relaySends).toHaveLength(0);
  });

  it('wires Speech-to-Text when SpeechRecognition is available', async () => {
    let recInstance;
    class FakeSR {
      constructor() { recInstance = this; this.started = 0; this.stopped = 0; }
      start() { this.started++; }
      stop() { this.stopped++; }
    }
    const h = setup({ contact: { id: 'bob', pubB64: 'bob-pub', name: 'Bob' }, speechRecognition: FakeSR });
    expect(h.sttBtn.classList.contains('hidden')).toBe(false);

    await h.sttBtn.click();
    expect(recInstance.started).toBe(1);
    expect(h.sttBtn.getAttribute('aria-pressed')).toBe('true');

    recInstance.onresult({ results: [{ isFinal: true, 0: { transcript: 'hello world' } }] });
    expect(h.input.value).toBe('hello world');
    expect(h.autoHeightCalled()).toBe(1);

    h.ui.cleanup();
    expect(recInstance.stopped).toBe(1);
  });

  it('wiring: index.html exposes window.__breezeVoiceInput and delegates cleanup', () => {
    expect(html).toContain("import { createVoiceInput } from './src/app/voice-input.js'; window.__breezeVoiceInput = { createVoiceInput };");
    expect(html).toContain('globalThis.__breezeVoiceInput?.createVoiceInput(');
    expect(html).toContain('_voiceInput?.cleanup();');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function slice(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  if (a < 0 || b < 0) throw Error('typing/read markers moved');
  return html.slice(a, b);
}
const read = slice('    if (_readTimer) { clearTimeout(_readTimer); _readTimer = null; }', '\n  }\n\n  // MESSAGE RENDERER');
const typing = slice("  _DOM.get('msg-input')?.addEventListener('input', () => {", '\n  // Show typing indicator when received');
function setup(kind, overrides = {}) {
  const dc = { readyState: 'open', send: vi.fn() };
  const stateDC = { readyState: 'open', send: vi.fn() };
  const contact = { id: 'peer', pubB64: 'pub' };
  const signal = vi.fn();
  const w = {
    contact, activeContact: contact, peers: { pub: { dc, stateDC } }, API: '/api',
    _privacyHideTyping: false, _privacyHideReadReceipts: false,
    _settings: { readReceiptDelay: 0 }, _lastTypingSent: 0, _readTimer: null,
    _signal: signal, _dbg: vi.fn(), showReadReceipt: vi.fn(), _lastReadTs: {},
    ...overrides,
  };
  const run = new Function('w', `
    let { contact, activeContact, peers, API, _privacyHideTyping, _privacyHideReadReceipts,
      _settings, _lastTypingSent, _readTimer, _signal, _dbg, showReadReceipt, _lastReadTs } = w;
    const myId = 'self', myName = 'Sender', MS = { SEC: 1000 };
    const _dmRoom = id => 'dm:self:' + id;
    const CONFIG = { TYPING_THROTTLE_MS: 3000 }, _charCounter = null;
    const _DOM = { get: () => ({ value: '', addEventListener: (_, fn) => { w.listener = fn; } }) };
    ${kind === 'typing' ? typing : ''}
    return {
      fire: ${kind === 'typing' ? '() => w.listener()' : `() => { ${read} }`},
      setActive: value => { activeContact = value; }
    };
  `)(w);
  return { ...run, dc, stateDC, signal, w };
}

describe.each(['typing', 'read'])('%s DC-first (deployed sender)', kind => {
  it('uses an open DC without a relay copy, even without the connected flag', () => {
    const h = setup(kind);
    h.fire();
    expect(kind === 'typing' ? h.stateDC.send : h.dc.send).toHaveBeenCalledOnce();
    expect(kind === 'typing' ? h.dc.send : h.stateDC.send).not.toHaveBeenCalled();
    expect(h.signal).not.toHaveBeenCalled();
  });
  it('falls back to relay with no open channel', () => {
    const h = setup(kind);
    h.dc.readyState = h.stateDC.readyState = 'closed';
    h.fire();
    expect(h.signal).toHaveBeenCalledWith('dm:self:peer', kind, ...(kind === 'read' ? [expect.any(String)] : []));
  });
  it('falls back to relay when send throws', () => {
    const h = setup(kind);
    (kind === 'typing' ? h.stateDC : h.dc).send.mockImplementation(() => { throw Error('closed during send'); });
    h.fire();
    expect(h.signal).toHaveBeenCalledOnce();
    expect(h.w._dbg).toHaveBeenCalled();
  });
  it('preserves privacy and API-unavailable gates', () => {
    const hidden = setup(kind, { _privacyHideTyping: true, _privacyHideReadReceipts: true });
    hidden.fire();
    expect(hidden.dc.send).not.toHaveBeenCalled();
    expect(hidden.stateDC.send).not.toHaveBeenCalled();
    expect(hidden.signal).not.toHaveBeenCalled();
    const offline = setup(kind, { API: '' });
    offline.dc.readyState = offline.stateDC.readyState = 'closed';
    offline.fire();
    expect(offline.signal).not.toHaveBeenCalled();
  });
});
it('typing uses message DC when state DC is closed, and state DC when message DC is closed', () => {
  const h = setup('typing');
  h.stateDC.readyState = 'closed'; h.fire();
  expect(h.dc.send).toHaveBeenCalledOnce();
  const stateOnly = setup('typing');
  stateOnly.dc.readyState = 'closed'; stateOnly.fire();
  expect(stateOnly.stateDC.send).toHaveBeenCalledOnce();
  expect(stateOnly.signal).not.toHaveBeenCalled();
});
it('typing preserves throttle and no-conversation gates', () => {
  const h = setup('typing'); h.fire(); h.fire();
  expect(h.stateDC.send).toHaveBeenCalledOnce();
  h.setActive(null); h.fire();
  expect(h.signal).not.toHaveBeenCalled();
});
it('read never uses the unreliable state DC and keeps the group exclusion', () => {
  const h = setup('read'); h.dc.readyState = 'closed'; h.fire();
  expect(h.stateDC.send).not.toHaveBeenCalled();
  expect(h.signal).toHaveBeenCalledOnce();
  const group = setup('read', { contact: { id: 'group', isGroup: true } }); group.fire();
  expect(group.dc.send).not.toHaveBeenCalled();
  expect(group.signal).not.toHaveBeenCalled();
});
it('read retains delayed receipt, jitter, cancellation and conversation checks', async () => {
  vi.useFakeTimers();
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
  try {
    const h = setup('read', { _settings: { readReceiptDelay: 10 } });
    h.fire(); h.fire();
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(9999);
    expect(h.dc.send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(h.dc.send).toHaveBeenCalledOnce();
    h.fire(); h.setActive(null);
    await vi.advanceTimersByTimeAsync(10000);
    expect(h.dc.send).toHaveBeenCalledOnce();
    expect(h.signal).not.toHaveBeenCalled();
  } finally { random.mockRestore(); vi.useRealTimers(); }
});

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function slice(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  if (a < 0 || b < 0) throw Error('heartbeat markers moved');
  return html.slice(a, b);
}
const handler = slice('    let _missedPongs = 0,', '\n    function setupDC(');
const timer = slice('      // v3.6: DC heartbeat', '      // v3.5: Connection health monitor');
const create = new Function('peerState', 'pc', '_adaptiveConfig', '_dbg', 'contact', handler + timer + '\nreturn handleHeartbeat;');
function harness({ stateOpen = true } = {}) {
  const main = { readyState: 'open', send: vi.fn() };
  const state = { readyState: stateOpen ? 'open' : 'closed', send: vi.fn() };
  const peer = { dc: main, stateDC: state, _sigPoll: { resetFast: vi.fn() } };
  const pc = { restartIce: vi.fn() };
  const adaptive = { updateFromRTT: vi.fn() };
  const receive = create(peer, pc, adaptive, () => {}, { id: 'peer' });
  main.send.mockClear();
  return { main, state, peer, pc, adaptive, receive,
    pong: ch => receive(ch, { type: 'pong', ts: JSON.parse(ch.send.mock.lastCall[0]).ts }),
  };
}

describe('deployed DM heartbeat', () => {
  it('counts unanswered probes and resets polling before restarting after three misses', async () => {
    vi.useFakeTimers();
    try {
      const h = harness();
      await vi.advanceTimersByTimeAsync(30_000);
      expect(h.state.send).toHaveBeenCalledTimes(3);
      expect(h.pc.restartIce).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(h.pc.restartIce).toHaveBeenCalledOnce();
      expect(h.peer._sigPoll.resetFast.mock.invocationCallOrder[0]).toBeLessThan(h.pc.restartIce.mock.invocationCallOrder[0]);
    } finally { vi.useRealTimers(); }
  });
  it('matching pongs reset misses; stale or wrong-channel pongs do not', async () => {
    vi.useFakeTimers();
    try {
      const h = harness();
      await vi.advanceTimersByTimeAsync(20_000);
      h.pong(h.state);
      expect(h.adaptive.updateFromRTT).toHaveBeenCalledWith(0);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(h.pc.restartIce).not.toHaveBeenCalled();
      h.receive(h.state, { type: 'pong', ts: Date.now() - 10_000 });
      h.receive(h.main, { type: 'pong', ts: Date.now() });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(h.pc.restartIce).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  });
  it('counts throwing sends and closed channels as misses', async () => {
    vi.useFakeTimers();
    try {
      const h = harness();
      h.state.send.mockImplementation(() => { throw Error('send failed'); });
      await vi.advanceTimersByTimeAsync(30_000);
      expect(h.pc.restartIce).toHaveBeenCalledOnce();
      h.state.readyState = h.main.readyState = 'closed';
      await vi.advanceTimersByTimeAsync(30_000);
      expect(h.pc.restartIce).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });
  it('handles ping/pong on the main fallback after support is advertised', async () => {
    vi.useFakeTimers();
    try {
      const h = harness({ stateOpen: false });
      h.receive(h.main, { type: 'pong', mainPong: true });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(JSON.parse(h.main.send.mock.lastCall[0]).type).toBe('ping');
      h.pong(h.main);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(h.pc.restartIce).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(h.pc.restartIce).toHaveBeenCalledOnce();
      for (const ch of [h.main, h.state]) {
        expect(h.receive(ch, { type: 'ping', ts: 123 })).toBe(true);
        expect(JSON.parse(ch.send.mock.lastCall[0])).toEqual({ type: 'pong', ts: 123, mainPong: true });
      }
      expect(h.receive(h.main, { type: 'typing' })).toBe(false);
    } finally { vi.useRealTimers(); }
  });
  it('keeps old state-DC pongs compatible and does not watchdog unsupported main-DC probes', async () => {
    vi.useFakeTimers();
    try {
      const h = harness();
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(10_000);
        h.pong(h.state); // Old peer echoes only type and ts.
      }
      h.state.readyState = 'closed';
      await vi.advanceTimersByTimeAsync(60_000);
      expect(h.main.send).not.toHaveBeenCalled();
      expect(h.pc.restartIce).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it('wires heartbeat reception to both channels and resets before every local restart and offer', () => {
    expect(html).toContain('if (handleHeartbeat(peerState.stateDC, msg)) return;');
    expect(html).toContain('if (handleHeartbeat(ch, msg)) return;');
    const code = html.replace(/\/\/[^\n]*/g, '');
    const calls = [...code.matchAll(/(?:peer\.)?pc\.restartIce\(\)/g)];
    expect(calls.length).toBeGreaterThanOrEqual(6);
    for (const call of calls) expect(code.slice(call.index - 160, call.index)).toContain('_sigPoll?.resetFast()');
    const negotiate = slice('    pc.onnegotiationneeded = async () => {', '\n    // Poll for signals');
    expect(negotiate.indexOf('_sigPoll?.resetFast()')).toBeLessThan(negotiate.indexOf('await pc.setLocalDescription()'));
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('  let _signingKey ='), html.indexOf('  async function verifySignature('));
function harness(supported = true) {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const context = vm.createContext({ crypto, TextEncoder, Uint8Array, btoa, _hasEd25519: supported,
    myId: 'ready001', MS: { SEC: 1000 }, setTimeout, clearTimeout, _dbg() {},
    dbGet: () => pending, dbPut: async () => {} });
  vm.runInContext(source, context);
  return { context, release, run: expression => vm.runInContext(expression, context) };
}
afterEach(() => vi.useRealTimers());

describe('deployed queue signing readiness', () => {
  it('startup, reconnect, ACK and mailbox subscription wait for the same initialization', async () => {
    const h = harness(); let finished = 0;
    const ops = ['msg-poll', 'sealed-poll', 'sealed-ack', 'mailbox-ws'];
    const pending = ops.map(op => h.run(`queueAuth('${op}')`).then(auth => { finished++; return auth; }));
    await Promise.resolve();
    expect(finished).toBe(0);
    h.release(null);
    for (const auth of await Promise.all(pending)) expect(auth).toEqual({ ts: expect.any(Number), sig: expect.any(String) });
    expect((await h.run("queueAuth('msg-poll')")).sig).toBeTruthy();
  });

  it('keeps unsupported runtimes unsigned without waiting for the timeout', async () => {
    const h = harness(false);
    expect(await h.run("queueAuth('msg-poll')")).toEqual({});
  });

  it('does not initialize or latch readiness before an identity exists', async () => {
    const h = harness(); h.context.myId = '';
    expect(await h.run("queueAuth('msg-poll')")).toEqual({});
    expect(h.run('_signingReady')).toBeNull();
    h.context.myId = 'ready001';
    h.release(null);
    expect((await h.run("queueAuth('msg-poll')")).sig).toBeTruthy();
  });

  it('bounds stuck initialization; unsigned polling continues and late readiness self-heals', async () => {
    vi.useFakeTimers();
    const h = harness();
    const pending = h.run("queueAuth('msg-poll')");
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toEqual({});
    expect(await h.run("queueAuth('sealed-poll')")).toEqual({});
    h.release(null);
    await h.run('_signingReady');
    expect((await h.run("queueAuth('msg-poll')")).sig).toBeTruthy();
  });

  it('handles initialization failure without wedging queue activity', async () => {
    const h = harness();
    h.context.dbGet = async () => { throw new Error('IDB failed'); };
    expect(await h.run("queueAuth('msg-poll')")).toEqual({});
  });

  it('also bounds a stuck wrapped-key unlock', async () => {
    vi.useFakeTimers();
    const h = harness();
    h.context._atRestIsWrapped = () => true;
    h.context._atRestLoadKey = () => new Promise(() => {});
    h.run("_atRestPassphrase = 'passphrase'");
    const auth = h.run("queueAuth('sealed-poll')");
    h.release({ wrapped: true });
    await vi.advanceTimersByTimeAsync(5000);
    expect(await auth).toEqual({});
  });

  it('both boot paths and leader promotion await readiness; every queue entry point uses queueAuth', () => {
    // Both paths run the sequence through _enterMainUI (extracted in the
    // D14 line-budget pass): the invariant is unchanged — each path awaits
    // the helper, and inside the helper readiness precedes polling.
    for (const [start, end] of [['  async function _boot()', '  } // end _boot'], ['  async function _runSetupCreate(', '    // Same omission class']]) {
      const body = html.slice(html.indexOf(start), html.indexOf(end));
      expect(body.indexOf('await _enterMainUI()')).toBeGreaterThan(0);
    }
    const enter = html.slice(html.indexOf('  async function _enterMainUI()'), html.indexOf('  async function _boot()'));
    expect(enter.indexOf('await ensureSigningReady()')).toBeGreaterThan(0);
    expect(enter.indexOf('await ensureSigningReady()')).toBeLessThan(enter.indexOf('startPolling()'));
    const polling = html.slice(html.indexOf('  async function startPolling()'), html.indexOf('  // ===== Mailbox WebSocket delivery'));
    expect(polling.indexOf('await ensureSigningReady()')).toBeLessThan(polling.indexOf('schedulePoll()'));
    for (const op of ['msg-poll', 'sealed-poll', 'sealed-ack', 'mailbox-ws']) expect(html).toContain(`queueAuth('${op}')`);
  });
});

// Regression: seven send paths persist the bubble + messages row BEFORE encrypting,
// so an encryptFor/encryptGroupMsg failure (no session, prekey exhausted, group-key
// init failure) left a stored record that LOOKED sent — '✓' bubble, lastMsg preview,
// and no signal it reached nobody. Some sites had no toast either (polls, files,
// voice): the user watched their message "send" into the void.
// Fix: the built-but-unused `failed` status (✗ + t('sendFailed') + retry-msg
// affordance) is now wired in — updateMsgStatus gained a 'failed' branch, and every
// persist-then-encrypt fail site marks the row and surfaces a toast.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Extract the shipped updateMsgStatus and run it — the DOM walk no-ops on an empty
// box, then the IDB branch must mark the matched mine-row `failed`.
function loadUMS() {
  const m = html.match(/function updateMsgStatus\(ts, status, contactId\) \{[\s\S]*?\n  \}\n/);
  return m && m[0].replace('function updateMsgStatus', 'const updateMsgStatus = function');
}
const block = loadUMS();
const run = (env) => new Function('env', `const {${Object.keys(env).join(',')}}=env;\n${block}\nreturn updateMsgStatus(env.ts, env.status, env.contactId);`)(env);

function harness(rows) {
  const puts = [];
  return {
    ts: 1000, status: 'failed', contactId: 'conv-1',
    _DOM: { get: () => ({ querySelectorAll: () => [] }) },
    activeContact: { id: 'conv-1' },
    dbGetByIndex: async () => rows,
    dbPut: async (_s, m) => { puts.push(m); },
    MS: { SEC: 1000 },
    t: (k) => k,
    _dbg: () => {},
    Number, Date, Math,
    puts,
  };
}

describe('updateMsgStatus failed marking', () => {
  it('extracts the shipped function', () => { expect(block).toBeTruthy(); });

  it("status 'failed' sets m.failed on the matching mine row", async () => {
    const row = { msgId: 'me:1000', contactId: 'conv-1', mine: true, ts: 1000 };
    const h = harness([row]);
    await run(h);
    expect(row.failed).toBe(true);
    expect(row.ack).toBeUndefined();
    expect(h.puts).toContain(row);
  });

  it("'failed' never touches deleted rows", async () => {
    const row = { msgId: 'me:1', contactId: 'conv-1', mine: true, ts: 1000, deleted: true };
    const h = harness([row]);
    await run(h);
    expect(row.failed).toBeUndefined();
    expect(h.puts.length).toBe(0);
  });

  it('other statuses still ack (no regression)', async () => {
    const row = { msgId: 'me:2', contactId: 'conv-1', mine: true, ts: 1000 };
    const h = harness([row]);
    h.status = 'delivered';
    await run(h);
    expect(row.ack).toBe(true);
    expect(row.failed).toBeUndefined();
  });

  it('rows >5s away are not mis-marked', async () => {
    const row = { msgId: 'me:3', contactId: 'conv-1', mine: true, ts: 999000 };
    const h = harness([row]);
    await run(h);
    expect(row.failed).toBeUndefined();
    expect(h.puts.length).toBe(0);
  });
});

describe('every persist-then-encrypt fail site marks the row failed', () => {
  it('sendMessage group + 1:1, createPoll group + 1:1, _sendFile group + 1:1, voice group', () => {
    const n = (html.match(/updateMsgStatus\(ts, 'failed', contact\.id\)/g) || []).length;
    expect(n).toBe(7);
  });

  it('voice group bubble renders ✗ immediately via meta.failed', () => {
    expect(html).toContain("{ msgId: genMsgId(), failed: !groupCt }");
  });

  it('updateMsgStatus has the failed DOM branch', () => {
    expect(html).toContain("status === 'failed' && !statusEl.classList.contains('failed')");
    expect(html).toContain("statusEl.textContent = '✗'");
  });
});

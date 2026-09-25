// Regression test (round 123): notification quick-reply spoof + dead sealed actions.
// Two defects, one root cause — the push payload's contactId is relay-supplied and
// unauthenticated:
//  (1) index.html auto-SENT the user's typed reply to whatever conversation the
//      contactId resolved to — a hostile relay could retarget "yes" (meant for Alice)
//      into a group or another chat by forging contactId (raw fallback resolves any id;
//      even hash ids are visible to the relay on the envelopes it carries).
//  (2) _worker.js stamped `contactId: sha256Short(to)` (the RECIPIENT's own id) on
//      sealed-sender pushes — it can never resolve to a contact, so reply/mark-read
//      buttons were silently dead on every sealed notification. sw.js now hides the
//      actions when the payload names no contact.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync('index.html', 'utf8');
const worker = readFileSync('_worker.js', 'utf8');
const sw = readFileSync('sw.js', 'utf8');

// The quick-reply block inside the SW 'message' listener — runs to the mark-read if.
const qrM = src.match(/if \(e\.data\?\.type === 'quick-reply' && e\.data\.contactId && e\.data\.text\) \{([\s\S]*?)\n    \}\n    if \(e\.data\?\.type === 'mark-read'/);
const QR = qrM ? qrM[0].replace(/\n    if \(e\.data\?\.type === 'mark-read'$/, '') : '';
const mrM = src.match(/if \(e\.data\?\.type === 'mark-read' && e\.data\.contactId\) \{([\s\S]*?)\n    \}/);
const MR = mrM ? mrM[0] : '';

async function runBlock(block, env) {
  new Function('env', `
    const {_pushContactId, dbGet, dbPut, openConversation, _DOM, _dbg, sendMessage, renderContacts} = env;
    const e = env.e;
    return (async () => { ${block} })();
  `)(env);
  // The handler's work lives in .then() chains the outer block doesn't await — flush
  // microtasks (resolve → dbGet → contact → openConversation → input) before asserting.
  await new Promise(r => setTimeout(r, 0));
}

function mkEnv({ resolveId, contact }) {
  const calls = { opened: [], sent: 0, focused: 0, inputs: [], puts: [], renders: 0 };
  const input = { value: '', focus: () => { calls.focused++; } };
  const env = {
    e: { data: { type: 'quick-reply', contactId: 'X', text: 'yes' } },
    _pushContactId: async () => resolveId,
    dbGet: async () => contact,
    dbPut: async (s, r) => { calls.puts.push(r); },
    openConversation: async (c) => { calls.opened.push(c); },
    _DOM: { get: () => input },
    _dbg: () => {},
    sendMessage: () => { calls.sent++; },
    renderContacts: () => { calls.renders++; },
  };
  return { env, calls, input };
}

describe('notification quick-reply must not auto-send to a forged target', () => {
  it('pre-fills the resolved conversation and focuses — never calls sendMessage', async () => {
    const { env, calls, input } = mkEnv({ resolveId: 'alice', contact: { id: 'alice', name: 'Alice' } });
    await runBlock(QR, env);
    expect(calls.opened.length).toBe(1);
    expect(calls.opened[0].id).toBe('alice');
    expect(input.value).toBe('yes');
    expect(calls.focused).toBe(1);
    expect(calls.sent).toBe(0); // the spoof hole: pre-fix this was 1 (auto-send)
  });

  it('does nothing when the contactId resolves to no contact', async () => {
    const { env, calls } = mkEnv({ resolveId: 'deadbeef', contact: null });
    await runBlock(QR, env);
    expect(calls.opened.length).toBe(0);
    expect(calls.sent).toBe(0);
  });

  it('pins: the quick-reply handler contains no sendMessage call', () => {
    expect(QR).toContain('quick-reply');
    expect(QR).not.toContain('sendMessage(');
    expect(QR).toContain("focus()");
  });
});

describe('mark-read keeps working on resolvable contacts', () => {
  it('clears unread on the resolved contact only', async () => {
    const c = { id: 'alice', unread: 4 };
    const { env, calls } = mkEnv({ resolveId: 'alice', contact: c });
    env.e = { data: { type: 'mark-read', contactId: 'X' } };
    await runBlock(MR, env);
    expect(c.unread).toBe(0);
    expect(calls.puts.length).toBe(1);
  });
});

describe('sealed push carries no contactId; actions hidden when unresolvable', () => {
  it('worker sealed push omits contactId (sender hidden by design)', () => {
    const sealed = worker.match(/sendPushToUser\(to, \{[^}]*\}, env\)\.catch/g) || [];
    const sealedLine = sealed.find(l => l.includes('breeze-sealed'));
    expect(sealedLine).toBeTruthy();
    expect(sealedLine).not.toContain('contactId');
    // Legacy path still names the sender — reply/mark-read work there.
    expect(worker).toContain('contactId: await sha256Short(from)');
  });

  it('sw.js gates action buttons on a resolvable contactId', () => {
    expect(sw).toContain('actions: data.contactId ?');
    // The sealed-notification actions array would show Reply/Mark Read with no target.
    expect(sw).toContain("]) : []");
  });
});

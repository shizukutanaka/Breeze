// Regression: a group-message push carried contactId=sha256Short(from) — the SENDER's
// hash — while tag already hashed `groupId || from`. Tapping or quick-replying a group
// notification resolved to the sender's 1:1 chat, not the group (pre-fill fix stops the
// silent wrong-send, but the notification still targets the wrong conversation).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { webcrypto } from 'crypto';
const crypto = webcrypto;

const src = readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');

// Extract the legacy /msg/send push-payload construction (rawTitle..sendPushToUser call)
// and run it verbatim against controlled inputs.
function pushBlock() {
  const start = src.indexOf('  // Trigger Web Push notification (non-blocking)');
  const end = src.indexOf('}, env).catch(() => {});', start);
  if (start < 0 || end < 0) throw new Error('push block not found');
  return src.slice(start, end + '}, env).catch(() => {});'.length);
}

async function sha256Short(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}
const sanitizeString = (s, n) => String(s).slice(0, n);
const TTL = { DAY: 86400 };

async function buildPush({ groupId, groupName, from, fromName, isCall, isVideoCall, isFile, isVoice }) {
  const pushes = [];
  const sendPushToUser = async (to, payload, env) => { pushes.push(payload); };
  const env = {};
  // eslint-disable-next-line no-new-func
  await new Function('groupId','groupName','from','fromName','isCall','isVideoCall','isFile','isVoice','sendPushToUser','sha256Short','sanitizeString','env',
    'return (async()=>{const to=from;\n' + pushBlock() + '\n})();')(
    groupId, groupName, from, fromName, isCall, isVideoCall, isFile, isVoice, sendPushToUser, sha256Short, sanitizeString, env);
  return pushes[0];
}

describe('push contactId targets the group for group messages', () => {
  it('group message: contactId hashes groupId (like tag), not the sender', async () => {
    const p = await buildPush({ groupId: 'grpABC123', from: 'senderXYZ', fromName: 'Alice', isCall: false, isVideoCall: false, isFile: false, isVoice: false });
    expect(p.contactId).toBe(await sha256Short('grpABC123'));
    expect(p.contactId).not.toBe(await sha256Short('senderXYZ'));
  });
  it('group message: tag also hashes the group (collapse per conversation)', async () => {
    const p = await buildPush({ groupId: 'grpABC123', from: 'senderXYZ', fromName: 'Alice' });
    expect(p.tag).toBe('breeze-' + await sha256Short('grpABC123'));
  });
  it('1:1 message: contactId still hashes the sender', async () => {
    const p = await buildPush({ groupId: undefined, from: 'senderXYZ', fromName: 'Alice' });
    expect(p.contactId).toBe(await sha256Short('senderXYZ'));
    expect(p.tag).toBe('breeze-' + await sha256Short('senderXYZ'));
  });
  it('push body labels are preserved', async () => {
    const p = await buildPush({ groupId: 'g', from: 's', isCall: true, isVideoCall: true });
    expect(p.body).toBe('Video call');
    const p2 = await buildPush({ groupId: 'g', from: 's', isFile: true });
    expect(p2.body).toBe('📎 File');
  });
});

describe('pins', () => {
  it('worker still hashes contactId through sha256Short', () => {
    expect(src).toMatch(/contactId: await sha256Short/);
  });
  it('contactId uses the same conversation key as tag', () => {
    expect(src).toMatch(/contactId: await sha256Short\(String\(groupId \|\| from\)\)/);
  });
});

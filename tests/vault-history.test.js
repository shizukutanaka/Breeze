import { beforeAll, describe, expect, it } from 'vitest';
import { newVault, openVaultRecord, sealVaultRecord } from '../src/app/vault.js';
import { inspectHistory, stageHistory } from '../src/app/vault-history.js';

function database(records, name = 'breeze-messenger') {
  const names = Object.keys(records);
  names.contains = name => names.includes(name);
  const request = value => { const r = {}; queueMicrotask(() => { r.result = structuredClone(value); r.onsuccess?.(); }); return r; };
  return { name, objectStoreNames: names, transaction: store => ({ objectStore: () => ({ getAllKeys: () => request(records[store].map(([key]) => key)), getAll: () => request(records[store].map(([, value]) => value)) }) }) };
}

describe('history format and authenticated inventory', () => {
  let codec;
  beforeAll(async () => {
    const { key, manifest } = await newVault('a separate strong vault passphrase');
    codec = { seal: (...args) => sealVaultRecord(key, manifest, ...args), open: (...args) => openVaultRecord(key, manifest, ...args) };
  });
  const records = () => ({ identity: [['msgkey', { key: 'local-key' }]], contacts: [['alice', { id: 'alice', name: 'Private Name', lastMsg: 'Private preview' }]], messages: [['message-id', { msgId: 'message-id', contactId: 'alice', text: 'Private message', fileData: 'Private file', ts: 123 }]], settings: [['app', { privacy: true }]], audit: [], calls: [] });

  it('encrypts values, primary keys, file bodies, previews and the old message key', async () => {
    const input = records(), db = database(input), staged = await stageHistory(db, codec);
    const raw = JSON.stringify(staged);
    for (const secret of ['local-key', 'alice', 'Private Name', 'Private preview', 'message-id', 'Private message', 'Private file', 'contactId']) expect(raw).not.toContain(secret);
    const opened = await inspectHistory(db, staged, codec);
    for (const [name, rows] of Object.entries(input)) expect([...opened.stores.get(name).values()].map(({ key, value }) => [key, value])).toEqual(rows);
  });

  it('handles empty accounts without skipping their stores', async () => {
    const db = database({ identity: [], contacts: [], messages: [] });
    const staged = await stageHistory(db, codec), opened = await inspectHistory(db, staged, codec);
    expect(staged.stores).toHaveLength(3);
    expect([...opened.stores.values()].every(rows => rows.size === 0)).toBe(true);
  });

  it('uses the legacy decoder before sealing and preserves typed arrays', async () => {
    const db = database({ identity: [['sess:a', { old: true }]] });
    const staged = await stageHistory(db, codec, (_store, _key, value) => value.old ? { chain: new Uint8Array([1, 2]) } : value);
    const opened = await inspectHistory(db, staged, codec);
    expect([...opened.stores.get('identity').values()][0].value.chain).toEqual(new Uint8Array([1, 2]));
  });

  it.each(['missing-row', 'extra-row', 'duplicate-row', 'missing-store', 'plaintext', 'wrong-account'])('fails closed on %s', async damage => {
    const db = database(records()), staged = await stageHistory(db, codec);
    const messages = staged.stores.find(([name]) => name === 'messages')[1];
    if (damage === 'missing-row') messages.pop();
    if (damage === 'extra-row') messages.push(['unlisted', messages[0][1]]);
    if (damage === 'duplicate-row') {
      const second = structuredClone(messages[0]); second[0] = 'other'; messages.push(second);
      const catalog = await codec.open(db.name, 'identity', 'vault:manifest', staged.marker);
      catalog.stores.messages.keys.push('other');
      staged.marker = await codec.seal(db.name, 'identity', 'vault:manifest', catalog);
      messages[1] = messages[0];
    }
    if (damage === 'missing-store') staged.stores.pop();
    if (damage === 'plaintext') messages[0][1] = { text: 'plaintext' };
    await expect(inspectHistory(damage === 'wrong-account' ? database(records(), 'breeze-acc-other') : db, staged, codec)).rejects.toThrow();
  });
});

import { expect, test } from '@playwright/test';

async function harness(page) {
  await page.goto('/manifest.json');
  await page.evaluate(async () => {
    const V = await import('/src/app/vault.js'), H = await import('/src/app/vault-history.js');
    const request = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const done = tx => new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error || new Error('aborted')); });
    const req = indexedDB.open('history-test', 6);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('identity'); db.createObjectStore('settings'); db.createObjectStore('contacts', { keyPath: 'id' });
      db.createObjectStore('audit', { keyPath: 'id', autoIncrement: true }); db.createObjectStore('calls', { keyPath: 'id' });
      const messages = db.createObjectStore('messages', { keyPath: 'msgId' });
      messages.createIndex('contact', 'contactId'); messages.createIndex('contact_ts', ['contactId', 'ts']);
    };
    const db = await request(req), { key, manifest } = await V.newVault('a separate strong vault passphrase');
    const codec = { seal: (...args) => V.sealVaultRecord(key, manifest, ...args), open: (...args) => V.openVaultRecord(key, manifest, ...args) };
    let epoch = 0, blocked = false;
    const runtime = { transactions: new Set(), caches: new Set(), epoch: () => epoch, assert: (expected = epoch) => { if (blocked || expected !== epoch) throw new Error('locked'); } };
    const lock = () => { blocked = true; epoch++; for (const tx of runtime.transactions) { try { tx.abort(); } catch { /* finished */ } } for (const cache of runtime.caches) cache.clear(); };
    window.HT = { V, H, db, codec, runtime, request, done, lock };
  });
}

test('opaque history transactions preserve indexed reads and atomic mixed-store writes', async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async () => {
    const { H, db, codec, runtime, request, done } = HT;
    const seeded = db.transaction([...db.objectStoreNames], 'readwrite'), seededDone = done(seeded);
    seeded.objectStore('identity').put({ key: 'old-local-message-key' }, 'msgkey');
    seeded.objectStore('contacts').put({ id: 'alice', name: 'Private Name', lastMsg: 'Private preview' });
    for (let i = 0; i < 3; i++) seeded.objectStore('messages').put({ msgId: 'm' + i, contactId: 'alice', ts: i, text: 'Private message ' + i, fileData: 'Private file' });
    await seededDone;
    const staged = await H.stageHistory(db, codec);
    await H.commitHistory(db, staged, codec);
    const wrapped = H.historyDatabase(db, codec, runtime);
    wrapped.onversionchange = () => {};
    const read = wrapped.transaction('messages'), readDone = done(read);
    const index = read.objectStore('messages').index('contact_ts');
    const recent = await request(index.getAllRecords({ query: IDBKeyRange.bound(['alice', 0], ['alice', Infinity]), direction: 'prev', count: 2 }));
    await readDone;
    const write = wrapped.transaction(['identity', 'messages'], 'readwrite'), writeDone = done(write);
    write.objectStore('identity').put({ chain: new Uint8Array([3, 4]) }, 'sess:alice');
    const outgoing = { msgId: 'm3', contactId: 'alice', ts: 3, text: 'new-private-message' };
    write.objectStore('messages').put(outgoing);
    outgoing.text = 'mutated-after-put';
    await writeDone;
    const abort = wrapped.transaction(['identity', 'messages'], 'readwrite'), abortDone = done(abort);
    abort.objectStore('identity').put({ chain: 'must-not-commit' }, 'sess:alice');
    abort.objectStore('messages').put({ msgId: 'uncommitted', text: 'must-not-commit' }); abort.abort();
    await abortDone.catch(() => {});
    const snapshot = await H.snapshotHistory(db, codec), raw = JSON.stringify(snapshot);
    for (const secret of ['alice', 'Private', 'new-private-message', 'must-not-commit', 'old-local-message-key']) if (raw.includes(secret)) throw new Error('raw leak: ' + secret);
    const opened = await H.inspectHistory(db, snapshot, codec);
    if ([...opened.stores.get('messages').values()].some(r => r.key === 'uncommitted')) throw new Error('aborted record committed');
    await H.commitHistory(db, snapshot, codec, true);
    const plain = await request(db.transaction('messages').objectStore('messages').get('m3'));
    return { recent: recent.map(r => r.value.msgId), messages: opened.stores.get('messages').size, chain: [...[...opened.stores.get('identity').values()].find(r => r.key === 'sess:alice').value.chain], plain: plain.text, version: db.version };
  });
  expect(result).toEqual({ recent: ['m2', 'm1'], messages: 4, chain: [3, 4], plain: 'new-private-message', version: 6 });
});

test('history rejects plaintext tampering and locked reads', async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async () => {
    const { H, db, codec, runtime, request, done } = HT;
    await H.commitHistory(db, await H.stageHistory(db, codec), codec);
    const wrapped = H.historyDatabase(db, codec, runtime);
    const tx = db.transaction('messages', 'readwrite'), complete = done(tx);
    tx.objectStore('messages').put({ msgId: 'plaintext', text: 'not trusted' }); await complete;
    const read = wrapped.transaction('messages'), failed = done(read).catch(() => {});
    let rejected = false;
    try { await request(read.objectStore('messages').getAll()); } catch { rejected = true; }
    await failed;
    HT.lock();
    let locked = false;
    try { wrapped.transaction('messages'); } catch { locked = true; }
    return { rejected, locked };
  });
  expect(result).toEqual({ rejected: true, locked: true });
});

test('10k-message history migration, ciphertext scan, open and indexed lookup timing', async ({ page }) => {
  test.setTimeout(120_000);
  await harness(page);
  const result = await page.evaluate(async () => {
    const { H, db, codec, runtime, request, done } = HT;
    const tx = db.transaction('messages', 'readwrite'), complete = done(tx);
    for (let i = 0; i < 10000; i++) tx.objectStore('messages').put({ msgId: 'secret-message-' + i, contactId: 'secret-peer', text: 'secret-body-' + i, fileData: 'secret-file-' + i, ts: i });
    await complete;
    const start = performance.now(), staged = await H.stageHistory(db, codec), sealed = performance.now();
    await H.commitHistory(db, staged, codec); const committed = performance.now();
    const snapshot = await H.snapshotHistory(db, codec), scanned = performance.now();
    if (JSON.stringify(snapshot).includes('secret-')) throw new Error('raw record scan found plaintext');
    const wrapped = H.historyDatabase(db, codec, runtime), read = wrapped.transaction('messages'), readDone = done(read);
    const rows = await request(read.objectStore('messages').index('contact_ts').getAllRecords({ query: IDBKeyRange.bound(['secret-peer', 0], ['secret-peer', Infinity]), direction: 'prev', count: 50 }));
    await readDone;
    return { messages: snapshot.stores.find(([name]) => name === 'messages')[1].length, recent: rows.length, newest: rows[0].value.ts, stageMs: Math.round(sealed - start), commitMs: Math.round(committed - sealed), scanMs: Math.round(scanned - committed), coldIndexedReadMs: Math.round(performance.now() - scanned) };
  });
  console.log('history 10k timing:', JSON.stringify(result));
  expect(result.messages).toBe(10000); expect(result.recent).toBe(50); expect(result.newest).toBe(9999);
});

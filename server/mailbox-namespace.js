// The MAILBOX_DO namespace, in process (stage-2 step 2): the Node
// host's stand-in for the Durable Object binding, composed exactly
// the way step 1 prepared — one MailboxCore per recipient over a
// per-user-prefixed SQLite storage view of one shared database
// (server/sqlite-mailbox-storage.js), with the core's queue-changed
// callback fanning out to this namespace's socket registry. This is
// the registry the stage-2 plan's step 2 names: the WebSocket
// transport terminates here instead of in a Durable Object, and no
// hibernation analogue exists or is needed in a long-lived process.
//
// The worker drives it through the same two calls it makes on
// Cloudflare — idFromName(name) and get(id).fetch(...) — either an
// op-protocol POST (answered by the core, wrapped like MailboxDO's
// adapter wraps it) or the signed WebSocket attach, which a Fetch
// Response cannot express in Node (no 101 status, no socket to hand
// back). For the attach the stub therefore answers a marker response
// (200 + X-Breeze-Ws-Attach: <userId>): reaching the stub at all
// means handleMailboxWs in the worker has already verified the
// caller's ownership signature and chosen this mailbox, so the host
// completes the RFC 6455 handshake on the raw socket itself and
// registers the resulting socket via attach() below.

import { MailboxCore } from '../_worker.js';
import { makeSqliteMailboxStorage } from './sqlite-mailbox-storage.js';

export function makeMailboxNamespace(db) {
  const instances = new Map(); // userId → { core, sockets }

  function instance(userId) {
    let inst = instances.get(userId);
    if (!inst) {
      const sockets = new Set();
      const core = new MailboxCore({
        storage: makeSqliteMailboxStorage(db, `${userId}:`),
        onQueueChanged: (family) => {
          // Same content-free wake-up frame the DO sends
          // (MailboxDO._notifyQueueChanged): no envelope, no sender,
          // no count — the client's poll stays the only data path.
          const frame = JSON.stringify({ type: 'mail', family });
          for (const ws of [...sockets]) {
            try { ws.send(frame); } catch { sockets.delete(ws); }
          }
        },
      });
      inst = { core, sockets };
      instances.set(userId, inst);
    }
    return inst;
  }

  return {
    idFromName(name) { return { name: String(name) }; },

    get(id) {
      const userId = String(id?.name ?? '');
      const inst = instance(userId);
      return {
        // Fetch-shaped like the real DO stub: accepts a Request, or
        // a URL string plus init (the worker's store handles use the
        // latter for the op protocol).
        async fetch(input, init) {
          const request = typeof input === 'string' ? new Request(input, init) : input;
          if ((request.headers.get('Upgrade') || '').toLowerCase() === 'websocket') {
            return new Response(null, { status: 200, headers: { 'X-Breeze-Ws-Attach': userId } });
          }
          let body;
          try { body = await request.json(); } catch { return Response.json({ ok: false }, { status: 400 }); }
          const { status, body: result } = await inst.core.execute(body);
          return Response.json(result, { status });
        },
      };
    },

    // Host-only (no Cloudflare analogue — the runtime owns this
    // there): register a live server-side socket for a mailbox whose
    // upgrade the worker has authorized. Mirrors MailboxDO's
    // webSocketMessage/webSocketClose semantics exactly: an inbound
    // 'ping' text is answered 'pong', every other inbound frame is
    // ignored, and close/error just unregister — no per-socket state
    // exists to clean up.
    attach(userId, ws) {
      const inst = instance(String(userId));
      inst.sockets.add(ws);
      ws.onMessage = (message) => {
        if (message === 'ping') {
          try { ws.send('pong'); } catch { /* peer vanished mid-reply */ }
        }
      };
      ws.onClose = () => { inst.sockets.delete(ws); };
    },

    // Live socket count for one mailbox (host diagnostics and the
    // black-box tests; not part of the worker-facing surface).
    socketCount(userId) {
      const inst = instances.get(String(userId));
      return inst ? inst.sockets.size : 0;
    },
  };
}

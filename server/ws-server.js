// Minimal RFC 6455 WebSocket server for the Node relay host
// (stage-2 step 2, docs/RELAY_STAGE2_PLAN.md). Zero-dependency by
// design: Node ships a WebSocket *client* but no server, and the
// relay's socket carries exactly one tiny text protocol — the
// client sends 'ping', the mailbox registry sends wake-up frames —
// so the server half of the RFC is a handshake plus a frame codec,
// implemented here over node:net sockets.
//
// Only what the relay needs is implemented:
//   - the opening handshake (Sec-WebSocket-Accept), no extensions,
//     no subprotocol negotiation (the worker's route negotiates none);
//   - data frames (text/binary, fragmented or not) reassembled into
//     whole messages and delivered as strings via onMessage;
//   - ping → pong at the protocol layer (in addition to the
//     application-level 'ping' text the MailboxDO protocol answers);
//   - close handshake: a client close frame is echoed and the socket
//     ends; send() emits single unfragmented text frames.
//
// Client frames must be masked (RFC 6455 §5.3 — a hard requirement,
// not a nicety): an unmasked frame is a protocol error (1002), as is
// an unknown opcode; a frame or reassembled message over
// MAX_PAYLOAD closes with 1009. The message cap exists so a hostile
// or broken peer cannot grow host memory with an endless fragment
// stream; the legitimate protocol's only inbound message is the
// 4-byte keepalive.

import { createHash } from 'node:crypto';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 1024 * 1024; // 1 MiB — see header

export function wsAcceptKey(key) {
  return createHash('sha1').update(key + WS_GUID).digest('base64');
}

// One live server-side socket. The host registry (server/
// mailbox-namespace.js) holds these and calls send(frame); the host
// wires onMessage/onClose. Mirrors the slice of the Cloudflare
// server-side WebSocket the MailboxDO relies on: send() of a text
// frame, and close/error simply ending the registration.
export class RelayWebSocket {
  constructor(socket, head) {
    this._socket = socket;
    this._buf = head && head.length ? Buffer.from(head) : Buffer.alloc(0);
    this._fragOp = -1; // opcode of the fragmented message in progress, -1 = none
    this._frags = [];
    this._fragBytes = 0;
    this.closed = false;
    this.onMessage = null; // (text: string) => void
    this.onClose = null; // () => void
    socket.on('data', (chunk) => this._onData(chunk));
    socket.on('error', () => this._finish());
    socket.on('close', () => this._finish());
    if (this._buf.length) this._drain();
  }

  send(text) {
    if (this.closed || this._socket.destroyed) throw new Error('websocket is closed');
    this._socket.write(encodeFrame(0x1, Buffer.from(String(text), 'utf8')));
  }

  close() {
    if (this.closed) return;
    try { this._socket.write(encodeFrame(0x8, Buffer.alloc(0))); } catch { /* already gone */ }
    this._socket.end();
    this._finish();
  }

  _fail(code) {
    if (this.closed) return;
    const payload = Buffer.alloc(2);
    payload.writeUInt16BE(code, 0);
    try { this._socket.write(encodeFrame(0x8, payload)); } catch { /* already gone */ }
    this._socket.end();
    this._finish();
  }

  _finish() {
    if (this.closed) return;
    this.closed = true;
    const cb = this.onClose;
    this.onClose = null;
    this.onMessage = null;
    if (cb) { try { cb(); } catch { /* a registry callback must not take the host down */ } }
  }

  _onData(chunk) {
    if (this.closed) return;
    this._buf = this._buf.length ? Buffer.concat([this._buf, chunk]) : chunk;
    this._drain();
  }

  _drain() {
    while (!this.closed) {
      const frame = this._parseFrame();
      if (!frame) return; // incomplete — wait for more bytes
      if (frame.error) { this._fail(frame.error); return; }
      this._handle(frame);
    }
  }

  // Returns null when more bytes are needed, { error: code } for a
  // protocol violation, or { fin, op, payload } for one full frame.
  _parseFrame() {
    const buf = this._buf;
    if (buf.length < 2) return null;
    const fin = (buf[0] & 0x80) !== 0;
    const op = buf[0] & 0x0f;
    const masked = (buf[1] & 0x80) !== 0;
    let len = buf[1] & 0x7f;
    let off = 2;
    if (len === 126) {
      if (buf.length < off + 2) return null;
      len = buf.readUInt16BE(off);
      off += 2;
    } else if (len === 127) {
      if (buf.length < off + 8) return null;
      const big = buf.readBigUInt64BE(off);
      if (big > BigInt(MAX_PAYLOAD)) return { error: 1009 };
      len = Number(big);
      off += 8;
    }
    if (len > MAX_PAYLOAD) return { error: 1009 };
    if (!masked) return { error: 1002 }; // client→server frames are masked, always
    if (buf.length < off + 4) return null;
    const mask = buf.subarray(off, off + 4);
    off += 4;
    if (buf.length < off + len) return null;
    const payload = Buffer.from(buf.subarray(off, off + len));
    for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    this._buf = buf.subarray(off + len);
    return { fin, op, payload };
  }

  _handle({ fin, op, payload }) {
    if (op === 0x8) { // close: echo and end (RFC 6455 §5.5.1)
      try { this._socket.write(encodeFrame(0x8, payload.subarray(0, 2))); } catch { /* already gone */ }
      this._socket.end();
      this._finish();
      return;
    }
    if (op === 0x9) { // protocol ping → pong with the same payload
      if (!this.closed && !this._socket.destroyed) {
        try { this._socket.write(encodeFrame(0xA, payload)); } catch { /* already gone */ }
      }
      return;
    }
    if (op === 0xA) return; // pong: no liveness bookkeeping in this host
    if (op === 0x1 || op === 0x2) {
      if (this._fragOp !== -1) { this._fail(1002); return; } // new message mid-fragment
      if (fin) { this._deliver(payload); return; }
      this._fragOp = op;
      this._frags = [payload];
      this._fragBytes = payload.length;
      return;
    }
    if (op === 0x0) { // continuation
      if (this._fragOp === -1) { this._fail(1002); return; }
      this._frags.push(payload);
      this._fragBytes += payload.length;
      if (this._fragBytes > MAX_PAYLOAD) { this._fail(1009); return; }
      if (fin) {
        const whole = Buffer.concat(this._frags);
        this._fragOp = -1;
        this._frags = [];
        this._fragBytes = 0;
        this._deliver(whole);
      }
      return;
    }
    this._fail(1002); // reserved opcodes
  }

  _deliver(payload) {
    if (this.onMessage) {
      try { this.onMessage(payload.toString('utf8')); } catch { /* a consumer must not take the host down */ }
    }
  }
}

function encodeFrame(op, payload) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = 0x80 | op; // FIN + opcode; server frames are never masked
  return Buffer.concat([header, payload]);
}

// Complete the opening handshake on a raw socket whose upgrade the
// worker has already authorized (the host dispatches the request
// through the worker first — see server/node-host.js). Returns the
// live RelayWebSocket, or null (socket destroyed) when the request
// carries no usable key.
export function completeWsUpgrade(req, socket, head) {
  const key = req.headers['sec-websocket-key'];
  if (typeof key !== 'string' || !key) { socket.destroy(); return null; }
  socket.setTimeout(0);
  socket.setNoDelay(true);
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${wsAcceptKey(key)}\r\n` +
    '\r\n',
  );
  return new RelayWebSocket(socket, head);
}

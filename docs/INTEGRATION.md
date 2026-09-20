# Breeze — Integration Runbook (wiring the tested crypto into the live app)

> The tested reference modules in `src/crypto/` (+ the worker changes already
> shipped) implement the security backlog. This runbook is the **turnkey guide**
> to wire them into the live `index.html` / `_worker.js` runtime. Every step here
> changes browser-executed code, so each needs a **manual two-device test**
> (checklists below) — that's why these were not auto-applied.
>
> Principle: **the `src/crypto/` modules are the source of truth.** index.html
> should consume them, not keep a divergent inline copy. Roll out behind `CONFIG`
> flags with a v4 read path so deployed clients keep working.
> Line numbers are approximate (one ~13k-line file).

## 0. Make index.html consume the ESM modules

Two options (pick one):

- **(A) Runtime import (no build).** Add near the top of the app bootstrap:
  ```html
  <script type="module">
    import { createRatchet } from './src/crypto/ratchet.js';
    import { createGroup }   from './src/crypto/group.js';
    import { createAtRest }  from './src/crypto/atrest.js';
    import { createFranking } from './src/crypto/franking.js';
    window.__breezeCrypto = { createRatchet, createGroup, createAtRest, createFranking };
  </script>
  ```
  The classic inline `<script>` (line 1213) then reads `window.__breezeCrypto`.
  Caveat: ESM is deferred, so guard first use (the app already `await`s identity
  setup). Packaging is **already handled**: Pages serves the repo tree directly, the
  `zip` target includes them via `git ls-files`, and `build.sh`'s `copy_web` now ships
  `src/crypto/` (path preserved) into Electron/mobile builds. Remaining: add the module
  paths to the **SW precache** list in `sw.js` (browser-gated) when wiring the import.
- **(B) Build-time inline.** A small `scripts/inline-crypto.mjs` strips the
  `export`/`import` lines and injects the module bodies into index.html between
  marker comments. Keeps the single-file deploy; adds a build step (tension with
  "no build"). Prefer (A) unless single-file is a hard requirement.

Update `validate.sh`/CI extractor if a second `<script>` tag is added (it greps the
first literal `<script>` — keep app logic there; see `.github/workflows/ci.yml`).

## 1. N1 — fix the DH-ratchet `Nr` bug (do first; tiny, high-value)

`index.html` `dhRatchetStep` (~line 4547-4565) sets `sess.sendCounter = 0` but
**not** `sess.recvCounter`. A DH step starts a new receiving chain, so the first
inbound message (counter 1) is misread as a replay. Add:
```js
sess.sendCounter = 0;
sess.recvCounter = 0;   // ← add: new receiving chain resets Nr (see CRYPTO-SPEC §9 N1)
```
Module proof: `tests/x3dh.test.js` "full session establishment" fails without it.
**Test:** two devices, A↔B several back-and-forth messages crossing ≥2 ratchet
turns; all decrypt. (Today the 3rd direction-flip can silently drop.)

## 2. G4 — port `encryptFor`/`decryptFrom` onto the module + drop compression (I15)

- Replace the inline ratchet body (`encryptFor` ~4594, `decryptFrom` ~4646) with
  calls into a `createRatchet({...})` instance (DI: pass `subtle`, the session
  store via `getSession`/`saveSession`, `_hasX25519`, `CONFIG`). Keep the v3/v4
  read path in `decryptFrom`.
- **Drop compression (I15):** delete the `CompressionStream('deflate-raw')` block
  (~4606-4618) so bodies aren't compressed before AES-GCM (CRIME/BREACH class);
  keep `_unpadAndDecompress` for reading legacy compressed messages. The module's
  `frameEncrypt` defaults `compressMin: Infinity` (off) — match that.
- Adopt the module's **key commitment** (`cm`) and **skipped-key TTL** automatically
  by using `ratchetEncrypt`/`ratchetDecrypt`.
- Flag: `CONFIG.RATCHET_MODULE = true`.
**Test:** A↔B text/emoji/empty/long messages; out-of-order delivery; a legacy
peer (old build) still interoperates; verify no `compressed` flag is set on new
messages.

## 3. G1 + G2(client) — authenticated X3DH

- **Upload (client, ~line 4451-4465):** generate SPK; **sign `spkPub`** with the
  Ed25519 `_signingKey` (~3833-3853) → `signedPreKeySig`; **persist SPK and OPK
  private keys** in IDB (today discarded); send
  `{ userId, identityKey, edIdentityKey: <Ed25519 pub>, signedPreKey, signedPreKeySig, oneTimePreKeys }`.
  Worker already verifies (shipped G2) and returns these on fetch.
- **Init (client, replace `initSession` ~4569):** fetch peer bundle via
  `/api/prekey/fetch`; **verify `signedPreKeySig`** against the peer's
  `edIdentityKey` (`R.verifySPK`) — on failure, abort + show the existing
  key-change/MITM banner (~4745); else `R.x3dhInitiator(...)` →
  `R.initiatorSession(SK, spkPub)`. Responder side uses `R.x3dhResponder` +
  `R.responderSession`. First message carries EK + consumed-OPK index.
- **Negotiation (N3):** advertise `x3dh:'v5'` in presence + bundle; initiator uses
  v5 only when the peer advertises it and the signature verifies, else falls back
  to the current path. Flag: `CONFIG.X3DH_V5_ENABLED`.
**Test:** new contact first-message works; **tamper test** — a MITM/modified
bundle must trigger the banner and NOT establish a session; a v4-only peer still
connects via fallback.

## 4. G3(client) — group epoch rotation

- Poll `/api/group/info` `epoch` (shipped). On a kick the admin client calls
  `/api/group/kick` (returns new epoch); **all remaining members**, on seeing a
  higher epoch, run `G.rotateEpoch(senderKey)` and **redistribute** the fresh
  sender key to remaining members via the 1:1 channel (`distributeSenderKey`,
  ~5032). Port the group functions (~4980-5041) onto `src/crypto/group.js`
  (`encryptGroupMsg`/`decryptGroupMsg`/`receiverFrom`), which also adds per-message
  **signatures** (N2) and **commitment**.
- Flag: `CONFIG.GROUP_RATCHET_V5`. Keep the `v:3` group read path.
**Test:** 3 members; kick one; the kicked device can no longer read new messages
while the other two can; pre-kick history still readable by those who had it.

## 5. G5 — at-rest key wrapping (opt-in app-lock)

- In `loadIdentity` (~4404) and key storage (~4444 identity, ~3852 signing):
  branch on a `kdf` marker. If app-lock enabled, wrap private JWKs with
  `createAtRest().wrapJWK(jwk, passphrase)`; on load prompt for the passphrase and
  `unwrapJWK`. On enable, `migrate` the existing plaintext records and `zeroBuffer`
  the plaintext. Default no-passphrase path unchanged.
- Optional: derive the passphrase via **WebAuthn/passkey PRF** for a device unlock.
**Test:** enable app-lock → reload requires passphrase, keys load, messaging works;
wrong passphrase rejected; existing users (plaintext) migrate transparently on enable.

## 6. I17(client) — franking send + report UI

- **Send:** compute `F.commit(plaintext)` → `{commitment, opening}`; POST
  `/api/abuse/record { frankId, commitment }` (frankId = the message id) — shipped;
  include `opening` **inside** the E2E ciphertext so only the recipient gets it.
- **Report:** a "Report message" action POSTs `/api/abuse/report { frankId, message, opening }`
  (shipped); show the relay's `verified` result.
**Test:** send A→B; B reports → relay returns `verified:true`; B editing the text
before reporting → `FRANK_MISMATCH`.

## 7. N3 — version negotiation (use negotiate.js before session init)

`src/crypto/negotiate.js` provides `advertise()`, `parsePeerCaps()`, and
`negotiate()`. Wire it so the initiator checks peer capabilities before choosing
X3DH v4 vs v5 and group-v4 vs group-v5.

```js
import { advertise, parsePeerCaps, negotiate } from './src/crypto/negotiate.js';
window.__breezeNegotiate = { advertise, parsePeerCaps, negotiate };
```

- **Advertise:** include `advertise()` in the presence heartbeat and prekey
  bundle so peers know which versions are supported.
- **Init:** when fetching a bundle, call `parsePeerCaps(bundle)` then
  `negotiate(localCaps, peerCaps)` → use `result.useX3dhV5` to pick the code
  path; use `result.useGroupV5` to pick group protocol.
- **Rule:** feature enabled only when BOTH sides advertise it — the library
  enforces this (AND rule). Never coerce the peer to a weaker path.

Flag: integrated into `CONFIG.X3DH_V5_ENABLED` / `CONFIG.GROUP_RATCHET_V5`.
**Test:** A (v5 capable) ↔ B (v4 only): A falls back to v4. A ↔ A: v5 used.

## 8. I11 — key-transparency rollover detection (use ktlog.js at prekey fetch)

`src/crypto/ktlog.js` exposes `hashIK`, `parseLog`, `checkRollover`, `mergeLog`.
After fetching a peer's prekey bundle (which now includes `bundle.keyHistory`):

```js
import { checkRollover, mergeLog } from './src/crypto/ktlog.js';
window.__breezeKtlog = { checkRollover, mergeLog };
```

In the `initSession` / `initSessionV5` path (after bundle fetch):

```js
const storedIK   = await dbGet('contacts', peerId + ':ik'); // null on first contact
const rollover   = await checkRollover(crypto.subtle, storedIK, bundle.keyHistory);
if (rollover.status === 'rolled') {
  // Show key-change banner (reuse the existing MITM banner ~line 4745)
  showKeyChangeBanner(peerId, rollover);
  if (!rollover.storedSeenInHistory) return; // hard abort on unseen rollover
}
// On 'ok' or 'new': store/update the IK
await dbPut('contacts', peerId + ':ik', bundle.identityKey);
// Merge and persist the log
const merged = mergeLog(existingLog, bundle.keyHistory);
await dbPut('contacts', peerId + ':ktlog', merged);
```

**Test:** first contact — status 'new', IK stored; same peer, same IK — status 'ok';
tamper the bundle to a different key — status 'rolled', banner shown, session aborted.

## 9. C12 — push notification subscription setup (client side)

The worker (`sendPushToUser`) now encrypts every notification via RFC 8291. The
client side only needs to register the subscription and pass VAPID public key:

```js
// VAPID public key from worker env (returned in /api/health { vapidPublicKey })
const reg  = await navigator.serviceWorker.ready;
const sub  = await reg.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
});
// POST subscription to worker
await postAPIRaw('/api/push/subscribe', { userId: _myId, subscription: sub.toJSON() });
```

The SW needs a `push` event handler to show the notification:

```js
// In sw.js:
self.addEventListener('push', e => {
  const data = e.data?.json() ?? {};
  e.waitUntil(self.registration.showNotification(data.title ?? 'Breeze', {
    body: data.body ?? 'New message',
    icon: '/icon-192.png',
    tag: data.tag ?? 'breeze-msg',
    renotify: true,
  }));
});
```

**Test:** subscribe from two devices; send a message from device B to device A
while A is backgrounded → A's SW fires a push notification with no plaintext
visible to FCM (verify via browser DevTools → Application → Push Messages).

## Rollout & rollback
- Each feature behind a `CONFIG.*` flag; all read paths keep v3/v4 compatibility.
- Disable a flag to stop emitting the new format while still reading it.
- Worker changes (G2/G3/franking/push-encrypt) are already live and backward-compatible.

## Cross-reference
- What/why per item: `docs/IMPROVEMENTS.md` (I1–I20), `docs/ROADMAP.md` (priority).
- Exact wire formats + status: `docs/CRYPTO-SPEC.md` (§2–§6a, gaps §8–§9).
- Tested behavior to mirror: `src/crypto/*.js` + `tests/*` (402 tests, 12 suites).

## Module helpers that make the port turnkey (call these — don't hand-roll)

The wire formats and the security-critical sequencing now live in the modules as the
single source of truth, so each port step is a function call rather than a re-implementation:

- **§3 X3DH (I1):** `R.initiatorHandshake({ myIdentity, bundle, firstMessage })` →
  `{ session, wire }` and `R.responderHandshake({ myKeys, wire, opkResolver })` →
  `{ session, plaintext }`. `initiatorHandshake` **throws** on a bad/absent pre-key
  signature, so the MITM check can't be skipped. Lower-level pieces
  (`buildPreKeyMessage`/`parsePreKeyMessage`, `x3dhInitiator/Responder`) remain exported.
- **§4 group (G3):** `G.buildSenderKeyDistribution(senderKey)` /
  `G.parseSenderKeyDistribution(wire)` for the `distributeSenderKey` channel (only the
  public epoch-sign key crosses the wire; the joiner's counter enforces FS).
- **§5 at-rest (G5):** `A.isWrapped(record)` + `A.loadKey(record, passphrase?)`
  (`loadKey` throws when a wrapped record is loaded without a passphrase → prompt signal).

## Security notes for browser port

**AEAD desync fix (important when porting G4):** In `src/crypto/ratchet.js` and
`group.js`, all chain-state advances (`recvChainKey`, `recvCounter`, `skipped` key
deletion) now happen **after** a successful AES-GCM auth. The old index.html inline
copy does NOT have this fix — an on-path attacker injecting a message with a corrupt
ciphertext permanently desyncs the receive chain until the session is renegotiated.
Apply the fix when porting (move state advance to after `subtle.decrypt` succeeds).

**N1 Nr reset (G4):** `dhRatchetStep` in index.html resets only `sendCounter`; it
must also reset `recvCounter` = 0. The module is fixed; apply when porting.

**Key commitment (G4):** Do not skip the `cm` check for back-compat — check it for
v5 messages and skip only when `cm` is absent (legacy). This is the fix for
"invisible salamanders" (I16).

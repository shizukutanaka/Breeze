# Breeze — プロダクト分析(長所・短所・不足機能)

> 2026-06-10 実施。コードベース全体(client 13,116 行 / worker ~2,100 行 / SW 145 行、
> 全 35 API エンドポイント、`src/crypto/` 9 モジュール、テスト 486 件)の監査に基づく。
> 英語版の詳細バックログは `docs/IMPROVEMENTS.md` / `docs/ROADMAP.md` を参照。

---

## 長所(Strengths)

1. **ゼロ依存・ビルド不要アーキテクチャ** — npm 依存ゼロ、フレームワークなし、単一
   HTML。サプライチェーン攻撃面が実質ゼロで、`view-source` で全コードを監査できる。
   Cloudflare Pages へ 60 秒でデプロイ可能、運用費 $0。
2. **Signal 級の暗号プロトコル(モジュール側)** — Double Ratchet、認証付き X3DH v5
   (SPK の Ed25519 署名検証)、グループ送信鍵のハッシュラチェット(前方秘匿性)+
   エポックローテーション(追放後秘匿性)、key commitment(invisible-salamanders 対策)、
   メッセージフランキング(プレーンテキストエスクローなしの通報)、改ざん検知可能な
   鍵透明性ログ、sealed sender。`tests/` で 486 件の自動テスト + KAT(RFC/NIST ベクタ)。
3. **デュアルパス配送** — P2P WebRTC DataChannel(即時)+ Sealed Sender リレー
   (確実)。ハートビート + ICE restart、5 分グレース + ACK でクラッシュ耐性あり。
4. **無料枠に最適化されたバックエンド** — KV 書き込みを 90% 以上削減する
   in-memory キャッシュ層(presence / dedup / rate-limit)、PoW スパム対策、
   SSRF ガード(リダイレクト再検証付き)、全 KV 入力の sanitize + 型ガード。
5. **収益化内蔵** — Stripe サブスクリプション(Lite/Plus/Pro)、Webhook 冪等性、
   顧客ポータル。
6. **マルチプラットフォーム** — PWA(オフライン + Web Push RFC 8291 暗号化)、
   Electron、Tauri、Capacitor。i18n 420 キー(EN+JA)+ 924 言語の遅延ロード翻訳。

## 短所(Weaknesses)

1. **index.html 13K 行の単一ファイル** — 設計上の選択(ビルドレス)の裏返しだが、
   レビュー・追跡が困難。テスト済みの `src/crypto/` モジュールと index.html 内の
   インライン実装が**二重管理**状態(配線はブラウザ 2 台検証ゲートで保留中)。
2. **ポーリングアーキテクチャ** — `/msg/poll` + `/sealed/poll` の定期ポーリングは
   リアルタイム性と KV 予算のトレードオフ。Durable Objects + WebSocket(ROADMAP C10)
   で解消可能だが大型改修。
3. **マルチデバイス未対応** — 同一アカウントの複数端末同期なし(Threema/Matrix 比)。
4. **ポスト量子未対応** — PQXDH / ML-KEM ハイブリッドなし(Signal/iMessage 比)。
5. **ネットワーク層の匿名性なし** — リレーと WebRTC ピアに IP が見える(Session/Briar 比)。
   `relay-only` モードの既定化(I19)は未実装。
6. **ブラウザ検証ゲートで停止中の修正** — N1(index.html `dhRatchetStep` の
   recvCounter リセット)、CSP `require-trusted-types-for`、SW への crypto モジュール
   プリキャッシュ等。

## 不足機能(Missing features)

### 今回実装したもの(2026-06-10、ワーカー側・テスト済み)

| # | 機能 | 問題 | 実装 |
|---|------|------|------|
| 1 | **サーバ側アカウント削除** | プライバシーポリシーは「/wipe で全データ削除可」と謳うが、実際はローカルのみ削除。サーバ KV には inbox/sealed(7日)、prekey/push(30日)、ktlog/**backup(90日)**、**slots(無期限)** が残存 — GDPR 第17条(消去権)のギャップ | `/api/account/delete` — Ed25519 署名認証(`breeze-account-delete:{userId}:{ts}` ±5分)。全 userId キーの即時消去 + pub 一致検証付きエイリアス解放。鍵未登録アカウントは 403(なりすまし削除の防止) |
| 2 | **グループ自主退出** | kick(管理者専用)のみ。退出してもメンバー登録(id/pub/名前)が招待トークン保持者全員から 30 日間読める | `/api/group/leave` — 自己削除 + エポックバンプ(自主退出にも PCS 適用)。作成者は退出不可(`CREATOR_CANNOT_LEAVE`) |
| 3 | **グループ削除** | create/join/info/kick はあるが delete がなく、放棄グループが 30 日 KV に残存 | `/api/group/delete` — 作成者限定 |
| 4 | **消えるメッセージのサーバ強制失効** | `disappearAt`(送信時刻+タイマーの絶対時刻)はクライアント描画時のみフィルタ。未配送の期限切れ暗号文が inbox TTL の最大 7 日間 KV に残存 | `/msg/poll` で期限切れを配送・保持の両方から除外(失効後最初のポーリングでパージ) |
| 5 | **メッセージ ID** | 同一ミリ秒に 2 通格納されると ts のみのカーソルが 2 通目を取りこぼす | `/msg/send` でサーバ側 12-hex ID を付与(将来の排他カーソルの土台。現行クライアントは未知フィールドを無視するため無害) |
| 6 | **複数管理者グループ** | `admins` 配列は kick/leave で維持(削除時にフィルタ)されるのに、任命 API がなく kick も無視 — 作成者単一障害点の「作りかけ」機能 | `/api/group/admin`(作成者限定の昇格/降格)。kick は admins 対応に(管理者は一般メンバーを kick 可、管理者同士は不可・作成者のみ)。info は `creatorId`+`admins` を返す |

### 未実装(優先度順・理由つき)

1. **クライアント側の配線**(L・ブラウザ 2 台検証必須)— `/wipe` から
   `/api/account/delete` 呼び出し、グループ UI から leave/delete、`src/crypto/`
   モジュール統合。**上記 1–3 は新エンドポイントのため現行クライアントに影響ゼロ**。
2. **Durable Objects + WebSocket push**(L)— ポーリング廃止、レート制限の
   isolate 跨ぎ精度向上(ROADMAP C10)。
3. **マルチデバイス同期**(L)— デバイスグループ鍵(Threema Ibex 方式)。
4. **PQXDH ハイブリッド**(M–L)— ML-KEM は WebCrypto 未対応のため WASM が必要 =
   ビルドレス制約と衝突。Workers 側は `crypto.subtle` 拡張待ち。
5. **既読レシートのジッタ/オプトアウト**(S–M、クライアント側)— sealed sender の
   タイミング非匿名化対策(NDSS'21)。
6. **Web アプリ完全性検証**(M)— Code Verify 方式の SW ハッシュピン(ROADMAP C8)。
   ホスティング事業者による悪意ある JS 配信が Web E2EE 最大の残存脅威。
7. **グループ所有権の移譲**(S)— 現状 `creatorId` は不変。作成者がアカウント削除する
   と作成者限定操作(delete/admin 管理)が不能になる。複数管理者で緩和されたが移譲 API は未実装。

---

## 検証

- `npm test` — 13 スイート / 496 件全成功(本セッションで +24 件:アカウント削除/
  グループ leave・delete/disappearAt パージ/メッセージ ID で +14、複数管理者で +10)
- `./validate.sh` — 33/36(ベースライン維持、⚠3 は既知の許容警告)
- `node -c _worker.js && node -c sw.js` — 構文 OK
- 新エンドポイント(account/delete・group/leave・group/delete・group/admin)はすべて
  追加(additive)のため、既存クライアントとの後方互換性はワイヤ変更なしで保たれる
  (disappearAt パージのみ挙動変更だが、クライアントは同条件で描画拒否済みのため
  観測可能な差分なし。kick 認可拡張も従来の作成者経路は不変)

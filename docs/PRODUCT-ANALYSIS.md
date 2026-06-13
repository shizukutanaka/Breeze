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
| 7 | **グループ所有権の移譲** | `creatorId` が不変。作成者がアカウント削除すると delete/admin 管理が永久に不能(複数管理者で緩和したが移譲は別途必要) | `/api/group/transfer`(作成者限定)。creator* フィールドが新所有者に追従、旧作成者は admin として残留、新所有者は admins から除外(権限は暗黙化) |
| 8 | **グループ改名** | 名前が `create()` で固定され編集手段なし(CRUD の "update" 動詞が欠落) | `/api/group/rename`(作成者または管理者)。create と同一サニタイズ(≤50字)。空名は拒否、超過は切詰 |
| 9 | **アカウント削除のグループ残存** | (項目1の穴)逆引きインデックスがないため、削除済みアカウントの id/pub/名前が参加グループに 30 日残存 | `/api/account/delete` に任意の `groups:[token]`(最大50)。作成者→グループごと削除、メンバー→除去+エポックバンプ(自己削除は署名で認証済み) |
| 10 | **課金エンドポイントのテスト皆無** | purchase/portal が 0 カバレッジ(収益クリティカル) | fetch スタブで11テスト追加。slot マッピング(lite=2/plus=4/pro=999)・未設定503・不正入力400・顧客なし404・Stripe失敗500 を固定 |
| 11 | **グループ能力ネゴシエーションの片肺** | `negotiate.js` の `negotiateGroup`(能力フロア計算)は存在・テスト済みだが、リレーがメンバー caps を出さず実質デッドコード | create/join が任意の `caps` を保存、info が返却。1回の info でフロア計算可能に(presence の N 回叩きが不要) |
| 12 | **グループ caps の陳腐化** | (項目11の続き)caps が join 時に固定。クライアント更新後もフロアを上げられない | `handleGroupJoin` の既存メンバー分岐(従来 no-op)が pub/name/caps をリフレッシュ。再接続時の再 join で自然に伝播、変更時のみ KV 書込、capless 再 join は既存 caps を消さない |
| 13 | **エイリアス解決の N+1 問題** | `/api/alias/get` が単一エイリアスのみ受け付けるため、コンタクトリスト(N人)の表示に N 回のラウンドトリップが発生 — 無料枠 KV 読み取り(1日10万回)の主要消費源 | `{ aliases: [...] }` バッチモードを追加。最大50件を1リクエストで解決、未登録は `null` として返却。単一エイリアスモード(後方互換)は変更なし |
| 14 | **署名済みプリキー(SPK)の無言失効** | `replenishOTP` フラグで OTP 枯渇は警告するが、SPK(KV TTL 30日)が期限切れになるとユーザが連絡不能になる問題は無警告 | `/api/prekey/fetch` で `uploadedAt` が 25 日超の場合に `replenishSPK: true` を返却。5 日間の再アップロードウィンドウを確保 |
| 15 | **健康エンドポイントの機能検出リスト陳腐化** | `batch-alias`・`group-caps` が実装済みにも関わらず `/api/health` の `capabilities` リストに未記載 — クライアントが機能を検出できない | `capabilities` 配列に `batch-alias` と `group-caps` を追加 |
| 16 | **鍵透明性ログの閲覧に OTP 消費が必要** | KT ログ(`{ ts, h, c }` チェーン)は `/api/prekey/fetch` の中に埋め込まれているため、ピアのログ監査に不可逆な OTP 消費が伴う | `/api/ktlog/get` 独立エンドポイントを追加。公開データ(IK ハッシュのハッシュチェーン)のため認証不要、OTP 消費なし |
| 17 | **OGP HTML バッファリングの上限バイパス** | `while (html.length < 32768)` はループ先頭のチェックのため、サーバが 1 MB チャンクを 1 回で送信すると 1 MB 全体がバッファされてから上限チェックが通る | チャンク追記後に即 `.slice(0, 32768)` で切り詰め。どのチャンクサイズでも上限が守られる |
| 18 | **プッシュ通知の解除手段なし** | `/api/push/subscribe` で登録したサブスクリプションは 30 日の KV TTL まで削除不能。ブラウザから通知を無効化しても KV 側は残存し続ける | `/api/push/unsubscribe` を追加。`{ userId, endpoint }` で特定のデバイスのサブスクリプションを即時削除。`removed: 0` で冪等 |
| 19 | **プリキー取得の N+1 問題** | グループ参加時に N 人分のセッション確立で `/api/prekey/fetch` を N 回呼ぶ必要がある — 往復 N 回 + N OTP 消費 | `/api/prekey/fetch/batch` を追加。最大10件を1リクエストで解決。OTP は各ユーザ分消費(レイテンシ最適化) |
| 20 | **OTP/SPK 残量をオーナー自身が確認する手段なし** | `replenishOTP`/`replenishSPK` は `/api/prekey/fetch` でのみ返され、OTP を不可逆に消費する。IDB 消失後に自分のプリキー状態を確認できない | `/api/prekey/status` を追加。OTP を消費せず `{ otpCount, uploadedAt, replenishOTP, replenishSPK }` を返却 |

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

---

## 検証

- `npm test` — 13 スイート / 544 件全成功(本セッションで +57 件:アカウント削除/
  グループ leave・delete/disappearAt パージ/メッセージ ID で +14、複数管理者で +10、
  所有権移譲で +6、改名で +4、アカウント削除のグループ清掃で +2、health capabilities
  +1、課金エンドポイントで +11、グループ能力ネゴシエーションで +3、caps リフレッシュで +2、
  バッチエイリアス解決で +2、replenishSPK + capabilities更新で +2、ktlog-get + OGP cap で +4、push unsubscribe で +4、prekey batch fetch で +3、prekey status で +4)
- `./validate.sh` — 33/36(ベースライン維持、⚠3 は既知の許容警告)
- `node -c _worker.js && node -c sw.js` — 構文 OK
- 新エンドポイント(account/delete・group/leave・group/delete・group/admin・
  group/transfer・group/rename)はすべて追加(additive)のため、既存クライアントとの
  後方互換性はワイヤ変更なしで保たれる(disappearAt パージのみ挙動変更だが、クライアントは
  同条件で描画拒否済みのため観測可能な差分なし。kick 認可拡張も従来の作成者経路は不変)。
  グループ操作は create/join/info/rename/kick/admin/transfer/leave/delete で
  CRUD ライフサイクル完成。

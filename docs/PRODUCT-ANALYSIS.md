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
| 21 | **通報が KV に死蔵される** | 検証済み通報(`report:{frankId}`)が 90 日間 KV に格納されるだけでオペレーターへの通知がなく、モデレーションの起点がない | `ABUSE_WEBHOOK_URL` env var サポートを追加。検証済み通報時に `{ type, frankId, messageLen, at }` を非同期 POST(メッセージ内容は含まない) |
| 22 | **エイリアスをアカウント削除なしで解放できない** | バニティ `@handle` を解放・再割り当てする唯一の方法がアカウント全削除。ユーザがアイデンティティ・連絡先・メッセージ・課金記録を残したまま `@handle` だけ変えることができない | `/api/alias/delete` を追加。Ed25519 署名認証(challenge `breeze-alias-delete:{alias}:{ts}`)。所有権二重確認(`alias.pub == identityKey`)でサードパーティ squat を防止。`{ ok, removed }` で冪等 |
| 23 | **バッチ presence check が常に KV を叩く / sealed send dedup キー衝突** | (1) `{ ids:[...], check:true }` のバッチ path が in-memory `_presenceCache` をスキップして全ユーザを KV 読み取り → 10 人グループで 5 秒ごとに ~120 KV reads/min の浪費。単一 check は正しくキャッシュを先読みしていた。(2) sealed send の dedup キーが `${to}:${envelope.slice(0,32)}` でエンベロープ長を含まず、異なる 2 メッセージが 32 文字プレフィックス一致で偽 dedup → 片方が無音でドロップされる恐れ | (1) バッチ path でも `_presenceCache.get(\`presence:${cid}:data\`)` をキャッシュヒット先行、ミス時のみ KV フォールバック。(2) dedup キーを `${to}:${envelope.length}:${envelope.slice(0,32)}` に変更して `handleMsgSend` と統一 |
| 24 | **OTP 配列の非 string エントリがプリキースロットを永久消費する** | `JSON.stringify(null)` = `'null'` (4 chars) がサイズチェックを通過して KV に保存される。取得時 `safeJsonParse('null')` = `null` が返り、`parsed !== null` ガードでキーとして使えないにも関わらずスロットが削除 → 無音でスロット浪費。カウントも配列長で記録されるため null 含む場合に最大インデックスと一致しない | アップロード時に `typeof oneTimePreKeys[i] !== 'string'` の型ガードを追加してスキップ。カウントは最後の有効エントリのインデックス +1 に修正。有効エントリが 0 件の場合はカウントキー自体を書かない |
| 25 | **全エラーレスポンスの `code` フィールド欠落(0 件残存)** | グループ系全エンドポイント、push 購読、フランキング、エイリアス、sealed send、プリキーアップロード、backup、drop、translate、AI、リクエスト共通バリデーションの全エラーに `code` がなく、クライアントが HTTP ステータスかエラーメッセージ文字列のパースに頼らざるを得なかった | `MISSING_FIELDS`/`INVALID_ENDPOINT`/`UNTRUSTED_ENDPOINT`/`INVALID_FIELD`/`INVALID_ALIAS`/`INVALID_NAME`/`GROUP_FULL`/`PAYLOAD_TOO_LARGE`/`FIELD_TOO_LARGE`/`INVALID_ACTION`/`KV_NOT_CONFIGURED`/`PRICE_NOT_CONFIGURED`/`SERVER_ERROR` など一斉追加。残 0 件(全エラー応答にコード付与完了) |
| 38 | **アカウント削除が cust:{customerId} 逆引きマッピングを消し残す — ソクラテス完全性監査** | item 36 が「全ユーザデータを削除」と主張した `handleAccountDelete` を、userId キーの全 KV 名前空間と照合すると 1 件漏れ。`slots:${userId}` を中の `customerId` を読まずに削除するため、逆引き `cust:{customerId} → userId`(Stripe 支払い識別子と userId のリンク)が削除後も残存(item 1 の GDPR 17条の意図に反する残留データ)。metadata.userId 欠如のサブスク webhook が削除済みアカウントをこの経由で解決しうる | 削除前に `slots:${userId}` を読み、`customerId` があれば `cust:${customerId}` も `kvDel` し `erased` に `'cust'` を報告。自アカウントの billing レコード由来の customerId のみ対象。注記:Breeze 作成サブスクは metadata にも userId を持つため、削除前にポータルで解約推奨(本修正はリレー側リンクのみ除去)。テスト+2(customerId あり→cust 消去、free tier→cust 不在かつ無関係 cust 維持)、ミューテーション検証済み |
| 37 | **Stripe Webhook リプレイウィンドウの回帰テスト欠如 — ソクラテスカバレッジ監査** | `verifyStripeSignature` はコメントで「5分許容」のリプレイウィンドウ(line 897)を謳うが、唯一のテストは `t=1,v1=deadbeef` で署名も不正なため、鮮度拒否と署名拒否を区別できない。鮮度ガードに独立した回帰カバレッジが皆無で、削除しても全テスト緑のまま。※本ラウンドは4つのセキュリティ主張(Stripe 定数時間 double-HMAC・消えるメッセージ purge・OGP リダイレクト再検証・CORS origin reflection)をソクラテス検証し全て正確と確認、コード修正は不要と判断 | テスト追加(+3、コードは無変更):有効署名+10分前タイムスタンプ→400(課金副作用なし)、有効署名+遠未来→400、同一イベント+鮮度内→200(タイムスタンプのみを変数化する対照)。ミューテーション検証:`> 300` チェックを無効化すると拒否2件が落ち対照1件は通る→ガードを確実に固定 |
| 36 | **通報 Webhook の同一アイソレート競合 + 過大主張コメント — ソクラテス追監査** | item 35 のコメントは check-before-fire で「frankId 冪等」が「真になる」と主張したが、KV は atomic CAS を持たず結果整合性のため、2 つの並行通報が共に `report:${frankId}` を不在と読んで両方 Webhook を発火しうる。コメントが過大主張 | `_msgDedup`/`_sealedDedup` と同じ同期 in-memory dedup(`globalThis._frankWebhookFired`)を追加。`.has()`/`.set()` 間に await なし → 暖機済みアイソレートへの並行再送(主な重複源)はイベントループで直列化され初回のみ発火。クロスアイソレート競合は KV 由来で残存(Durable Object 必要・範囲外)とコメントに正直に明記、payload の `frankId` で運用側 dedup を想定。※agent 提案の `at === Date.now()` fix はソクラテス却下(書込→読戻し間で時刻が進むため不成立)。`handleAccountPurchase`(plan whitelist)・`handlePreKeyFetchBatch`(cap 10)は再検証で既存正常を確認 |
| 35 | **通報 Webhook の冪等性が半分しか実装されていない(Webhook 増幅) — ソクラテス監査** | `handleAbuseReport` のコメントは「frankId で冪等」と謳うが、冪等なのは KV 書込のみで、モデレーション Webhook は**毎回**発火。franking の opening 鍵 `Kf` は E2E ペイロードで受信者に届くため、受信者(または再試行クライアント)が同じ `(frankId, message, opening)` を再 POST 可能。各再送が `ABUSE_WEBHOOK_URL` を再発火(10/分のレート制限まで)し、1 件の通報のモデレーションキューが重複で溢れる | 発火前に `report:${frankId}` を確認。Webhook と report スタンプは初回のみ発火、再送は `{ verified: true, duplicate: true }` を返し Webhook 非発火。文書化された冪等性が Webhook にも適用される。加えて従来未検査だった `report:${frankId}` 書込に `STORE_FAILED` 500 を追加(項目33/34 の sweep が見落とした 1 箇所)。※本ラウンドでは提案された 2 件の「クライアント制御タイムスタンプ」指摘(presence `p.at`、signal `ts`)をソクラテス問答で論駁 — 両者ともサーバ側 `Date.now()` 設定でクライアント非制御のため検証不要 |
| 34 | **グループ削除・エイリアス削除・Dead Drop 一回限り読取の kvDel 失敗がサイレント成功** | `handleGroupDelete` / `handleAliasDelete` の `kvDel` が失敗しても `{ ok: true }` を返す。クライアントはグループ/エイリアスが消えたと誤認するが KV には残存。`handleDropRead` は read→delete→return 順のため、delete 失敗時に暗号文を漏洩しつつ Drop が KV に残留し、一回限り性質が破れる | `handleGroupDelete`/`handleAliasDelete`: `kvDel` 失敗で `STORE_FAILED` 500。`handleDropRead`: OTP 項目28と同じ delete-first パターンに変更。delete 失敗→`DEL_FAILED` 500(暗号文未漏洩、Drop 保持)、成功後のみ暗号文を返却 |
| 33 | **グループ操作・プリキー・バックアップの KV 書込失敗がサイレント成功(セキュリティ回帰)** | `handleGroupKick`/`handleGroupLeave` が `kvPut` 失敗時に `{ ok: true }` を返す。kick/leave がサーバ側に永続化されないと、対象メンバーは古い sender-key エポックで新メッセージを復号可能なまま — I3 PCS(後方秘匿性)の約束が破れる。`handleGroupCreate`/`handleGroupJoin`/`handleGroupAdmin`/`handleGroupTransfer`/`handleGroupRename`、`handlePreKeyUpload`、`handleBackupUpload`、`handleAliasSet` も同様に成功を誤報 | 各関数の末端 `kvPut` の戻り値を確認し、失敗時は `STORE_FAILED` 500 を返す。成功時のみ `ok: true` を返す。合計 10 箇所修正 |
| 32 | **Stripe Webhook: KV 書込失敗をサイレント成功として返す(課金消失)** | `handleWebhook` の `checkout.session.completed` / `subscription.deleted` / `subscription.updated` ハンドラが `kvPut` の戻り値を検査しない。Cloudflare KV が一時的に利用不可の場合、スロット付与が行われないまま「処理済み」マーク(line 839)が書かれる → Stripe が再試行しないため課金付与が永久に失われる | 各 billing `kvPut` の戻り値を確認。失敗時は `500` を返して「処理済み」書込をスキップ → Stripe が通常のバックオフで再試行。幂等キーは 500 時に書かれないため再試行が正常に再実行される |
| 31 | **Dead Drop の ID 衝突レース + unknown IP レート制限バイパス** | (1) `handleDropCreate` はクライアント提供の `id` を KV に書き込む前に `kvGet` で存在確認するが、Cloudflare KV は atomic CAS を持たないため同一 `id` を持つ 2 並行リクエストが両方 `null` を読み取り → 後発が先発の暗号文を無音で上書きできる。(2) `CF-Connecting-IP` ヘッダ不在リクエストは全て `unknown` バケットを共有し、1 つのノン CF 送信元がそのエンドポイントの通常上限を独占できる | (1) `id` 省略時はサーバ側で `crypto.randomUUID().replace(/-/g,'')` を生成(32-char hex、128-bit エントロピー)→ 衝突レース原理的排除。クライアント提供 `id` は後方互換で継続受付。レスポンスに常に `id` を返却。`kvPut` 失敗で `STORE_FAILED` 500(item 27 パターン)。`'drop-server-id'` を health capabilities に追加。(2) `ip === 'unknown'` の場合はパス別上限を `min(limit, 5)` に制限(非 CF 環境での共有バケット独占を防止) |
| 30 | **オンラインカウンターが毎分0にフリッカーする(分境界でスパイク)** | `handleOnlineCount` は新しい分のカウントが 0 のとき(最初のハートビートが届く前)に `{ online: 0 }` を返す。毎分 0 → 実数値 と変化するので接続中の全クライアントのプレゼンス UI が点滅 | `_onlineCounter` に `prev` フィールドを追加。分境界で `handlePresence` が旧カウントを `prev` に保存し、新分カウントが 0 のとき `handleOnlineCount` が `prev` をフォールバックとして返す |
| 29 | **handleTranslate の言語コードに特殊文字が通過 → 下流 API へのインジェクション** | `to`/`from` の言語コードは `.slice(0,10)` のみで `\r\n` 等の制御文字を通過させる。DeepL/LibreTranslate/Google/MyMemory へフォワードする際に HTTP ヘッダ注入や URL パラメータ汚染の可能性。`handleAI` は同一の `replace(/[^a-zA-Z0-9-]/g, '')` を適用済みで不整合 | `to`/`from` に対して `replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20)` を適用し BCP-47 セーフな文字のみ許可。ストリップ後に `tgt` が空の場合は `INVALID_LANG` 400 を返す |
| 28 | **OTP 削除前にバンドルに添付 → 削除失敗時に OTP が再使用される(X3DH 前方秘匿性劣化)** | `handlePreKeyFetch` は `bundle.oneTimePreKey = parsed` で OTP を先にセットしてから `kvDel` を呼ぶ。KV の一時的なエラーで削除が失敗してもレスポンスには OTP が含まれてしまう。次の fetch 呼び出し(別のイニシエータ)が同じスロットを取得すると同一 OTP が 2 人に配布 → DH4 コンポーネントが複数セッション間で共有 → 前方秘匿性の劣化 | `kvDel` を先に呼び出し、戻り値が `false` の場合はそのスロットをスキップして次のスロットへ。確実に削除された場合のみ OTP をバンドルに添付。全スロットで削除失敗なら `replenishOTP = true` を設定して再試行を促す |
| 27 | **KV write/delete 失敗をサイレント成功として返す(メッセージ消失・ACK 誤報)** | `handleMsgSend`・`handleSealedSend` は `kvPut` 失敗時も `{ok:true}` を返し、クライアントがメッセージ配送完了と誤認して再送しない。`handleSealedAck` は `kvDel` 失敗時も `{ok:true}` を返し、クライアントが sealed キューのポーリングを停止するがサーバ側のキューは残存したまま → TTL(7日)期限切れまでメッセージ未達 | 3 箇所の KV 操作の戻り値を確認: `handleMsgSend` / `handleSealedSend` は `kvPut` 失敗で `STORE_FAILED` 500、`handleSealedAck` は `kvDel` 失敗で `ACK_FAILED` 500。クライアントはエラーを受け取り再試行可能 |
| 26 | **バックアップ upload/download に認証がない(任意の userId 知者が上書き/読取り可)** | `/api/backup/upload` と `/api/backup/download` は `userId` のみで認証なし。攻撃者が被害者の `userId` を知っていれば暗号化バックアップを上書き(サービス妨害)または取得(メタデータ漏洩)できた。既存クライアントとの後方互換性を壊さずに強化する必要あり | `/api/backup/upload` および `/api/backup/download` にオプション Ed25519 認証を追加。リクエストに `{ ts, sig }` を含める場合は両フィールド必須(`PARTIAL_AUTH`)、Ed25519 署名を prekey bundle の `edIdentityKey` で検証(チャレンジ `breeze-backup-{upload\|download}:{userId}:{ts}`)。含めない場合は従来通り通過(後方互換)。レスポンスに `authenticated: bool` を追加。鮮度ウィンドウ ±5 分、片方のみ指定で `PARTIAL_AUTH` 400、署名不正で `SIG_INVALID` 403 |

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

- `npm test` — 13 スイート / 606 件全成功(item 38 で +2 件追加)
- `./validate.sh` — 33/36(ベースライン維持、⚠3 は既知の許容警告)
- `node -c _worker.js && node -c sw.js` — 構文 OK
- 新エンドポイント(account/delete・group/leave・group/delete・group/admin・
  group/transfer・group/rename)はすべて追加(additive)のため、既存クライアントとの
  後方互換性はワイヤ変更なしで保たれる(disappearAt パージのみ挙動変更だが、クライアントは
  同条件で描画拒否済みのため観測可能な差分なし。kick 認可拡張も従来の作成者経路は不変)。
  グループ操作は create/join/info/rename/kick/admin/transfer/leave/delete で
  CRUD ライフサイクル完成。

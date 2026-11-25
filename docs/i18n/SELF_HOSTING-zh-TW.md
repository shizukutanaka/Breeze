# 自行託管指南

**用其他語言閱讀**: [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · 中文（繁體）(本頁) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


運行 Breeze 中轉有兩種方式:

1. **自行託管（Node + Docker）** — 在你自己的機器或
   VPS 上的中轉: 一個容器、一個資料卷、註冊預設
   關閉。如果中轉是給你和你的人用的，從這裡開始。
2. **Cloudflare** — 在 Cloudflare 免費額度上的官方方式部署
   （Breeze 自己運行的中轉）。如果你想要一個不用維護伺服器的
   公開中轉，從那裡開始。

兩者運行完全相同的處理程式碼；無論哪種，中轉都是一個簡單、
可互換的保管箱，每個用戶端都能與每個中轉配合運作。

## 用 Docker 自行託管

```bash
# 1. Get the code
git clone https://github.com/shizukutanaka/Breeze.git && cd Breeze

# 2. Start it, with your own Breeze ID admitted (see "Registration"
#    below for how to find it — you can also start closed-to-everyone
#    and add IDs later)
BREEZE_ALLOWLIST=<your Breeze ID> docker compose up -d

# 3. Watch the first-boot log — it prints your relay identity
#    fingerprint; write it down (see "Relay identity")
docker compose logs breeze
```

中轉在容器內以 8787 連接埠提供明文 HTTP。
**在它前面放一個反向代理，在那裡終止 TLS**（Caddy、nginx、
Traefik、Cloudflare Tunnel、…）：瀏覽器只會透過 HTTPS/WSS 使用中轉。
這樣做時，在 `docker-compose.yml` 裡設定 `TRUST_PROXY: "true"`，
讓速率限制以真實用戶端位址為準 — 並且沒有這樣的代理時絕不要
設定它，因為它信任的標頭能被任何能直接到達入口的人偽造。

對著資料卷只運行恰好**一個**容器：速率限制器在每個處理序的記憶體裡，
每個保管箱的操作都在那個處理序內序列化，所以第二個副本兩個性質
都保持不了。擴展靠給那一個處理序更大的機器。

### 註冊: 預設關閉

一個網際網路上任何人都能註冊的自行託管中轉，會重現官方中轉的
上限正是為了控制的垃圾/濫用經濟，所以 **Docker 打包以關閉狀態
出貨**：compose 檔案傳遞一個 `REGISTRATION_ALLOWLIST`（可以為空），
只有上面的 Breeze ID 才能*建立帳號*（第一次 prekey 上傳）。
關閉註冊從不影響已經在該中轉安家的人 — 他們的上傳、寄存、
會合和輪詢都不設門 — 而開放註冊是一個明確的選擇，絕不是預設。

- **你的 Breeze ID** 是你邀請連結中的 12 個字元的識別碼（其 `pub` 值的
  前 12 個字元）。向你邀請的每個人同樣地詢問他們的 — ID 是
  聯絡人已經在交換的公開識別碼，不是秘密。
- **准入他人**靠列出他們的 ID：在你的 shell 或 `docker-compose.yml`
  旁邊的 `.env` 檔案裡設定 `BREEZE_ALLOWLIST=id1,id2,…`，
  然後再次 `docker compose up -d`。
- **現在開始，稍後准入**：不設定 `BREEZE_ALLOWLIST` 時，中轉對所有人
  關閉運行 — 啟動日誌會這樣說 — 在你加入 ID 之前沒有人能註冊。
- **開放中轉**（任何人都可以註冊）：在 `docker-compose.yml` 裡取消
  `REGISTRATION_OPEN: "1"` 的註解。這樣做的話濫用經濟由你負責。

### 使用量配額: 在自己的中轉上關掉它

該 worker 出貨時啟用了**公平使用配額**：每個保管箱，
最多 10,000 次寄存/天和 200,000 次/月（一次寄存是
一個完整的投遞週期 — 政策和數字見 `docs/COST_MODEL.md` §10）。
這個框架是為*共享的預設中轉*存在的，它作為免費入口運行，
否則營運者要替所有人承擔變動成本。**在你為自己和你的人
運行的中轉上，這個框架毫無意義 — 關掉它**：

```bash
USAGE_QUOTA_ENABLED=false
```

在你的中轉讀取其環境的任何地方設定它（shell 或
`docker-compose.yml` 旁邊的 `.env`、Node 處理序環境，
或 Cloudflare Pages 密鑰）。如果你運行社群中轉並*確實*想要
一個框架，有兩個相鄰的旋鈕：`USAGE_QUOTA_DAILY` 和
`USAGE_QUOTA_MONTHLY` 可以重新調整上限。重要的注意事項：

- 配額只在保管箱位於 Durable Objects 中時才強制執行
  （`MAILBOX_BACKEND=do`，本主機的預設）；在 KV 後端上它是
  有文件記錄的無操作。
- 超過上限後，傳送者會收到明確的 `429 USAGE_QUOTA_EXCEEDED`
  （附帶視窗和其上限），而不是被悄悄丟棄 — 訊息留在
  傳送者的寄件匣裡，接收者透過 P2P 和任何其他歸屬中轉
  仍然可以到達。

### 中轉身分

首次啟動時，中轉會在*資料卷內部*產生一個持久的 Ed25519 身分金鑰，
並在日誌中列印其指紋：

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

指紋識別*你的*中轉：透過帶外方式（當面、透過另一個管道）
把它交給你的使用者，讓他們能認出交給他們的中轉就是你運行的那個。
相同的指紋每次啟動都會列印；如果它變了，說明資料卷被
更換了 — 在告訴使用者信任新的之前先調查。

用戶端自動驗證並固定這個金鑰（第 2 階段第 4 步）：首次
接觸時用戶端向中轉發起挑戰，要求用該金鑰簽章
（`/api/relay/attest`），把驗證過的金鑰與帳號一起儲存，並在
之後的每個工作階段重新驗證。用戶端顯示的指紋（在 `/security`
下，以及首次固定時的提示）由同一個金鑰衍生 — 與上面的
啟動日誌行比較。如果金鑰變了，用戶端會**停止與中轉
交談**並警告使用者；它們絕不會悄悄重新固定。把指紋變化
當作破壞性事件對待：第 4 步中沒有應用程式內「信任新金鑰」按鈕，
所以在真正遺失卷之後，你的使用者必須清除應用程式為其帳號儲存的
資料，並在首次接觸時重新固定 — 先透過帶外方式公布新指紋，
否則他們無法區分你的新金鑰和攻擊者的金鑰。

### 備份與復原

**資料卷就是中轉狀態的全部**：一個 SQLite 檔案，裝著
目錄、保管箱和中轉身分金鑰。沒有其他需要備份的東西。

```bash
# Back up: copy the database out of the (stopped) container
docker compose stop
docker cp "$(docker compose ps -aq breeze)":/data/breeze-relay.db ./breeze-relay-backup.db
docker compose start

# Restore: copy the backup back in as /data/breeze-relay.db before
# starting, and the relay serves identically — same fingerprint.
docker compose stop
docker cp ./breeze-relay-backup.db "$(docker compose ps -aq breeze)":/data/breeze-relay.db
docker compose start
```

### 更新

```bash
git pull origin main
docker compose up -d --build
```

狀態在卷裡，不在映像裡，所以更新從不觸及你的使用者的資料。

## 用裸 Node 自行託管（無 Docker）

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

設定只有環境變數 — `server/README.md` 列出了全部。與 Docker
路徑的兩個區別：

- **資料檔案**預設是 `./breeze-relay.db`（用 `BREEZE_DB_PATH` 覆寫）；
  它是同一個單一檔案狀態，包括中轉身分。用同樣的方法備份它：
  停止、複製、重新啟動。
- **註冊除非關閉否則開放**：關閉預設是 Docker 打包的
  性質。要關閉一個裸入口，設定 `REGISTRATION_ALLOWLIST=id1,id2`
  （或對所有人關閉的空值）；`REGISTRATION_OPEN=1` 明確重新開放。

## Cloudflare 部署

### 最小部署（每月 0 美元，5 分鐘）

```bash
# 1. Install Wrangler CLI
npm install -g wrangler

# 2. Login to Cloudflare
wrangler login

# 3. Deploy
wrangler pages deploy . --project-name=breeze

# 4. Create a KV namespace and declare it in wrangler.toml
wrangler kv:namespace create KV
# Copy the new namespace's ID and put it in wrangler.toml, replacing the
# id in the [[kv_namespaces]] section (binding = "KV"). Pages takes its
# bindings from wrangler.toml; a binding set only in the Dashboard is
# NOT applied while a wrangler.toml exists.
# Then deploy again so the binding takes effect:
wrangler pages deploy . --project-name=breeze

# 5. Visit your deployment's URL (https://<your-project>.pages.dev)
```

**就這樣。** 除推送通知外所有功能都運作。注意
Cloudflare 部署上的註冊是**開放**的，除非你自己設定
`REGISTRATION_ALLOWLIST`（見 `.env.example`）；關閉預設的
打包是上面的 Docker 路徑。

### 0 美元能運作的

| 功能 | 狀態 | 備註 |
|---------|--------|-------|
| E2E 加密聊天 | ✓ | 完整的 Double Ratchet |
| P2P 訊息 | ✓ | WebRTC DataChannel |
| 語音/視訊通話 | ✓ | WebRTC + 免費 STUN |
| TURN 中轉 | ✓ | Open Relay（每月 20GB 免費） |
| 群組（1,000 名成員） | ✓ | Sender Key O(1) |
| 檔案傳輸 | ✓ | 透過 P2P 最大 50MB |
| 51 種語言 | ✓ | 英語內置 + 50 個完整語言檔案，自動偵測 |
| 離線/PWA | ✓ | Service Worker |
| 推送通知 | ✗ | 需要 VAPID 金鑰 |

多帳號計費（Lite/Plus/Pro）不可用 — 見
[SECURITY.md](../../SECURITY.md) 的 "Removed: multi-account billing" 一節。每個帳號都
免費獲得無限的本地子帳號，沒有方案門檻。

### 免費額度限制

| 資源 | 免費額度 | 每個活躍使用者的用量 |
|----------|-----------|----------------------|
| Worker 請求 | 100,000/天 | ~500/天（輪詢 + 信令） |
| KV 讀取 | 100,000/天 | ~200/天 |
| KV 寫入 | 1,000/天 | ~350/天（已最佳化） |
| KV 儲存 | 1 GB | ~10 KB/使用者 |
| 靜態資產 | 無限 | ~894 KB（單個 HTML） |

**在免費額度上支援約 3 名同時活躍使用者。**

### 加入可選功能

#### 推送通知（免費）

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### TURN 伺服器（用於受限網路）

TURN 是通話和僅中轉（隱藏 IP）連接穿越受限 NAT 的方式。
你的中轉發放哪種 TURN 是作為營運者的**你的**選擇 — Worker 按
順序嘗試：

```bash
# Option A: Cloudflare Calls ($0.05/GB, global anycast)
wrangler pages secret put TURN_KEY_ID
wrangler pages secret put TURN_KEY_API_TOKEN

# Option B: your own coturn (HMAC time-limited credentials — the Worker
# mints a 24h username/credential per registered user from the secret)
#   coturn: use-auth-secret, static-auth-secret=<same secret>
wrangler pages secret put TURN_URL      # turn:your-server:3478
wrangler pages secret put TURN_SECRET

# Option C: static credentials (metered.ca, Twilio, …)
wrangler pages secret put TURN_URL
wrangler pages secret put TURN_USERNAME
wrangler pages secret put TURN_CREDENTIAL

# Option D: No config → free Open Relay (20GB/month). This is a third
# party's PUBLIC quota, shared with every unconfigured relay — fine for
# a first run, not a foundation. Opt out explicitly and callers get
# STUN only (some restrictive-NAT calls will then fail, visibly):
wrangler pages secret put TURN_OPENRELAY_FALLBACK   # set to: false
```

**驗證你實際設定了什麼：** `GET /api/health` 以 `turnProvider`
（`cloudflare` | `custom` | `static` | `openrelay` | `none`）
報告有效模式。較舊的 `turn` 布林值只反映 `TURN_URL`，所以對
推薦的選項 A 它讀作 `false` — 使用 `turnProvider`。用戶端在
`/security` 中顯示相同的提供者，所以使用 Open Relay 兜底的
使用者可以看到第三方在中轉他們的通話媒體（僅中繼資料 — 媒體
本身是 DTLS-SRTP 加密的）。

#### 認證強化與明文中轉路徑

Prekey 上傳現在在 `prekey-owner:<userId>` 單獨保存簽章所有權，
且**沒有 TTL**。現有 bundle 所有權在下一次上傳時、在接受替換之前
懶遷移。新的 Ed25519 bundle 也建立該記錄。修剪過期的 prekey bundle 時
保留這些記錄：等待 bundle 過期絕不能允許新所有者。輪換需要
由先前所有者簽章的上傳，在現有上傳摘要中綁定新金鑰。
經過認證的 `/account/delete` 會刪除兩條記錄，並且即使 bundle
過期後也能對所有者進行認證。沒有遺失所有者金鑰的重設。

對於有此記錄的帳號，上傳和訊息/密封輪詢、密封 ACK 和
保管箱 WebSocket 證明必須使用持久所有者。**即使
`PREKEY_REQUIRE_AUTH=false` 或 `QUEUE_REQUIRE_AUTH=false`，
未簽章的請求也會被拒絕。** 這些旗標對沒有所有者的帳號保留
其現有的預設值和舊語義；明確以 `false` 接受未簽章的上傳/佇列
請求會記錄一條無內容的棄用警告。其他認證旗標不變。
保管箱 WebSocket 對所有人仍然要求簽章。

用戶端在佇列活動之前等待簽章初始化，包括
返回帳號啟動、領導者提升和重新連接。共享等待
上限為五秒。不支援的執行環境立即以未簽章繼續；
卡住的 IDB/金鑰解包在超過上限後以未簽章繼續，然後在準備好時
簽章。這讓輪詢迴圈保持存活，**不是**繞過：有所有者支援的帳號
在簽章金鑰可用之前無法從中轉接收。請將更新後的用戶端
資產與 Worker 一起部署，以避免舊的啟動競態。

遷移無法從在其所有者被保存**之前**就過期的 bundle 中復原
所有權。首次註冊仍然是 TOFU。所有權記錄使用
現有的 KV 後端：此變更不會使最終一致性和並發寫入
線性化。證明保留現有的五分鐘新鮮度視窗和操作/負載
綁定；視窗內相同的重試不是一次性 nonce 協議。

Presence 寫入和 TURN 憑證發放預設已經要求*已註冊的*
帳號（prekey bundle 存在），並且每個用戶端都會自動
註冊。Presence 心跳還攜帶一個 Ed25519 所有權
證明（該 beat 對其儲存的欄位簽章），Worker 在
每次呈現時驗證它 — `PRESENCE_SIGN_REQUIRE_AUTH=true` 使該
證明成為必需。其餘的 Ed25519 簽章旗標保持可選啟用；
`wrangler.toml` 記錄了每一個及其原因（在沒有
WebCrypto Ed25519 的執行環境上的用戶端根本無法簽章）。

舊式明文中轉（`/api/msg/send`、`/api/msg/poll`）已棄用：其
回應帶有 `Deprecation: true` 標頭，密封路徑是
每個目前用戶端的預設路由。在確認沒有在線用戶端仍需要
回退後，徹底停用它：

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### 自訂網域

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### 超出免費額度的擴展

當你超出免費額度時（每月 5 美元的 Workers Paid 方案）：

| 資源 | 付費方案 |
|----------|-----------|
| Worker 請求 | 每月 1,000 萬 |
| KV 寫入 | 每月 100 萬 |
| KV 儲存 | 包含 1 GB |
| CPU 時間 | 每請求 30 秒 |

這支援**數千名同時使用者**。

### 更新

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

沒有建構步驟。沒有要安裝的相依性。直接部署即可。

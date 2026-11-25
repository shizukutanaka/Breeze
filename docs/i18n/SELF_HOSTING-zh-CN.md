# 自行托管指南

**用其他语言阅读**: [English](SELF_HOSTING-en.md) · 中文（简体）(本页) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)

> **开始之前：标准安装需要一个 Cloudflare 账号。**
> 本指南中的标准安装——即下面的 Cloudflare 部署
> ——运行在 Cloudflare 上，因此开始前请先准备好
> 一个 Cloudflare 账号。如果您不想使用 Cloudflare，
> 本指南中的 Docker 和直接用 Node 的安装不需要
> Cloudflare 账号。

运行 Breeze 中转有两种方式:

1. **自行托管（Node + Docker）** — 在你自己的机器或
   VPS 上的中转: 一个容器、一个数据卷、注册默认
   关闭。如果中转是给你和你的人用的，从这里开始。
2. **Cloudflare** — 在 Cloudflare 免费额度上的官方方式部署
   （Breeze 自己运行的中转）。如果你想要一个不用维护服务器的
   公开中转，从那里开始。

两者运行完全相同的处理代码；无论哪种，中转都是一个简单、
可互换的保管箱，每个客户端都能与每个中转配合工作。

## 用 Docker 自行托管

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

中转在容器内以 8787 端口提供明文 HTTP。
**在它前面放一个反向代理，在那里终止 TLS**（Caddy、nginx、
Traefik、Cloudflare Tunnel、…）：浏览器只会通过 HTTPS/WSS 使用中转。
这样做时，在 `docker-compose.yml` 里设置 `TRUST_PROXY: "true"`，
让速率限制以真实客户端地址为准 — 并且没有这样的代理时绝不要
设置它，因为它信任的标头能被任何能直接到达入口的人伪造。

对着数据卷只运行恰好**一个**容器：速率限制器在每个进程的内存里，
每个保管箱的操作都在那个进程内串行化，所以第二个副本两个性质
都保持不了。扩展靠给那一个进程更大的机器。

### 注册: 默认关闭

一个互联网上任何人都能注册的自行托管中转，会重现官方中转的
上限正是为了控制的垃圾/滥用经济，所以 **Docker 打包以关闭状态
出货**：compose 文件传递一个 `REGISTRATION_ALLOWLIST`（可以为空），
只有上面的 Breeze ID 才能*创建账号*（第一次 prekey 上传）。
关闭注册从不影响已经在该中转安家的人 — 他们的上传、寄存、
会合和轮询都不设门 — 而开放注册是一个明确的选择，绝不是默认。

- **你的 Breeze ID** 是你邀请链接中的 12 个字符的标识符（其 `pub` 值的
  前 12 个字符）。向你邀请的每个人同样地询问他们的 — ID 是
  联系人已经在交换的公开标识符，不是秘密。
- **准入他人**靠列出他们的 ID：在你的 shell 或 `docker-compose.yml`
  旁边的 `.env` 文件里设置 `BREEZE_ALLOWLIST=id1,id2,…`，
  然后再次 `docker compose up -d`。
- **现在开始，稍后准入**：不设置 `BREEZE_ALLOWLIST` 时，中转对所有人
  关闭运行 — 启动日志会这样说 — 在你添加 ID 之前没有人能注册。
- **开放中转**（任何人都可以注册）：在 `docker-compose.yml` 里取消
  `REGISTRATION_OPEN: "1"` 的注释。这样做的话滥用经济由你负责。

### 使用量配额: 在自己的中转上关掉它

该 worker 出货时启用了**公平使用配额**：每个保管箱，
最多 10,000 次寄存/天和 200,000 次/月（一次寄存是
一个完整的投递周期 — 政策和数字见 `docs/COST_MODEL.md` §10）。
这个框架是为*共享的默认中转*存在的，它作为免费入口运行，
否则运营者要替所有人承担变动成本。**在你为自己和你的人
运行的中转上，这个框架毫无意义 — 关掉它**：

```bash
USAGE_QUOTA_ENABLED=false
```

在你的中转读取其环境的任何地方设置它（shell 或
`docker-compose.yml` 旁边的 `.env`、Node 进程环境，
或 Cloudflare Pages 密钥）。如果你运行社区中转并*确实*想要
一个框架，有两个相邻的旋钮：`USAGE_QUOTA_DAILY` 和
`USAGE_QUOTA_MONTHLY` 可以重新调整上限。重要的注意事项：

- 配额只在保管箱位于 Durable Objects 中时才强制执行
  （`MAILBOX_BACKEND=do`，本主机的默认）；在 KV 后端上它是
  有文档记录的无操作。
- 超过上限后，发送者会收到明确的 `429 USAGE_QUOTA_EXCEEDED`
  （附带窗口和其上限），而不是被悄悄丢弃 — 消息留在
  发送者的发件箱里，接收者通过 P2P 和任何其他归属中转
  仍然可以到达。

### 中转身份

首次启动时，中转会在*数据卷内部*生成一个持久的 Ed25519 身份密钥，
并在日志中打印其指纹：

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

指纹标识*你的*中转：通过带外方式（当面、通过另一个渠道）
把它交给你的用户，让他们能认出交给他们的中转就是你运行的那个。
相同的指纹每次启动都会打印；如果它变了，说明数据卷被
更换了 — 在告诉用户信任新的之前先调查。

客户端自动验证并固定这个密钥（第 2 阶段第 4 步）：首次
接触时客户端向中转发起挑战，要求用该密钥签名
（`/api/relay/attest`），把验证过的密钥与账号一起存储，并在
之后的每个会话重新验证。客户端显示的指纹（在 `/security`
下，以及首次固定时的提示）由同一个密钥派生 — 与上面的
启动日志行比较。如果密钥变了，客户端会**停止与中转
交谈**并警告用户；它们绝不会悄悄重新固定。把指纹变化
当作破坏性事件对待：第 4 步中没有应用内"信任新密钥"按钮，
所以在真正丢失卷之后，你的用户必须清除应用为其账号存储的
数据，并在首次接触时重新固定 — 先通过带外方式公布新指纹，
否则他们无法区分你的新密钥和攻击者的密钥。

### 备份与恢复

**数据卷就是中转状态的全部**：一个 SQLite 文件，装着
目录、保管箱和中转身份密钥。没有其他需要备份的东西。

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

状态在卷里，不在镜像里，所以更新从不触及你的用户的数据。

## 用裸 Node 自行托管（无 Docker）

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

配置只有环境变量 — `server/README.md` 列出了全部。与 Docker
路径的两个区别：

- **数据文件**默认是 `./breeze-relay.db`（用 `BREEZE_DB_PATH` 覆盖）；
  它是同一个单文件状态，包括中转身份。用同样的方法备份它：
  停止、复制、重启。
- **注册除非关闭否则开放**：关闭默认是 Docker 打包的
  性质。要关闭一个裸入口，设置 `REGISTRATION_ALLOWLIST=id1,id2`
  （或对所有人关闭的空值）；`REGISTRATION_OPEN=1` 明确重新开放。

## Cloudflare 部署

### 最小部署（每月 0 美元，5 分钟）

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

**就这样。** 除推送通知外所有功能都工作。注意
Cloudflare 部署上的注册是**开放**的，除非你自己设置
`REGISTRATION_ALLOWLIST`（见 `.env.example`）；关闭默认的
打包是上面的 Docker 路径。

### 0 美元能工作的

| 功能 | 状态 | 备注 |
|---------|--------|-------|
| E2E 加密聊天 | ✓ | 完整的 Double Ratchet |
| P2P 消息 | ✓ | WebRTC DataChannel |
| 语音/视频通话 | ✓ | WebRTC + 免费 STUN |
| TURN 中转 | ✓ | Open Relay（每月 20GB 免费） |
| 群组（1,000 名成员） | ✓ | Sender Key O(1) |
| 文件传输 | ✓ | 通过 P2P 最大 50MB |
| 51 种语言 | ✓ | 英语内置 + 50 个完整语言文件，自动检测 |
| 离线/PWA | ✓ | Service Worker |
| 推送通知 | ✗ | 需要 VAPID 密钥 |

多账号计费（Lite/Plus/Pro）不可用 — 见
[SECURITY.md](../../SECURITY.md) 的 "Removed: multi-account billing" 一节。每个账号都
免费获得无限的本地子账号，没有套餐门槛。

### 免费额度限制

| 资源 | 免费额度 | 每个活跃用户的用量 |
|----------|-----------|----------------------|
| Worker 请求 | 100,000/天 | ~500/天（轮询 + 信令） |
| KV 读取 | 100,000/天 | ~200/天 |
| KV 写入 | 1,000/天 | ~350/天（已优化） |
| KV 存储 | 1 GB | ~10 KB/用户 |
| 静态资产 | 无限 | ~894 KB（单个 HTML） |

**在免费额度上支持约 3 名同时活跃用户。**

### 添加可选功能

#### 推送通知（免费）

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### TURN 服务器（用于受限网络）

TURN 是通话和仅中转（隐藏 IP）连接穿越受限 NAT 的方式。
你的中转发放哪种 TURN 是作为运营者的**你的**选择 — Worker 按
顺序尝试：

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

**验证你实际配置了什么：** `GET /api/health` 以 `turnProvider`
（`cloudflare` | `custom` | `static` | `openrelay` | `none`）
报告有效模式。较旧的 `turn` 布尔值只反映 `TURN_URL`，所以对
推荐的选项 A 它读作 `false` — 使用 `turnProvider`。客户端在
`/security` 中显示相同的提供者，所以使用 Open Relay 兜底的
用户可以看到第三方在中转他们的通话媒体（仅元数据 — 媒体
本身是 DTLS-SRTP 加密的）。

#### 认证强化与明文中转路径

Prekey 上传现在在 `prekey-owner:<userId>` 单独保存签名所有权，
且**没有 TTL**。现有 bundle 所有权在下一次上传时、在接受替换之前
懒迁移。新的 Ed25519 bundle 也建立该记录。修剪过期的 prekey bundle 时
保留这些记录：等待 bundle 过期绝不能允许新所有者。轮换需要
由先前所有者签名的上传，在现有上传摘要中绑定新密钥。
经过认证的 `/account/delete` 会删除两条记录，并且即使 bundle
过期后也能对所有者进行认证。没有丢失所有者密钥的重置。

对于有此记录的账号，上传和消息/密封轮询、密封 ACK 和
保管箱 WebSocket 证明必须使用持久所有者。**即使
`PREKEY_REQUIRE_AUTH=false` 或 `QUEUE_REQUIRE_AUTH=false`，
未签名的请求也会被拒绝。** 这些标志对没有所有者的账号保留
其现有的默认值和旧语义；明确以 `false` 接受未签名的上传/队列
请求会记录一条无内容的弃用警告。其他认证标志不变。
保管箱 WebSocket 对所有人仍然要求签名。

客户端在队列活动之前等待签名初始化，包括
返回账号启动、领导者提升和重新连接。共享等待
上限为五秒。不支持的运行时立即以未签名继续；
卡住的 IDB/密钥解包在超过上限后以未签名继续，然后在准备好时
签名。这让轮询循环保持存活，**不是**绕过：有所有者支持的账号
在签名密钥可用之前无法从中转接收。请将更新后的客户端
资产与 Worker 一起部署，以避免旧的启动竞态。

迁移无法从在其所有者被保存**之前**就过期的 bundle 中恢复
所有权。首次注册仍然是 TOFU。所有权记录使用
现有的 KV 后端：此更改不会使最终一致性和并发写入
线性化。证明保留现有的五分钟新鲜度窗口和操作/负载
绑定；窗口内相同的重试不是一次性 nonce 协议。

Presence 写入和 TURN 凭据发放默认已经要求*已注册的*
账号（prekey bundle 存在），并且每个客户端都会自动
注册。Presence 心跳还携带一个 Ed25519 所有权
证明（该 beat 对其存储的字段签名），Worker 在
每次呈现时验证它 — `PRESENCE_SIGN_REQUIRE_AUTH=true` 使该
证明成为必需。其余的 Ed25519 签名标志保持可选启用；
`wrangler.toml` 记录了每一个及其原因（在没有
WebCrypto Ed25519 的运行时上的客户端根本无法签名）。

旧式明文中转（`/api/msg/send`、`/api/msg/poll`）已弃用：其
响应带有 `Deprecation: true` 标头，密封路径是
每个当前客户端的默认路由。在确认没有在线客户端仍需要
回退后，彻底禁用它：

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### 自定义域名

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### 超出免费额度的扩展

当你超出免费额度时（每月 5 美元的 Workers Paid 计划）：

| 资源 | 付费计划 |
|----------|-----------|
| Worker 请求 | 每月 1,000 万 |
| KV 写入 | 每月 100 万 |
| KV 存储 | 包含 1 GB |
| CPU 时间 | 每请求 30 秒 |

这支持**数千名同时用户**。

### 更新

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

没有构建步骤。没有要安装的依赖。直接部署即可。

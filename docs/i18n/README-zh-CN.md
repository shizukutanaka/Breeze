# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

**用其他语言阅读**: [日本語](../../README.md) · [English](README-en.md) · 中文（简体）(本页) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · [Dansk](README-da.md) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**不需要电话号码，也不需要注册的加密通讯软件。**
对话内容只有发送者和接收者能读。途中搬运的服务器也读不了。
全部功能免费，也没有广告。

这不是网页，而是安装后使用的软件（Windows / Mac / Linux / Android / iPhone / 浏览器）。

![Breeze Messenger screenshot — the main window right after creating an identity](../images/screenshot.png)

## 使用时，要放在自己的服务器上

Breeze 没有"运营公司的服务器"。**使用时，你要自己准备放置的地方（服务器），把 Breeze 放在那里。这才是正式的使用方式。**

- 标准安装使用 Cloudflare，因此**需要一个 Cloudflare 账号**。步骤在[安装指南](SELF_HOSTING-zh-CN.md)里（其他语言版本可从指南开头选择）。
- 应用（Windows / Mac / Linux / Android / iPhone）从[下载页面](https://github.com/shizukutanaka/Breeze/releases/latest)获取，连接到自己的服务器使用。
- **关于示例安装（诚实的说明）**: 放了一个用于确认动作的示例（https://breeze-469.pages.dev/）。放的是同一套软件，但实际使用请在自己的服务器上。示例可能会在没有预告的情况下变更或停止。放在自己服务器上的不受示例停止的影响。

详细的使用方法在[说明书](MANUAL-zh-CN.md)里（其他语言版本可从说明书开头选择）。

## 使用方法（3步）

1. 打开放在自己服务器上的 Breeze（或安装的人告诉你的地址），按"使用随机 ID 开始"（如果愿意，也可以输入名字）。这样就准备完成了（不需要注册，也不需要电话号码）。这时设备内部会生成"密钥"，它就是你的身份。
2. 把自己的 ID 或二维码交给想对话的人。
3. 对方也打开应用时，可以直接连接对话。对方没打开时，会以加密状态放在"保管箱"里，对方打开时送达。搬运保管箱的服务器读不了内容。一直没送达的信件最多 7 天后自动消失。

## 承诺（不做的事）

- **不放广告。** 应用里不放，任何地方都不放。
- **不追踪。** 不做使用情况分析、广告机制、数据买卖，一概不做。
- **制作者不持有用户的数据。** 服务器端根本没有账号列表。身份只有你设备里的密钥。
- **对话在设备之间加密。** 服务器处理的只有读不了的信封。

也诚实地写明范围。为了送达，服务器会有短时间的保管（未送达的信封最多 7 天、连接信号 5 分钟、地址和设备记录 90 天、群组信息和通知订阅 30 天。都自动消失，内容读不了）。云端备用保存最初是关闭的。放在自己的服务器上，这些保管也在自己的管理之下。

## 能做的事

- 一对一对话和群组对话（最多 1,000 人）
- 语音通话和视频通话（群组通话最多 8 人）
- 通话记录（只保留在这台设备上：只有对方、方向、时间和通话时长，不保留通话内容。不会发送到服务器或对方）
- 文件发送（一对一最大 50MB。群组也能发，但大小上限较小）
- 多台设备、多个账号分别使用（如工作用和私人用。台数和账号数都免费且无限制）
- 自动备份（有变化时，加密备份会自动保存到你自己的服务器上。在新设备上，恢复身份后，会自动找到备份并向你提供。设置里也会引导你换到新设备）
- 给每个联系人取一个你选的名字（你可以给每个联系人改名，只保存在这台设备上。也可以选择是否显示对方自己设置的名字）
- 51 种语言（英语加上 50 个语言文件），根据设备的语言自动选择
- 带照片的个人资料、贴纸、位置信息共享
- `/help` 等命令操作（71 种）
- 与电池状况相匹配的电源模式（自动／正常／省电／应急）。电量减少时，会拉开接收确认的间隔，让电池用得更久。这是为灾害等无法充电的时刻所做的准备
- 手机的底部标签（聊天／通话／联系人／我的卡片／设置。显示哪些标签可以在设置中选择）
- 易于看清的画面（注重颜色的浓淡对比、文字的大小，以及只用键盘的操作）

## 与其他通讯软件的区别

| | Breeze | 许多通讯软件 |
|---|--------|--------|
| 注册 | 不需要（身份是设备里的密钥） | 需要电话号码 |
| 服务器 | 读不了内容 | 以信任运营公司为前提 |
| 放在自己的服务器上 | 前提（放着用的东西） | 做不到 |
| 内容公开 | 全部公开（MIT 许可证） | 多为不公开 |
| 数据的位置 | 在你的设备里 | 在运营公司的服务器上 |

与 Signal 和 LINE 的详细比较在[比较页面（英语）](../COMPARISON.md)里。Breeze 的每项主张都附有"验证的方法"，Breeze 处于劣势的点（用户数量、没有接受外部审计等）也毫不隐瞒地写着。

## 放在自己服务器上的费用

Breeze 在 Cloudflare 的免费范围内运行。不需要信用卡。

| 项目 | 免费范围 | 付费时 |
|-----------|-----------|-------------|
| 放置的地方 | Cloudflare Pages（免费） | — |
| 处理 | 每天最多 10 万次 | 每月最多 1,000 万次 |
| 存储 | 每天读取 10 万次、写入 1 千次 | 每月读取 1,000 万次、写入 100 万次 |
| 通话中转 | 20GB 以内免费 | 每 GB 0.05 美元 |
| 自定义域名 | 不需要（附带免费地址） | 每年 10 美元 |
| **合计** | **每月 0 美元**（轻度使用约可供 20〜40 人） | **每月 5 美元起**（轻度使用约 100 人规模。1,000 人规模时视使用方式每月 34〜222 美元） |

大规模时费用的增长方式，以及"为什么单个运营者不需要背负全部费用"，在[费用与持续的考え方（英语）](../SUSTAINABILITY.md)里，基础计算在[费用模型（英语）](../COST_MODEL.md)里。

安装从这一条命令开始（详情见[安装指南](SELF_HOSTING-zh-CN.md)）。

```bash
wrangler pages deploy . --project-name=breeze
```

## 技术细节（面向开发者）

### 加密方式

| 作用 | 方式 |
|-------|-----------|
| 密钥交换 | X25519（备用: P-256） |
| 签名 | Ed25519（备用: HMAC-SHA256） |
| 加密 | AES-256-GCM |
| 密钥派生 | HKDF-SHA256 |
| 对话密钥更新 | Double Ratchet（与 Signal 相同的方式） |
| 群组密钥 | Sender Key |
| 向中转向发送者隐藏 | Sealed Sender |

设计的正本在[规格书 SPEC.md](../../SPEC.md)，弱点报告去向和方针在 [SECURITY.md](../../SECURITY.md)。

### 测试与质量检查

```bash
npm ci            # 安装开发用工具
npm test          # 运行测试
./validate.sh     # 质量检查（语法、安全性、语言、方式合规等 7 个领域）
./build.sh zip    # 制作发布用 ZIP
```

### 参与开发

推进方式和规范在 [CONTRIBUTING.md](../../CONTRIBUTING.md)。
缺陷报告请到 [Issue 页面](https://github.com/shizukutanaka/Breeze/issues)。行为规范是 [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)。

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [../COMPARISON.md](../COMPARISON.md).

## 许可证

MIT — 按照 [LICENSE](../../LICENSE)，可以自由使用、修改、分发。

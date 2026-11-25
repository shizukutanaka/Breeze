# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

**用其他語言閱讀**: [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · 中文（繁體）(本頁) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · [Dansk](README-da.md) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**不需要電話號碼，也不需要註冊的加密通訊軟體。**
對話內容只有傳送者和接收者能讀。途中搬運的伺服器也讀不了。
全部功能免費，也沒有廣告。

這不是網頁，而是安裝後使用的軟體（Windows / Mac / Linux / Android / iPhone / 瀏覽器）。

![Breeze Messenger screenshot — the main window right after creating an identity](../images/screenshot.png)

## 使用時，要放在自己的伺服器上

Breeze 沒有「營運公司的伺服器」。**使用時，你要自己準備放置的地方（伺服器），把 Breeze 放在那裡。這才是正式的使用方式。**

- 放置的地方用免費額度就夠了。在 Cloudflare 的免費額度內運作，也不需要信用卡。步驟在[安裝指南](SELF_HOSTING-zh-TW.md)裡（其他語言版本可從指南開頭選擇）。
- 應用程式（Windows / Mac / Linux / Android / iPhone）從[下載頁面](https://github.com/shizukutanaka/Breeze/releases/latest)取得，連接到自己的伺服器使用。
- **關於範例安裝（誠實的說明）**: 放了一個用於確認運作的範例（https://breeze-469.pages.dev/）。放的是同一套軟體，但實際使用請在自己的伺服器上。範例可能會在沒有預告的情況下變更或停止。放在自己伺服器上的不受範例停止的影響。

詳細的使用方法在[說明書](MANUAL-zh-TW.md)裡（其他語言版本可從說明書開頭選擇）。

## 使用方法（3步）

1. 打開放在自己伺服器上的 Breeze（或安裝的人告訴你的地址），輸入名字。這樣就準備完成了（不需要註冊，也不需要電話號碼）。這時裝置內部會產生「金鑰」，它就是你的身分。
2. 把自己的 ID 或 QR 碼交給想對話的人。
3. 對方也打開應用程式時，可以直接連接對話。對方沒打開時，會以加密狀態放在「保管箱」裡，對方打開時送達。搬運保管箱的伺服器讀不了內容。一直沒送達的信件最多 7 天後自動消失。

## 承諾（不做的事）

- **不放廣告。** 應用程式裡不放，任何地方都不放。
- **不追蹤。** 不做使用情況分析、廣告機制、資料買賣，一概不做。
- **製作者不持有使用者的資料。** 伺服器端根本沒有帳號清單。身分只有你裝置裡的金鑰。
- **對話在裝置之間加密。** 伺服器處理的只有讀不了的信封。

也誠實地寫明範圍。為了送達，伺服器會有短時間的保管（未送達的信封最多 7 天、連接訊號 5 分鐘、地址和裝置記錄 90 天、群組資訊和通知訂閱 30 天。都自動消失，內容讀不了）。雲端備用保存最初是關閉的。放在自己的伺服器上，這些保管也在自己的管理之下。

## 能做的事

- 一對一對話和群組對話（最多 1,000 人）
- 語音通話和視訊通話（群組通話最多 8 人）
- 檔案傳送（一對一最大 50MB。群組也能傳，但大小上限較小）
- 多台裝置、多個帳號分別使用（如工作用和私人用。台數和帳號數都免費且無限制）
- 51 種語言（英語加上 50 個語言檔案），根據裝置的語言自動選擇
- 帶照片的個人資料、貼圖、位置資訊共享
- `/help` 等指令操作（71 種）
- 與電池狀況相配合的電源模式（自動／正常／省電／緊急）。電量減少時，會拉開接收確認的間隔，讓電池用得更久。這是為災害等無法充電的時刻所做的準備
- 易於看清的畫面（注重顏色的濃淡對比、文字的大小，以及只用鍵盤的操作）

## 與其他通訊軟體的區別

| | Breeze | 許多通訊軟體 |
|---|--------|--------|
| 註冊 | 不需要（身分是裝置裡的金鑰） | 需要電話號碼 |
| 伺服器 | 讀不了內容 | 以信任營運公司為前提 |
| 放在自己的伺服器上 | 前提（放著用的東西） | 做不到 |
| 內容公開 | 全部公開（MIT 授權） | 多為不公開 |
| 資料的位置 | 在你的裝置裡 | 在營運公司的伺服器上 |

與 Signal 和 LINE 的詳細比較在[比較頁面（英語）](../COMPARISON.md)裡。Breeze 的每項主張都附有「驗證的方法」，Breeze 處於劣勢的點（使用者數量、沒有接受外部稽核等）也毫不隱瞞地寫著。

## 放在自己伺服器上的費用

Breeze 在 Cloudflare 的免費範圍內運作。不需要信用卡。

| 項目 | 免費範圍 | 付費時 |
|-----------|-----------|-------------|
| 放置的地方 | Cloudflare Pages（免費） | — |
| 處理 | 每天最多 10 萬次 | 每月最多 1,000 萬次 |
| 儲存 | 每天讀取 10 萬次、寫入 1 千次 | 每月讀取 1,000 萬次、寫入 100 萬次 |
| 通話中轉 | 20GB 以內免費 | 每 GB 0.05 美元 |
| 自訂網域 | 不需要（附帶免費地址） | 每年 10 美元 |
| **合計** | **每月 0 美元**（輕度使用約可供 20〜40 人） | **每月 5 美元起**（輕度使用約 100 人規模。1,000 人規模時視使用方式每月 34〜222 美元） |

大規模時費用的增長方式，以及「為什麼單個營運者不需要背負全部費用」，在[費用與持續的想法（英語）](../SUSTAINABILITY.md)裡，基礎計算在[費用模型（英語）](../COST_MODEL.md)裡。

安裝從這一條指令開始（詳情見[安裝指南](SELF_HOSTING-zh-TW.md)）。

```bash
wrangler pages deploy . --project-name=breeze
```

## 技術細節（面向開發者）

### 加密方式

| 作用 | 方式 |
|-------|-----------|
| 金鑰交換 | X25519（備用: P-256） |
| 簽章 | Ed25519（備用: HMAC-SHA256） |
| 加密 | AES-256-GCM |
| 金鑰衍生 | HKDF-SHA256 |
| 對話金鑰更新 | Double Ratchet（與 Signal 相同的方式） |
| 群組金鑰 | Sender Key |
| 向中轉隱藏傳送者 | Sealed Sender |

設計的正本在[規格書 SPEC.md](../../SPEC.md)，弱點報告去向和方針在 [SECURITY.md](../../SECURITY.md)。

### 測試與品質檢查

```bash
npm ci            # 安裝開發用工具
npm test          # 執行測試
./validate.sh     # 品質檢查（語法、安全性、語言、方式合規等 7 個領域）
./build.sh zip    # 製作發布用 ZIP
```

### 參與開發

推進方式和規範在 [CONTRIBUTING.md](../../CONTRIBUTING.md)。
缺陷報告請到 [Issue 頁面](https://github.com/shizukutanaka/Breeze/issues)。行為規範是 [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)。

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server (Cloudflare's free tier is enough) and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [../COMPARISON.md](../COMPARISON.md).

## 授權

MIT — 按照 [LICENSE](../../LICENSE)，可以自由使用、修改、散布。

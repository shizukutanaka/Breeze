# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**他の言語で読む**: 日本語（このページ） · [English](docs/i18n/README-en.md) · [中文（简体）](docs/i18n/README-zh-CN.md) · [中文（繁體）](docs/i18n/README-zh-TW.md) · [Español](docs/i18n/README-es.md) · [Français](docs/i18n/README-fr.md) · [Deutsch](docs/i18n/README-de.md) · [Italiano](docs/i18n/README-it.md) · [Português (Brasil)](docs/i18n/README-pt-BR.md) · [Русский](docs/i18n/README-ru.md) · [Українська](docs/i18n/README-uk.md) · [Polski](docs/i18n/README-pl.md) · [Nederlands](docs/i18n/README-nl.md) · [Svenska](docs/i18n/README-sv.md) · [Norsk](docs/i18n/README-nb.md) · [Dansk](docs/i18n/README-da.md) · [Suomi](docs/i18n/README-fi.md) · [Čeština](docs/i18n/README-cs.md) · [Magyar](docs/i18n/README-hu.md) · [Română](docs/i18n/README-ro.md) · [Ελληνικά](docs/i18n/README-el.md) · [Türkçe](docs/i18n/README-tr.md) · [العربية](docs/i18n/README-ar.md) · [فارسی](docs/i18n/README-fa.md) · [עברית](docs/i18n/README-he.md) · [हिन्दी](docs/i18n/README-hi.md) · [বাংলা](docs/i18n/README-bn.md) · [اردو](docs/i18n/README-ur.md) · [ਪੰਜਾਬੀ](docs/i18n/README-pa.md) · [தமிழ்](docs/i18n/README-ta.md) · [తెలుగు](docs/i18n/README-te.md) · [മലയാളം](docs/i18n/README-ml.md) · [Bahasa Indonesia](docs/i18n/README-id.md) · [Bahasa Melayu](docs/i18n/README-ms.md) · [Tiếng Việt](docs/i18n/README-vi.md) · [ไทย](docs/i18n/README-th.md) · [မြန်မာ](docs/i18n/README-my.md) · [ខ្មែរ](docs/i18n/README-km.md) · [한국어](docs/i18n/README-ko.md) · [Filipino](docs/i18n/README-tl.md) · [Kiswahili](docs/i18n/README-sw.md) · [Hausa](docs/i18n/README-ha.md) · [Yorùbá](docs/i18n/README-yo.md) · [Igbo](docs/i18n/README-ig.md) · [አማርኛ](docs/i18n/README-am.md) · [ქართული](docs/i18n/README-ka.md) · [Azərbaycan](docs/i18n/README-az.md) · [Қазақша](docs/i18n/README-kk.md) · [Oʻzbek](docs/i18n/README-uz.md) · [Српски](docs/i18n/README-sr.md) · [Hrvatski](docs/i18n/README-hr.md)

**電話番号も登録もいらない、暗号化メッセンジャーです。**
会話の中身は、送った人と受け取る人にしか読めません。途中で運ぶサーバーにも読めません。
全機能が無料で、広告もありません。

これはWebページではなく、インストールして使うソフトウェアです（Windows / Mac / Linux / Android / iPhone / ブラウザ）。

![Breeze Messenger screenshot — the main window right after creating an identity](docs/images/screenshot.png)

## 使うには、自分のサーバーに置きます

Breeze には「運営会社のサーバー」がありません。**使うには、あなた自身が置き場所（サーバー）を用意して、そこに Breeze を置きます。これが正式な使い方です。**

- 置き場所は無料の範囲で足ります。Cloudflare の無料枠で動き、クレジットカードも要りません。手順は[設置の手順書](docs/SELF_HOSTING.md)（多言語版は手順書の冒頭から選べます）にあります。
- アプリ（Windows / Mac / Linux / Android / iPhone）は[ダウンロードのページ](https://github.com/shizukutanaka/Breeze/releases/latest)から取り、自分のサーバーに接続して使います。
- **見本の設置について（正直なお知らせ）**: 動作確認のための見本（https://breeze-469.pages.dev/）を置いてあります。置いてあるのは同じソフトウェアですが、実利用は自分のサーバーでお願いします。見本は予告なく変わったり止まったりします。自分のサーバーに置いたものは、見本の停止の影響を受けません。

詳しい使い方は[説明書](docs/MANUAL-ja.md)（多言語版は説明書の冒頭から選べます）にあります。

## 使い方（3ステップ）

1. 自分のサーバーに置いた Breeze（または、置いた人から教えてもらった住所）を開いて、名前を入れます。それだけで準備完了です（登録も電話番号も不要）。このとき端末の中で「鍵」が作られ、それがあなたの身元になります。
2. 自分のIDかQRコードを、話したい相手に渡します。
3. 相手もアプリを開いていれば、直接つながって会話できます。相手が開いていないときは、暗号化されたまま「預かり箱」に置かれ、相手が開いたときに届きます。預かり箱を運ぶサーバーは中身を読めません。届かないままの手紙は最大7日で自動的に消えます。

## 約束（しないこと）

- **広告は出しません。** アプリの中にも、どこにも。
- **追跡しません。** 利用状況の解析、広告の仕組み、データの売買は一切しません。
- **作った人は、利用者のデータを持ちません。** サーバー側にアカウントの一覧そのものがありません。身元はあなたの端末の中の鍵だけです。
- **会話は端末同士で暗号化されます。** サーバーが扱うのは、読めない封筒だけです。

正直に範囲も書きます。届けるために、サーバーには短い間の預かりがあります（未配達の封筒は最大7日、接続の合図は5分、宛名と端末の記録は90日、グループの情報と通知の購読は30日。どれも自動で消え、中身は読めません）。クラウドへの予備保存は、最初は無効です。自分のサーバーに置けば、その預かりも自分の管理下に置けます。

## できること

- 1対1の会話と、グループの会話（最大1,000人）
- 音声通話とビデオ通話（グループ通話は最大8人）
- ファイルの送信（1対1では最大50MB。グループでも送れますが、大きさの上限は小さめです）
- 複数の端末・複数のアカウントの使い分け（仕事用と私用など。台数もアカウント数も無料で無制限）
- 51の言語（英語と、50の言語ファイル）から、端末の言語に合わせて自動で選ばれます
- 写真つきのプロフィール、ステッカー、位置情報の共有
- `/help` などのコマンド操作（71種類）
- 電池に合わせた電力モード（自動／通常／省電力／非常時）。電池が減ると、受け取りの確認を間引いて電池を長持ちさせます。災害などで充電できないときの備えです
- 見やすい画面づくり（色の濃さ・文字の大きさ・キーボードだけでの操作に配慮しています）

## ほかのメッセンジャーとの違い

| | Breeze | 多くのメッセンジャー |
|---|--------|--------|
| 登録 | 不要（身元は端末の中の鍵） | 電話番号が必要 |
| サーバー | 中身を読めない | 運営会社を信頼する前提 |
| 自分のサーバーに置く | 前提（置いて使うもの） | できない |
| 中身の公開 | 全て公開（MITライセンス） | 非公開が多い |
| データの場所 | あなたの端末の中 | 運営会社のサーバー |

Signal や LINE との詳しい比較は、[比較のページ（英語）](docs/COMPARISON.md)にあります。Breeze の主張には一つずつ「確かめる方法」が付いていて、Breeze が負けている点（利用者の数、外部の監査を受けていないこと等）も隠さず書いてあります。

## 自分のサーバーに置く場合の費用

Breeze は Cloudflare の無料の範囲で動きます。クレジットカードも要りません。

| 項目 | 無料の範囲 | 有料の場合 |
|-----------|-----------|-------------|
| 置き場所 | Cloudflare Pages（無料） | — |
| 処理 | 1日10万回まで | 月1,000万回まで |
| 保存 | 1日 読み10万回・書き1千回まで | 月 読み1,000万回・書き100万回まで |
| 通話の中継 | 20GBまで無料 | 1GBあたり0.05ドル |
| 独自ドメイン | 不要（無料の住所が付きます） | 年10ドル |
| **合計** | **月0ドル**（軽い使い方で20〜40人程度まで） | **月5ドルから**（軽い使い方で約100人規模。1,000人規模では使い方により月34〜222ドル） |

大きな規模での費用の伸び方と、「なぜ一人の運営者が全体の費用を背負わずに済むのか」は、[費用と持続の考え方（英語）](docs/SUSTAINABILITY.md)に、もとになる計算は[費用モデル（英語）](docs/COST_MODEL.md)にあります。

設置はこの1コマンドからです（詳しくは[設置の手順書](docs/SELF_HOSTING.md)）。

```bash
wrangler pages deploy . --project-name=breeze
```

## 技術の詳細（開発者向け）

### 暗号の方式

| 役割 | 方式 |
|-------|-----------|
| 鍵の交換 | X25519（予備: P-256） |
| 署名 | Ed25519（予備: HMAC-SHA256） |
| 暗号化 | AES-256-GCM |
| 鍵の導出 | HKDF-SHA256 |
| 会話の鍵の更新 | Double Ratchet（Signal と同じ方式） |
| グループの鍵 | Sender Key |
| 送り主を中継に隠す | Sealed Sender |

設計の正本は[仕様書 SPEC.md](SPEC.md)、弱点の報告先と方針は[SECURITY.md](SECURITY.md)にあります。

### テストと品質チェック

```bash
npm ci            # 開発用の道具を入れる
npm test          # テストを実行する
./validate.sh     # 品質チェック（構文・安全性・言語・方式の準拠など7分野）
./build.sh zip    # 配布用ZIPを作る
```

### 開発への参加

進め方と規約は[CONTRIBUTING.md](CONTRIBUTING.md)にあります。
不具合の報告は[Issue のページ](https://github.com/shizukutanaka/Breeze/issues)へ。行動規範は[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)です。

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server (Cloudflare's free tier is enough) and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [docs/i18n/README-en.md](docs/i18n/README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [docs/COMPARISON.md](docs/COMPARISON.md).

## ライセンス

MIT — [LICENSE](LICENSE) のとおり、自由に使って、直して、配れます。

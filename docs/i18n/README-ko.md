# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

**다른 언어로 읽기**: [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · [Dansk](README-da.md) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · 한국어(이 페이지) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**전화번호도 등록도 필요 없는 암호화 메신저입니다.**
대화 내용은 보낸 사람과 받는 사람만 읽을 수 있습니다. 중간에서 전달하는 서버도 읽을 수 없습니다.
모든 기능이 무료이고, 광고도 없습니다.

이것은 웹페이지가 아니라 설치해서 사용하는 소프트웨어입니다(Windows / Mac / Linux / Android / iPhone / 브라우저).

![Breeze Messenger screenshot — the main window right after creating an identity](../images/screenshot.png)

## 사용하려면, 자신의 서버에 설치합니다

Breeze에는 "운영 회사의 서버"가 없습니다. **사용하려면, 당신 자신이 둘 장소(서버)를 마련해서 거기에 Breeze를 설치합니다. 이것이 정식 사용 방법입니다.**

- 표준 설치는 Cloudflare를 사용하므로 **Cloudflare 계정이 필요합니다**. 절차는 [설치 안내서](SELF_HOSTING-ko.md)(다른 언어판은 안내서 첫머리에서 선택할 수 있습니다)에 있습니다.
- 앱(Windows / Mac / Linux / Android / iPhone)은 [다운로드 페이지](https://github.com/shizukutanaka/Breeze/releases/latest)에서 받아서, 자신의 서버에 연결해 사용합니다.

자세한 사용법은 [설명서](MANUAL-ko.md)(다른 언어판은 설명서 첫머리에서 선택할 수 있습니다)에 있습니다.

## 사용법(3단계)

1. 자신의 서버에 설치한 Breeze(또는 설치한 사람에게 들은 주소)를 열고, "무작위 ID로 시작하기"를 누릅니다(이름은 원하면 입력할 수 있습니다). 그것만으로 준비 완료입니다(등록도 전화번호도 불필요). 이때 단말기 안에서 "키"가 만들어지고, 그것이 당신의 신원이 됩니다.
2. 자신의 ID나 QR 코드를, 대화하고 싶은 상대에게 건넵니다.
3. 상대도 앱을 열고 있으면, 직접 연결되어 대화할 수 있습니다. 상대가 열고 있지 않을 때는, 암호화된 채로 "보관함"에 놓이고, 상대가 열었을 때 도착합니다. 보관함을 운반하는 서버는 내용을 읽을 수 없습니다. 도착하지 않은 편지는 최대 7일이 지나면 자동으로 사라집니다.

## 약속(하지 않는 것)

- **광고는 내지 않습니다.** 앱 안에도, 어디에도.
- **추적하지 않습니다.** 이용 상황 분석, 광고 장치, 데이터 매매는 일절 하지 않습니다.
- **만든 사람은 이용자의 데이터를 갖지 않습니다.** 서버 쪽에 계정 목록 자체가 없습니다. 신원은 당신의 단말기 안의 키뿐입니다.
- **대화는 단말기끼리 암호화됩니다.** 서버가 다루는 것은 읽을 수 없는 봉투뿐입니다.

솔직하게 범위도 적습니다. 전달을 위해, 서버에는 짧은 기간의 보관이 있습니다(미배달 봉투는 최대 7일, 연결 신호는 5분, 주소와 단말기 기록은 90일, 그룹 정보와 알림 구독은 30일. 모두 자동으로 사라지고, 내용은 읽을 수 없습니다). 클라우드 예비 저장은 처음에는 비활성화되어 있습니다. 자신의 서버에 설치하면, 그 보관도 자신의 관리 아래에 둘 수 있습니다.

## 할 수 있는 것

- 1대1 대화와, 그룹 대화(최대 1,000명)
- 음성 통화와 영상 통화(그룹 통화는 최대 8명)
- 통화 기록(이 기기에만 남습니다: 상대방, 방향, 시간, 통화 시간만 — 통화 내용은 없습니다. 서버나 상대방에게 절대 전송되지 않습니다)
- 파일 전송(1대1에서는 최대 50MB. 그룹에서도 보낼 수 있지만, 크기 상한은 작습니다)
- 여러 단말기·여러 계정의 구분 사용(업무용과 개인용 등. 대수도 계정 수도 무료로 무제한)
- 자동 백업(무언가 바뀌면, 암호화된 백업이 자신의 서버에 자동으로 저장됩니다. 새 단말기에서는, 신원을 되돌리면 백업이 자동으로 발견되어 제안됩니다. 설정에서는 새 단말기로의 이동도 안내합니다)
- 연락처마다 자신이 정하는 이름(연락처마다 이름을 바꿀 수 있고, 이 단말기에만 저장됩니다. 상대가 스스로 정한 이름을 표시할지도 선택할 수 있습니다)
- 51개 언어(영어와 언어 파일 50개), 단말기의 언어에 맞춰 자동으로 선택됩니다
- 사진이 있는 프로필, 스티커, 위치 정보 공유
- `/help` 등의 명령 조작(71종류)
- 배터리에 맞춘 전원 모드(자동/보통/절전/비상시). 배터리가 줄면 수신 확인 간격을 넓혀 배터리가 오래 갑니다. 재해 등 충전할 수 없을 때를 위한 대비입니다
- 휴대폰의 하단 탭(채팅 / 통화 / 연락처 / 내 카드 / 설정. 어떤 탭을 표시할지는 설정에서 선택할 수 있습니다)
- 보기 쉬운 화면(색의 대비, 문자의 크기, 키보드만으로의 조작에 대한 배려)

## 다른 메신저와의 차이

| | Breeze | 많은 메신저 |
|---|--------|--------|
| 등록 | 불필요(신원은 단말기 안의 키) | 전화번호가 필요 |
| 서버 | 내용을 읽을 수 없음 | 운영 회사를 신뢰하는 전제 |
| 자신의 서버에 설치 | 전제(설치해서 쓰는 것) | 불가능 |
| 내용 공개 | 전부 공개(MIT 라이선스) | 비공개가 많음 |
| 데이터의 장소 | 당신의 단말기 안 | 운영 회사의 서버 |

Signal이나 LINE과의 자세한 비교는 [비교 페이지(영어)](../COMPARISON.md)에 있습니다. Breeze의 주장에는 하나하나 "확인하는 방법"이 붙어 있고, Breeze가 지고 있는 점(이용자 수, 외부 감사를 받지 않은 것 등)도 숨기지 않고 적혀 있습니다.

## 자신의 서버에 설치하는 경우의 비용

Breeze는 Cloudflare의 무료 범위에서 동작합니다. 신용카드도 필요 없습니다.

| 항목 | 무료 범위 | 유료인 경우 |
|-----------|-----------|-------------|
| 둘 장소 | Cloudflare Pages(무료) | — |
| 처리 | 하루 10만 회까지 | 월 1,000만 회까지 |
| 저장 | 하루 읽기 10만 회·쓰기 1천 회까지 | 월 읽기 1,000만 회·쓰기 100만 회까지 |
| 통화 중계 | 20GB까지 무료 | 1GB당 0.05달러 |
| 고유 도메인 | 불필요(무료 주소가 붙습니다) | 연 10달러 |
| **합계** | **월 0달러**(가벼운 사용으로 20~40명 정도까지) | **월 5달러부터**(가벼운 사용으로 약 100명 규모. 1,000명 규모에서는 사용법에 따라 월 34~222달러) |

큰 규모에서의 비용 증가 방식과, "왜 한 사람의 운영자가 전체 비용을 짊어지지 않아도 되는가"는 [비용과 지속에 대한 생각(영어)](../SUSTAINABILITY.md)에, 바탕이 되는 계산은 [비용 모델(영어)](../COST_MODEL.md)에 있습니다.

설치는 이 1개 명령부터입니다(자세한 내용은 [설치 안내서](SELF_HOSTING-ko.md)).

```bash
wrangler pages deploy . --project-name=breeze
```

## 기술 세부 사항(개발자용)

### 암호 방식

| 역할 | 방식 |
|-------|-----------|
| 키 교환 | X25519(예비: P-256) |
| 서명 | Ed25519(예비: HMAC-SHA256) |
| 암호화 | AES-256-GCM |
| 키 유도 | HKDF-SHA256 |
| 대화 키 갱신 | Double Ratchet(Signal과 같은 방식) |
| 그룹 키 | Sender Key |
| 보낸 사람을 중계에 숨김 | Sealed Sender |

설계의 정본은 [사양서 SPEC.md](../../SPEC.md), 약점 신고처와 방침은 [SECURITY.md](../../SECURITY.md)에 있습니다.

### 테스트와 품질 검사

```bash
npm ci            # 개발용 도구를 넣는다
npm test          # 테스트를 실행한다
./validate.sh     # 품질 검사(구문·안전성·언어·방식 준수 등 7개 분야)
./build.sh zip    # 배포용 ZIP을 만든다
```

### 개발 참여

진행 방식과 규약은 [CONTRIBUTING.md](../../CONTRIBUTING.md)에 있습니다.
결함 신고는 [Issue 페이지](https://github.com/shizukutanaka/Breeze/issues)로. 행동 규범은 [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)입니다.

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [../COMPARISON.md](../COMPARISON.md).

## 라이선스

MIT — [LICENSE](../../LICENSE)에 따라, 자유롭게 사용하고, 고치고, 배포할 수 있습니다.

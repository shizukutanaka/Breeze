# 자체 호스팅 안내서

**다른 언어로 읽기**: [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · 한국어(이 페이지) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


> **시작하기 전에: 표준 설치에는 Cloudflare 계정이 필요합니다.**
> 이 안내서의 표준 설치 — 아래의 Cloudflare 배포
> — 는 Cloudflare에서 동작하므로, 시작하기 전에 Cloudflare 계정을
> 준비하세요. Cloudflare를 사용하고 싶지 않다면,
> 이 안내서의 Docker와 베어 Node 설치는 Cloudflare
> 계정이 필요 없습니다.

Breeze 중계를 운영하는 방법은 두 가지가 있습니다:

1. **자체 호스팅(Node + Docker)** — 자신의 기계나
   VPS 위의 중계: 컨테이너 하나, 데이터 볼륨 하나, 등록은 기본적으로
   닫혀 있습니다. 중계가 당신과 당신의 사람들을 위한 것이라면 여기서 시작하세요.
2. **Cloudflare** — Cloudflare의 무료 한도에서의 공식 방식 배포
   (Breeze 자체가 운영하는 중계). 유지할 서버 없이 공개 중계를 원한다면
   여기서 시작하세요.

둘 다 동일한 핸들러 코드를 실행합니다. 중계는 어느 쪽이든 단순하고
교체 가능한 보관함이며, 모든 클라이언트는 모든 중계와 동작합니다.

## Docker로 자체 호스팅

```bash
# 1. 코드를 가져온다
git clone https://github.com/shizukutanaka/Breeze.git && cd Breeze

# 2. 자신의 Breeze ID를 허용한 상태로 시작한다(찾는 방법은 아래
#    "등록"을 참조 — 모두에게 닫힌 상태로 시작해서 나중에 ID를
#    추가할 수도 있다)
BREEZE_ALLOWLIST=<your Breeze ID> docker compose up -d

# 3. 첫 부팅 로그를 본다 — 중계 신원의 지문이 출력된다;
#    적어 둔다("중계 신원" 참조)
docker compose logs breeze
```

중계는 컨테이너 안에서 포트 8787로 평문 HTTP를 제공합니다.
**앞에 리버스 프록시를 두고 거기서 TLS를 종단하세요**(Caddy, nginx,
Traefik, Cloudflare Tunnel, …): 브라우저는 HTTPS/WSS로만 중계를
사용합니다. 그렇게 할 때는 `docker-compose.yml`에 `TRUST_PROXY: "true"`를
설정해서 속도 제한이 실제 클라이언트 주소를 기준으로 걸리게 하세요 —
그리고 그런 프록시 없이 설정해서는 절대 안 됩니다. 그것이 신뢰하는 헤더는
진입점에 직접 닿을 수 있는 누구나 위조할 수 있기 때문입니다.

데이터 볼륨에 대해서는 컨테이너를 정확히 **하나**만 실행하세요: 속도
제한기는 프로세스별 메모리 안에 있고 각 보관함의 연산은 그 프로세스
안에서 직렬화되므로, 두 번째 복제본은 어느 성질도 유지하지 못합니다.
확장은 하나의 프로세스에 더 큰 기계를 주는 방식으로 하세요.

### 등록: 기본적으로 닫혀 있음

인터넷의 누구나 등록할 수 있는 자체 호스팅 중계는, 공식 중계의
상한이 통제하려고 존재하는 스팸/악용 경제를 재현하게 되므로, **Docker
패키징은 닫힌 상태로 출하됩니다**: compose 파일은
`REGISTRATION_ALLOWLIST`(비어 있을 수 있음)를 전달하고, 거기에 있는
Breeze ID만 *계정을 만들* 수 있습니다(첫 prekey 업로드). 등록을 닫는 것은
이미 그 중계에 자리 잡은 사람들에게는 전혀 영향을 주지 않습니다 — 그들의
업로드, 맡기기, 랑데부, 폴링은 게이트되지 않습니다 — 그리고 등록을 여는 것은
명시적인 선택이며, 결코 기본값이 아닙니다.

- **당신의 Breeze ID**는 초대 링크에 있는 12자 식별자입니다(그 `pub` 값의
  처음 12자). 초대하는 각 사람에게도 같은 방법으로 물어보세요 — ID는
  연락처끼리 이미 주고받는 공개 식별자이며, 비밀이 아닙니다.
- **사람들을 허용**하려면 그들의 ID를 나열하세요:
  `BREEZE_ALLOWLIST=id1,id2,…`를 셸이나 `docker-compose.yml` 옆의 `.env`
  파일에 설정한 뒤, 다시 `docker compose up -d` 하세요.
- **지금 시작하고, 허용은 나중에**: `BREEZE_ALLOWLIST`를 설정하지 않으면,
  중계는 모두에게 닫힌 상태로 동작합니다 — 부팅 로그가 그렇게 말합니다 —
  ID를 추가할 때까지 아무도 등록할 수 없습니다.
- **공개 중계**(누구나 등록 가능): `docker-compose.yml`에서
  `REGISTRATION_OPEN: "1"`의 주석을 해제하세요. 그렇게 하면 악용 경제는
  당신의 책임이 됩니다.

### 사용량 쿼터: 자신의 중계에서는 끄세요

워커는 **공정 사용 쿼터**가 활성화된 상태로 출하됩니다: 보관함당
최대 10,000회 맡기기/일, 200,000회/월(맡기기 1회는 완전한 전달
사이클 1회입니다 — 정책과 수치는 `docs/COST_MODEL.md` §10 참조).
그 틀은 *공유 기본 중계*를 위해 존재합니다. 기본 중계는 무료 입구로
운영되며, 그렇지 않으면 운영자가 모두의 변동 비용을 떠안게 됩니다.
**자신과 자신의 사람들을 위해 운영하는 중계에서는, 그 틀은 무의미합니다 —
끄세요**:

```bash
USAGE_QUOTA_ENABLED=false
```

중계가 환경을 읽는 곳 어디에든 설정하세요(셸이나 `docker-compose.yml`
옆의 `.env`, Node 프로세스 환경, 또는 Cloudflare Pages 시크릿).
커뮤니티 중계를 운영하면서 틀을 *원하는* 경우를 위해 이웃한 손잡이
두 개가 있습니다: `USAGE_QUOTA_DAILY`와 `USAGE_QUOTA_MONTHLY`로
상한을 다시 조정합니다. 중요한 주의:

- 쿼터는 보관함이 Durable Objects에 있을 때만(`MAILBOX_BACKEND=do`,
  이 호스트의 기본값) 강제됩니다. KV 백엔드에서는 문서화된
  무동작(no-op)입니다.
- 상한을 넘으면, 보낸 사람은 조용한 누락 대신 명시적인
  `429 USAGE_QUOTA_EXCEEDED`(윈도와 그 상한 포함)를 받습니다 —
  메시지는 보낸 사람의 발신함에 남고, 받는 사람은 P2P와 다른
  모든 홈 중계를 통해 계속 닿을 수 있습니다.

### 중계 신원

첫 부팅 때 중계는 *데이터 볼륨 안에* 영속적인 Ed25519 신원 키를
생성하고, 그 지문을 로그에 출력합니다:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

지문은 *당신의* 중계를 식별합니다: 사용자들에게 대역 외로(직접 만나서,
다른 채널로) 건네서, 그들이 건네받은 중계가 당신이 운영하는 것임을
알아볼 수 있게 하세요. 같은 지문은 부팅할 때마다 출력됩니다. 만약
바뀌었다면, 데이터 볼륨이 교체된 것입니다 — 사용자들에게 새 것을
신뢰하라고 말하기 전에 조사하세요.

클라이언트는 이 키를 자동으로 검증하고 고정합니다(2단계 4단계): 첫
접촉 때 클라이언트는 중계에 그 키로 서명하도록 도전하고
(`/api/relay/attest`), 검증된 키를 계정과 함께 저장하며, 이후 모든
세션에서 다시 검증합니다. 클라이언트가 표시하는 지문(`/security`
아래, 그리고 첫 고정 때의 토스트)은 같은 키에서 도출됩니다 — 위의
부팅 로그 줄과 비교하세요. 키가 바뀌면, 클라이언트는 **중계와의
대화를 멈추고** 사용자에게 경고합니다. 조용히 다시 고정하는 일은
결코 없습니다. 지문 변경은 파괴적 사건으로 취급하세요: 4단계에는
앱 안에 "새 키를 신뢰" 버튼이 없으므로, 실제로 볼륨을 잃은 뒤에는
사용자들이 그 계정에 대해 앱에 저장된 데이터를 지우고 첫 접촉 때
다시 고정해야 합니다 — 새 지문을 먼저 대역 외로 알리세요. 그렇지
않으면 당신의 새 키와 공격자의 키를 구별할 수 없습니다.

### 백업과 복원

**데이터 볼륨이 중계 상태의 전부입니다**: 디렉터리, 보관함, 중계
신원 키를 담은 SQLite 파일 하나. 백업할 것은 그 밖에 없습니다.

```bash
# 백업: (멈춘) 컨테이너에서 데이터베이스를 복사해 낸다
docker compose stop
docker cp "$(docker compose ps -aq breeze)":/data/breeze-relay.db ./breeze-relay-backup.db
docker compose start

# 복원: 시작하기 전에 백업을 /data/breeze-relay.db로 되돌려 넣으면,
# 중계는 동일하게 동작한다 — 지문도 같다.
docker compose stop
docker cp ./breeze-relay-backup.db "$(docker compose ps -aq breeze)":/data/breeze-relay.db
docker compose start
```

### 업데이트

```bash
git pull origin main
docker compose up -d --build
```

상태는 이미지가 아니라 볼륨에 있으므로, 업데이트는 사용자의
데이터에 결코 닿지 않습니다.

## 베어 Node로 자체 호스팅(Docker 없음)

```bash
node server/index.js   # Node ≥ 24, 설치할 npm 의존성 없음
```

설정은 환경 변수만으로 합니다 — `server/README.md`에 전부가
나열되어 있습니다. Docker 경로와의 차이 두 가지:

- **데이터 파일**은 기본값이 `./breeze-relay.db`입니다(`BREEZE_DB_PATH`로
  재정의). 중계 신원을 포함해 같은 단일 파일 상태입니다. 백업도
  같은 방법으로: 멈추고, 복사하고, 재시작하세요.
- **등록은 닫지 않는 한 열려 있습니다**: 닫힌 기본값은 Docker
  패키징의 성질입니다. 베어 진입점을 닫으려면,
  `REGISTRATION_ALLOWLIST=id1,id2`(또는 모두에게 닫힌 빈 값)를
  설정하세요. `REGISTRATION_OPEN=1`은 명시적으로 다시 엽니다.

## Cloudflare 배포

### 최소 배포(월 0달러, 5분)

```bash
# 1. Wrangler CLI 설치
npm install -g wrangler

# 2. Cloudflare에 로그인
wrangler login

# 3. 배포
wrangler pages deploy . --project-name=breeze

# 4. KV 네임스페이스를 만들고 wrangler.toml에 선언한다
wrangler kv:namespace create KV
# 새 네임스페이스의 ID를 복사해서 wrangler.toml에 넣고,
# [[kv_namespaces]] 절의 id(binding = "KV")를 교체한다. Pages는
# 바인딩을 wrangler.toml에서 가져온다; 대시보드에서만 설정한
# 바인딩은 wrangler.toml이 존재하는 한 적용되지 않는다.
# 그다음 바인딩이 효력을 갖도록 다시 배포한다:
wrangler pages deploy . --project-name=breeze

# 5. Visit your deployment's URL (https://<your-project>.pages.dev)
```

**이것으로 끝입니다.** 푸시 알림을 제외한 모든 기능이 동작합니다.
Cloudflare 배포에서의 등록은, 직접 `REGISTRATION_ALLOWLIST`를
설정하지 않는 한 **열려** 있다는 점에 주의하세요(`.env.example`
참조). 닫힌 기본값의 패키징은 위의 Docker 경로입니다.

### 0달러로 동작하는 것

| 기능 | 상태 | 비고 |
|---------|--------|-------|
| E2E 암호화 채팅 | ✓ | 완전한 Double Ratchet |
| P2P 메시징 | ✓ | WebRTC DataChannel |
| 음성/영상 통화 | ✓ | WebRTC + 무료 STUN |
| TURN 중계 | ✓ | Open Relay(월 20GB 무료) |
| 그룹(1,000명) | ✓ | Sender Key O(1) |
| 파일 전송 | ✓ | P2P로 최대 50MB |
| 51개 언어 | ✓ | 영어 내장 + 완전한 로케일 파일 50개, 자동 감지 |
| 오프라인/PWA | ✓ | Service Worker |
| 푸시 알림 | ✗ | VAPID 키가 필요 |

다중 계정 과금(Lite/Plus/Pro)은 이용할 수 없습니다 —
[SECURITY.md](../../SECURITY.md)의 "Removed: multi-account billing" 절을 보세요. 모든 계정은
플랜 게이트 없이 무료로 무제한의 로컬 하위 계정을 받습니다.

### 무료 한도의 제한

| 자원 | 무료 한도 | 활성 사용자당 사용량 |
|----------|-----------|----------------------|
| Worker 요청 | 100,000/일 | ~500/일(폴링 + 시그널링) |
| KV 읽기 | 100,000/일 | ~200/일 |
| KV 쓰기 | 1,000/일 | ~350/일(최적화됨) |
| KV 저장 | 1 GB | ~10 KB/사용자 |
| 정적 자산 | 무제한 | ~894 KB(단일 HTML) |

**무료 한도에서 동시 활성 사용자 약 3명을 지원합니다.**

### 선택 기능 추가

#### 푸시 알림(무료)

```bash
# VAPID 키 생성
npx web-push generate-vapid-keys

# 시크릿 설정
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### TURN 서버(제한적인 네트워크용)

TURN은 통화와 중계 전용(IP 숨김) 연결이 제한적인 NAT를 넘는
방법입니다. 당신의 중계가 어떤 TURN을 건넬지는 운영자인 **당신의**
선택입니다 — Worker는 다음 순서로 시도합니다:

```bash
# 옵션 A: Cloudflare Calls (0.05달러/GB, 글로벌 애니캐스트)
wrangler pages secret put TURN_KEY_ID
wrangler pages secret put TURN_KEY_API_TOKEN

# 옵션 B: 자신의 coturn (HMAC 시간 제한 자격 증명 — Worker가 시크릿으로
# 등록 사용자마다 24시간짜리 사용자 이름/자격 증명을 발급한다)
#   coturn: use-auth-secret, static-auth-secret=<같은 시크릿>
wrangler pages secret put TURN_URL      # turn:your-server:3478
wrangler pages secret put TURN_SECRET

# 옵션 C: 정적 자격 증명 (metered.ca, Twilio, …)
wrangler pages secret put TURN_URL
wrangler pages secret put TURN_USERNAME
wrangler pages secret put TURN_CREDENTIAL

# 옵션 D: 설정 없음 → 무료 Open Relay (월 20GB). 이것은 제3자의
# 공개 쿼터로, 설정되지 않은 모든 중계와 공유된다 — 첫 실행에는
# 괜찮지만 토대는 아니다. 명시적으로 거부하면 발신자는 STUN만
# 받는다(일부 제한적 NAT 통화는 그때 눈에 띄게 실패한다):
wrangler pages secret put TURN_OPENRELAY_FALLBACK   # 설정값: false
```

**실제로 설정한 것을 확인하세요:** `GET /api/health`는 유효한 모드를
`turnProvider`(`cloudflare` | `custom` | `static` |
`openrelay` | `none`)로 보고합니다. 오래된 `turn` 불리언은
`TURN_URL`만을 반영하므로, 권장되는 옵션 A에서는 `false`로 읽힙니다 —
`turnProvider`를 사용하세요. 클라이언트는 `/security`에 같은
제공자를 표시하므로, Open Relay 폴백을 쓰는 사용자는 제3자가 자신의
통화 미디어를 중계한다는 것을 볼 수 있습니다(메타데이터만 — 미디어
자체는 DTLS-SRTP로 암호화됩니다).

#### 인증 강화와 평문 중계 경로

Prekey 업로드는 이제 서명 소유권을 `prekey-owner:<userId>`에 **TTL
없이** 별도로 보존합니다. 기존 번들 소유권은 다음 업로드 때, 교체가
수락되기 전에 느리게(lazily) 이전됩니다. 새 Ed25519 번들도 그
기록을 확립합니다. 만료된 prekey 번들을 정리할 때 이 기록들을
유지하세요: 번들 만료를 기다리는 것이 새 소유자를 허용해서는 안
됩니다. 교체에는 이전 소유자가 서명한 업로드가 필요하며, 기존
업로드 다이제스트 안에 새 키를 묶습니다. 인증된 `/account/delete`는
양쪽 기록을 지우고, 번들이 만료된 뒤에도 소유자에 대해 인증할 수
있습니다. 소유자 키를 잃었을 때의 재설정은 없습니다.

이 기록이 있는 계정에서는, 업로드와 메시지/봉인 폴링, 봉인 ACK,
보관함 WebSocket 증명이 영속적인 소유자를 사용해야 합니다.
**`PREKEY_REQUIRE_AUTH=false`나 `QUEUE_REQUIRE_AUTH=false`인 경우에도
서명 없는 요청은 거부됩니다.** 그 플래그들은 소유자가 없는 계정에
대해 기존 기본값과 레거시 의미를 유지합니다. 서명 없는 업로드/큐
요청을 명시적으로 `false`로 수락하면 내용이 없는 비권장 경고가
로그됩니다. 다른 인증 플래그는 변하지 않습니다. 보관함 WebSocket은
모두에게 여전히 서명을 요구합니다.

클라이언트는 큐 활동 전에 서명 초기화를 기다립니다. 복귀 계정
부팅, 리더 승격, 재연결을 포함합니다. 공유 대기는 5초로 제한됩니다.
지원되지 않는 런타임은 즉시 서명 없이 계속합니다. IDB/키 언래핑이
멈춘 경우는 제한 시간이 지난 뒤 서명 없이 계속하고, 준비가 되면
서명합니다. 이것은 폴링 루프를 살려 두는 것이지, **우회가 아닙니다**:
소유자가 뒷받침하는 계정은 서명 키를 사용할 수 있을 때까지 중계에서
받을 수 없습니다. 오래된 시작 경합을 피하려면 업데이트된 클라이언트
자산을 Worker와 함께 배포하세요.

소유자가 보존되기 **전에** 만료된 번들에서는 소유권을 복원할 수
없습니다. 첫 등록은 여전히 TOFU입니다. 소유권 기록은 기존 KV
백엔드를 사용합니다: 결과적 일관성과 동시 쓰기는 이 변경으로
선형화되지 않습니다. 증명은 기존의 5분 신선도 윈도와 연산/페이로드
바인딩을 유지합니다. 윈도 안의 동일한 재시도는 일회용 논스
프로토콜이 아닙니다.

Presence 쓰기와 TURN 자격 증명 발급은 이미 기본적으로 *등록된*
계정(prekey 번들 존재)을 요구하고, 모든 클라이언트는 자동으로
등록합니다. Presence 하트비트는 추가로 Ed25519 소유권 증명을
담습니다(비트가 저장하는 필드에 서명합니다). Worker는 그것이
제시될 때마다 검증합니다 — `PRESENCE_SIGN_REQUIRE_AUTH=true`로 하면
그 증명이 필수가 됩니다. 나머지 Ed25519 서명 플래그는 opt-in으로
남아 있습니다. `wrangler.toml`에 각각과 그 이유가 문서화되어
있습니다(WebCrypto Ed25519가 없는 런타임의 클라이언트는 아예
서명할 수 없습니다).

레거시 평문 중계(`/api/msg/send`, `/api/msg/poll`)는 비권장입니다:
그 응답은 `Deprecation: true` 헤더를 달고, 봉인 경로가 모든 현행
클라이언트의 기본 경로입니다. 살아 있는 클라이언트 중 폴백이
필요한 것이 없음을 확인했으면, 완전히 비활성화하세요:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # 설정값: true
```

#### 커스텀 도메인

```bash
# Cloudflare 대시보드에서:
# Pages > breeze > Custom domains > Add
# 도메인의 DNS를 Cloudflare로 향하게 한다
```

### 무료 한도를 넘어 확장

무료 한도를 넘어서면(월 5달러 Workers Paid 플랜):

| 자원 | 유료 플랜 |
|----------|-----------|
| Worker 요청 | 월 1,000만 |
| KV 쓰기 | 월 100만 |
| KV 저장 | 1 GB 포함 |
| CPU 시간 | 요청당 30초 |

이것은 **수천 명의 동시 사용자**를 지원합니다.

### 업데이트

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

빌드 단계 없음. 설치할 의존성 없음. 그냥 배포하면 됩니다.

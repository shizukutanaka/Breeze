# Hướng dẫn tự lưu trữ

**Đọc bằng ngôn ngữ khác**: [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · Tiếng Việt (trang này) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


> **Trước khi bắt đầu: cách cài đặt tiêu chuẩn cần có tài khoản Cloudflare.**
> Cách cài đặt tiêu chuẩn trong hướng dẫn này — cách triển khai Cloudflare
> dưới đây — chạy trên Cloudflare, vì vậy hãy chuẩn bị sẵn một tài khoản Cloudflare
> trước khi bắt đầu. Nếu bạn không muốn dùng Cloudflare, các cách cài đặt
> Docker và Node trực tiếp trong hướng dẫn này không cần
> tài khoản Cloudflare.

Có hai cách để chạy một máy chủ chuyển tiếp Breeze:

1. **Tự lưu trữ (Node + Docker)** — máy chủ chuyển tiếp trên máy của riêng bạn hoặc
   VPS: một container, một ổ dữ liệu, đăng ký đóng theo
   mặc định. Hãy bắt đầu ở đây nếu máy chủ chuyển tiếp dành cho bạn và những người của bạn.
2. **Cloudflare** — cách triển khai theo phong cách chính thức trên gói
   miễn phí của Cloudflare (máy chủ chuyển tiếp mà chính Breeze vận hành). Hãy bắt đầu ở đó nếu bạn muốn
   một máy chủ chuyển tiếp công cộng mà không có máy chủ nào phải bảo trì.

Cả hai đều chạy cùng một mã xử lý; dù theo cách nào, máy chủ chuyển tiếp cũng là một hộp thư đơn giản,
có thể thay thế cho nhau, và mọi ứng dụng khách đều hoạt động với
mọi máy chủ chuyển tiếp.

## Tự lưu trữ với Docker

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

Máy chủ chuyển tiếp phục vụ HTTP thuần trên cổng 8787 bên trong container.
**Hãy kết thúc TLS tại một proxy ngược ở phía trước nó** (Caddy, nginx,
Traefik, Cloudflare Tunnel, …): trình duyệt sẽ chỉ dùng máy chủ chuyển tiếp
qua HTTPS/WSS. Khi làm vậy, hãy đặt `TRUST_PROXY: "true"` trong
`docker-compose.yml` để việc giới hạn tốc độ khóa theo địa chỉ khách
thực — và đừng bao giờ đặt nó mà không có proxy như vậy, vì tiêu đề
mà nó tin tưởng có thể bị giả mạo bởi bất kỳ ai có thể chạm trực tiếp tới lối vào.

Hãy chạy đúng **một** container trên ổ dữ liệu: bộ giới hạn
tốc độ nằm trong bộ nhớ của từng tiến trình và các thao tác của mỗi hộp thư
được tuần tự hóa bên trong tiến trình đó, vì vậy bản sao thứ hai sẽ không giữ được
cả hai tính chất này. Mở rộng quy mô bằng cách cho tiến trình duy nhất đó một máy lớn hơn.

### Đăng ký: đóng theo mặc định

Một máy chủ chuyển tiếp tự lưu trữ mà bất kỳ ai trên internet cũng có thể đăng ký
sẽ tái tạo lại nền kinh tế spam/lạm dụng mà các giới hạn của máy chủ chuyển tiếp chính thức tồn tại
để kiểm soát, vì vậy **gói Docker được giao ở trạng thái đóng**: tệp
compose truyền vào một `REGISTRATION_ALLOWLIST` (có thể rỗng) và
chỉ các ID Breeze có trong đó mới có thể *tạo tài khoản* (lần tải lên khóa trước
đầu tiên). Việc đóng đăng ký không bao giờ ảnh hưởng đến những người đã an cư trên
máy chủ chuyển tiếp — các lần tải lên, gửi thư, điểm hẹn và thăm dò của họ không
bị chặn — và việc mở đăng ký là một lựa chọn rõ ràng, không bao giờ là
mặc định.

- **ID Breeze của bạn** là định danh 12 ký tự trong liên kết mời
  của bạn (12 ký tự đầu tiên của giá trị `pub` của nó). Hãy hỏi mỗi người
  bạn mời lấy ID của họ theo cùng cách — ID là định danh công khai
  mà các liên hệ vốn đã trao đổi với nhau, không phải bí mật.
- **Cho phép mọi người** bằng cách liệt kê ID của họ: đặt
  `BREEZE_ALLOWLIST=id1,id2,…` trong shell của bạn hoặc một tệp `.env` bên cạnh
  `docker-compose.yml`, rồi chạy lại `docker compose up -d`.
- **Bắt đầu ngay, cho phép sau**: khi không đặt `BREEZE_ALLOWLIST`, máy chủ
  chuyển tiếp chạy ở trạng thái đóng với mọi người — nhật ký khởi động nói rõ điều đó — và không ai
  có thể đăng ký cho đến khi bạn thêm ID.
- **Máy chủ chuyển tiếp mở** (bất kỳ ai cũng có thể đăng ký): bỏ chú thích
  `REGISTRATION_OPEN: "1"` trong `docker-compose.yml`. Nếu làm vậy, bạn sở hữu
  nền kinh tế lạm dụng.

### Hạn mức sử dụng: hãy tắt nó trên máy chủ chuyển tiếp của riêng bạn

Worker được giao với một **hạn mức sử dụng công bằng** được bật: đối với mỗi
hộp thư, tối đa 10.000 lần gửi mỗi ngày và 200.000 lần mỗi tháng (một lần gửi là
một chu kỳ chuyển phát đầy đủ — xem `docs/COST_MODEL.md` §10 về
chính sách và các con số). Khung đó tồn tại cho *máy chủ chuyển tiếp mặc định dùng chung*,
vốn được vận hành như một lối vào miễn phí mà nếu không, chi phí biến đổi của nó
người vận hành sẽ phải gánh cho mọi người. **Trên một máy chủ chuyển tiếp bạn chạy
cho chính mình và những người của mình, khung đó vô nghĩa — hãy tắt
nó**:

```bash
USAGE_QUOTA_ENABLED=false
```

Đặt nó ở bất cứ nơi nào máy chủ chuyển tiếp của bạn đọc môi trường của nó (shell hoặc
`.env` bên cạnh `docker-compose.yml`, môi trường của tiến trình Node,
hoặc bí mật của Cloudflare Pages). Hai núm điều chỉnh kề bên tồn tại nếu bạn
chạy một máy chủ chuyển tiếp cộng đồng và *có* muốn một khung:
`USAGE_QUOTA_DAILY` và `USAGE_QUOTA_MONTHLY` chỉnh lại các mức trần.
Những lưu ý quan trọng:

- Hạn mức chỉ được thực thi khi các hộp thư sống trong Durable
  Objects (`MAILBOX_BACKEND=do`, mặc định trên máy chủ này); trên
  backend KV nó là một no-op đã được ghi chép.
- Vượt quá mức trần, người gửi nhận được một `429 USAGE_QUOTA_EXCEEDED` rõ ràng
  (kèm cửa sổ và giới hạn của nó) thay vì bị loại bỏ âm thầm — tin nhắn
  vẫn ở trong hộp thư đi của người gửi, và người nhận vẫn
  có thể liên lạc được qua P2P và qua bất kỳ máy chủ chuyển tiếp nhà nào khác.

### Danh tính máy chủ chuyển tiếp

Ở lần khởi động đầu tiên, máy chủ chuyển tiếp tạo ra một khóa danh tính Ed25519 bền vững
*bên trong ổ dữ liệu* và in dấu vân tay của nó vào nhật ký:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

Dấu vân tay xác định máy chủ chuyển tiếp *của bạn*: hãy đưa nó cho người dùng của bạn
ngoài kênh (trực tiếp, qua một kênh khác) để họ có thể nhận ra
máy chủ chuyển tiếp được trao cho họ là cái bạn vận hành. Cùng một dấu vân tay
được in ở mỗi lần khởi động; nếu nó thay đổi, ổ dữ liệu đã bị
thay thế — hãy điều tra trước khi bảo người dùng tin tưởng cái mới.

Ứng dụng khách tự động xác minh và ghim khóa này (giai đoạn 2, bước 4): ở
lần liên lạc đầu tiên, ứng dụng khách thách thức máy chủ chuyển tiếp ký bằng khóa
(`/api/relay/attest`), lưu khóa đã xác minh cùng với tài khoản, và
xác minh lại ở mỗi phiên sau đó. Dấu vân tay mà ứng dụng khách hiển thị
(dưới `/security`, và trong thông báo toast ở lần ghim đầu tiên) được suy ra từ
cùng một khóa — hãy so sánh nó với dòng nhật ký khởi động ở trên. Nếu khóa
thay đổi, ứng dụng khách **ngừng nói chuyện với máy chủ chuyển tiếp** và cảnh báo
người dùng; chúng không bao giờ ghim lại một cách âm thầm. Hãy coi việc thay đổi dấu vân tay là một
sự kiện gây phá vỡ: không có nút "tin tưởng khóa mới" trong ứng dụng ở
bước 4, vì vậy sau một lần mất ổ thực sự, người dùng của bạn phải xóa
dữ liệu đã lưu của ứng dụng cho tài khoản của họ và ghim lại ở lần liên lạc đầu tiên —
hãy thông báo dấu vân tay mới ngoài kênh trước, nếu không họ không thể phân biệt
khóa mới của bạn với khóa của kẻ tấn công.

### Sao lưu & khôi phục

**Ổ dữ liệu là toàn bộ trạng thái của máy chủ chuyển tiếp**: một tệp SQLite duy nhất
chứa thư mục, các hộp thư, và khóa danh tính của máy chủ chuyển tiếp.
Không còn gì khác để sao lưu.

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

### Cập nhật

```bash
git pull origin main
docker compose up -d --build
```

Trạng thái sống trong ổ, không phải trong image, vì vậy việc cập nhật không bao giờ chạm tới
dữ liệu của người dùng của bạn.

## Tự lưu trữ với Node thuần (không có Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Cấu hình chỉ là các biến môi trường — `server/README.md`
liệt kê tất cả. Hai điểm khác biệt so với đường Docker:

- **Tệp dữ liệu** mặc định là `./breeze-relay.db` (ghi đè bằng
  `BREEZE_DB_PATH`); đó là cùng một trạng thái một tệp, danh tính máy chủ chuyển tiếp
  bao gồm trong đó. Sao lưu nó theo cùng cách: dừng, sao chép, khởi động lại.
- **Đăng ký mở trừ khi bạn đóng nó**: mặc định đóng
  là một tính chất của gói Docker. Để đóng một lối vào thuần, hãy đặt
  `REGISTRATION_ALLOWLIST=id1,id2` (hoặc một giá trị rỗng cho
  đóng-với-mọi-người); `REGISTRATION_OPEN=1` mở lại một cách rõ ràng.

## Triển khai Cloudflare

### Triển khai tối thiểu ($0/tháng, 5 phút)

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

**Chỉ vậy thôi.** Mọi tính năng đều hoạt động ngoại trừ thông báo đẩy. Lưu ý
rằng đăng ký trên bản triển khai Cloudflare là **mở** trừ khi bạn
tự đặt `REGISTRATION_ALLOWLIST` (xem `.env.example`); gói
đóng-theo-mặc-định là đường Docker ở trên.

### Những gì hoạt động ở mức $0

| Tính năng | Trạng thái | Ghi chú |
|---------|--------|-------|
| Trò chuyện mã hóa E2E | ✓ | Double Ratchet đầy đủ |
| Nhắn tin P2P | ✓ | WebRTC DataChannel |
| Gọi thoại/video | ✓ | WebRTC + STUN miễn phí |
| Chuyển tiếp TURN | ✓ | Open Relay (20GB/tháng miễn phí) |
| Nhóm (1.000 thành viên) | ✓ | Sender Key O(1) |
| Truyền tệp | ✓ | Tối đa 50MB qua P2P |
| 51 ngôn ngữ | ✓ | Tiếng Anh tích hợp sẵn + 50 tệp bản địa hóa đầy đủ, tự động phát hiện |
| Ngoại tuyến/PWA | ✓ | Service Worker |
| Thông báo đẩy | ✗ | Cần khóa VAPID |

Thanh toán nhiều tài khoản (Lite/Plus/Pro) không khả dụng — xem
mục "Removed: multi-account billing" trong [SECURITY.md](../../SECURITY.md). Mọi tài khoản đều nhận
tài khoản phụ cục bộ không giới hạn miễn phí mà không có cổng gói nào.

### Giới hạn gói miễn phí

| Tài nguyên | Gói miễn phí | Mức dùng cho mỗi người dùng hoạt động |
|----------|-----------|----------------------|
| Yêu cầu Worker | 100.000/ngày | ~500/ngày (thăm dò + báo hiệu) |
| Lượt đọc KV | 100.000/ngày | ~200/ngày |
| Lượt ghi KV | 1.000/ngày | ~350/ngày (đã tối ưu) |
| Dung lượng KV | 1 GB | ~10 KB/người dùng |
| Tài sản tĩnh | Không giới hạn | ~894 KB (HTML đơn lẻ) |

**Hỗ trợ ~3 người dùng hoạt động đồng thời trên gói miễn phí.**

### Thêm các tính năng tùy chọn

#### Thông báo đẩy (miễn phí)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### Máy chủ TURN (cho các mạng hạn chế)

TURN là cách các cuộc gọi và kết nối chỉ-qua-chuyển-tiếp (ẩn IP) vượt qua
các NAT hạn chế. Việc máy chủ chuyển tiếp của bạn đưa ra TURN nào là lựa chọn của **bạn**
với tư cách người vận hành — Worker thử, theo thứ tự:

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

**Hãy xác minh những gì bạn thực sự đã cấu hình:** `GET /api/health` báo cáo
chế độ hiệu lực dưới dạng `turnProvider` (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). Boolean `turn` cũ hơn chỉ phản ánh
`TURN_URL`, vì vậy nó đọc là `false` đối với Tùy chọn A được khuyến nghị — hãy dùng
`turnProvider`. Ứng dụng khách hiển thị cùng nhà cung cấp đó trong `/security`, vì vậy một
người dùng trên phương án dự phòng Open Relay có thể thấy rằng một bên thứ ba chuyển tiếp
phương tiện cuộc gọi của họ (chỉ siêu dữ liệu — bản thân phương tiện được mã hóa DTLS-SRTP).

#### Tăng cường xác thực & đường chuyển tiếp thuần cũ

Việc tải lên khóa trước giờ đây bảo toàn quyền sở hữu ký riêng biệt tại
`prekey-owner:<userId>` **không có TTL**. Quyền sở hữu gói hiện có di chuyển lười biếng
ở lần tải lên tiếp theo, trước khi một bản thay thế được chấp nhận. Các gói Ed25519 mới cũng
thiết lập bản ghi đó. Hãy giữ các bản ghi này khi cắt tỉa các gói khóa trước đã hết hạn:
việc chờ gói hết hạn không được phép tạo ra một chủ sở hữu mới. Việc xoay vòng yêu cầu một
lần tải lên được ký bởi chủ sở hữu trước đó, ràng buộc khóa mới vào trong digest tải lên
hiện có. `/account/delete` đã xác thực sẽ xóa cả hai bản ghi và có thể xác thực
với chủ sở hữu ngay cả sau khi gói hết hạn. Không có cách đặt lại khóa-chủ-sở-hữu-bị-mất.

Đối với các tài khoản có bản ghi này, việc tải lên và thăm dò tin nhắn/sealed, ACK sealed và
bằng chứng WebSocket hộp thư phải sử dụng chủ sở hữu bền vững. **Các yêu cầu không có chữ ký
bị từ chối ngay cả với `PREKEY_REQUIRE_AUTH=false` hoặc `QUEUE_REQUIRE_AUTH=false`.**
Các cờ đó giữ nguyên giá trị mặc định hiện có và ngữ nghĩa cũ của chúng cho các tài khoản
không có chủ sở hữu; việc chấp nhận rõ ràng `false` đối với các yêu cầu tải lên/xếp hàng không có chữ ký
ghi nhật ký một cảnh báo ngừng sử dụng không chứa nội dung. Các cờ xác thực khác không thay đổi.
WebSocket hộp thư vẫn yêu cầu chữ ký đối với mọi người.

Ứng dụng khách chờ khởi tạo việc ký trước hoạt động xếp hàng, bao gồm
khởi động tài khoản quay lại, thăng cấp leader và kết nối lại. Việc chờ dùng chung
bị giới hạn ở năm giây. Các runtime không được hỗ trợ tiếp tục không ký ngay lập tức;
IDB/mở gói khóa bị kẹt tiếp tục không ký sau giới hạn, rồi ký khi sẵn sàng.
Điều này giữ vòng lặp thăm dò sống, **không phải** một lối tắt: các tài khoản được chủ sở hữu hậu thuẫn không thể
nhận từ máy chủ chuyển tiếp cho đến khi khóa ký của chúng dùng được. Hãy triển khai tài sản ứng dụng khách đã cập nhật
cùng với Worker để tránh cuộc đua khởi động cũ.

Việc di chuyển không thể khôi phục quyền sở hữu từ một gói đã hết hạn **trước khi**
chủ sở hữu của nó được bảo toàn. Đăng ký lần đầu vẫn là TOFU. Các bản ghi quyền sở hữu dùng
backend KV hiện có: tính nhất quán cuối cùng và các lần ghi đồng thời không được biến thành
có thể tuyến tính hóa bởi thay đổi này. Các bằng chứng giữ nguyên cửa sổ tươi mới năm phút
hiện có và ràng buộc thao tác/tải trọng; các lần thử lại giống hệt trong cửa sổ không phải là
một giao thức nonce dùng một lần.

Việc ghi sự hiện diện và cấp phát thông tin xác thực TURN đã yêu cầu một tài khoản *đã đăng ký*
(có gói khóa trước) theo mặc định, và mọi ứng dụng khách đều đăng ký
tự động. Nhịp tim hiện diện còn mang theo một bằng chứng quyền sở hữu Ed25519
(nhịp tim ký các trường mà nó lưu), bằng chứng này Worker xác minh
bất cứ khi nào nó được trình ra — `PRESENCE_SIGN_REQUIRE_AUTH=true` biến
bằng chứng đó thành bắt buộc. Các cờ chữ ký Ed25519 còn lại vẫn là tùy chọn tham gia;
`wrangler.toml` ghi chép mỗi cờ và lý do (ứng dụng khách trên các runtime không có
WebCrypto Ed25519 hoàn toàn không thể ký).

Đường chuyển tiếp thuần cũ (`/api/msg/send`, `/api/msg/poll`) đã bị ngừng khuyến khích: các phản hồi của nó
mang một tiêu đề `Deprecation: true`, và đường sealed là
tuyến mặc định cho mọi ứng dụng khách hiện tại. Khi bạn đã xác nhận không còn ứng dụng khách đang sống nào
vẫn cần phương án dự phòng, hãy tắt hẳn nó:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Tên miền tùy chỉnh

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Mở rộng vượt gói miễn phí

Khi bạn vượt quá gói miễn phí (gói Workers Paid $5/tháng):

| Tài nguyên | Gói trả phí |
|----------|-----------|
| Yêu cầu Worker | 10 triệu/tháng |
| Lượt ghi KV | 1 triệu/tháng |
| Dung lượng KV | 1 GB đi kèm |
| Thời gian CPU | 30 giây/yêu cầu |

Điều này hỗ trợ **hàng nghìn người dùng đồng thời**.

### Cập nhật

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Không có bước biên dịch. Không có phụ thuộc nào để cài đặt. Chỉ cần triển khai.

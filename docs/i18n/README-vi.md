# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

**Đọc bằng ngôn ngữ khác**: [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · [Dansk](README-da.md) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · Tiếng Việt (trang này) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**Ứng dụng nhắn tin được mã hóa — không cần số điện thoại, không cần đăng ký.**
Nội dung cuộc trò chuyện chỉ có người gửi và người nhận mới đọc được. Ngay cả máy chủ vận chuyển ở giữa cũng không đọc được.
Mọi tính năng đều miễn phí, và không có quảng cáo.

Đây không phải là trang web, mà là phần mềm bạn cài đặt và sử dụng (Windows / Mac / Linux / Android / iPhone / trình duyệt).

![Breeze Messenger screenshot — the main window right after creating an identity](../images/screenshot.png)

## Để sử dụng, hãy đặt nó trên máy chủ của riêng bạn

Breeze không có "máy chủ của công ty vận hành". **Để sử dụng, chính bạn chuẩn bị một nơi (máy chủ) và đặt Breeze lên đó. Đây là cách sử dụng chính thức.**

- Cách cài đặt tiêu chuẩn sử dụng Cloudflare, vì vậy **cần có tài khoản Cloudflare**. Các bước có trong [hướng dẫn cài đặt](SELF_HOSTING-vi.md) (có thể chọn các ngôn ngữ khác ở đầu hướng dẫn).
- Các ứng dụng (Windows / Mac / Linux / Android / iPhone) lấy từ [trang tải xuống](https://github.com/shizukutanaka/Breeze/releases/latest), và sử dụng bằng cách kết nối tới máy chủ của riêng bạn.
- **Về bản cài đặt mẫu (thông báo trung thực)**: Có một bản mẫu để kiểm tra hoạt động (https://breeze-469.pages.dev/). Phần mềm đặt ở đó là cùng một phần mềm, nhưng để sử dụng thực tế, vui lòng dùng máy chủ của riêng bạn. Bản mẫu có thể thay đổi hoặc dừng mà không báo trước. Những gì bạn đặt trên máy chủ của mình sẽ không bị ảnh hưởng bởi việc bản mẫu dừng hoạt động.

Cách sử dụng chi tiết có trong [sách hướng dẫn](MANUAL-vi.md) (có thể chọn các ngôn ngữ khác ở đầu sách hướng dẫn).

## Cách sử dụng (3 bước)

1. Mở Breeze mà bạn đã đặt trên máy chủ của mình (hoặc địa chỉ được người đã đặt cho biết), và nhấn "Bắt đầu với ID ngẫu nhiên" (bạn có thể nhập tên nếu muốn). Chỉ vậy là xong phần chuẩn bị (không cần đăng ký, không cần số điện thoại). Lúc này, một "khóa" được tạo ra bên trong thiết bị, và khóa đó trở thành danh tính của bạn.
2. Đưa ID hoặc mã QR của bạn cho người bạn muốn trò chuyện.
3. Nếu người kia cũng đang mở ứng dụng, hai bạn có thể kết nối trực tiếp và trò chuyện. Nếu họ chưa mở, tin nhắn được đặt ở trạng thái đã mã hóa trong "hộp lưu giữ", và sẽ được chuyển đến khi họ mở ứng dụng. Máy chủ vận chuyển hộp lưu giữ không thể đọc nội dung. Thư không đến được sẽ tự động bị xóa sau tối đa 7 ngày.

## Cam kết (những điều chúng tôi không làm)

- **Chúng tôi không hiển thị quảng cáo.** Không trong ứng dụng, không ở bất cứ đâu.
- **Chúng tôi không theo dõi.** Không phân tích việc sử dụng, không cơ chế quảng cáo, không bán dữ liệu — tuyệt đối không.
- **Người tạo ra không nắm giữ dữ liệu của người dùng.** Phía máy chủ thậm chí không có danh sách tài khoản. Danh tính của bạn chỉ là khóa bên trong thiết bị của bạn.
- **Cuộc trò chuyện được mã hóa giữa các thiết bị.** Máy chủ chỉ xử lý những phong bì mà nó không thể đọc.

Chúng tôi cũng viết trung thực về phạm vi. Để chuyển phát, máy chủ lưu giữ một số thứ trong thời gian ngắn (phong bì chưa chuyển phát tối đa 7 ngày, tín hiệu kết nối 5 phút, bản ghi địa chỉ và thiết bị 90 ngày, thông tin nhóm và đăng ký thông báo 30 ngày. Tất cả đều tự động bị xóa, và nội dung không thể đọc được). Sao lưu lên đám mây bị tắt ban đầu. Nếu bạn đặt nó trên máy chủ của mình, việc lưu giữ đó cũng nằm dưới sự quản lý của bạn.

## Những điều có thể làm

- Trò chuyện 1 đối 1 và trò chuyện nhóm (tối đa 1.000 người)
- Gọi thoại và gọi video (gọi nhóm tối đa 8 người)
- Lịch sử cuộc gọi (chỉ được giữ trên thiết bị này: chỉ người kia, hướng, thời gian và thời lượng cuộc gọi — không có gì trong những điều đã nói. Không bao giờ được gửi đến máy chủ hoặc người kia)
- Gửi tệp (trong trò chuyện 1 đối 1, tối đa 50MB. Trong nhóm cũng gửi được, nhưng giới hạn kích thước nhỏ hơn)
- Sử dụng nhiều thiết bị, nhiều tài khoản (chẳng hạn công việc và cá nhân. Cả số thiết bị và số tài khoản đều miễn phí và không giới hạn)
- Sao lưu tự động (khi có thay đổi, một bản sao lưu đã mã hóa được lưu tự động vào máy chủ của riêng bạn. Trên thiết bị mới, sau khi bạn khôi phục danh tính, một bản sao lưu được tìm thấy tự động và được đề xuất cho bạn. Cài đặt cũng hướng dẫn bạn chuyển sang thiết bị mới)
- Tên bạn chọn cho mỗi liên hệ (bạn có thể đổi tên mỗi liên hệ, chỉ lưu trên thiết bị này. Bạn cũng có thể chọn có hiển thị tên mà mỗi liên hệ đã đặt cho chính họ hay không)
- 51 ngôn ngữ (tiếng Anh cộng thêm 50 tệp ngôn ngữ), được chọn tự động theo ngôn ngữ của thiết bị của bạn
- Hồ sơ có ảnh, nhãn dán, chia sẻ vị trí
- Thao tác bằng lệnh như `/help` (71 loại)
- Chế độ nguồn phù hợp với pin của bạn (tự động / bình thường / tiết kiệm pin / khẩn cấp). Khi pin yếu dần, việc kiểm tra thư đến được giãn cách để pin dùng được lâu hơn. Một biện pháp bảo vệ cho thảm họa và những lúc không thể sạc pin
- Tab dưới cùng trên điện thoại (Trò chuyện / Cuộc gọi / Danh bạ / Thẻ của tôi / Cài đặt. Tab nào được hiển thị có thể được chọn trong cài đặt)
- Màn hình dễ đọc (chú trọng độ tương phản màu, cỡ chữ và thao tác chỉ bằng bàn phím)

## Khác biệt với các ứng dụng nhắn tin khác

| | Breeze | Hầu hết các ứng dụng nhắn tin |
|---|--------|--------|
| Đăng ký | Không cần (danh tính là khóa trong thiết bị) | Cần số điện thoại |
| Máy chủ | Không đọc được nội dung | Dựa trên sự tin tưởng vào công ty vận hành |
| Đặt trên máy chủ của mình | Tiền đề (là thứ để đặt và dùng) | Không thể |
| Công khai nội dung bên trong | Công khai toàn bộ (giấy phép MIT) | Thường không công khai |
| Nơi chứa dữ liệu | Bên trong thiết bị của bạn | Trên máy chủ của công ty vận hành |

So sánh chi tiết với Signal và LINE có ở [trang so sánh (tiếng Anh)](../COMPARISON.md). Mỗi tuyên bố của Breeze đều kèm theo "cách để kiểm chứng", và những điểm Breeze thua (số lượng người dùng, chưa được kiểm toán bên ngoài, v.v.) cũng được viết ra không giấu giếm.

## Chi phí khi đặt trên máy chủ của riêng bạn

Breeze chạy trong phạm vi miễn phí của Cloudflare. Không cần thẻ tín dụng.

| Hạng mục | Phạm vi miễn phí | Khi trả phí |
|-----------|-----------|-------------|
| Nơi đặt | Cloudflare Pages (miễn phí) | — |
| Xử lý | Tối đa 100.000 lần mỗi ngày | Tối đa 10 triệu lần mỗi tháng |
| Lưu trữ | Mỗi ngày đọc tối đa 100.000 lần, ghi tối đa 1.000 lần | Mỗi tháng đọc 10 triệu lần, ghi 1 triệu lần |
| Chuyển tiếp cuộc gọi | Miễn phí đến 20GB | 0,05 đô la mỗi 1GB |
| Tên miền riêng | Không cần (được kèm địa chỉ miễn phí) | 10 đô la mỗi năm |
| **Tổng cộng** | **0 đô la mỗi tháng** (với mức sử dụng nhẹ, đến khoảng 20–40 người) | **Từ 5 đô la mỗi tháng** (với mức sử dụng nhẹ, quy mô khoảng 100 người. Ở quy mô 1.000 người, tùy cách sử dụng, 34–222 đô la mỗi tháng) |

Cách chi phí tăng lên ở quy mô lớn và "tại sao một người vận hành không phải gánh chi phí cho tất cả" có trong [suy nghĩ về chi phí và tính bền vững (tiếng Anh)](../SUSTAINABILITY.md), và phép tính gốc có trong [mô hình chi phí (tiếng Anh)](../COST_MODEL.md).

Việc cài đặt bắt đầu từ một lệnh duy nhất này (chi tiết trong [hướng dẫn cài đặt](SELF_HOSTING-vi.md)).

```bash
wrangler pages deploy . --project-name=breeze
```

## Chi tiết kỹ thuật (dành cho nhà phát triển)

### Phương thức mã hóa

| Vai trò | Phương thức |
|-------|-----------|
| Trao đổi khóa | X25519 (dự phòng: P-256) |
| Chữ ký | Ed25519 (dự phòng: HMAC-SHA256) |
| Mã hóa | AES-256-GCM |
| Suy ra khóa | HKDF-SHA256 |
| Cập nhật khóa cuộc trò chuyện | Double Ratchet (cùng phương thức như Signal) |
| Khóa nhóm | Sender Key |
| Ẩn người gửi khỏi bên chuyển tiếp | Sealed Sender |

Tài liệu gốc của thiết kế là [tài liệu đặc tả SPEC.md](../../SPEC.md), và nơi báo cáo điểm yếu cùng chính sách có trong [SECURITY.md](../../SECURITY.md).

### Kiểm thử và kiểm tra chất lượng

```bash
npm ci            # 開発用の道具を入れる
npm test          # テストを実行する
./validate.sh     # 品質チェック（構文・安全性・言語・方式の準拠など7分野）
./build.sh zip    # 配布用ZIPを作る
```

### Tham gia phát triển

Cách tiến hành và quy ước có trong [CONTRIBUTING.md](../../CONTRIBUTING.md).
Báo cáo lỗi xin gửi tới [trang Issue](https://github.com/shizukutanaka/Breeze/issues). Quy tắc ứng xử là [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md).

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [../COMPARISON.md](../COMPARISON.md).

## Giấy phép

MIT — như trong [LICENSE](../../LICENSE), tự do sử dụng, sửa đổi và phân phối.

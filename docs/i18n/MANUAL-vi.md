# Sách hướng dẫn Breeze

**Đọc bằng ngôn ngữ khác**: [日本語](../MANUAL-ja.md) · [English](MANUAL-en.md) · [中文（简体）](MANUAL-zh-CN.md) · [中文（繁體）](MANUAL-zh-TW.md) · [Español](MANUAL-es.md) · [Français](MANUAL-fr.md) · [Deutsch](MANUAL-de.md) · [Italiano](MANUAL-it.md) · [Português (Brasil)](MANUAL-pt-BR.md) · [Русский](MANUAL-ru.md) · [Українська](MANUAL-uk.md) · [Polski](MANUAL-pl.md) · [Nederlands](MANUAL-nl.md) · [Svenska](MANUAL-sv.md) · [Norsk](MANUAL-nb.md) · [Dansk](MANUAL-da.md) · [Suomi](MANUAL-fi.md) · [Čeština](MANUAL-cs.md) · [Magyar](MANUAL-hu.md) · [Română](MANUAL-ro.md) · [Ελληνικά](MANUAL-el.md) · [Türkçe](MANUAL-tr.md) · [العربية](MANUAL-ar.md) · [فارسی](MANUAL-fa.md) · [עברית](MANUAL-he.md) · [हिन्दी](MANUAL-hi.md) · [বাংলা](MANUAL-bn.md) · [اردو](MANUAL-ur.md) · [ਪੰਜਾਬੀ](MANUAL-pa.md) · [தமிழ்](MANUAL-ta.md) · [తెలుగు](MANUAL-te.md) · [മലയാളം](MANUAL-ml.md) · [Bahasa Indonesia](MANUAL-id.md) · [Bahasa Melayu](MANUAL-ms.md) · Tiếng Việt (trang này) · [ไทย](MANUAL-th.md) · [မြန်မာ](MANUAL-my.md) · [ខ្មែរ](MANUAL-km.md) · [한국어](MANUAL-ko.md) · [Filipino](MANUAL-tl.md) · [Kiswahili](MANUAL-sw.md) · [Hausa](MANUAL-ha.md) · [Yorùbá](MANUAL-yo.md) · [Igbo](MANUAL-ig.md) · [አማርኛ](MANUAL-am.md) · [ქართული](MANUAL-ka.md) · [Azərbaycan](MANUAL-az.md) · [Қазақша](MANUAL-kk.md) · [Oʻzbek](MANUAL-uz.md) · [Српски](MANUAL-sr.md) · [Hrvatski](MANUAL-hr.md)


Breeze là ứng dụng nhắn tin được mã hóa, không cần số điện thoại cũng không cần đăng ký.
Nội dung cuộc trò chuyện chỉ có người gửi và người nhận mới đọc được. Ngay cả máy chủ vận chuyển ở giữa cũng không đọc được.
Mọi tính năng đều miễn phí, và không có quảng cáo.

Sách hướng dẫn này là chỉ dẫn dành cho người mới bắt đầu sử dụng.

---

## 1. Cách bắt đầu

### Lấy ứng dụng

Từ [trang tải xuống](https://github.com/shizukutanaka/Breeze/releases/latest), hãy chọn một bản phù hợp với máy của bạn.

- Windows: bản có tên kết thúc bằng `-win-x64.exe` (cũng có bản cho máy ARM)
- Mac: bản có tên kết thúc bằng `-mac.dmg`
- Linux: `.AppImage` (chạy được ngay) hoặc `.deb`
- Nếu dùng trong trình duyệt, hãy dùng bản đã đặt trên máy chủ của riêng bạn (các bước cài đặt có trong tài liệu riêng "Hướng dẫn cài đặt")

Mỗi tệp đều kèm theo giá trị đối chiếu (SHA256SUMS.txt). Nếu lo lắng, bạn có thể kiểm tra xem giá trị của tệp đã tải xuống có khớp hay không.

> **Về trang dùng thử**: Trang dùng thử từng công bố (breeze.pages.dev) hiện đang dừng hoạt động (khi mở sẽ hiện 404). Cho đến khi được khôi phục, vui lòng dùng bản ứng dụng. Những gì đặt trên máy chủ của riêng bạn sẽ không bị ảnh hưởng bởi việc dừng này.

### Thiết lập lần đầu

1. Mở ứng dụng.
2. Nhập tên của bạn. Chỉ vậy là xong phần chuẩn bị. Không cần đăng ký, không cần số điện thoại.

Lúc này, một "khóa" được tạo ra bên trong thiết bị. Đó chính là danh tính của bạn.
**Danh sách tài khoản không tồn tại trên máy chủ.** Danh tính chỉ nằm bên trong thiết bị của bạn.
Điều này trở nên quan trọng trong chương sao lưu (8).

### Về "danh tính dùng một lần"

Nếu bạn chọn "danh tính dùng một lần" khi tạo, đó sẽ là danh tính không có bất kỳ cách khôi phục nào.
Nếu bạn làm mất thiết bị đó, khôi phục cài đặt gốc, hoặc xóa dữ liệu trình duyệt, danh tính đó sẽ không bao giờ trở lại.
Điều đó cũng được hiển thị trên màn hình. Đừng chọn nó cho danh tính dùng lâu dài.

---

## 2. Kết nối với người khác

Có 3 cách để kết nối với người bạn muốn trò chuyện.

- **Đưa ID**: Cho người kia biết ID của bạn và nhờ họ nhập vào.
- **Mã QR**: Hiển thị mã QR mời và nhờ người kia quét.
- **Liên kết mời**: Sao chép tin nhắn mời từ "Mời bạn bè" và gửi bằng phương tiện liên lạc thường dùng của bạn (chẳng hạn e-mail). Khi người kia mở liên kết và nhập tên, họ có thể trò chuyện ngay.

Nếu người kia cũng đang mở ứng dụng, hai bạn có thể kết nối trực tiếp và trò chuyện.

---

## 3. Trò chuyện

- Chỉ cần nhập tin nhắn và gửi. Ảnh, nhãn dán và thông tin vị trí cũng gửi được.
- **Gửi tệp**: Trong trò chuyện 1 đối 1, tối đa 50MB. Trong nhóm thì nhỏ hơn, khoảng 50KB.
- Các tệp có định dạng nguy hiểm như tệp thực thi sẽ tự động bị chặn.
- Khi người kia chưa mở ứng dụng, tin nhắn được đặt ở trạng thái đã mã hóa trong "hộp lưu giữ", và sẽ được chuyển đến khi họ mở ứng dụng. Máy chủ vận chuyển hộp lưu giữ không thể đọc nội dung. Thư không đến được sẽ tự động bị xóa sau **tối đa 7 ngày**.
- Lịch sử trò chuyện có thể xuất ra tệp hoặc nhập vào.

### Lệnh

Khi nhập `/help` vào ô nhập, danh sách các lệnh có thể dùng (hơn 60 loại) sẽ hiện ra.
Một số thao tác như cài đặt và liên kết thiết bị được thực hiện từ lệnh.

---

## 4. Nhóm

- Nhóm có thể chứa tối đa **1.000 người**.
- Cách tạo chỉ là nhập tên nhóm. Việc mời được thực hiện từ "Liên kết mời nhóm". Người nhận được liên kết có thể tham gia bằng cách nhập tên.
- Trong nhóm cũng gửi được tệp, nhưng giới hạn nhỏ, khoảng 50KB. Tin nhắn thoại chưa gửi được trong nhóm.
- Nếu có thành viên đang dùng ứng dụng phiên bản cũ, phương thức mới an toàn hơn (nhóm v5) sẽ không dùng được trong nhóm đó, và cảnh báo sẽ hiện trên màn hình. Nó sẽ có hiệu lực khi mọi người đều dùng phiên bản mới nhất.

---

## 5. Cuộc gọi

- Có thể gọi thoại và gọi video 1 đối 1. Cũng có gọi nhóm.
- **Mã xác nhận cuộc gọi**: Mã xác nhận được hiển thị trên màn hình cuộc gọi. Hãy đọc cho nhau nghe với người kia và xác nhận xem có khớp trên cả hai màn hình không. Nếu không khớp, có khả năng ai đó đang nghe lén ở giữa. Trong trường hợp đó, hãy kết thúc cuộc gọi.
- Gọi nhóm có thể không bắt đầu được nếu ứng dụng của mọi người không phải phiên bản mới nhất.

---

## 6. Nhiều thiết bị, nhiều tài khoản

- Để dùng cùng một danh tính trên nhiều thiết bị, hãy liên kết các thiết bị với nhau bằng lệnh `/link`.
- Tài khoản có thể tạo nhiều và dùng riêng (chẳng hạn công việc và cá nhân). Cả số thiết bị và số tài khoản đều miễn phí và không giới hạn.
- Ngôn ngữ được tự động chọn từ 8 ngôn ngữ: tiếng Anh, tiếng Nhật, tiếng Hàn, tiếng Trung (Đài Loan), tiếng Tây Ban Nha, tiếng Thái, tiếng Indonesia và tiếng Bồ Đào Nha (Brazil).

---

## 7. Cài đặt để giữ an toàn

- **Khóa tự động**: Có cài đặt tự động khóa khi bạn chuyển tab.
- **Mật khẩu khóa**: Khóa bên trong thiết bị có thể được bảo vệ bằng cách bọc trong một mật khẩu. Bạn sẽ được yêu cầu nhập khi mở ứng dụng.
- **Chặn**: Bạn có thể chặn người gây phiền toái. Liên lạc từ người bị chặn sẽ không đến được.

---

## 8. Sao lưu và khôi phục (chương quan trọng nhất)

Danh tính của Breeze chỉ là khóa bên trong thiết bị của bạn. Danh sách tài khoản không tồn tại trên máy chủ, và người tạo ra cũng không có khóa của bạn.
**Nếu bạn làm mất thiết bị, danh tính cũng sẽ mất.** Với danh tính quan trọng, hãy nhất định tạo bản sao lưu.

### Cách tạo bản sao lưu

1. Chọn "Tạo bản sao lưu".
2. Đặt mật khẩu cho bản sao lưu (6 ký tự trở lên).
3. Chọn nơi lưu.
   - **Lưu vào tệp**: Giữ tệp sao lưu trong tay bạn (khuyến nghị).
   - **Lưu vào máy chủ chuyển tiếp**: Chỉ dùng được khi người vận hành máy chủ chuyển tiếp đó đã bật. Không dùng được trên máy chủ chuyển tiếp mặc định. Có thời hạn lưu giữ, vì vậy hãy lấy lại trước khi hết hạn.

Nội dung bản sao lưu đã được mã hóa. Máy chủ ở nơi lưu chỉ xử lý bản mã.

### Cách khôi phục

Trên thiết bị mới, khôi phục bằng tệp sao lưu (hoặc bản sao lưu trên máy chủ chuyển tiếp) và mật khẩu bạn đã đặt.

### Lưu ý

- **Nếu quên mật khẩu, không thể khôi phục.** Người tạo ra cũng không sửa được. Hãy ghi mật khẩu lại ở một nơi khác.
- **Danh tính dùng một lần không trở lại bằng sao lưu hay khôi phục.**
- Hãy tạo lại bản sao lưu khi danh tính tăng thêm hoặc khi bạn đổi thiết bị.

---

## 9. Hộp lưu giữ và cách suy nghĩ về chi phí

- Thư khi người kia ngoại tuyến được đặt ở trạng thái đã mã hóa trong "hộp lưu giữ" của máy chủ chuyển tiếp (tối đa 7 ngày).
- Máy chủ chuyển tiếp có giới hạn để ngăn lạm dụng (lượng và tần suất có thể lưu giữ). Khi đạt giới hạn, trong khoảng thời gian đó sẽ không lưu giữ được thư mới, nhưng **thư đã đến sẽ không biến mất**. Màn hình sẽ hiển thị lý do và thời gian chờ.
- Giới hạn có thể tự quyết định nếu bạn đặt trên máy chủ của mình.

Phạm vi bản ghi còn lại phía máy chủ (tất cả đều tự động bị xóa, và nội dung không thể đọc được):

| Thứ | Thời gian còn lại |
|---|---|
| Thư chưa chuyển phát | Tối đa 7 ngày |
| Tín hiệu kết nối | 5 phút |
| Bản ghi địa chỉ và thiết bị | 90 ngày |
| Thông tin nhóm / đăng ký thông báo | 30 ngày |

---

## 10. Cách cập nhật (bản máy tính)

1. Khi có phiên bản mới, thông báo sẽ hiện trên màn hình.
2. Khi nhấn "Tải xuống", nó sẽ đi lấy phiên bản mới (không tự động cài đặt).
3. Khi tải xuống xong, nhấn "Cài đặt" và khởi động lại.

Nếu cập nhật thất bại giữa chừng (chẳng hạn giá trị đối chiếu của tệp không khớp), **việc cập nhật sẽ dừng lại và lý do được hiển thị trên màn hình**. Không thể quay lại phiên bản cũ.

---

## 11. Khi gặp sự cố

| Triệu chứng | Điều cần kiểm tra |
|---|---|
| Không gửi được tin nhắn | Hãy kiểm tra xem giờ của thiết bị có bị lệch không. Nếu giờ lệch, việc gửi sẽ thất bại. |
| Không đến được người kia | Nó đang chờ trong hộp lưu giữ cho đến khi người kia mở ứng dụng (tối đa 7 ngày). |
| Không gửi được tệp | Hãy kiểm tra xem có vượt giới hạn kích thước (1 đối 1 là 50MB, nhóm khoảng 50KB) không, hoặc có bị chặn vì định dạng nguy hiểm không. |
| Mã xác nhận cuộc gọi không khớp | Hãy kết thúc cuộc gọi và gọi lại. Đừng tiếp tục trong trạng thái không khớp. |
| Quên mật khẩu | Không thể khôi phục. Hãy tạo danh tính mới và cho người kia biết lại. |
| Làm mất thiết bị | Nếu có bản sao lưu, bạn có thể khôi phục trên thiết bị mới. Nếu không có, sẽ thành danh tính mới. |
| Trang dùng thử không mở được (404) | Hiện đang dừng hoạt động. Vui lòng dùng bản ứng dụng. |

Báo cáo lỗi xin gửi tới [trang Issue](https://github.com/shizukutanaka/Breeze/issues).

---

## 12. Cam kết của Breeze

- Chúng tôi không hiển thị quảng cáo. Không trong ứng dụng, không ở bất cứ đâu.
- Chúng tôi không theo dõi. Không phân tích việc sử dụng, không cơ chế quảng cáo, không bán dữ liệu — tuyệt đối không.
- Người tạo ra không nắm giữ dữ liệu của người dùng. Phía máy chủ, danh sách tài khoản tự nó không tồn tại.
- Cuộc trò chuyện được mã hóa giữa các thiết bị. Máy chủ chỉ xử lý những phong bì mà nó không thể đọc.

So sánh chi tiết với các ứng dụng nhắn tin khác được viết ở "trang so sánh" của kho lưu trữ, bao gồm cả những điểm Breeze thua (số lượng người dùng, chưa được kiểm toán bên ngoài, v.v.).

---

*Sách hướng dẫn này là nội dung tại thời điểm Breeze v3.8.0.*

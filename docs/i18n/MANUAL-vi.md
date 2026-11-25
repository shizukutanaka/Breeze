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
- Nếu dùng trong trình duyệt, hãy dùng bản đã đặt trên máy chủ của riêng bạn (các bước cài đặt có trong tài liệu riêng "Hướng dẫn cài đặt"). Cách cài đặt tiêu chuẩn sử dụng Cloudflare, vì vậy cần có tài khoản Cloudflare

Mỗi tệp đều kèm theo giá trị đối chiếu (SHA256SUMS.txt). Nếu lo lắng, bạn có thể kiểm tra xem giá trị của tệp đã tải xuống có khớp hay không.

> **Về trang mẫu**: Một trang mẫu để kiểm tra cách hoạt động (https://breeze-469.pages.dev/) được cung cấp. Phần mềm đặt ở đó là cùng một phần mềm, nhưng trang mẫu có thể thay đổi hoặc dừng mà không báo trước. Để sử dụng thực tế, vui lòng dùng bản đặt trên máy chủ của riêng bạn. Bản trên máy chủ của riêng bạn sẽ không bị ảnh hưởng nếu trang mẫu dừng hoạt động.

### Thiết lập lần đầu

1. Mở ứng dụng.
2. Nhấn "Bắt đầu với ID ngẫu nhiên". Chỉ vậy là xong phần chuẩn bị. Không cần đăng ký, không cần số điện thoại.

- Nếu bạn nhập "Tên của bạn (tên hiển thị)" vào ô phía trên nút, bạn sẽ bắt đầu với tên đó. Bạn cũng có thể nhấn nút khi để trống ô. Bạn có thể đổi tên hiển thị sau, trong phần hồ sơ của cài đặt.
- Cũng có cách tạo danh tính với tên và Breeze ID do chính bạn chọn. Trong trường hợp đó, một cụm từ khôi phục được cấp và hiển thị trên màn hình. Cụm từ khôi phục là những từ cho phép bạn khôi phục danh tính đó trên thiết bị khác. Hãy ghi lại ra giấy hoặc ở nơi an toàn.
- Nếu bạn muốn khôi phục lại một danh tính đã tạo trước đây, hãy mở "Khôi phục tài khoản hiện có" và các cách khôi phục (khôi phục từ tệp sao lưu, khôi phục bằng cụm từ khôi phục, khôi phục bằng tài khoản + mật khẩu) sẽ hiện ra.
- Khi tạo xong, một thẻ xuất hiện hướng dẫn bạn bảo vệ khóa bằng cụm mật khẩu (thẻ không biến mất sau một thời gian). Với danh tính quan trọng, hãy làm theo hướng dẫn và thêm lớp bảo vệ.

Lúc này, một "khóa" được tạo ra bên trong thiết bị. Đó chính là danh tính của bạn.
**Danh sách tài khoản không tồn tại trên máy chủ.** Danh tính chỉ nằm bên trong thiết bị của bạn.
Điều này trở nên quan trọng trong chương sao lưu (9).

### Về "danh tính dùng một lần" trước đây

"Danh tính dùng một lần" — danh tính không có bất kỳ cách khôi phục nào — đã không còn. Với các cách tạo danh tính hiện nay, mọi danh tính đều có thể được bảo vệ bằng bản sao lưu.

---

## 2. Kết nối với người khác

Nhấn nút "Thêm bạn" trên màn hình danh bạ và ba lựa chọn sẽ xuất hiện.

- **Thêm liên hệ**: Nhập ID của người kia, hoặc quét mã QR.
- **Mời bạn bè**: Sao chép liên kết mời và gửi bằng phương tiện liên lạc thường dùng của bạn (chẳng hạn e-mail). Khi người kia mở liên kết và nhập tên, hai bạn có thể trò chuyện ngay.
- **Tạo nhóm**: Chỉ cần nhập tên nhóm để tạo (chương 4).

ID của chính bạn được hiển thị ở dạng đầy đủ khi bạn mở hồ sơ của mình, và bạn có thể sao chép nguyên như vậy. Bạn có thể đưa ID đầy đủ, không chỉ ID rút gọn.

Nếu người kia cũng đang mở ứng dụng, hai bạn có thể kết nối trực tiếp và trò chuyện.

---

## 3. Trò chuyện

- Chỉ cần nhập tin nhắn và gửi. Ảnh, nhãn dán và thông tin vị trí cũng gửi được.
- Mở "+" bên cạnh ô nhập và tệp đính kèm, tin nhắn thoại, nhập bằng giọng nói, thông tin vị trí, nhãn dán, cài đặt "không cần trả lời" và nhiều thứ khác sẽ xuất hiện cùng nhau.
- **Gửi tệp**: Trong trò chuyện 1 đối 1, tối đa 50MB. Trong nhóm thì nhỏ hơn, khoảng 50KB.
- Các tệp có định dạng nguy hiểm như tệp thực thi sẽ tự động bị chặn.
- Khi người kia chưa mở ứng dụng, tin nhắn được đặt ở trạng thái đã mã hóa trong "hộp lưu giữ", và sẽ được chuyển đến khi họ mở ứng dụng. Máy chủ vận chuyển hộp lưu giữ không thể đọc nội dung. Thư không đến được sẽ tự động bị xóa sau **tối đa 7 ngày**.
- Lịch sử trò chuyện có thể xuất ra tệp hoặc nhập vào.

### Đọc màn hình

- **Trạng thái gửi**: Có thể biết qua dấu bên cạnh tin nhắn. ✓ nghĩa là đã gửi, ✓ trong vòng tròn nghĩa là đã gửi vào hộp lưu giữ, ✓✓ nghĩa là đã đến người kia, đã đọc là dấu màu xanh dương, và thất bại là dấu màu đỏ. Chúng được phân biệt bằng hình dạng ngoài màu sắc.
- **Danh sách liên hệ**: Thời gian trò chuyện gần nhất được hiển thị là giờ đối với hôm nay, "Hôm qua" đối với hôm qua, tháng/ngày đối với năm nay, và năm/tháng/ngày đối với thời gian trước đó. Liên hệ có tin nhắn chưa đọc sẽ được làm nổi bật tên và thời gian.
- **Tên cho các liên hệ**: Mở "Thông tin liên hệ" (trong menu chuột phải của một liên hệ, hoặc menu "⋮" của cuộc trò chuyện) và bạn có thể đặt tên riêng của bạn cho liên hệ đó (biệt danh). Biệt danh chỉ được lưu trên thiết bị này và không bao giờ được gửi tới liên hệ hay máy chủ chuyển tiếp. Khi bạn đặt biệt danh, tên mà liên hệ đó đã đặt cho chính họ cũng được hiển thị bên cạnh với màu nhạt. Bạn có thể tắt tên thứ hai đó bằng "Cũng hiển thị tên mà mỗi liên hệ đã đặt cho chính họ" trong mục "Quyền riêng tư" của cài đặt.
- **Thẻ của chính bạn**: Ở đầu danh sách là thẻ hồ sơ của chính bạn; nhấn vào để mở hồ sơ của bạn. Nó cuộn cùng với danh sách.
- **Tab dưới cùng trên điện thoại**: Ở chiều rộng điện thoại, năm tab xuất hiện ở cuối màn hình: "Trò chuyện", "Cuộc gọi", "Danh bạ", "Thẻ của tôi" và "Cài đặt". Tab nào được hiển thị, bạn có thể chọn từng cái một tại "Tab dưới cùng" trong phần cài đặt (Trò chuyện luôn được hiển thị. Ngay cả khi bạn ẩn tab Cài đặt, bạn vẫn có thể mở cài đặt từ nút bánh răng trên màn hình).
- **Phần đầu cuộc trò chuyện**: Từ biểu tượng tìm kiếm, bạn có thể tìm trong cuộc trò chuyện. Từ menu "⋮", bạn có thể kiểm tra số an toàn, tắt thông báo, ghim, tạo cuộc thăm dò, và nhiều hơn nữa.

### Lệnh

Nhập `/` vào ô nhập và gợi ý lệnh sẽ xuất hiện. Nhập `/help` để xem danh sách các lệnh có thể dùng (71 loại).
Một số thao tác như cài đặt và liên kết thiết bị được thực hiện từ lệnh.

---

## 4. Nhóm

- Nhóm có thể chứa tối đa **1.000 người**.
- Cách tạo chỉ là nhập tên nhóm tại "Tạo nhóm" trong "Thêm bạn" (bạn cũng có thể tạo bằng lệnh `/newgroup`). Việc mời được thực hiện từ "Liên kết mời nhóm". Người nhận được liên kết có thể tham gia bằng cách nhập tên.
- Trong nhóm cũng gửi được tệp, nhưng giới hạn nhỏ, khoảng 50KB. Tin nhắn thoại chưa gửi được trong nhóm.
- Nếu có thành viên đang dùng ứng dụng phiên bản cũ, phương thức mới an toàn hơn (nhóm v5) sẽ không dùng được trong nhóm đó, và cảnh báo sẽ hiện trên màn hình. Nó sẽ có hiệu lực khi mọi người đều dùng phiên bản mới nhất.

---

## 5. Cuộc gọi

- Có thể gọi thoại và gọi video 1 đối 1. Cũng có gọi nhóm (tối đa 8 người).
- **Mã xác nhận cuộc gọi**: Mã xác nhận được hiển thị trên màn hình cuộc gọi. Hãy đọc cho nhau nghe với người kia và xác nhận xem có khớp trên cả hai màn hình không. Nếu không khớp, có khả năng ai đó đang nghe lén ở giữa. Trong trường hợp đó, hãy kết thúc cuộc gọi.
- Gọi nhóm có thể không bắt đầu được nếu ứng dụng của mọi người không phải phiên bản mới nhất.
- **Lịch sử cuộc gọi**: Các cuộc gọi một đối một chỉ để lại lịch sử trên thiết bị này (người kia, cuộc gọi là đi / đến / nhỡ, thời gian và thời lượng cuộc gọi. Không có gì trong những điều đã nói được giữ lại). Lịch sử không bao giờ được gửi đến máy chủ hoặc người kia. Tối đa 200 mục được giữ, mục cũ nhất bị xóa trước. Cuộc gọi nhóm không xuất hiện trong lịch sử.
- Mở lịch sử trên điện thoại từ tab "Cuộc gọi". Khi có cuộc gọi nhỡ mà bạn chưa xem, một huy hiệu số xuất hiện trên tab Cuộc gọi và biến mất khi bạn mở lịch sử. Từ một hàng trong lịch sử, bạn có thể mở cuộc trò chuyện với người đó hoặc gọi lại cho họ. Bạn có thể xóa toàn bộ lịch sử bằng một nút trên màn hình.
- **Lịch sử cuộc gọi không phải là một phần của bản sao lưu.** Trên thiết bị mới, lịch sử bắt đầu trống. Nếu bạn không muốn lịch sử được giữ, hãy tắt "Giữ lịch sử cuộc gọi trên thiết bị này" trong phần "Quyền riêng tư" của cài đặt, và việc ghi lại sẽ tự dừng.

---

## 6. Nhiều thiết bị, nhiều tài khoản

- Để dùng cùng một danh tính trên nhiều thiết bị, hãy liên kết các thiết bị với nhau bằng lệnh `/link`.
- Tài khoản có thể tạo nhiều và dùng riêng (chẳng hạn công việc và cá nhân). Cả số thiết bị và số tài khoản đều miễn phí và không giới hạn.
- **Cách tạo tài khoản**: Nhấn nút "+" bên cạnh các tab tài khoản ở trên cùng của danh sách liên hệ. Nhập tên và chọn một emoji biểu tượng, tài khoản mới sẽ được tạo và tự động chuyển sang.
- **Chuyển tài khoản**: Các tab tài khoản luôn hiển thị ở trên cùng của danh sách liên hệ. Nhấn một tab để chuyển (trên máy tính, bạn cũng có thể chuyển bằng Ctrl+1–9). Nhấn và giữ một tab để đổi tên, đổi biểu tượng hoặc xóa nó.
- Liên hệ và khóa riêng biệt cho mỗi tài khoản. Hãy trao đổi liên hệ lại cho mỗi tài khoản.
- Ngôn ngữ được tự động chọn từ 51 ngôn ngữ, bao gồm tiếng Anh, theo ngôn ngữ của thiết bị của bạn.

---

## 7. Cài đặt để giữ an toàn

Cài đặt mở ra thành màn hình riêng. Trên điện thoại, mở từ tab "Cài đặt" ở cuối màn hình; trên máy tính, từ nút bánh răng trên màn hình (bạn cũng có thể mở bằng lệnh `/settings`). Dùng thao tác quay lại để trở về màn hình trước đó.

- **Khóa tự động**: Có cài đặt tự động khóa khi bạn chuyển tab.
- **Mật khẩu khóa**: Khóa bên trong thiết bị có thể được bảo vệ bằng cách bọc trong một mật khẩu. Bạn sẽ được yêu cầu nhập khi mở ứng dụng.
- **Cũng hiển thị tên mà mỗi liên hệ đã đặt cho chính họ**: Trong mục "Quyền riêng tư". Đối với liên hệ bạn đã đặt biệt danh, bạn có thể chọn có hiển thị tên của chính họ bên cạnh hay không (chương 3).
- **Chặn**: Bạn có thể chặn người gây phiền toái. Liên lạc từ người bị chặn sẽ không đến được.
- **Có giữ lịch sử cuộc gọi hay không**: Với "Giữ lịch sử cuộc gọi trên thiết bị này" trong phần "Quyền riêng tư", bạn có thể dừng việc ghi lịch sử cuộc gọi (chương 5).
- **Hiển thị các tab dưới cùng**: Trong phần "Tab dưới cùng", bạn có thể hiện hoặc ẩn các tab dưới cùng của điện thoại (Cuộc gọi / Danh bạ / Thẻ của tôi / Cài đặt) từng cái một. Trò chuyện luôn được hiển thị.

---

## 8. Pin và tình huống khẩn cấp (chế độ nguồn)

Trong cài đặt "Chế độ nguồn", bạn có thể chọn cách sử dụng pin.

- **Tự động (mức pin)**: Tự động chuyển đổi theo lượng pin còn lại.
- **Bình thường**: Như thường lệ.
- **Tiết kiệm pin**: Giãn cách việc kiểm tra thư đến tối đa một lần mỗi 60 giây, và dừng tín hiệu hiện diện.
- **Khẩn cấp (cho thảm họa)**: Giãn cách việc kiểm tra thư đến tối đa một lần mỗi 10 phút. Hãy dùng khi có thảm họa hoặc khi không thể sạc pin.

Điều làm hao pin không phải là lượng liên lạc mà là số lần bộ thu phát thức dậy. Vì vậy phía gửi không bị giãn cách; chỉ phía nghe bị giãn cách. Việc gửi vẫn diễn ra ngay lập tức như thường lệ. Khi bạn bắt đầu sạc, nó tự động lùi một bước về phía nhẹ hơn.

Trên các thiết bị không thể tự động đọc mức pin (như trình duyệt trên iPhone), "Tự động" hoạt động như Bình thường, và lựa chọn thủ công hoạt động đúng như đã chọn.

---

## 9. Sao lưu và khôi phục (chương quan trọng nhất)

Danh tính của Breeze chỉ là khóa bên trong thiết bị của bạn. Danh sách tài khoản không tồn tại trên máy chủ, và người tạo ra cũng không có khóa của bạn.
**Nếu bạn làm mất thiết bị, danh tính cũng sẽ mất.** Với danh tính quan trọng, hãy nhất định tạo bản sao lưu.

Sao lưu và khôi phục được thực hiện từ mục "Sao lưu và khôi phục" trong cài đặt (các nút là "Tạo bản sao lưu", "Khôi phục bản sao lưu" và "Khôi phục từ tệp"). Lần đầu tiên bạn thêm một liên hệ, một thẻ kêu gọi bạn tạo bản sao lưu sẽ xuất hiện đúng một lần.

### Sao lưu tự động

Cài đặt "Sao lưu tự động" được bật từ đầu. Khi dữ liệu của bạn thay đổi, một bản sao lưu đã mã hóa được gửi tự động tới máy chủ chuyển tiếp do bạn lưu trữ.

- Nó không gửi theo mỗi thay đổi: nó đợi 30 giây sau thay đổi cuối cùng và gửi tất cả cùng nhau. Các lần thử được giãn cách ít nhất 15 phút.
- Khi bạn ngoại tuyến, không có gì được gửi; các thay đổi được giữ lại và gửi khi kết nối trở lại và khi bạn mở ứng dụng.
- Để gửi tự động, bạn cần nhập mật khẩu sao lưu một lần trên thiết bị đó (khi cần, nút "Nhập mật khẩu" xuất hiện trong mục cài đặt). **Mật khẩu không được lưu trữ.** Nó chỉ được ghi nhớ khi ứng dụng đang mở, và biến mất khi bạn đóng ứng dụng. Đối với danh tính khôi phục đơn giản, ngay sau khi bạn nhập mật khẩu lúc đăng ký hoặc cập nhật, việc gửi hoạt động như bình thường.
- Nếu máy chủ chuyển tiếp không hỗ trợ lưu trữ bản sao lưu, sao lưu tự động sẽ không chạy. Điều đó được hiển thị trong mục cài đặt.
- Trạng thái (lần gửi thành công gần nhất là khi nào, có thay đổi đang chờ hay không, việc gửi có thất bại hay không) được hiển thị trong mục cài đặt.

### Cách tạo bản sao lưu (thủ công)

1. Từ "Sao lưu và khôi phục" trong cài đặt, chọn "Tạo bản sao lưu".
2. Đặt mật khẩu cho bản sao lưu (6 ký tự trở lên).
3. Chọn nơi lưu.
   - **Lưu vào tệp**: Giữ tệp sao lưu trong tay bạn (khuyến nghị).
   - **Lưu vào máy chủ chuyển tiếp**: Chỉ dùng được khi người vận hành máy chủ chuyển tiếp đó đã bật. Không dùng được trên máy chủ chuyển tiếp mặc định. Có thời hạn lưu giữ, vì vậy hãy lấy lại trước khi hết hạn.

Nội dung bản sao lưu đã được mã hóa. Máy chủ ở nơi lưu chỉ xử lý bản mã.

### Cách khôi phục

Trên thiết bị mới, khôi phục bằng tệp sao lưu (hoặc bản sao lưu trên máy chủ chuyển tiếp) và mật khẩu bạn đã đặt.

Nếu bạn vừa khôi phục danh tính bằng cụm từ khôi phục, và một bản sao lưu của danh tính đó có trên máy chủ chuyển tiếp, nó sẽ được tìm thấy tự động và bạn được hỏi với "Đã tìm thấy bản sao lưu". Nếu bạn khôi phục nó, dữ liệu trên thiết bị đó sẽ được thay bằng nội dung của bản sao lưu.

### Chuyển sang thiết bị mới

Nhấn nút "Chuyển sang thiết bị mới" trong mục "Sao lưu và khôi phục" của cài đặt và các bước sẽ được hiển thị.

1. Trên thiết bị hiện tại của bạn, hãy giữ một bản sao lưu trên máy chủ chuyển tiếp (sao lưu tự động, hoặc "Tạo bản sao lưu").
2. Trên thiết bị mới, chọn một cách khôi phục trên màn hình đầu tiên và nhập cụm từ khôi phục của bạn (hoặc tên tài khoản và mật khẩu của bạn).
3. Khi danh tính của bạn đã trở lại, bản sao lưu trên máy chủ được tìm thấy tự động và việc khôi phục được đề xuất.

Không cần cáp hay trao tay tệp.

### Lưu ý

- **Nếu quên mật khẩu, không thể khôi phục.** Người tạo ra cũng không sửa được. Hãy ghi mật khẩu lại ở một nơi khác.
- Việc nhập mật khẩu cho sao lưu tự động là cần thiết trên mỗi thiết bị. Trên thiết bị mới, hãy nhập lại một lần nữa.
- Hãy tạo lại bản sao lưu thủ công khi danh tính của bạn tăng thêm hoặc khi bạn đổi thiết bị.
- Lịch sử cuộc gọi không phải là một phần của bản sao lưu. Khi bạn đổi thiết bị, lịch sử cuộc gọi không chuyển sang thiết bị mới.

---

## 10. Hộp lưu giữ và cách suy nghĩ về chi phí

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

## 11. Cách cập nhật (bản máy tính)

1. Khi có phiên bản mới, thông báo sẽ hiện trên màn hình.
2. Khi nhấn "Tải xuống", nó sẽ đi lấy phiên bản mới (không tự động cài đặt).
3. Khi tải xuống xong, nhấn "Cài đặt" và khởi động lại.

Nếu cập nhật thất bại giữa chừng (chẳng hạn giá trị đối chiếu của tệp không khớp), **việc cập nhật sẽ dừng lại và lý do được hiển thị trên màn hình**. Không thể quay lại phiên bản cũ.

---

## 12. Khi gặp sự cố

| Triệu chứng | Điều cần kiểm tra |
|---|---|
| Không gửi được tin nhắn | Hãy kiểm tra xem giờ của thiết bị có bị lệch không. Nếu giờ lệch, việc gửi sẽ thất bại. |
| Không đến được người kia | Nó đang chờ trong hộp lưu giữ cho đến khi người kia mở ứng dụng (tối đa 7 ngày). |
| Không gửi được tệp | Hãy kiểm tra xem có vượt giới hạn kích thước (1 đối 1 là 50MB, nhóm khoảng 50KB) không, hoặc có bị chặn vì định dạng nguy hiểm không. |
| Mã xác nhận cuộc gọi không khớp | Hãy kết thúc cuộc gọi và gọi lại. Đừng tiếp tục trong trạng thái không khớp. |
| Quên mật khẩu | Không thể khôi phục. Hãy tạo danh tính mới và cho người kia biết lại. |
| Làm mất thiết bị | Nếu có bản sao lưu, bạn có thể khôi phục trên thiết bị mới. Nếu không có, sẽ thành danh tính mới. |
| Trang mẫu không mở được | Trang mẫu có thể dừng mà không báo trước. Vui lòng dùng bản đặt trên máy chủ của riêng bạn. |

Báo cáo lỗi xin gửi tới [trang Issue](https://github.com/shizukutanaka/Breeze/issues).

---

## 13. Cam kết của Breeze

- Chúng tôi không hiển thị quảng cáo. Không trong ứng dụng, không ở bất cứ đâu.
- Chúng tôi không theo dõi. Không phân tích việc sử dụng, không cơ chế quảng cáo, không bán dữ liệu — tuyệt đối không.
- Người tạo ra không nắm giữ dữ liệu của người dùng. Phía máy chủ, danh sách tài khoản tự nó không tồn tại.
- Cuộc trò chuyện được mã hóa giữa các thiết bị. Máy chủ chỉ xử lý những phong bì mà nó không thể đọc.

So sánh chi tiết với các ứng dụng nhắn tin khác được viết ở "trang so sánh" của kho lưu trữ, bao gồm cả những điểm Breeze thua (số lượng người dùng, chưa được kiểm toán bên ngoài, v.v.).

---

*Sách hướng dẫn này phản ánh nội dung tính đến ngày 2026-11-25.*

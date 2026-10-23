# Rà soát độ ổn định — 23/10/2026

Đã đọc mã Windows, thư viện web, lớp hình nền/GIF, chương trình khởi động/cài đặt, phần mở rộng và mã nguồn macOS. Phần Windows được chạy kiểm thử trên máy hiện tại; nguồn macOS chỉ được đọc, chưa biên dịch hoặc chạy trên Windows. Kết quả không bảo đảm mọi phiên bản Windows/Codex hoặc mọi file GIF đều hoạt động.

## Lỗi đã sửa

- Nhiều yêu cầu Áp dụng/Khôi phục có thể cùng đọc cấu hình cũ, để thừa JPEG tối ưu hoặc xóa ảnh mà cấu hình cuối đang dùng. Máy chủ thư viện giờ xếp các thay đổi theo thứ tự, thay tệp cấu hình nguyên khối, thử lại khóa chia sẻ ngắn và dọn dữ liệu tạm nếu lưu thất bại.
- Hai lần nhập cùng tên có thể cùng chọn một tên đích rồi một lần thất bại. Tên được giữ chỗ bằng tạo tệp độc quyền; trùng tên sẽ thử tên kế tiếp.
- Khôi phục không chạy được nếu JSON cấu hình đã hỏng. Khôi phục nay vẫn tắt ảnh trong trường hợp này; lỗi truy cập tệp vẫn được báo, không coi như cấu hình trống.
- Giao diện có thể gửi Khôi phục khi Áp dụng còn chạy; phản hồi làm mới cũ có thể ghi đè trạng thái vừa lưu. Các điều khiển thay đổi được khóa khi bận và phản hồi cũ bị bỏ qua. Quét định kỳ không tạo thêm lượt tải thư viện khi lượt trước chưa xong.
- File bị chép đè cùng tên/cùng dung lượng có thể giữ ảnh xem trước hoặc ảnh thu nhỏ GIF cũ. Thư viện trả mã phiên bản từ kích thước/thời gian sửa, dùng mã này trong khóa ảnh xem trước và thu hồi địa chỉ Blob cũ. Mỗi lần Áp dụng tạo mã phiên bản cấu hình mới để bộ giải mã GIF đọc lại nội dung cùng tên.
- Bộ cài có thể đổi biểu tượng thư viện đã ghim thành Codex gốc do dùng chung tệp thực thi với chương trình khởi động cũ. Chỉ lối tắt khởi động không có tham số mới được chuyển; lối tắt `--settings` được giữ nguyên.
- Chương trình khởi động xử lý khóa đồng bộ bị bỏ dở khi tiến trình trước thoát bất thường. Máy chủ thư viện từ chối địa chỉ yêu cầu không hợp lệ thay vì để lỗi thoát ra ngoài hàm xử lý; dòng lệnh kiểm tra rõ tham số `--root`.

## Kết quả kiểm chứng

- 14 kiểm thử Node: giao thức phần mở rộng, xác thực thư viện, lưu/mở lại ảnh và GIF, 8 lần nhập trùng tên đồng thời, 16 thay đổi giao diện đồng thời, khóa Windows 180 ms, lưu thất bại, khôi phục JSON hỏng và mã phiên bản ảnh xem trước/GIF.
- Bộ kiểm thử lớp hình nền Windows: thao tác chuột xuyên qua/không lấy quyền nhập liệu, quyền sở hữu cửa sổ và tọa độ, 3 tiến trình thử độc lập, 24 vòng đóng/mở, di chuyển/thu nhỏ/khôi phục qua WinEvent khi tắt quét định kỳ, nhiều cửa sổ và phục hồi lớp ảnh đã bị hủy.
- GIF: chuyển khung hình, dừng khi thu nhỏ, tiếp tục khi khôi phục, lưu trạng thái tạm dừng qua lần khởi động lại, không khóa file gốc, thay nội dung cùng tên và 40 vòng GIF ↔ ảnh tĩnh không tích lũy tài nguyên đồ họa GDI trong kiểm thử.
- Chương trình khởi động mở lại cấu hình mới ở đường dẫn chứa khoảng trắng. Chuyển đổi lối tắt được thử bằng thư mục giả riêng; không sửa thanh tác vụ thật trong kiểm thử.
- Giao diện được thử trên thư viện riêng với phản hồi lưu trì hoãn: các nút Khôi phục/Áp dụng/chọn ảnh/độ mờ đều khóa trong khi lưu và mở lại sau khi thành công.
- Kiểm tra cú pháp JavaScript/PowerShell và `git diff --check` đạt. Ảnh và cấu hình cá nhân không được dùng làm nơi ghi kết quả thử.

## Phạm vi còn cần kiểm tra thực tế

- Chưa khởi động lại máy hoặc đăng xuất/đăng nhập Windows để kiểm tra cơ chế kích hoạt; tác vụ đăng nhập có cấu hình nhưng điều đó không thay thế chạy thật.
- Chưa thử nhiều màn hình/DPI hỗn hợp, Windows ARM, các phiên bản Codex khác hoặc chạy nhiều giờ/ngủ máy nhiều vòng.
- Chưa đo CPU/GPU của lớp GIF thật với file GIF người dùng. Số đo trong `gif-performance.md` thuộc chương trình thử trước khi tích hợp.
- Bộ lọc GIF có giới hạn kích thước/số khung hình; bộ giải mã Windows có thể từ chối một số file dù trình duyệt xem được. Lỗi được báo, không biến GIF lỗi thành ảnh mặc định.

Đợt rà soát này không đẩy mã lên GitHub hoặc thay ảnh cá nhân; mã được đưa lên bản sao nhánh ở bước xuất bản sau đó.

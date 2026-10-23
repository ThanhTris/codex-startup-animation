# Rà soát độ ổn định — 23/10/2026

Đã đọc mã Windows, thư viện web, lớp overlay/GIF, launcher/cài đặt, phần extension và nguồn macOS. Phần Windows được chạy kiểm thử trên máy hiện tại; nguồn macOS chỉ được đọc, chưa build hoặc chạy trên Windows. Kết quả không bảo đảm mọi phiên bản Windows/Codex hoặc mọi file GIF đều hoạt động.

## Lỗi đã sửa

- Nhiều yêu cầu Áp dụng/Khôi phục có thể cùng đọc cấu hình cũ, để thừa JPEG tối ưu hoặc xóa ảnh mà cấu hình cuối đang dùng. Server giờ xếp các thay đổi theo thứ tự, thay tệp cấu hình nguyên khối, thử lại khóa chia sẻ ngắn và dọn dữ liệu tạm nếu lưu thất bại.
- Hai lần nhập cùng tên có thể cùng chọn một tên đích rồi một lần thất bại. Tên được giữ chỗ bằng tạo tệp độc quyền; trùng tên sẽ thử tên kế tiếp.
- Khôi phục không chạy được nếu JSON cấu hình đã hỏng. Khôi phục nay vẫn tắt ảnh trong trường hợp này; lỗi truy cập tệp vẫn được báo, không coi như cấu hình trống.
- UI có thể gửi Khôi phục khi Áp dụng còn chạy; phản hồi làm mới cũ có thể ghi đè trạng thái vừa lưu. Các điều khiển thay đổi được khóa khi bận và phản hồi cũ bị bỏ qua. Polling không tạo thêm lượt tải thư viện khi lượt trước chưa xong.
- File bị chép đè cùng tên/cùng dung lượng có thể giữ preview hoặc thumbnail GIF cũ. Thư viện trả revision từ kích thước/thời gian sửa, dùng revision trong khóa preview và thu hồi Blob URL cũ. Mỗi lần Áp dụng tạo revision cấu hình mới để decoder GIF đọc lại nội dung cùng tên.
- Bộ cài có thể đổi icon thư viện đã ghim thành Codex gốc do dùng chung executable với launcher cũ. Chỉ shortcut launcher không có tham số mới được chuyển; shortcut `--settings` được giữ nguyên.
- Launcher xử lý mutex bị bỏ dở khi tiến trình trước thoát bất thường. Server từ chối URL yêu cầu không hợp lệ thay vì để lỗi thoát ra ngoài handler; CLI kiểm tra rõ tham số `--root`.

## Kết quả kiểm chứng

- 14 kiểm thử Node: giao thức extension, xác thực thư viện, lưu/mở lại ảnh và GIF, 8 lần nhập trùng tên đồng thời, 16 thay đổi giao diện đồng thời, khóa Windows 180 ms, lưu thất bại, khôi phục JSON hỏng và revision preview/GIF.
- Bộ kiểm thử overlay Windows: click xuyên qua/không lấy focus, owner và tọa độ, 3 tiến trình thử độc lập, 24 vòng đóng/mở, di chuyển/thu nhỏ/khôi phục qua WinEvent khi tắt polling, nhiều cửa sổ và phục hồi layer đã bị hủy.
- GIF: chuyển khung hình, dừng khi thu nhỏ, tiếp tục khi khôi phục, lưu trạng thái tạm dừng qua lần khởi động lại, không khóa file gốc, thay nội dung cùng tên và 40 vòng GIF ↔ ảnh tĩnh không tích lũy GDI handle trong kiểm thử.
- Launcher mở lại cấu hình mới ở đường dẫn chứa khoảng trắng. Shortcut migration được thử bằng thư mục giả riêng; không sửa taskbar thật trong kiểm thử.
- Giao diện được thử trên thư viện riêng với phản hồi lưu trì hoãn: các nút Khôi phục/Áp dụng/chọn ảnh/độ mờ đều khóa trong khi lưu và mở lại sau khi thành công.
- Kiểm tra cú pháp JavaScript/PowerShell và `git diff --check` đạt. Ảnh và cấu hình cá nhân không được dùng làm nơi ghi kết quả thử.

## Phạm vi còn cần kiểm tra thực tế

- Chưa reboot máy hoặc đăng xuất/đăng nhập Windows để kiểm tra trigger; tác vụ đăng nhập có cấu hình nhưng điều đó không thay thế chạy thật.
- Chưa thử nhiều màn hình/DPI hỗn hợp, Windows ARM, các phiên bản Codex khác hoặc chạy nhiều giờ/ngủ máy nhiều vòng.
- Chưa đo CPU/GPU của lớp GIF thật với file GIF người dùng. Số đo trong `gif-performance.md` thuộc chương trình thử trước khi tích hợp.
- Bộ lọc GIF có giới hạn kích thước/số frame; decoder Windows có thể từ chối một số file dù trình duyệt xem được. Lỗi được báo, không biến GIF lỗi thành ảnh mặc định.

Không có push/commit tự động hoặc thay ảnh cá nhân trong đợt rà soát này.

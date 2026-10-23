# Phần mở rộng giao diện trên macOS

Thư mục này chứa phần kết nối hoạt ảnh và hình nền với Codex trên macOS, được kế thừa từ dự án gốc. Bản Windows hiện dùng bộ nạp cửa sổ riêng trong [thư mục Windows](../windows/README.md).

## Các thành phần

| Tệp | Chức năng |
| --- | --- |
| `renderer.mjs` | Tạo khung giao diện tạm thời, trao đổi dữ liệu qua hàm ràng buộc với khung, đặt hình nền tĩnh, xử lý phím tắt và khôi phục giao diện. Không đăng ký vòng quét nền thường trực. |
| `payload.mjs` | Đóng gói HTML, CSS, ảnh và hàm hoạt ảnh cục bộ; gắn môi trường thực thi vào khung giao diện. Không cần đổi chính sách bảo mật nội dung hoặc chạy máy chủ tài nguyên riêng. |
| `cdp.mjs` | Lọc cửa sổ chính, kiểm tra địa chỉ WebSocket nội bộ, đặt thời gian chờ và dọn kết nối. |
| `run.mjs` | Kiểm tra chữ ký OpenAI, danh tính ứng dụng, cổng nội bộ ngẫu nhiên và tiến trình sở hữu; mở app gốc, xác nhận hoạt ảnh bắt đầu rồi ngắt kết nối và thoát. |
| `wallpaper.css` | Điều chỉnh các bề mặt trong suốt theo thuộc tính bố cục và biến màu đã đối chiếu. |
| `../Native/Extension.swift` | Chương trình khởi động nhẹ; nếu Codex đã chạy thì chuyển về cửa sổ hiện có và thoát, không khởi động lại ứng dụng. |

## Luồng sử dụng

1. Biên dịch và mở chương trình khởi động theo [hướng dẫn macOS](../docs/macos.md).
2. Hoạt ảnh được hiển thị trong cửa sổ Codex chính thức.
3. Khi hoạt ảnh kết thúc, khung tạm thời bị gỡ; hình nền tĩnh và phím tắt cài đặt vẫn được giữ.
4. Nhấn **⌘⌥B** để mở cài đặt ảnh, tiêu đề và phụ đề.
5. Lưu thành công sẽ phát lại hoạt ảnh. Đóng bảng cài đặt hoặc nhấn Esc sẽ bỏ thay đổi chưa lưu, kết thúc lớp hoạt ảnh và trở về trang chính.

Cài đặt dùng IndexedDB cục bộ và tương thích với dữ liệu ảnh cũ. Phần mở rộng không đọc nội dung trò chuyện, không thay cấu hình API và không sửa gói cài chính thức.

## Giới hạn

Cổng gỡ lỗi CDP tồn tại cùng tiến trình Codex. Gỡ lớp giao diện không đóng cổng này; cần thoát hẳn Codex rồi mở lại bằng biểu tượng chính thức để kết thúc phiên gỡ lỗi.

Phần macOS của dự án gốc từng được ghi nhận hoạt động khi thử thực tế. Điều đó không bảo đảm mọi phiên bản mới đều tương thích; trang thử mô phỏng cũng không thay thế kiểm tra trên app thật. Đợt rà soát Windows của bản sao nhánh này không biên dịch hoặc chạy lại mã macOS.

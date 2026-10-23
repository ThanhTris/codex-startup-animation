# Nguồn tham khảo và hình ảnh mẫu

## Dự án gốc

Repo này là bản sao nhánh do [ThanhTris](https://github.com/ThanhTris/codex-startup-animation) phát triển từ [panding999/codex-startup-animation](https://github.com/panding999/codex-startup-animation).

Mã hoạt ảnh, chương trình macOS, tài nguyên mẫu và các công cụ liên quan được kế thừa từ dự án gốc. Phần phát triển Windows bổ sung thư viện ảnh/GIF, giao diện xem trước, lưu cấu hình, bộ nạp cửa sổ và kiểm thử. Việc dịch tài liệu không thay đổi nguồn gốc của mã hoặc quyền sở hữu tài nguyên.

## Các triển khai được tham khảo

Các dự án dưới đây được dùng để nghiên cứu cách triển khai; không cần cài đặt hoặc chạy chúng để dùng repo này. Theo ghi chú của dự án gốc, mã hoạt ảnh và phần kết nối macOS được triển khai riêng, không sao chép mã từ ba dự án tham khảo sau:

| Dự án | Nội dung tham khảo |
| --- | --- |
| [Tangc/codex-skin-launcher](https://github.com/Tangc/codex-skin-launcher) | Cửa sổ gốc trên macOS, danh tính ứng dụng và lối tắt khởi động riêng. |
| [Fei-Away/Codex-Dream-Skin](https://github.com/Fei-Away/Codex-Dream-Skin) | Hình nền toàn cửa sổ, bề mặt trong suốt, kết nối CDP cục bộ và xác minh tiến trình đích. |
| [NativeDog1/dsh-boot-animation](https://github.com/NativeDog1/dsh-boot-animation) | Hoạt ảnh mở đầu có thể bỏ qua, gỡ lớp hoạt ảnh khi hoàn tất, đợi tài nguyên sẵn sàng và giới hạn thời gian chờ. |

DSH dùng giao diện lớp phủ riêng, không thể cài trực tiếp vào Codex. Phần hoạt ảnh của dự án không cần kho video hoặc môi trường chạy của các dự án trên.

Phần Windows tham khảo cách theo dõi cửa sổ và hiển thị lớp ảnh trong suốt của [paperfish-bot/codex-startup-animation](https://github.com/paperfish-bot/codex-startup-animation). `windows/Overlay.cs` được viết riêng cho thư viện và cấu hình của bản này, không nhập mã hoặc DLL WebView2 từ bản tham khảo. Chi tiết đối chiếu nằm trong [khảo sát các bản sao nhánh](windows-forks.md).

## Hình ảnh mẫu

- Ảnh đại diện và hình nền mặc định của phần macOS được kế thừa từ ảnh mà chủ dự án gốc cung cấp, sau khi thay đổi kích thước và cắt giữa ảnh.
- `assets/contours.js` chứa đường nét trích từ hình nền mẫu bằng macOS Vision. Với ảnh người dùng chọn trong phần hoạt ảnh, đường nét được tạo cục bộ bằng Canvas khi nhập ảnh.
- Biểu tượng khởi động màu hồng được chỉnh màu từ biểu tượng thương hiệu gốc để phân biệt lối tắt cá nhân. Quyền đối với biểu tượng gốc thuộc chủ sở hữu tương ứng.
- Theo tài liệu gốc, nguyên mẫu trước đây từng dùng ảnh chụp từ video tham khảo và ảnh dựng bằng ImageGen; các ảnh dự phòng, ảnh chụp và video đó không thuộc tài nguyên được lưu trong repo này.
- Hoạt ảnh được vẽ bằng HTML, CSS, Canvas và SVG; không dùng âm thanh, phông chữ tải từ xa, CDN hoặc yêu cầu ảnh trực tuyến.

Hoạt ảnh macOS chuyển từ mảnh ảnh đại diện sang các nét rời của hình nền, gom nét từ trái sang phải rồi hiện ảnh màu. Bản Windows dùng ảnh do bạn thêm vào thư viện, không tự chọn ảnh mẫu macOS làm hình nền.

## Quyền sử dụng

Repo không có quan hệ trực thuộc OpenAI. Quyền đối với hình nhân vật, biểu tượng thương hiệu và mã chương trình cần được xem riêng. Việc lưu tài nguyên trong repo không cấp thêm quyền đối với tài nguyên của bên thứ ba. Dự án hiện chưa chỉ định giấy phép mã nguồn mở cho mã chương trình.

# Khảo sát các bản sao nhánh và cơ chế mở bằng ứng dụng gốc trên Windows

Đối chiếu ngày 23/10/2026, qua GitHub REST API: 14 fork công khai trực tiếp của `panding999/codex-startup-animation`. Đã đọc cây file ở nhánh mặc định của cả 14 fork, rồi đọc tài liệu và mã Windows của ba fork có triển khai Windows. Phạm vi này không bao gồm nhánh phụ, repo riêng tư hoặc mọi fork gián tiếp.

| Nguồn | Cách nạp giao diện | Mở biểu tượng app gốc có tự hiện ảnh? |
| --- | --- | --- |
| [Repo gốc](https://github.com/panding999/codex-startup-animation) | Launcher macOS mở app với CDP rồi chèn giao diện. README nói rõ biểu tượng chính thức không tự nạp hiệu ứng. | Không |
| [Nuttnee](https://github.com/Nuttnee/codex-startup-animation/blob/main/README-Windows.md) | Launcher Windows với CDP, ảnh và thiết lập trong IndexedDB. | Không |
| [bopeng-sun](https://github.com/bopeng-sun/codex-background-renderer/blob/main/README-Win11.md) | Launcher Windows với CDP, shortcut riêng. Tài liệu giới hạn kiểm chứng trên app thật. | Không |
| [paperfish-bot](https://github.com/paperfish-bot/codex-startup-animation/blob/main/docs/windows.md) | Chương trình theo dõi cửa sổ chạy khi đăng nhập. Cửa sổ ảnh trong suốt nằm trên app và cho bấm xuyên qua. | Có, theo thiết kế của fork; ảnh cũng ảnh hưởng màu chữ |

Mười một fork còn lại không có tích hợp Windows trong cây file đã kiểm tra. Không suy ra rằng thiết bị của người dùng macOS khác nhất thiết dùng đúng phiên bản công khai của repo gốc.

## Triển khai tại repo này

Theo lựa chọn của người dùng, Windows dùng chương trình chạy nền để đáp ứng việc mở biểu tượng app gốc. Tham khảo kiến trúc tại [SeamlessAgent.cs](https://github.com/paperfish-bot/codex-startup-animation/blob/main/windows/SeamlessAgent.cs), [SeamlessWallpaper.cs](https://github.com/paperfish-bot/codex-startup-animation/blob/main/windows/SeamlessWallpaper.cs) và [bộ cài](https://github.com/paperfish-bot/codex-startup-animation/blob/main/tools/install-seamless-windows.ps1).

`windows/Overlay.cs` được viết riêng cho thư viện và cấu hình đã có. Chỉ dùng .NET Framework/WinForms có sẵn, không nhập mã, DLL WebView2, ảnh mặc định, video hoặc tập lệnh sửa ứng dụng từ bản tham khảo. Tác vụ đăng nhập chạy dưới tài khoản hiện tại, quyền người dùng thông thường (`Limited`). Chương trình chỉ nhận cửa sổ thuộc đường dẫn gói Store `OpenAI.Codex` với mã nhà phát hành đang dùng.

Lớp ảnh phủ lên cả nội dung, không tương đương CSS đặt ảnh sau chữ. Phần xem trước đã đổi sang mô phỏng cùng phép trộn alpha; 0% hoặc Khôi phục sẽ ẩn ảnh. Chương trình vẫn chạy khi Codex thoát để đợi lần mở tiếp theo.

## Kiểm chứng

`tools/windows-overlay.test.ps1` biên dịch mã sản phẩm cùng bộ test, tạo cửa sổ thử riêng và kiểm tra thao tác chuột xuyên qua, không lấy quyền nhập liệu, quyền sở hữu cửa sổ, không nổi trên toàn hệ thống, tọa độ, thu nhỏ/khôi phục, đóng/mở cửa sổ, đổi ảnh/độ mờ, giải phóng file, khôi phục giao diện, cấu hình lỗi, giới hạn đường dẫn và khởi động lại bộ nạp. Test không đóng app thật hay đọc nội dung trò chuyện.

Trạng thái bộ nạp trên app thật và cấu hình tác vụ đăng nhập được kiểm tra riêng. Cấu hình kích hoạt `AtLogOn` không chứng minh đã đăng xuất/đăng nhập hoặc khởi động lại máy thật.

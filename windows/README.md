# Codex Wallpaper trên Windows

Cài bằng Windows PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\install.ps1
```

Bộ cài tạo `CodexWallpaperOverlay.exe` và tác vụ đăng nhập `CodexWallpaperOverlay`, chạy dưới tài khoản hiện tại, quyền Limited. Nó theo dõi cửa sổ app Store `OpenAI.Codex` và hiển thị lớp ảnh trong suốt. Không cần mở thư viện hoặc launcher mỗi lần dùng Codex.

## Sử dụng

1. Mở **Codex Wallpaper** trong Start Menu hoặc **Codex With Wallpaper** trên Desktop. Tab **Ảnh tĩnh / GIF** lọc từng loại. Thêm PNG/JPEG/WebP/GIF bằng nút Thêm hoặc kéo thả. Nút **Thư mục ảnh / Thư mục GIF** mở đúng thư mục; thư viện tự kiểm tra file mới khi đang mở.
2. Chọn ảnh, chỉnh độ hiện ở bản mô phỏng rồi bấm **Áp dụng hình nền**. Nếu Codex đang mở, lớp ảnh tự cập nhật.
3. Đóng thư viện. Sau đó mở **biểu tượng ChatGPT/Codex gốc** như bình thường, kể cả sau khi đã thoát hẳn app. Bộ nạp tự hiện ảnh đã lưu. Tác vụ đăng nhập khởi động bộ nạp cho phiên Windows tiếp theo.

GIF nằm tại `%USERPROFILE%\CodexWallpaper\gifs`, giữ nguyên dữ liệu động khi áp dụng. Bộ nạp dùng thời gian từng frame, lặp liên tục và giới hạn dựng tối đa khoảng 15 FPS. Chỉ một decoder/timeline dùng chung cho các cửa sổ; chuyển frame sang bộ đệm RGBA trước khi vẽ, không cache toàn bộ frame đã giải nén. Bộ đếm dừng khi mọi cửa sổ bị thu nhỏ/ẩn hoặc bạn tạm dừng GIF rồi Áp dụng. Thumbnail GIF là ảnh tĩnh để cả thư viện không chạy nhiều GIF cùng lúc; preview phát theo GIF gốc nên FPS có thể khác app.

Mỗi file tối đa 30 MB. Ảnh tĩnh tối đa 40 megapixel. GIF tối đa 2 megapixel, 300 frame và tổng số pixel các frame không vượt 120 triệu; file vượt giới hạn được báo trong thư viện thay vì âm thầm bỏ qua. Bộ lọc GIF đọc cấu trúc khối theo [GIF89a](https://www.w3.org/Graphics/GIF/spec-gif89a.txt) trước khi chuyển cho decoder Windows. Các GIF có cùng tên với ảnh ở thư mục khác vẫn được phân biệt.

**Ảnh phủ lên cửa sổ, kể cả chữ**; đây không phải CSS đặt ảnh sau nội dung. Thử 15–25% rồi cân chỉnh. Preview mô phỏng cùng độ trong suốt, nhưng màu giao diện và bố cục thực tế có thể khác. Lớp ảnh không nhận chuột/bàn phím, không lấy focus, không có nút taskbar riêng; nó ẩn khi thu nhỏ hoặc app ở desktop ảo khác. Hộp chọn file và cửa sổ có owner không được coi là cửa sổ chính.

**Khôi phục giao diện gốc** ẩn ảnh, giữ thư viện. Đóng thư viện hoặc thoát Codex không dừng bộ nạp; nó chờ lần mở tiếp theo. Mở lại thư viện sẽ khởi động bộ nạp nếu đã dừng.

Nếu còn shortcut **Codex With Wallpaper** do phiên bản trước tạo trên Desktop, bộ cài đưa shortcut đó về thư viện chọn ảnh (`--settings`). Không tạo thêm một ứng dụng Codex để dùng hằng ngày.

Bộ nạp tạo lại lớp ảnh nếu Windows hủy nó khi app đổi cửa sổ, kiểm tra HWND thật và giữ lỗi từng cửa sổ riêng. WinEvent ngoài tiến trình cập nhật vị trí/thu nhỏ/khôi phục ngay khi có sự kiện; quét định kỳ vẫn được giữ làm dự phòng. Không chèn DLL vào app. `overlay-state.json` báo số lớp ảnh đang hiển thị theo trạng thái Windows thực tế; log ghi các lần tạo lại và thay đổi trạng thái.

Tệp cấu hình tạm thời bị khóa hoặc đang được thay thế sẽ được đọc lại; ảnh đang hiện được giữ tối đa hai giây trong lúc chờ. Cấu hình mất lâu hơn sẽ báo lỗi, còn Khôi phục/0% vẫn có hiệu lực ngay. API trạng thái cũng đọc lại khi tệp trạng thái đang được thay thế. Khi cập nhật bộ cài, thư viện đang chạy được khởi động lại để nạp mã mới; mở lại cửa sổ thư viện cũ nếu còn hiển thị liên kết phiên trước.

Lưu/khôi phục được xử lý tuần tự, dùng tệp tạm và thay thế nguyên khối; khóa tệp ngắn của Windows được thử lại. UI khóa thao tác thay đổi trong lúc lưu, bỏ phản hồi làm mới cũ và cập nhật preview khi file cùng tên bị chép đè. Áp dụng lại GIF luôn nạp decoder mới. Bộ cài giữ nguyên shortcut thư viện đã ghim (`--settings`) khi sửa shortcut Codex cũ.

Nút **Mở Codex gốc** kích hoạt gói app chính thức, không thêm cổng debug hoặc chờ thoát phiên đang làm việc. Shortcut cũ mở qua `CodexWallpaper.exe` vẫn dùng được, nhưng không còn là điều kiện để hiện ảnh. Bộ cài mới đưa các pin đã bị bộ cài cũ đổi sang launcher về app chính thức, giữ bản sao trong `backups`, rồi ngừng chuyển pin sang launcher.

## Dữ liệu và chẩn đoán

- Bộ cài: `%USERPROFILE%\CodexWallpaper\app`.
- Ảnh cá nhân: `%USERPROFILE%\CodexWallpaper\images`; ảnh gốc được giữ, JPEG tối ưu tạo riêng.
- Lựa chọn ảnh/độ mờ: `settings.json`; kiểu tích hợp: `integration.json`.
- Trạng thái bộ nạp: `overlay-state.json`; lỗi: `overlay.log`.
- Tác vụ `CodexWallpaperService` phục vụ thư viện trên loopback, chạy theo yêu cầu. Thư viện dùng Edge app window hoặc trình duyệt mặc định. Bộ nạp ảnh không phụ thuộc dịch vụ này.

Dữ liệu ở thư mục UserProfile để tiến trình ngoài bản Store đọc được, tránh chuyển hướng AppData của MSIX. Dữ liệu cũ trong AppData được sao chép khi cần, không xóa bản nguồn. Ảnh không gửi lên mạng.

## Kiểm tra

```powershell
node --test tools/extension.test.mjs tools/windows-wallpaper.test.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\windows-overlay.test.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\windows-launcher.test.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\windows-taskbar.test.ps1
```

Test dùng cả cửa sổ cùng tiến trình và chương trình thử ở tiến trình riêng: ba lần khởi động tiến trình, 24 vòng đóng/mở cửa sổ, thay đổi vị trí/thu nhỏ/khôi phục bằng WinEvent khi đã tắt polling, lớp ảnh bị hủy, nhiều cửa sổ, nạp lại ảnh, tọa độ, ownership, input xuyên qua và xử lý lỗi. Có trigger đăng nhập chưa thay thế kiểm thử reboot thật. Windows/Codex mới, nhiều màn hình và mức DPI khác nhau có thể cần kiểm tra thêm.

Kiểm thử hồi quy bổ sung: nhập trùng tên đồng thời, lưu/khôi phục đồng thời, khóa tệp Windows ngắn, dọn tệp tạm khi lưu thất bại, khôi phục JSON hỏng, GIF cùng tên được thay nội dung và 40 vòng đổi GIF/ảnh tĩnh không tích lũy GDI handle. Xem [kết quả rà soát](../docs/stability-review.md).

Hướng này tham khảo kiến trúc fork paperfish-bot; hai fork Windows khác vẫn dùng launcher. Chi tiết và nguồn trong [khảo sát fork](../docs/windows-forks.md).

## Tắt và gỡ

Để tắt ảnh, dùng **Khôi phục giao diện gốc**. Để dừng chương trình và ngăn chạy khi đăng nhập:

```powershell
Stop-ScheduledTask -TaskName CodexWallpaperOverlay
Disable-ScheduledTask -TaskName CodexWallpaperOverlay
```

Để bật lại:

```powershell
Enable-ScheduledTask -TaskName CodexWallpaperOverlay
Start-ScheduledTask -TaskName CodexWallpaperOverlay
```

Khi gỡ, dừng/xóa hai tác vụ `CodexWallpaperOverlay`, `CodexWallpaperService`, xóa shortcut Codex Wallpaper và thư mục `app`. Giữ `images`, `gifs` và `settings.json` nếu cần ảnh/cấu hình. Không cần gỡ Codex hoặc sửa WindowsApps.

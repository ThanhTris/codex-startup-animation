# Hình nền Codex cho Windows

**Codex Wallpaper** giúp bạn dùng ảnh riêng, GIF hoặc video MP4/WebM/MOV làm hình nền cho Codex trên Windows. Chọn và lưu một lần trong thư viện; những lần sau, mở **biểu tượng Codex gốc** như bình thường để hiện hình nền đã lưu. GIF và video phát lặp vô hạn.

Dự án do [ThanhTris](https://github.com/ThanhTris/codex-startup-animation) phát triển từ bản sao nhánh của [panding999/codex-startup-animation](https://github.com/panding999/codex-startup-animation). Mã hoạt ảnh khởi động trên macOS của dự án gốc vẫn được giữ lại, với [hướng dẫn riêng bằng tiếng Việt](docs/macos.md).

## App này làm được gì?

| Chức năng trên Windows | Cách hoạt động |
| --- | --- |
| Thư viện ảnh cá nhân | Thêm PNG, JPEG, WebP hoặc GIF bằng nút chọn tệp, kéo thả hoặc chép vào thư mục riêng. |
| Phân loại ảnh | Lọc **Tất cả**, **Ảnh tĩnh** và **GIF**; có nút mở từng thư mục. |
| Xóa và hoàn tác | Nút thùng rác trên từng ảnh/GIF/video, kể cả tệp lỗi. Xóa hình đang dùng sẽ tắt hình nền; có thể hoàn tác sau khi mở lại thư viện. |
| Báo tệp trùng khi thêm | So sánh nội dung SHA-256, kể cả khác tên. Chọn **Bỏ qua tệp này** hoặc **Vẫn lưu bản sao**. |
| Xem trước giao diện | Mô phỏng lớp ảnh phủ lên Codex trước khi áp dụng. |
| Căn và cắt vùng hiển thị | Kéo ảnh, phóng/thu 25–400%, chọn phủ kín khung hoặc hiện toàn bộ ảnh; giữ nguyên ảnh/GIF gốc. |
| Chỉnh độ đậm nhạt | Điều chỉnh từ 0–75%, có mức chọn nhanh 15%, 25% và 35%. |
| Đổi hình nền khi đang dùng | Bấm **Áp dụng hình nền** để lưu lựa chọn và cập nhật cửa sổ Codex đang mở. |
| Tự hiện khi mở app gốc | Bộ nạp chạy nền nhận diện cửa sổ Codex; không cần mở thư viện mỗi lần dùng. |
| Phát ảnh động | GIF giữ nguyên chuyển động, giới hạn khoảng 15 khung hình/giây; tự dừng khi mọi cửa sổ Codex bị ẩn hoặc thu nhỏ. |
| Video lặp vô hạn | Nhận MP4, M4V, WebM và MOV; phát lại toàn bộ clip khi hết, không có âm thanh. Dùng chung độ hiện, căn/cắt ảnh và lưu lựa chọn. |
| Tạm dừng GIF | Chọn tạm dừng trong thư viện rồi áp dụng để dùng khung hình tĩnh. |
| Khôi phục giao diện | Tắt lớp hình nền và giữ nguyên ảnh trong thư viện. |
| Lưu trên máy | Ảnh và cấu hình nằm ngoài kho mã nguồn, không được gửi lên mạng. |

Windows dùng **lớp ảnh trong suốt phủ lên cửa sổ, kể cả chữ**. Hãy bắt đầu ở mức 15–25% rồi điều chỉnh để nội dung dễ đọc. Lớp ảnh cho thao tác chuột đi xuyên qua và không lấy quyền nhập liệu của Codex. Hình xem trước là bản mô phỏng; màu sắc và bố cục có thể khác app thật.

## Yêu cầu trên Windows

- Windows 10/11 và bản Codex cài từ Microsoft Store, có mã gói `OpenAI.Codex`.
- Windows PowerShell và .NET Framework có sẵn trên hệ thống để biên dịch bộ nạp.
- Thư viện ảnh dùng Node.js 22 trở lên trong `PATH`; nếu không có, công cụ tìm Node.js đi kèm Codex. Bộ nạp hình nền chạy riêng, không phụ thuộc Node.js.
- Không cần cài gói npm hoặc chạy bộ cài với quyền quản trị.

## Cài đặt

Tải mã nguồn từ [repo này](https://github.com/ThanhTris/codex-startup-animation), mở PowerShell tại thư mục dự án rồi chạy:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\install.ps1
```

Bộ cài tạo mục **Codex Wallpaper** trong trình đơn Start và tác vụ chạy bộ nạp khi đăng nhập Windows. Ảnh cá nhân và lựa chọn đã lưu được giữ khi cài lại.

Kho mã nguồn chứa mã để tự biên dịch; không cần sử dụng ảnh mẫu của tác giả gốc làm hình nền Windows.

## Cách sử dụng

1. Mở **Codex Wallpaper** trong trình đơn Start. Nếu đã có lối tắt **Codex With Wallpaper** từ bản cũ trên màn hình nền, bạn cũng có thể dùng lối tắt đó để mở thư viện.
2. Bấm **Thêm ảnh hoặc GIF**, kéo thả tệp vào thư viện hoặc chép vào thư mục ảnh/GIF.
3. Chọn hình, xem trước và chỉnh **Độ hiện của hình nền**. Với GIF, có thể chọn **Tạm dừng GIF**.
4. Bấm **Áp dụng hình nền**. Nếu Codex đang mở, hình nền sẽ được cập nhật.
5. Đóng thư viện. Từ lần sau, mở **biểu tượng Codex/ChatGPT gốc của gói Codex** như bình thường; bộ nạp sẽ tự hiện lựa chọn đã lưu.

Nút **Mở Codex** trong thư viện chỉ giúp mở ứng dụng gốc cho tiện kiểm tra. Bạn không phải bấm nút này mỗi lần sử dụng. Nút **Khôi phục giao diện gốc** tắt hình nền mà không xóa thư viện.

Mỗi thẻ có **nút thùng rác** ở góc phải để xóa khỏi thư viện, kể cả tệp bị hỏng hoặc không tạo được ảnh xem trước. App hỏi lại trước khi xóa; xóa hình nền đang dùng sẽ tắt hình đó trên Codex. **Hoàn tác xóa gần nhất** đưa tệp trở lại, không ghi đè tệp cùng tên và không tự bật lại hình nền. Có thể hoàn tác lần lượt các tệp đã xóa, kể cả sau khi khởi động lại thư viện. Tệp được giữ trong `trash` trên máy, chưa tự dọn vĩnh viễn.

Khi thêm tệp bằng nút chọn hoặc kéo thả, nếu nội dung giống hệt tệp đã có, app hiện tên bản trùng để bạn chọn **Bỏ qua tệp này** hoặc **Vẫn lưu bản sao**. Bản sao được đặt tên riêng, không ghi đè bản cũ. Kiểm tra áp dụng cho ảnh, GIF và video; đây là so sánh tệp giống hệt, không nhận diện hai hình nhìn tương tự hoặc đã nén lại. Tệp chép trực tiếp bằng Explorer vẫn được liệt kê, không tự bị xóa.

Muốn chọn vùng ảnh, bấm **Căn / cắt ảnh** dưới phần xem trước. Kéo ảnh trong khung, chỉnh độ phóng hoặc vị trí ngang/dọc; chọn **Phủ kín khung** để lấp đầy hoặc **Hiện toàn bộ ảnh** để tránh mất nội dung. Có khung xem thử theo màn hình, 16:9, 16:10, 21:9 và 4:3. Bấm **Xong** rồi **Áp dụng hình nền** để lưu. Khung xem thử không đổi kích thước Codex: khi cửa sổ thay đổi, chương trình giữ cách căn và độ phóng theo tỷ lệ. Vùng trống khi thu nhỏ dùng nền tối. Với GIF, phần căn ảnh dùng ảnh tĩnh để dễ chỉnh; GIF vẫn chuyển động khi áp dụng.

## Thư mục dữ liệu

| Đường dẫn | Nội dung |
| --- | --- |
| `%USERPROFILE%\CodexWallpaper\images` | Ảnh tĩnh của bạn và bản JPEG tối ưu được tạo riêng. |
| `%USERPROFILE%\CodexWallpaper\gifs` | GIF gốc, giữ nguyên dữ liệu động khi áp dụng. |
| `%USERPROFILE%\CodexWallpaper\videos` | Video gốc; phát lặp vô hạn, không âm thanh. |
| `%USERPROFILE%\CodexWallpaper\video-cache` | Ảnh xem trước và thông tin video; không chứa bản GIF chuyển đổi. |
| `%USERPROFILE%\CodexWallpaper\trash` | Tệp đã xóa khỏi thư viện và thông tin để hoàn tác. Vẫn chiếm dung lượng cho đến khi được dọn thủ công. |
| `%USERPROFILE%\CodexWallpaper\settings.json` | Lựa chọn hình nền, độ hiện và trạng thái tạm dừng. |
| `%USERPROFILE%\CodexWallpaper\app` | Mã chương trình và bộ nạp đã biên dịch trên máy. |

Bạn có thể chép tệp vào thư mục rồi bấm **Làm mới thư viện**. Thư viện cũng tự kiểm tra thay đổi khi đang mở. Việc đóng Codex hoặc thư viện không xóa ảnh và cấu hình.

## Giới hạn ảnh và GIF

### Video MP4, M4V, WebM và MOV

Mở tab **Video**, thêm hoặc kéo thả video, chọn cách căn rồi bấm **Áp dụng hình nền**. Bộ nạp phát lặp vô hạn, tắt âm thanh và giới hạn khoảng 15 khung hình/giây. Khi Codex bị ẩn/thu nhỏ, bộ giải mã ngừng nhận yêu cầu khung hình; khi mở lại, video tiếp tục. Video gốc được giữ trong `%USERPROFILE%\CodexWallpaper\videos`, không đổi thành GIF. Ảnh thu nhỏ và ảnh dùng khi tạm dừng nằm trong `video-cache`.

Giới hạn hiện tại: **200 MB/tệp, 10 phút, 8,3 megapixel**; hỗ trợ codec H.264, VP8, VP9 hoặc AV1. **MP4 H.264** tương thích tốt nhất với phần xem trước trong trình duyệt. Bộ nạp giảm kích thước khung hình tối đa 1280×720 để hạn chế tài nguyên; tốc độ thực tế còn tùy video và cấu hình máy. Một số tệp MOV cũ không có cấu trúc được hỗ trợ sẽ bị từ chối.

Video cần bộ giải mã [FFmpeg](https://ffmpeg.org/documentation.html) bên ngoài. Ảnh tĩnh và GIF không cần thành phần này. Trên máy mới, cài qua WinGet rồi chạy lại bộ cài để ghi nhận đường dẫn:

```powershell
winget install --id Gyan.FFmpeg.Essentials --exact --source winget
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\install.ps1
```

FFmpeg không được đóng gói hoặc tải lên repo này. Bộ cài chỉ tìm thành phần đã cài và ghi đường dẫn vào `video-runtime.json`. Có thể bấm **Tạm dừng** rồi Áp dụng để lưu video ở trạng thái ảnh tĩnh; khi mở lại, trạng thái này được giữ.

### Ảnh tĩnh và GIF

- Mỗi tệp tối đa **30 MB**.
- Ảnh tĩnh tối đa **40 megapixel**; khi áp dụng sẽ tạo JPEG tối ưu riêng và giữ ảnh gốc.
- GIF tối đa **2 megapixel**, **300 khung hình** và tổng số điểm ảnh của các khung hình không vượt **120 triệu**. Tệp phải đáp ứng đồng thời các giới hạn này.
- GIF trong Codex được giới hạn khoảng **15 khung hình/giây**. Phần xem trước phát theo tốc độ GIF gốc nên có thể khác bộ nạp.
- Ảnh thu nhỏ của GIF là ảnh tĩnh để tránh phát nhiều GIF cùng lúc trong thư viện.

Mức CPU/RAM phụ thuộc kích thước và nội dung GIF. [Báo cáo tài nguyên](docs/gif-performance.md) ghi số đo của chương trình thử riêng; chưa phải số đo CPU/GPU của mọi GIF trong bản đã tích hợp.

## Cách hoạt động

Trên Windows, thư viện chỉ dùng để chọn và lưu hình. Chương trình `CodexWallpaperOverlay.exe` chạy nền, nhận diện cửa sổ Codex chính thức và hiển thị lớp ảnh theo vị trí cửa sổ. Khi đóng Codex, bộ nạp chờ lần mở tiếp theo; khi đăng nhập Windows, tác vụ `CodexWallpaperOverlay` khởi động bộ nạp.

Thư viện được phục vụ qua địa chỉ nội bộ `127.0.0.1` bằng tác vụ `CodexWallpaperService`, chạy khi cần mở thư viện. Bộ nạp hình nền hoạt động độc lập với cửa sổ thư viện. Bản Windows hiện không sửa gói cài Codex, không chèn DLL và không mở cổng gỡ lỗi của Codex.

## Khi gặp lỗi

- **Mở Codex gốc mà chưa thấy hình:** mở thư viện, kiểm tra trạng thái phía trên và bấm Áp dụng. Nếu bộ nạp chưa chạy, mở lại thư viện hoặc chạy lại bộ cài.
- **Không thấy GIF trong danh sách:** kiểm tra tệp có nằm trong thư mục `gifs`, đúng định dạng và không vượt giới hạn; bấm Làm mới.
- **Chữ khó đọc:** giảm độ hiện xuống 15–25% hoặc Khôi phục giao diện gốc.
- **Trang thư viện cũ báo mất kết nối sau khi cập nhật:** đóng trang đó và mở lại **Codex Wallpaper** từ trình đơn Start.

Hướng dẫn kiểm tra trạng thái, tắt bộ nạp và gỡ cài đặt nằm trong [tài liệu Windows](windows/README.md).

## Kiểm thử và phạm vi hỗ trợ

```powershell
node --test tools/extension.test.mjs tools/windows-wallpaper.test.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\windows-overlay.test.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\windows-launcher.test.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\windows-taskbar.test.ps1
```

Đợt rà soát ngày 23/10/2026 đã kiểm tra lưu/mở lại ảnh và GIF, 24 vòng đóng/mở cửa sổ, thu nhỏ/khôi phục, thao tác lưu đồng thời và 40 vòng đổi GIF/ảnh tĩnh không tích lũy tài nguyên đồ họa GDI trong kiểm thử. Xem [báo cáo độ ổn định](docs/stability-review.md).

Chưa kiểm tra đầy đủ việc khởi động lại máy, nhiều màn hình với mức DPI khác nhau hoặc chạy liên tục nhiều giờ. Các phiên bản Windows/Codex mới có thể cần điều chỉnh. Phần macOS được giữ từ dự án gốc và chưa được kiểm thử lại trên máy Windows này.

## Tài liệu khác

- [Cài đặt, sử dụng và chẩn đoán trên Windows](windows/README.md).
- [Hoạt ảnh khởi động và hình nền trên macOS](docs/macos.md).
- [Cấu trúc phần mở rộng macOS](extension/README.md).
- [Khảo sát các bản sao nhánh hỗ trợ Windows](docs/windows-forks.md).
- [Nguồn tham khảo và hình ảnh mẫu](docs/references.md).

## Cấu trúc dự án

```text
windows/          Thư viện ảnh/GIF, bộ cài và lớp hình nền Windows
Native/           Chương trình khởi động và xem trước trên macOS
extension/        Kết nối và giao diện tạm thời cho macOS
assets/           Ảnh, đường nét và biểu tượng mẫu của phần macOS
tools/            Công cụ biên dịch, đo tài nguyên và kiểm thử
docs/             Hướng dẫn và báo cáo bằng tiếng Việt
index.html        Trang hoạt ảnh và bảng cài đặt của dự án gốc
animation.js      Hoạt ảnh, mảnh ảnh và hiệu ứng vẽ đường nét
image-settings.js Lưu ảnh và cài đặt cục bộ của phần hoạt ảnh
style.css         Kiểu hiển thị của phần hoạt ảnh
```

## Nguồn gốc và quyền sử dụng

Đây là dự án cá nhân, không có quan hệ trực thuộc OpenAI. Mã nguồn macOS và hình ảnh mẫu được kế thừa từ [repo gốc của panding999](https://github.com/panding999/codex-startup-animation); phần phát triển Windows và các nguồn tham khảo được ghi trong [tài liệu nguồn gốc](docs/references.md).

Quyền đối với hình nhân vật và biểu tượng thương hiệu thuộc chủ sở hữu tương ứng. Việc có hình mẫu trong repo không cấp thêm quyền phân phối hoặc sử dụng nhãn hiệu. Dự án hiện chưa chỉ định giấy phép mã nguồn mở cho mã chương trình.

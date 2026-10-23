# Hướng dẫn Codex Wallpaper trên Windows

Codex Wallpaper quản lý ảnh/GIF cá nhân và tự hiện lớp hình nền khi bạn mở ứng dụng Codex gốc. Xem [danh sách chức năng](../README.md#app-này-làm-được-gì) để hiểu các thao tác chính.

## Cài đặt

Mở Windows PowerShell tại thư mục dự án rồi chạy:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\install.ps1
```

Bộ cài tạo `CodexWallpaperOverlay.exe` và tác vụ đăng nhập `CodexWallpaperOverlay`, chạy dưới tài khoản hiện tại với quyền người dùng thông thường (`Limited`). Bộ nạp theo dõi cửa sổ thuộc gói Microsoft Store `OpenAI.Codex` và hiển thị lớp ảnh trong suốt.

Thư viện cần Node.js 22 trở lên trong `PATH` hoặc Node.js đi kèm Codex. Không cần cài thêm gói npm; bộ nạp hình nền chạy độc lập với Node.js. Yêu cầu hệ thống đầy đủ nằm ở [README chính](../README.md#yêu-cầu-trên-windows).

## Chọn ảnh và áp dụng

1. Mở **Codex Wallpaper** trong trình đơn Start. Nếu có lối tắt **Codex With Wallpaper** từ bản cũ trên màn hình nền, lối tắt này cũng mở thư viện.
2. Chọn bộ lọc **Tất cả**, **Ảnh tĩnh** hoặc **GIF**. Thêm PNG/JPEG/WebP/GIF bằng nút **Thêm ảnh hoặc GIF**, kéo thả, hoặc chép vào thư mục tương ứng.
3. Chọn hình, chỉnh **Độ hiện của hình nền** trong phần **Xem trước**. Thử 15–25% để chữ dễ đọc; có mức chọn nhanh 15%, 25% và 35%.
4. Với GIF, chọn **Tạm dừng GIF** nếu muốn dùng ảnh tĩnh. Muốn lưu trạng thái này cho Codex, bấm **Áp dụng hình nền**.
5. Bấm **Áp dụng hình nền** để lưu ảnh, độ hiện và trạng thái GIF. Nếu Codex đang mở, bộ nạp sẽ cập nhật lớp ảnh.
6. Đóng thư viện. Những lần sau, mở **biểu tượng Codex/ChatGPT gốc của gói Codex** như bình thường.

Nút **Mở Codex** kích hoạt ứng dụng chính thức, không cần đóng phiên làm việc đang mở. Bạn không phải mở thư viện hoặc dùng lối tắt riêng mỗi lần dùng Codex.

## Thư viện và dữ liệu

Bấm **Căn / cắt ảnh** dưới phần xem trước để chọn vùng hiển thị. Kéo để dời ảnh hoặc dùng thanh **Vị trí ngang/dọc**; chỉnh **Phóng to / thu nhỏ** từ 25–400%. **Phủ kín khung** lấp đầy cửa sổ, **Hiện toàn bộ ảnh** giữ đủ nội dung (có thể có vùng nền tối); **Đặt lại** trở về cách căn giữa mặc định. Thử khung theo màn hình, 16:9, 16:10, 21:9 hoặc 4:3 rồi bấm **Xong → Áp dụng hình nền**.

Cách căn được lưu trong `settings.json` và giữ sau khi mở lại. Ảnh/GIF gốc không bị cắt hoặc ghi đè. Khung chỉ mô phỏng tỷ lệ: bộ nạp vẫn theo kích thước cửa sổ Codex thật và giữ vị trí/độ phóng tương đối khi đổi kích thước. Cấu hình cũ chưa có cách căn tiếp tục dùng chế độ phủ kín, căn giữa như trước.

Dữ liệu nằm dưới `%USERPROFILE%\CodexWallpaper`, bên ngoài kho mã nguồn:

| Vị trí | Nội dung |
| --- | --- |
| `images` | Ảnh tĩnh gốc và JPEG tối ưu được tạo riêng. |
| `gifs` | GIF gốc, không chuyển thành JPEG khi áp dụng. |
| `app` | Mã chương trình và các tệp đã biên dịch trên máy. |
| `settings.json` | Ảnh được chọn, độ hiện, loại ảnh và trạng thái tạm dừng. |
| `integration.json` | Kiểu tích hợp đang dùng. |
| `overlay-state.json` | Trạng thái bộ nạp và số lớp ảnh đang hiển thị. |
| `overlay.log` | Nhật ký bộ nạp và lỗi phát sinh. |
| `launcher.log`, `service.log` | Nhật ký mở chương trình và dịch vụ thư viện. |
| `backups` | Bản sao lối tắt cũ khi cần chuyển về ứng dụng gốc. |

**Thư mục ảnh** và **Thư mục GIF** mở đúng thư mục để bạn chép tệp vào. Bấm **Làm mới thư viện** để đọc ngay; khi đang mở, thư viện cũng tự kiểm tra thay đổi.

Mỗi tệp tối đa **30 MB**. Ảnh tĩnh tối đa **40 megapixel**. GIF tối đa **2 megapixel**, **300 khung hình** và tổng số điểm ảnh của các khung hình không vượt **120 triệu**; phải đáp ứng đồng thời các giới hạn. Tệp không hợp lệ hoặc vượt giới hạn được báo trong thư viện. Ảnh và GIF cùng tên ở hai thư mục vẫn được phân biệt.

Ảnh không được gửi lên mạng. Dữ liệu đặt tại thư mục hồ sơ người dùng để tiến trình bên ngoài bản Store đọc được, tránh chuyển hướng AppData của MSIX. Bộ cài có thể sao chép dữ liệu cũ từ AppData khi cần, không xóa bản nguồn.

## Ảnh động, video và mức sử dụng tài nguyên

### Video lặp vô hạn

Tab **Video** nhận MP4, M4V, WebM và MOV; tối đa 200 MB, 10 phút và 8,3 megapixel, codec H.264/VP8/VP9/AV1. Nên dùng MP4 H.264 để phần xem trước trong trình duyệt tương thích tốt. Một số MOV cũ không được hỗ trợ. Video gốc được lưu ở `videos`, ảnh thu nhỏ ở `video-cache`; ảnh thu nhỏ không phát động trong danh sách.

Thêm video bằng **Thêm ảnh / GIF / video** hoặc kéo thả, chọn video, căn/cắt và chỉnh độ hiện rồi Áp dụng. Video tự lặp lại toàn bộ clip khi đến cuối, luôn tắt âm thanh. Bộ nạp dùng một tiến trình FFmpeg chung cho các cửa sổ, hai bộ đệm điểm ảnh cố định, dựng tối đa 1280×720 và khoảng 15 khung hình/giây. Khi mọi cửa sổ Codex bị ẩn/thu nhỏ hoặc lưu trạng thái tạm dừng, bộ nạp ngừng yêu cầu khung hình, không tích trữ toàn bộ video trong RAM. Khi đổi sang ảnh/GIF hoặc tắt hình nền, tiến trình giải mã được dừng.

FFmpeg là thành phần riêng, không được đóng gói vào repo. Cài bằng `winget install --id Gyan.FFmpeg.Essentials --exact --source winget`, sau đó chạy lại `windows/install.ps1`. Bộ cài tìm `ffmpeg.exe` và `ffprobe.exe` trong đường dẫn chương trình hoặc đường dẫn người dùng, rồi ghi `video-runtime.json`. Không có FFmpeg thì ảnh/GIF vẫn dùng được, nhưng nhập video sẽ báo thiếu bộ giải mã. Tệp video đang phát được đọc trực tiếp; nếu cần ghi đè tệp đó, hãy đổi sang hình khác trước.

Xem trước trong trình duyệt có thể phát theo tốc độ gốc, khác giới hạn bộ nạp. Số đo GIF trong báo cáo cũ không đại diện cho CPU/GPU của video. Kiểm thử video: `node --test tools/windows-video.test.mjs`; bộ kiểm thử bộ nạp sẽ chạy thêm phần video khi đặt `CODEX_TEST_FFMPEG` trỏ đến FFmpeg.

### GIF

GIF giữ nguyên dữ liệu động, phát lặp liên tục theo thời gian từng khung hình và giới hạn khoảng **15 khung hình/giây** trong Codex. Các cửa sổ dùng chung một bộ giải mã và trục thời gian; chương trình không lưu sẵn toàn bộ khung hình đã giải nén.

Bộ đếm phát dừng khi mọi cửa sổ Codex bị thu nhỏ/ẩn, khi tắt hình nền hoặc khi bạn lưu trạng thái tạm dừng. Ảnh thu nhỏ trong thư viện là ảnh tĩnh, tránh phát nhiều GIF cùng lúc. Phần xem trước phát theo tốc độ GIF gốc nên có thể khác tốc độ trong app.

Bộ lọc đọc cấu trúc theo [đặc tả GIF89a](https://www.w3.org/Graphics/GIF/spec-gif89a.txt) trước khi chuyển cho bộ giải mã Windows. Một số GIF vẫn có thể bị bộ giải mã Windows từ chối dù trình duyệt mở được. Xem [báo cáo đo thử tài nguyên](../docs/gif-performance.md) để biết phạm vi các số đo CPU/RAM đã có.

## Cơ chế tự hiện hình nền

**Ảnh phủ lên cửa sổ, kể cả chữ**; hình xem trước mô phỏng cùng độ trong suốt, nhưng màu và bố cục có thể khác app thật. Lớp ảnh cho thao tác chuột đi xuyên qua, không lấy quyền nhập liệu và không có nút riêng trên thanh tác vụ. Nó ẩn khi Codex thu nhỏ hoặc ở màn hình làm việc ảo khác. Hộp chọn tệp và cửa sổ phụ có cửa sổ sở hữu không được coi là cửa sổ chính.

Bộ nạp nhận sự kiện cửa sổ qua WinEvent, kèm quét định kỳ dự phòng. Nếu Windows hủy lớp ảnh khi Codex đổi cửa sổ, bộ nạp tạo lại lớp ảnh và xử lý lỗi riêng cho từng cửa sổ. Không chèn DLL hoặc sửa gói cài Codex; chế độ Windows hiện không mở cổng gỡ lỗi của Codex.

Có hai tác vụ riêng:

| Tác vụ | Khi chạy | Công việc |
| --- | --- | --- |
| `CodexWallpaperOverlay` | Khi cài và khi đăng nhập Windows; tiếp tục chờ nếu Codex đã đóng. | Theo dõi cửa sổ và hiển thị hình nền đã lưu. |
| `CodexWallpaperService` | Khi cần mở thư viện. | Phục vụ giao diện thư viện qua địa chỉ nội bộ; mở bằng cửa sổ ứng dụng Edge hoặc trình duyệt mặc định. |

Đóng thư viện hoặc thoát Codex không dừng bộ nạp. Mở lại thư viện sẽ khởi động bộ nạp nếu đã dừng. Bộ cài giữ lối tắt thư viện đã ghim, chỉ chuyển các lối tắt Codex do bộ cài cũ đổi về ứng dụng chính thức.

Nếu tệp cấu hình tạm bị khóa hoặc đang thay thế, bộ nạp giữ ảnh hiện tại tối đa hai giây trong lúc đọc lại. Lưu/khôi phục được xử lý tuần tự, thay tệp cấu hình nguyên khối và thử lại khi Windows khóa tệp trong chốc lát. Giao diện khóa thao tác thay đổi trong khi lưu, bỏ phản hồi làm mới cũ và cập nhật ảnh xem trước khi tệp cùng tên bị chép đè. Áp dụng lại GIF sẽ nạp bộ giải mã mới.

## Khôi phục và xử lý lỗi

**Khôi phục giao diện gốc** ẩn hình nền, giữ ảnh và GIF trong thư viện. Đặt độ hiện 0% cũng ẩn lớp ảnh.

Nếu mở app gốc mà chưa thấy hình:

1. Mở lại **Codex Wallpaper**, kiểm tra trạng thái trên đầu trang.
2. Chọn hình và bấm **Áp dụng hình nền**.
3. Nếu bộ nạp chưa chạy, chạy lại bộ cài hoặc khởi động tác vụ:

```powershell
Start-ScheduledTask -TaskName CodexWallpaperOverlay
```

Sau khi cập nhật bộ cài, dịch vụ thư viện đang chạy được khởi động lại để nạp mã mới. Trang thư viện cũ có thể giữ liên kết phiên trước; đóng trang đó và mở lại từ trình đơn Start.

Xem `overlay-state.json` và `overlay.log` khi cần kiểm tra sâu hơn. Kiểu tích hợp hiện tại cần là `overlay` trong `integration.json`.

## Kiểm thử

```powershell
node --test tools/extension.test.mjs tools/windows-wallpaper.test.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\windows-overlay.test.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\windows-launcher.test.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\windows-taskbar.test.ps1
```

Kiểm thử dùng cửa sổ thử riêng cùng tiến trình và ở tiến trình khác: ba lần mở tiến trình, 24 vòng đóng/mở cửa sổ, di chuyển/thu nhỏ/khôi phục qua WinEvent khi đã tắt quét định kỳ, lớp ảnh bị hủy, nhiều cửa sổ, nạp lại ảnh, tọa độ, quyền sở hữu cửa sổ, thao tác chuột xuyên qua và phục hồi sau lỗi.

Kiểm thử hồi quy bổ sung bao gồm nhập trùng tên đồng thời, lưu/khôi phục đồng thời, khóa tệp Windows ngắn, dọn tệp tạm khi lưu thất bại, khôi phục JSON hỏng, thay nội dung GIF cùng tên và 40 vòng đổi GIF/ảnh tĩnh không tích lũy tài nguyên đồ họa GDI. Xem [báo cáo rà soát](../docs/stability-review.md).

Cấu hình tác vụ đăng nhập không thay thế kiểm tra khởi động lại máy thật. Windows/Codex mới, nhiều màn hình và mức DPI khác nhau có thể cần kiểm tra thêm. Thiết kế lớp ảnh tham khảo bản sao nhánh paperfish-bot; nguồn đối chiếu có trong [khảo sát các bản sao nhánh](../docs/windows-forks.md).

## Tắt, bật lại và gỡ cài đặt

Để tắt ảnh, dùng **Khôi phục giao diện gốc**. Muốn dừng bộ nạp và ngăn chạy khi đăng nhập:

```powershell
Stop-ScheduledTask -TaskName CodexWallpaperOverlay
Disable-ScheduledTask -TaskName CodexWallpaperOverlay
```

Để bật lại:

```powershell
Enable-ScheduledTask -TaskName CodexWallpaperOverlay
Start-ScheduledTask -TaskName CodexWallpaperOverlay
```

Khi gỡ, dừng và xóa hai tác vụ `CodexWallpaperOverlay`, `CodexWallpaperService`, xóa lối tắt Codex Wallpaper và thư mục `app`. Giữ `images`, `gifs` và `settings.json` nếu muốn giữ ảnh/cấu hình. Không cần gỡ Codex hoặc sửa thư mục WindowsApps.

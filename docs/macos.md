# Hoạt ảnh khởi động Codex trên macOS

Phần macOS được kế thừa từ [panding999/codex-startup-animation](https://github.com/panding999/codex-startup-animation). Hướng dẫn này được dịch và sắp xếp lại bằng tiếng Việt. Nếu dùng Windows, xem [hướng dẫn Windows](../windows/README.md).

## Chức năng

Hoạt ảnh dài khoảng 12 giây: nhịp sáng khởi động → ảnh đại diện và vòng tròn xoay → mảnh ảnh tách ra → đường nét nhân vật gom từ trái sang phải → hình nền màu hiện lên → khép vào giữa và trở về giao diện Codex.

- Chọn ảnh đại diện cho nửa đầu và hình nền cho nửa sau; khi đổi hình nền, công cụ tự tạo đường nét.
- Sửa tiêu đề, dòng chữ nhỏ và phụ đề; để trống để ẩn chữ.
- Chỉnh độ hiện hình nền hoặc khôi phục giao diện Codex.
- Bỏ qua hoạt ảnh bằng nút trên màn hình hoặc phím Esc; hỗ trợ thiết lập giảm chuyển động của hệ thống.
- Có chương trình xem trước độc lập, thanh thời gian và nút phát lại.

Đây là chương trình khởi động và phần giao diện bên ngoài do cộng đồng phát triển. Nó mở app chính thức đã cài trên máy và thêm hoạt ảnh tạm thời vào cửa sổ chính, không sửa gói cài hoặc tệp `app.asar`.

[Video minh họa do tác giả gốc công bố](https://v.douyin.com/XaCddnhQbQ0/) thể hiện phần hoạt ảnh macOS, không phải giao diện thư viện Windows.

## Yêu cầu

- macOS 13 trở lên.
- Xcode Command Line Tools, gồm `swiftc` và các nền tảng AppKit, WebKit, Vision dùng để biên dịch/xử lý ảnh.
- Codex/ChatGPT chính thức đã cài, có mã ứng dụng `com.openai.codex`.
- Chương trình khởi động dùng Node.js đi kèm app chính thức, không đóng gói thêm Electron và không cần gói npm.

Dự án gốc ghi nhận từng thử trên bản app **26.924.22138**. Bản sao nhánh này chưa chạy lại kiểm thử macOS; phiên bản Codex mới có thể đổi môi trường chạy hoặc cấu trúc cửa sổ.

## Biên dịch

Tại thư mục gốc của dự án, chạy trên macOS:

```sh
bash tools/build-extension.sh
bash tools/build-macos.sh
```

| Kết quả | Công dụng |
| --- | --- |
| `dist/Codex.app` | Lối mở Codex kèm hoạt ảnh, có biểu tượng màu hồng. |
| `dist/Aemeath Startup.app` | Chương trình xem trước hoạt ảnh độc lập. |

Repo không chứa bản `.app` đã biên dịch. Lần đầu sử dụng cần biên dịch từ mã nguồn.

## Mở Codex kèm hoạt ảnh

1. Lưu công việc và dùng **⌘Q** để thoát hoàn toàn app Codex chính thức đang chạy.
2. Mở `dist/Codex.app`.
3. Trang Codex và hoạt ảnh được tải song song; khi hoạt ảnh kết thúc, bạn trở về trang chính.
4. Có thể chép chương trình khởi động màu hồng vào `~/Applications` để tiện mở những lần sau.

Nếu Codex đã chạy, chương trình khởi động chỉ chuyển về cửa sổ hiện có; không buộc thoát hoặc phát lại. Trên macOS, mở biểu tượng chính thức trực tiếp không tự nạp hoạt ảnh của dự án.

Mở `dist/Aemeath Startup.app` để xem trước độc lập. Bạn cũng có thể mở `index.html` bằng trình duyệt để dùng thanh thời gian và nút phát lại; kết quả này không thay thế kiểm tra tích hợp trên app thật.

## Cài đặt ảnh và chữ

Trong hoặc sau hoạt ảnh, nhấn **⌘⌥B** để mở bảng cài đặt. Bảng trong app gốc có thể giữ nhãn tiếng Trung của mã macOS; các thao tác tương ứng được giải thích dưới đây.

| Cài đặt | Ý nghĩa |
| --- | --- |
| Ảnh đại diện | Nhận PNG/JPEG/WebP, cắt giữa thành 512×512. |
| Hình nền | Nhận PNG/JPEG/WebP, cắt giữa thành 1536×1024 rồi tạo đường nét. |
| Tiêu đề và phụ đề | Sửa chữ ở hai phần hoạt ảnh; để trống để ẩn. |
| Độ hiện hình nền | Mặc định 42%; 0% tắt hình nền. |
| Lưu và xem trước | Lưu ảnh/chữ rồi phát lại hoạt ảnh. |
| Đóng bảng hoặc Esc | Bỏ thay đổi chưa lưu, kết thúc lớp hoạt ảnh và trở về Codex. |
| Khôi phục giao diện | Gỡ kiểu hiển thị và lối mở cài đặt của phần mở rộng, giữ dữ liệu tùy chỉnh đã lưu. |

Mỗi ảnh tối đa 30 MB. Ảnh và chữ được lưu cục bộ bằng IndexedDB, không tải lên mạng. Cài đặt của chương trình xem trước độc lập và phần tích hợp app không dùng chung. Cập nhật chương trình khởi động không chủ động xóa dữ liệu đã lưu.

## Tài nguyên mặc định

Repo giữ các tài nguyên cần để biên dịch phần macOS:

- `assets/avatar.jpg`: ảnh đại diện.
- `assets/artwork.jpg`: hình nền.
- `assets/contours.js`: đường nét tương ứng với hình nền mẫu.
- `assets/codex-pink.icns`: biểu tượng khởi động cá nhân.

Các thư viện dự phòng `assets/bg1/`, `assets/bg2/`, ảnh nguồn biểu tượng, video tham khảo, ảnh chụp tạm, bộ nhớ đệm biên dịch và `dist/` không được lưu trong Git. Mã nguồn tải mới vẫn có tài nguyên chạy sẵn để biên dịch.

Muốn tạo lại tài nguyên mặc định từ ảnh riêng:

```sh
AVATAR_SOURCE="/duong/dan/day/du/anh-dai-dien.jpg" \
ARTWORK_SOURCE="/duong/dan/day/du/hinh-nen.png" \
bash tools/prepare-defaults.sh

bash tools/build-extension.sh
```

Có thể chỉ đặt một trong hai biến. Với việc đổi ảnh hằng ngày, dùng bảng cài đặt trong app sẽ tiện hơn biên dịch lại. Đường nét và hình nền màu được tạo từ cùng ảnh đã cắt để tránh lệch hình.

## Cơ chế kết nối và giới hạn

Chương trình kiểm tra chữ ký/danh tính ứng dụng, mở cổng gỡ lỗi ngẫu nhiên chỉ ở `127.0.0.1` và kiểm tra tiến trình sở hữu. Hoạt ảnh chạy trong khung giao diện tạm thời của cửa sổ chính, không đổi chính sách bảo mật nội dung của trang và không cần máy chủ ảnh riêng.

Chương trình hỗ trợ thoát sau khi xác nhận hoạt ảnh bắt đầu. Khung hoạt ảnh bị gỡ khi hoàn tất; hình nền tĩnh và tài nguyên cài đặt vẫn còn nên bộ nhớ bổ sung không bằng không. Phần macOS không có dịch vụ hoạt ảnh hoặc vòng quét nền thường trực; chưa có số đo đỉnh bộ nhớ đầy đủ ở cấp hệ thống.

Cổng CDP vẫn tồn tại cùng tiến trình Codex, kể cả sau khi gỡ giao diện. Muốn kết thúc phiên gỡ lỗi, thoát hẳn Codex rồi mở lại từ biểu tượng chính thức.

Ứng dụng chính thức có thể cập nhật như bình thường, nhưng bản mới có thể cần điều chỉnh phần kết nối. Sau khi cập nhật chương trình khởi động, thoát hẳn Codex rồi mở lại từ biểu tượng màu hồng để nạp mã mới. Làm mới toàn trang, mở cửa sổ mới hoặc tự khởi động lại sau cập nhật có thể làm mất giao diện tùy chỉnh trong phiên đó.

Tài liệu gốc ghi nhận một số mục thanh bên thay đổi theo tài khoản hoặc cờ tính năng, với nguyên nhân chưa xác định; chưa thể bảo đảm mọi trạng thái giao diện giống nhau. Nếu kết nối thất bại, thoát hẳn và mở bằng biểu tượng gốc để dùng app bình thường.

## Kiểm thử

```sh
node --test tools/extension.test.mjs

"dist/Aemeath Startup.app/Contents/MacOS/AemeathStartup" --smoke-test
```

Kiểm tra phát hoàn chỉnh cần có thông báo `ANIMATION COMPLETE` và kết quả `SMOKE RESULT` chứa `completed: "true"`. Kiểm thử tự động bao gồm lọc cửa sổ, xác minh địa chỉ nội bộ, lỗi giao thức và thời gian chờ.

Để tạo trang thử tích hợp với cửa sổ mô phỏng:

```sh
node tools/extension-preview.mjs
python3 -m http.server 8765 --bind 127.0.0.1
```

Sau đó mở `http://127.0.0.1:8765/.build/extension-preview/`. Trang thử không phải trang Codex chính thức.

Xem thêm [cấu trúc phần mở rộng](../extension/README.md) và [nguồn tham khảo, hình ảnh mẫu](references.md).

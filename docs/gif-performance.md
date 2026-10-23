# Kiểm tra khả năng dùng GIF trên máy Windows này

Đo ngày **23/10/2026** trên Intel Core i5-1035G1 (4 lõi/8 luồng), RAM vật lý 11,77 GiB, màn hình 1920×1080. Máy có Intel UHD Graphics và GeForce MX230; màn hình đang báo Intel UHD. Trước khi đo còn khoảng 1,57 GiB RAM trống.

## Kết luận

Có thể giải mã và đổi khung hình GIF bằng System.Drawing trên máy này. Bản thử đã xác minh các khung hình có pixel khác nhau. Microsoft cung cấp [ImageAnimator](https://learn.microsoft.com/en-us/dotnet/api/system.drawing.imageanimator?view=netframework-4.8.1) và [ví dụ GIF trong Windows Forms](https://learn.microsoft.com/en-us/dotnet/api/system.drawing.imageanimator.animate?view=netframework-4.8.1). Các số đo dưới đây thuộc chương trình dựng thử riêng, trước khi tích hợp GIF vào sản phẩm.

Bản Windows hiện đã nhận GIF trong thư mục `gifs`, giữ nguyên dữ liệu động, giới hạn khoảng 15 FPS và dừng timer khi cửa sổ ẩn hoặc thu nhỏ. Bộ dựng chuyển khung hình sang bitmap 32-bit dùng lại trước khi co giãn, không cache toàn bộ frame. Các kiểm thử đã xác minh chuyển frame, tạm dừng, mở lại và đổi qua lại giữa ảnh tĩnh/GIF; chưa đo lại CPU/GPU của đường dựng mới với GIF người dùng. Vì vậy bảng này không đại diện cho tài nguyên của bản đã tích hợp. Xem cách dùng và giới hạn ở [hướng dẫn Windows](../windows/README.md).

## Phương pháp và phạm vi

- Hai GIF tổng hợp 24 khung hình: 1280×720 (~4,21 MiB) và 1920×1080 (~11,40 MiB), mỗi khung 30 ms, hình học và màu thay đổi toàn khung. Không dùng ảnh cá nhân hoặc GIF tải từ mạng.
- Tiến trình thử riêng giữ dữ liệu GIF, chọn frame theo thời gian rồi vẽ vào bitmap **1920×1080 trong bộ nhớ**. Kiểu HighQualityBicubic tương ứng với cách co giãn hiện dùng trong OnPaint; Bilinear là một phương án so sánh.
- Mỗi trường hợp chạy hai lần, mỗi lần đo 6 giây sau 1 giây làm nóng. Mỗi lần dùng tiến trình mới. CPU lấy từ TotalProcessorTime, chia cho thời gian thực và 8 bộ xử lý logic, gần cách tính phần trăm CPU toàn máy. 12,5% tương đương sử dụng hết một bộ xử lý logic.
- RAM là Working Set của riêng chương trình thử, chưa cộng vào/không đại diện cho toàn bộ Codex. Đỉnh RAM là PeakWorkingSet từ lúc tiến trình bắt đầu, gồm khởi tạo.
- FPS là số lần dựng frame trong bộ nhớ, **không phải FPS hiển thị trên màn hình**. Chưa đo GPU, Desktop Window Manager, chuyển bitmap lên lớp cửa sổ trong suốt, điện năng, pin hoặc độ mượt quan sát trực tiếp.

## Số đo

| Trường hợp | Bộ co giãn | CPU toàn máy | RAM ổn định (MiB) | RAM đỉnh (MiB) | FPS dựng thực tế | Thời gian dựng p95 (ms) |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Ảnh tĩnh 1080p, không vẽ lại | HighQualityBicubic | 0.00–0.07% | 34.0–34.4 | 40.5–40.9 | 0.0 | 0.0 |
| GIF 720p → 1080p, giới hạn 15 FPS | HighQualityBicubic | 12.42–12.42% | 47.4–47.5 | 57.9–58.0 | 14.4–14.7 | 72.2–73.6 |
| GIF 1080p, giới hạn 15 FPS | HighQualityBicubic | 4.68–4.91% | 70.5–70.6 | 94.3–94.3 | 15.0–15.0 | 31.0–31.8 |
| GIF 1080p, giới hạn 30 FPS | HighQualityBicubic | 6.70–6.86% | 70.7–70.7 | 94.3–94.3 | 30.0–30.0 | 24.5–25.8 |
| GIF 1080p tạm dừng | HighQualityBicubic | 0.00% | 70.5–70.5 | 94.2–94.3 | 0.0 | 0.0 |
| GIF 720p → 1080p, giới hạn 15 FPS | Bilinear | 12.48–12.48% | 47.5–47.9 | 58.0–58.3 | 5.2–5.9 | 179.5–203.2 |
| GIF 1080p, giới hạn 15 FPS | Bilinear | 4.75–5.01% | 70.6–70.7 | 94.3–94.4 | 15.0–15.0 | 31.2–32.8 |
| GIF 1080p, giới hạn 30 FPS | Bilinear | 6.21–6.31% | 70.6–70.7 | 94.3–94.4 | 30.0–30.0 | 22.6–23.4 |

Giới hạn thời gian mỗi khung là 66,7 ms ở 15 FPS và 33,3 ms ở 30 FPS. Đường vẽ GIF 720p phóng lên 1080p trực tiếp bằng GDI+ chạm một luồng CPU; đổi sang Bilinear còn chậm hơn trong mẫu này. Không thể kết luận ảnh có độ phân giải thấp luôn nhẹ hơn khi phải phóng mỗi khung hình.

Đo riêng bộ nạp **ảnh tĩnh thật đang chạy** trong một khoảng 6 giây: ~0,19% CPU toàn máy, Working Set ~25,1 MiB và Private Bytes ~40,3 MiB. Working Set thay đổi theo việc Windows thu hồi trang bộ nhớ; không nên so sánh nó như một phép đo tăng RAM chính xác giữa hai sản phẩm khác nhau.

Tạm dừng GIF không đồng nghĩa giải phóng RAM: mẫu GIF 1080p vẫn giữ ~70,5 MiB, dù phần CPU của tiến trình thử về gần 0. Một file GIF khác có thể dùng bộ nhớ rất khác. Nếu giải nén sẵn toàn bộ 24 frame 1080p thành RGBA 32-bit, riêng dữ liệu pixel đã khoảng **190 MiB**; không nên cache mọi frame vô hạn.

## Các điểm rút ra khi tích hợp

1. Nhận và kiểm tra GIF thật ở server; giữ dữ liệu động thay vì chuyển thành JPEG. Bổ sung preview và đường khôi phục.
2. Giữ decoder cùng luồng dữ liệu sống đúng vòng đời ảnh; xử lý thời gian từng frame, vòng lặp, frame disposal và đổi ảnh khi đang chạy.
3. Bắt đầu với giới hạn khoảng 15 FPS. Tránh co giãn GIF bảng màu trực tiếp ở mọi khung; bản tích hợp dùng bitmap 32-bit trung gian. Cần đo lại đường dựng này trước khi so sánh hiệu năng.
4. Chỉ chạy khi cửa sổ cần hiện; dừng frame timer khi thu nhỏ/ẩn/khôi phục giao diện. Giới hạn kích thước, số frame và ngân sách bộ nhớ giải mã, không chỉ dung lượng file.
5. Đo lại bằng GIF người dùng muốn dùng, trong lớp ảnh thật, gồm CPU của tiến trình, RAM theo thời gian và DWM/GPU; chưa có cơ sở đưa số phần trăm GPU hoặc mức hao pin.

## Tái lập và dữ liệu

Mã: \tools\gif-fixtures.py, \tools\gif-benchmark.cs, \tools\gif-benchmark.ps1. Script dùng Pillow/numpy từ Python runtime có sẵn của Codex, không cài thêm package.

Dữ liệu thô trên máy này:

- `%USERPROFILE%\CodexWallpaper\research\gif-benchmark-fa731935e8d24607a893e92138a52aef\results.json`
- `%USERPROFILE%\CodexWallpaper\research\gif-benchmark-bd72a9263e3d4d3cad70f51fbbee5764\results.json`

Các file kết quả thô này chỉ nằm trên máy đã đo, không được đính kèm trong repository.

Các số đo ngắn trong điều kiện tải máy hiện tại không thay thế kiểm thử dài hạn, kiểm tra GPU/hiển thị hoặc thử GIF thực tế.

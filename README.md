# 🏰 Vương Quốc Toán Học

Game phiêu lưu 3D học toán cho học sinh tiểu học (lớp 1–5), xây dựng theo kịch bản *"Vương Quốc Toán Học"*.
Bé đi khám phá 7 khu vực, giúp các bạn thú giải toán, chơi 12 mini-game, sưu tầm sao, vé, xu và huy hiệu.
Câu hỏi tự điều chỉnh độ khó theo lớp và theo kết quả làm bài của từng bé.

## ▶️ Chơi ngay

- **Chơi trên web:** <https://kien14593-lab.github.io/vuong-quoc-toan-hoc/> – mở bằng Chrome / Edge / Safari trên
  máy tính, máy tính bảng hoặc điện thoại, không cần cài đặt. Bản web tự cập nhật mỗi khi mã nguồn mới được đưa lên GitHub.
- **Chơi offline:** mở tệp **`ban-phat-hanh\VuongQuocToanHoc.html`** bằng Chrome / Edge (nhấp đúp).
- Chưa có tệp này (hoặc vừa sửa code)? Nhấp đúp **`DongGoi.bat`** để đóng gói lại (khoảng 30 giây).
  Lần đầu máy cần có **Node.js LTS** (<https://nodejs.org>) và Internet để cài thư viện.
- Có thể chép riêng tệp HTML sang máy khác / USB – mọi thứ (đồ họa, âm thanh, phông chữ) nằm trong một tệp.

### Điều khiển

| Thao tác | Bàn phím / chuột | Màn hình cảm ứng |
|---|---|---|
| Di chuyển | WASD hoặc phím mũi tên · nhấp chuột vào mặt đất | Cần điều khiển ảo (đẩy hết cỡ = chạy) · chạm mặt đất |
| Chạy nhanh | Giữ Shift | – |
| Nói chuyện / tương tác | E hoặc Enter · nhấp vào nhân vật | Nút tương tác (giữa, dưới màn hình) · chạm vào nhân vật |
| Nhảy | Space | Nút "Nhảy" |
| Xoay camera | Kéo chuột · Q / `,` và `.` (45°) | Kéo một ngón · nút ⟲ ⟳ |
| Phóng to / thu nhỏ | Con lăn chuột · `+` / `-` | Chụm hai ngón |
| Bản đồ · Túi đồ · Trò chơi | M · B (hoặc I) · G | Các nút bên phải màn hình |
| Cài đặt · đóng bảng | Esc | Nút ⚙️ · nút ✕ |

### Lưu tiến độ & Góc phụ huynh

- Tiến độ được **tự động lưu trên trình duyệt** (localStorage), mỗi máy có thể có nhiều hồ sơ học sinh.
  Bản web và bản tệp HTML lưu **riêng** – dùng xuất / nhập tệp JSON trong Góc phụ huynh để chuyển tiến độ.
- **Góc phụ huynh** (ở màn hình chính và trong Cài đặt, có câu hỏi kiểm tra người lớn): tổng quan, kết quả theo
  chủ đề, tiến bộ theo tuần, mục tiêu, nhật ký hoạt động; xuất / nhập tệp JSON (chuyển máy), đổi lớp,
  đặt lại tiến độ, xóa hồ sơ.

## 🗺️ Nội dung

**7 khu vực** (mở dần theo cốt truyện "Giúp chú Gấu đến sở thú"):

| Khu vực | Nội dung chính | Điều kiện mở |
|---|---|---|
| 🏡 Ngôi Làng Khởi Đầu | Hướng dẫn, đếm hộp, tìm 5 ngôi sao cho Thỏ Bông, cửa hàng | – |
| 🏠 Ngôi Nhà Của Bạn | Trang trí nhà, trồng cây – thu hoạch, tủ huy hiệu | – |
| 🌳 Rừng Phép Tính | Cầu phép cộng, tảng đá phép trừ, cây cầu của chú Gấu, chọn viên đá lớn nhất | Xong nhiệm vụ 5 ngôi sao |
| 🌀 Mê Cung Toán Học | Giải toán để chọn đường, tìm 3 chìa khóa, nhận vé sở thú | Xong Rừng Phép Tính |
| 🎡 Khu Vui Chơi Toán Học | Tàu lượn, ném bóng, vòng quay, chú hề – mỗi trò 1 vé | Có 10 ⭐ |
| 🦁 Sở Thú Kỳ Diệu | Đưa 5 vé mở cổng, giúp hươu cao cổ, khỉ, chim cánh cụt | Qua Mê Cung hoặc Khu Vui Chơi |
| 🏰 Lâu Đài Toán Học | 3 phòng: Bảng Nhân, Phân Số, Hình Học + thử thách của Nhà Vua | Đạt cấp 3 |

**12 mini-game:** Ghép số · Bắn đáp án · Chạy vượt chướng ngại · Mê cung · Câu cá số · Siêu thị · Đồng hồ bí ẩn ·
Xây nhà (hình học) · Chia bánh (phân số) · Tàu hỏa (dãy số) · Cho khỉ ăn · Vòng quay (nhân/chia).
Chơi tại các điểm trong thế giới hoặc từ nút **Trò chơi** (một số trò mở khi bé lên cấp).

**17 chủ đề toán** (đếm, so sánh, cộng, trừ, nhân, chia, dãy số, thời gian, độ dài, tiền, hình học, chu vi,
diện tích, phân số, số thập phân, tỉ số – phần trăm, toán có lời văn) với mức khởi đầu theo lớp 1–5 và tự
tăng / giảm độ khó theo kết quả. Câu hỏi có thể được đọc to (giọng đọc của trình duyệt).

**14 huy hiệu**, sao, vé, xu, XP và cấp độ; cửa hàng, túi đồ, trang trí nhà.

## 🧸 Thay nhân vật bằng mô hình AI

Chép tệp `.glb` (tạo bằng Tencent HY 3D, Meshy, Tripo…) vào thư mục **`mo-hinh-ai`** rồi nhấp đúp **`CapNhatMoHinh.bat`**.

- **[CAU-LENH-TAO-NHAN-VAT.md](CAU-LENH-TAO-NHAN-VAT.md)** – trang tạo mô hình nên dùng (Tencent HY 3D, miễn phí), câu lệnh soạn sẵn cho từng nhân vật, thứ tự nên làm.
- **[HUONG-DAN-MO-HINH-AI.md](HUONG-DAN-MO-HINH-AI.md)** – đặt tên tệp, tinh chỉnh, xử lý lỗi, ghi công.

## 🛠️ Dành cho lập trình viên

Công nghệ: **Three.js** (3D), **TypeScript**, **Vite**, **Vitest**. Mọi mô hình đều có bản dựng bằng code
(pastel, low-poly), có thể thay bằng tệp GLB (Chú Gấu đã dùng mô hình AI).

```bash
npm install
npm run dev          # chạy thử tại http://localhost:5173
npm run typecheck    # kiểm tra kiểu TypeScript
npm test             # chạy kiểm thử (bộ sinh câu hỏi toán)
npm run build        # bản web vào dist/
npm run build:single # bản 1 tệp HTML vào dist-single/ (DongGoi.bat dùng lệnh này)
```

**Bản web:** mỗi lần đẩy (push) lên nhánh `main`, GitHub Actions (`.github/workflows/deploy.yml`) tự chạy kiểm thử,
build rồi đăng lên GitHub Pages (khoảng 1–2 phút).

Trang thử nghiệm khi chạy `npm run dev`:

- `/dev/zone.html?zone=forest&grade=2&fresh=1` – vào thẳng một khu vực (tham số: `spawn`, `flags`, `stars`,
  `tickets`, `coins`, `xp`…); bảng điều khiển gỡ lỗi qua `window.__vq`.
- `/dev/mini.html` – chơi thử từng mini-game · `/dev/gallery.html` – thư viện mô hình 3D ·
  `/dev/dashboard.html` – Góc phụ huynh với dữ liệu mẫu.

### Cấu trúc thư mục

```
src/
  engine/     lõi 3D: renderer, ánh sáng, vật liệu, gộp mesh, hiệu ứng
  models/     ~150 mô hình dựng bằng code (nhân vật, thú, nhà, cây, đồ vật) + nạp GLB
  world/      thế giới: camera, người chơi, va chạm, nhãn, các khu vực (world/zones/*)
  minigames/  khung mini-game + 12 trò chơi (minigames/games/*)
  math/       chương trình, bộ sinh câu hỏi theo chủ đề, độ khó thích ứng
  core/       trạng thái, lưu trữ, tiến trình, huy hiệu, âm thanh, đọc câu hỏi
  game/       ứng dụng, cốt truyện, nhân vật, thử thách
  ui/         HUD, hội thoại, bảng, màn hình (tiêu đề, bản đồ, túi đồ, Góc phụ huynh…)
  styles/     CSS giao diện
dev/          trang thử nghiệm · tests/ kiểm thử · tools/ đóng gói & xử lý mô hình
mo-hinh-ai/   nơi đặt mô hình AI (.glb) · ban-phat-hanh/ bản đóng gói 1 tệp HTML
```

## 📜 Ghi công

- Phông chữ **Baloo 2** và **Nunito** (SIL Open Font License) qua Fontsource.
- Thư viện **three.js** (MIT). Mô hình, âm thanh và giao diện được tạo bằng code trong dự án.
- Mô hình nhân vật tạo bằng AI (nếu có): xem `src/assets/models/ai/GHI-CONG.md` và mục ⚙️ Cài đặt trong trò chơi.
- Hỗ trợ mô hình CC0 tùy chọn (Quaternius, Kenney, KayKit, Poly Pizza) – xem `src/models/glb_cc0.ts`.

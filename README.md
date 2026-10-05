# 🏰 Vương Quốc Học Vui

Game phiêu lưu 3D giúp học sinh tiểu học (lớp 1–5) vừa chơi vừa học **Toán và Tiếng Anh**. Tên cũ: *"Vương Quốc Toán Học"* (xây dựng theo
kịch bản cùng tên).
Bé đi khám phá 7 khu vực, giúp các bạn thú giải câu đố, chơi 12 mini-game, sưu tầm sao, vé, xu và huy hiệu.
Mỗi hồ sơ chọn môn **Toán**, **Tiếng Anh** hoặc **Cả hai** – mọi câu hỏi trong game theo môn đã chọn.
Câu hỏi tự điều chỉnh độ khó theo lớp và theo kết quả làm bài của từng bé.

## ▶️ Chơi ngay

- **Chơi trên web:** <https://kien14593-lab.github.io/vuong-quoc-hoc-vui/> – mở bằng Chrome / Edge / Safari trên
  máy tính, máy tính bảng hoặc điện thoại, không cần cài đặt. Bản web tự cập nhật mỗi khi mã nguồn mới được đưa lên GitHub.
- **Chơi offline:** mở tệp **`ban-phat-hanh\VuongQuocHocVui.html`** bằng Chrome / Edge (nhấp đúp).
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
  chủ đề (Toán / Tiếng Anh), tiến bộ theo tuần, mục tiêu, nhật ký hoạt động; xuất / nhập tệp JSON (chuyển máy), đổi lớp,
  chọn môn học và Unit Tiếng Anh, đặt lại tiến độ, xóa hồ sơ.
  Nhập tệp của hồ sơ **đã có trên máy** thì game hỏi lại trước, kèm bảng so sánh "Trên máy này" / "Trong tệp"
  (tên, lớp, ⭐, cấp, lần chơi cuối). Tệp **cũ hơn** bản trên máy thì có thêm lời cảnh báo và nút "Thôi" được chọn sẵn.
  Hồ sơ chưa có trên máy thì nhập luôn, không hỏi.
  Khi đang chơi mà nhập tệp của **chính hồ sơ đang chơi**, đặt lại tiến độ hoặc xóa hồ sơ đó,
  game tự về màn hình chính để tải lại hồ sơ cho đúng.
- **Chuyển hồ sơ sang máy khác:** máy cũ: Góc phụ huynh → Quản lý → **Xuất hồ sơ JSON**; máy mới: Góc phụ huynh →
  **Nhập hồ sơ JSON**. Máy mới **chưa có hồ sơ nào** vẫn nhập được ngay (nút hiện ngay sau câu hỏi kiểm tra người
  lớn), không cần tạo hồ sơ tạm; nhập xong bấm **▶ Chơi** ở màn hình chính để chơi tiếp. Các bước chi tiết:
  **[HUONG-DAN-GIAO-VIEN.md](HUONG-DAN-GIAO-VIEN.md)**.

### 📚 Môn học: Toán · Tiếng Anh · Cả hai

- Chọn khi **tạo hồ sơ** ("Bạn muốn học môn gì?"). Mọi câu hỏi theo môn đó: câu đố của các bạn thú, thử thách trong
  cốt truyện, các phòng trong Lâu Đài và thử thách của Nhà Vua, Mê Cung, Khu Vui Chơi, Sở Thú và cả 12 mini-game.
  **Cả hai** = xen kẽ hai môn, môn bé còn yếu được hỏi nhiều hơn một chút.
- Bé tự đổi môn trong **⚙️ Cài đặt → 📚 Môn học**. Thầy cô / bố mẹ có thể khóa việc này, chọn **"Tiếng Anh: đang học
  đến Unit N"** và áp dụng cho mọi hồ sơ cùng lớp trên máy trong **Góc phụ huynh → Quản lý → Môn học**.
- Tiếng Anh bám theo **chủ đề các Unit** của bộ sách *Tiếng Anh Global Success* (Kết nối tri thức với cuộc sống)
  lớp 1–5. Mọi câu hỏi, câu mẫu và gợi ý do dự án tự soạn; hình minh họa là emoji.
- Hồ sơ cũ (tạo trước khi có Tiếng Anh) vẫn học Toán như trước. Chi tiết:
  **[HUONG-DAN-GIAO-VIEN.md](HUONG-DAN-GIAO-VIEN.md)**.

### 🗣️ Giọng đọc

- Lời thoại và câu hỏi được **đọc to** bằng giọng đọc có sẵn của trình duyệt / máy (không cần tải thêm gì khi dùng
  **Microsoft Edge có mạng**).
- **Mỗi nhân vật một giọng:** trên Edge có mạng, lời dẫn chuyện, câu hỏi và các nhân vật nữ (Thỏ Bông, Cô Mèo,
  Cô Sóc, Bạn Nai…) dùng giọng **Hoài My**; các nhân vật nam (Chú Gấu, Bác Cú, Nhà Vua, Robot Bíp, Chú Hề Bibo…)
  dùng giọng **Nam Minh**. Mỗi nhân vật còn có tốc độ đọc riêng (Bà Ba, Nhà Vua đọc chậm; Robot Bíp, Bé Na nhanh hơn).
  Máy chỉ có một giọng tiếng Việt thì nhân vật nam dùng giọng đó, đọc trầm hơn (nếu giọng cho phép đổi cao độ).
- **⚙️ Cài đặt:** bật / tắt đọc, tốc độ đọc, **🎭 Giọng nhân vật** (tắt thì mọi lời dùng một giọng), nút
  **Nghe thử giọng nhân vật**, và **🎙️ Chọn giọng đọc** khi máy có từ 2 giọng tiếng Việt (lưu riêng trên từng máy).
- **Điện thoại / máy tính bảng:** giọng có sẵn thường nghe như máy – tải giọng tốt hơn (iPhone/iPad: "Linh (Nâng cao)")
  theo mục **💡 Giọng đọc chưa hay?** trong Cài đặt hoặc **[HUONG-DAN-GIAO-VIEN.md](HUONG-DAN-GIAO-VIEN.md)**.
- Bản offline (tệp HTML) không có mạng thì dùng giọng cài trong Windows (ví dụ Microsoft An); Hoài My / Nam Minh cần mạng.
- **Tiếng Anh:** từ và câu tiếng Anh (chữ xanh đậm) được đọc bằng giọng tiếng Anh của máy (**⚙️ Cài đặt → 🔤 Giọng
  tiếng Anh**, nút **Nghe thử tiếng Anh**). Máy chưa có giọng tiếng Anh thì trò chơi tạm bỏ các câu hỏi nghe.

### 📱 iPhone / iPad

- **Cầm máy nằm ngang:** trên điện thoại / máy tính bảng chữ và nút tự to hơn cho dễ đọc, dễ bấm. Điện thoại cầm dựng
  đứng thì game nhắc **"Xoay ngang điện thoại để chơi nhé"**; iPad cầm dựng hay nằm ngang đều chơi được.
- **⚙️ Cài đặt → 🎮 Đồ họa:** **Tự động** (mặc định – máy cảm ứng tự hạ / nâng độ nét theo tốc độ khung hình),
  **Đẹp**, **Nhẹ (mượt hơn)**. Máy tính vẫn vẽ như cũ.
- Tắt **Chế độ nguồn điện thấp** (Safari bị giới hạn 30 hình/giây). Mở trang với **`?fps=1`** ở cuối địa chỉ để xem
  số đo độ mượt. Chi tiết: **[HUONG-DAN-GIAO-VIEN.md](HUONG-DAN-GIAO-VIEN.md)** (mục *Chơi trên iPhone / iPad*).
- **Toàn màn hình:** Safari → nút Chia sẻ → **Thêm vào MH chính**, rồi mở game từ biểu tượng **Học Vui** (⚙️ Cài đặt →
  📱 Toàn màn hình → 📲 Cách làm có các bước; iPad còn có nút **Phóng to**). Game mở từ biểu tượng lưu tiến độ riêng
  (chuyển bằng xuất / nhập JSON) và vẫn cần mạng. Chữ, nút tự tránh tai thỏ và vạch Home.

## 🗺️ Nội dung

**7 khu vực** (mở dần theo cốt truyện "Giúp chú Gấu đến sở thú"):

| Khu vực | Nội dung chính | Điều kiện mở |
|---|---|---|
| 🏡 Ngôi Làng Khởi Đầu | Hướng dẫn, đếm hộp, tìm 5 ngôi sao cho Thỏ Bông, cửa hàng | – |
| 🏠 Ngôi Nhà Của Bạn | Trang trí nhà, trồng cây – thu hoạch, tủ huy hiệu | – |
| 🌳 Rừng Thông Thái | Cây cầu bị khóa của Bác Cú, tảng đá chắn đường, cây cầu của chú Gấu, chọn viên đá đúng | Xong nhiệm vụ 5 ngôi sao |
| 🌀 Mê Cung Kỳ Bí | Giải câu đố để chọn đường, tìm 3 chìa khóa, nhận vé sở thú | Xong Rừng Thông Thái |
| 🎡 Khu Vui Chơi | Tàu lượn, ném bóng, vòng quay, chú hề – mỗi trò 1 vé | Có 10 ⭐ |
| 🦁 Sở Thú Kỳ Diệu | Đưa 5 vé mở cổng, giúp hươu cao cổ, khỉ, chim cánh cụt | Qua Mê Cung hoặc Khu Vui Chơi |
| 🏰 Lâu Đài Trí Tuệ | 3 phòng thử thách (Toán: Bảng Nhân, Phân Số, Hình Học · Tiếng Anh: Từ Vựng, Lắng Nghe, Chữ Cái hoặc Mẫu Câu) + thử thách của Nhà Vua | Đạt cấp 3 |

Thử thách ở mỗi khu theo môn của hồ sơ (ví dụ cây cầu trong rừng là *Cầu Phép Cộng* với môn Toán, *Cầu Từ Vựng* với
môn Tiếng Anh).

**12 mini-game:** Ghép số · Bắn đáp án · Chạy vượt chướng ngại · Mê cung · Câu cá số · Siêu thị · Đồng hồ bí ẩn ·
Xây nhà (hình học) · Chia bánh (phân số) · Tàu hỏa (dãy số) · Cho khỉ ăn · Vòng quay (nhân/chia).
Trò nào cũng có bản **Tiếng Anh**: Ghép từ · Bắn từ · Chạy vượt chướng ngại · Mê cung chữ · Câu cá chữ ·
Siêu thị tiếng Anh · Đồng hồ tiếng Anh · Xây nhà – hình và màu · Làm bánh pizza · Tàu chữ cái · Cho khỉ ăn – trái cây ·
Vòng quay tiếng Anh.
Chơi tại các điểm trong thế giới hoặc từ nút **Trò chơi** (một số trò mở khi bé lên cấp).

**17 chủ đề toán** (đếm, so sánh, cộng, trừ, nhân, chia, dãy số, thời gian, độ dài, tiền, hình học, chu vi,
diện tích, phân số, số thập phân, tỉ số – phần trăm, toán có lời văn) với mức khởi đầu theo lớp 1–5 và tự
tăng / giảm độ khó theo kết quả.
**7 chủ đề Tiếng Anh** (từ vựng, nghe, chữ cái & âm, chính tả, mẫu câu, số đếm, giờ & lịch) theo lớp và theo Unit:
lớp 1–2 làm quen qua hình và âm thanh; lớp 3–5 thêm chính tả và mẫu câu ngắn; lớp 4–5 thêm giờ và lịch.
Lời thoại và câu hỏi được đọc to, mỗi nhân vật một giọng (mục **🗣️ Giọng đọc** ở trên).

**Nhân vật chính:** khi tạo hồ sơ, học sinh chọn **Bé trai** hoặc **Bé gái** (nhân vật 3D tạo bằng AI, biết đi, chạy,
vẫy tay) và đổi lại được trong **Túi đồ**. **Bộ đồ** mua ở cửa hàng của Cô Mèo; mũ, balo, phụ kiện, thú cưng và ván
trượt dùng được cho cả hai bé.

**19 huy hiệu** (12 huy hiệu chung, 2 của môn Toán, 5 của môn Tiếng Anh – bé thấy huy hiệu chung và huy hiệu của môn
mình học), sao, vé, xu, XP và cấp độ; cửa hàng, túi đồ, trang trí nhà.

## 🧸 Thay nhân vật bằng mô hình AI

Chép tệp `.glb` (tạo bằng Tencent HY 3D, Meshy, Tripo…) vào thư mục **`mo-hinh-ai`** rồi nhấp đúp **`CapNhatMoHinh.bat`**.

- **[CAU-LENH-TAO-NHAN-VAT.md](CAU-LENH-TAO-NHAN-VAT.md)** – trang tạo mô hình nên dùng (Tencent HY 3D, miễn phí), câu lệnh soạn sẵn cho từng nhân vật, thứ tự nên làm.
- **[HUONG-DAN-MO-HINH-AI.md](HUONG-DAN-MO-HINH-AI.md)** – đặt tên tệp, tinh chỉnh, xử lý lỗi, ghi công.
- **Bé và bộ đồ:** `be-trai.glb`, `be-gai.glb` (đồ thường ngày) và `be-trai-<bộ đồ>.glb`, `be-gai-<bộ đồ>.glb` – bộ đồ
  mới tự có trong cửa hàng, không cần sửa code (mục 8 của CAU-LENH-TAO-NHAN-VAT.md).

## 🛠️ Dành cho lập trình viên

Công nghệ: **Three.js** (3D), **TypeScript**, **Vite**, **Vitest**. Mọi mô hình đều có bản dựng bằng code
(pastel, low-poly), có thể thay bằng tệp GLB (Chú Gấu, Thỏ Bông, Cô Mèo, Bác Cú, Robot Bíp, Chú Hề Bibo, Bác Voi, Nhà Vua, Hiệp Sĩ Thỏ,
Ông Rùa, Bạn Nai, 6 dân làng, cả 7 thú cưng và 6 thú Sở Thú đã dùng mô hình AI). Mô hình AI được tải theo cảnh: màn hình tiêu đề tải trước, mỗi khu vực/mini-game chờ mô hình của mình lúc
chuyển cảnh (quá 15 giây thì dùng bản dựng bằng code; thú cưng, thú Sở Thú và dân làng không bắt chờ mà tải ngay sau đó rồi tự thay tại chỗ), phần còn lại tải dần ở chế độ nền.
Thú Sở Thú ở xa được giảm chi tiết tự động (`src/world/lod.ts`; việc rút gọn lưới chạy trong luồng phụ `src/world/lod-worker.ts` nên không làm giật hình) để Sở Thú vẫn mượt. Danh sách nằm trong
`src/game/needs.ts`; `tests/needs.test.ts` báo lỗi nếu một cảnh dùng nhân vật chưa có trong danh sách.

Bé (nhân vật chính) là mô hình AI theo hồ sơ: `player_trai`, `player_gai` (đồ thường ngày) và `player_<bé>__<bộ đồ>`
(vd. `player_gai__the_thao`). Danh mục bộ đồ dựng từ các tệp có trong `src/assets/models/ai/` (`src/core/outfits.ts`);
xương tự dựng lúc nạp từ dáng chữ A (`src/models/autorig.ts`), mũ/balo/phụ kiện gắn theo chỗ đo được trên mô hình
(`src/models/kid.ts`). Thiếu tệp hoặc tệp lỗi thì dùng bé dựng bằng code.

```bash
npm install
npm run dev          # chạy thử tại http://localhost:5173
npm run typecheck    # kiểm tra kiểu TypeScript
npm test             # chạy kiểm thử (bộ sinh câu hỏi toán và tiếng Anh, chọn môn, danh sách mô hình theo cảnh, hồ sơ cũ, bộ đồ)
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
- `/dev/do.html?kids=trai,gai&items=hat` – thử mũ, balo, phụ kiện trên bé AI (trước / nghiêng / sau; `anim`,
  `outfit`, `mat`) · `/dev/rig.html?key=player_trai&mode=strip` – xương tự dựng (`mode=weights|strip|perf`).
- Giọng đọc: `__vq.speak('Chào bạn!', 'gau')` đọc bằng giọng một nhân vật (mã trong `src/core/voice-profiles.ts`),
  `__vq.voices()` cho biết giọng đang dùng; thêm `?qa=1` vào địa chỉ để ghi nhật ký giọng đọc vào `window.__vqVoiceLog`.

### Cấu trúc thư mục

```
src/
  engine/     lõi 3D: renderer, ánh sáng, vật liệu, gộp mesh, hiệu ứng
  models/     ~150 mô hình dựng bằng code (nhân vật, thú, nhà, cây, đồ vật) + nạp GLB
  world/      thế giới: camera, người chơi, va chạm, nhãn, các khu vực (world/zones/*)
  minigames/  khung mini-game + 12 trò chơi (minigames/games/*)
  math/       chương trình, bộ sinh câu hỏi theo chủ đề, độ khó thích ứng
  english/    Tiếng Anh: tên Unit theo lớp (units.ts – sửa tên bài ở đây), ngân hàng từ, bộ sinh câu hỏi
  core/       trạng thái, lưu trữ, tiến trình, huy hiệu, âm thanh, đọc câu hỏi
  game/       ứng dụng, cốt truyện, nhân vật, thử thách, chọn môn cho từng câu hỏi (subject.ts)
  ui/         HUD, hội thoại, bảng, màn hình (tiêu đề, bản đồ, túi đồ, Góc phụ huynh…)
  styles/     CSS giao diện
public/       tệp chép nguyên vào bản web: manifest.webmanifest + biểu tượng (thêm vào màn hình chính)
dev/          trang thử nghiệm · tests/ kiểm thử · tools/ đóng gói & xử lý mô hình
mo-hinh-ai/   nơi đặt mô hình AI (.glb) · ban-phat-hanh/ bản đóng gói 1 tệp HTML
```

## 📜 Ghi công

- Phông chữ **Baloo 2** và **Nunito** (SIL Open Font License) qua Fontsource.
- Thư viện **three.js** (MIT). Mô hình, âm thanh và giao diện được tạo bằng code trong dự án.
- Nội dung Tiếng Anh: chỉ dùng **tên chủ đề các Unit** và **từ vựng thông dụng** để bám bộ sách *Tiếng Anh Global
  Success* (NXB Giáo dục Việt Nam). Mọi câu hỏi, câu mẫu, hội thoại và gợi ý do dự án tự soạn; không chép câu, bài hát,
  truyện hay bài tập của sách, không dùng hình của sách (hình minh họa là emoji).
- Mô hình nhân vật tạo bằng AI (nếu có): xem `src/assets/models/ai/GHI-CONG.md` và mục ⚙️ Cài đặt trong trò chơi.
- Hỗ trợ mô hình CC0 tùy chọn (Quaternius, Kenney, KayKit, Poly Pizza) – xem `src/models/glb_cc0.ts`.

# Câu lệnh tạo nhân vật 3D bằng AI

Tệp này có sẵn **câu mô tả tiếng Anh** cho từng nhân vật của trò chơi (mục 5, 6; **bé trai, bé gái và bộ đồ** của
bé: mục 8). Cách làm khuyên dùng – **miễn phí**:

1. Dán câu lệnh vào trang AI vẽ tranh miễn phí (**Microsoft Copilot** hoặc **Google Gemini**) để có **ảnh mẫu**.
2. Đưa ảnh mẫu vào **Tencent HY 3D** (*Image-to-3D*) → tải mô hình **GLB** về.
3. Gửi tệp cho Copilot (hoặc tự chép vào thư mục `mo-hinh-ai`). Phần lắp vào trò chơi xem ở
   [HUONG-DAN-MO-HINH-AI.md](HUONG-DAN-MO-HINH-AI.md).

> Mỗi câu lệnh đã kèm sẵn một đoạn "phong cách chung" (chibi, đầu to, màu pastel, đứng thẳng, nhìn thẳng)
> để cả dàn nhân vật **đồng bộ** với nhau và với khung cảnh trò chơi. Không cần sửa gì.

---

## 1. Chọn trang tạo mô hình

| | **Tencent HY 3D** ⭐ khuyên dùng | Meshy.ai (cách khác) |
|---|---|---|
| Đăng nhập | Gmail + mã gửi qua thư, **không cần đăng ký** | Tài khoản Google |
| Miễn phí | Khoảng **20 lượt tạo mỗi ngày** (theo thông báo của Tencent) | 100 điểm/tháng ≈ 4–5 nhân vật |
| Tải về GLB | Được | Chỉ mô hình **Meshy 6 Lite** – tài khoản của cô **bị chặn tải** cả loại này |
| Khung xương, động tác | Không có – trò chơi tự cho nhân vật nhún nhảy, "thở", lắc lư | Có (khoảng 20 động tác miễn phí) |
| Ghi công | `Tencent HY 3D` | `Meshy.ai – CC BY 4.0` |

Tệp của HY 3D rất nặng (khoảng **80 MB**, **1,5 triệu mặt**) – không sao: công cụ của trò chơi **tự giảm** còn khoảng
60.000 tam giác (dưới 1 MB) mà vẫn đẹp. Trò chơi tự hiện dòng ghi công trong mục **⚙️ Cài đặt** (Copilot ghi nguồn
vào mục `"nguon"` khi lắp mô hình). Nên đọc điều khoản sử dụng của trang trước khi dùng.
*(Số lượt miễn phí và giới hạn có thể thay đổi theo thời gian.)*

## 2. Các bước với Tencent HY 3D (khoảng 10 phút/nhân vật)

**Bước 1 – Vẽ ảnh mẫu.** Mở **Microsoft Copilot** (<https://copilot.microsoft.com>) hoặc **Google Gemini**
(<https://gemini.google.com>), dán câu lệnh của nhân vật (mục 5, 6), thêm vào cuối
*"3D render, front view, plain white background, square image"*. Chọn ảnh ưng nhất → tải về máy.

- Ảnh tốt: **một nhân vật**, **nhìn thẳng**, **nền trơn**, thấy đủ toàn thân, tay tách khỏi người, hai chân có khe hở.
- Ảnh hợp lệ: **PNG/JPG/WEBP**, tối đa **10 MB**, mỗi cạnh **512–4096 px**, gần **vuông**.
- Nhân vật có **nhiều phần màu trắng** (Robot Bíp, Chú Hề Bibo, Nhà Vua, Ông Rùa…): đổi *"plain white background"* thành
  *"plain light grey background"* để phần trắng không lẫn vào nền. Nhân vật mặc **giáp bạc** (Hiệp Sĩ Thỏ) thì giữ
  nền trắng – giáp bạc dễ lẫn vào nền xám.
- **Mẹo để nhân vật mới cùng phong cách với Chú Gấu** (cô đã làm Thỏ Bông và Cô Mèo như vậy): trong **Gemini**, đính kèm ảnh
  mẫu của Gấu (`gau-anh-mau-3.png`) cùng với câu lệnh của nhân vật, thêm vào **đầu** câu lệnh:
  `Use the attached bear only as a style reference (same 3D render style, proportions and soft materials). Draw a new character:`
  và vào **cuối cùng**: `Do not copy the bear's hat, scarf or backpack.`

**Bước 2 – Tạo mô hình 3D.**

1. Mở <https://3d.hunyuanglobal.com> (trang tự chuyển sang **hy3d.tencent.ai**) → bấm **Start Using**.
2. Nhập địa chỉ **Gmail** → **Continue** → mở hộp thư, lấy **mã** vừa được gửi tới, nhập vào trang.
3. Chọn **Image-to-3D** → **Upload Image** → chọn ảnh mẫu ở bước 1.
4. Bấm **Generate Now** → chờ vài phút. Xoay xem mô hình; chưa ưng thì tạo lại (hoặc vẽ ảnh mẫu khác).
5. Bấm **Download** → chọn **GLB** → tệp về thư mục **Tải xuống (Downloads)**.

**Bước 3 – Gửi tệp cho trò chơi** – chọn một trong hai cách:

- **Dễ nhất – nhờ Copilot:** để tệp trong **Tải xuống**, **giữ nguyên tên**, rồi nhắn Copilot **"xong Gấu"**
  (tên nhân vật vừa làm) hoặc gửi kèm tệp. Copilot tự đặt tên, tối ưu, chỉnh cỡ/hướng, kiểm tra trong trò chơi,
  đóng gói lại và đưa lên bản chơi trên web. **Làm xong con nào thì nhắn con đó** để tệp không lẫn.
- **Tự làm:** đổi tên tệp thành tên nhân vật (vd. `gau.glb`), chép vào **`E:\VuongQuocToanHoc\mo-hinh-ai`**,
  rồi nhấp đúp `CapNhatMoHinh.bat` (cách này chỉ cập nhật bản chơi offline trên máy).

Lưu ý:

- Mô hình HY 3D **không có khung xương** – trò chơi tự cho nhân vật nhún nhảy, "thở", lắc lư khi đứng và khi đi theo
  bé. Nút gắn xương tự động (*Auto-Rigging*) của HY 3D **tốn điểm** – không bắt buộc.
- Tên các nút có thể đổi theo thời gian – cứ tìm chữ **Image-to-3D**, **Generate** và **Download → GLB**.

## 3. Cách khác: Meshy.ai

⚠️ Gói miễn phí của Meshy chỉ cho tải mô hình làm bằng **Meshy 6 Lite** (tối đa 10 lần/tháng), và tài khoản của cô
**bị chặn tải về cả mô hình Meshy 6 Lite**. Chỉ nên dùng Meshy khi đã mua gói, hoặc khi muốn nhân vật có **khung
xương và động tác thật** (đi, chạy, vẫy tay…).

| Việc (gói miễn phí) | Điểm (credit) |
|---|---|
| Mỗi tháng được tặng | **100 điểm** (không cần thẻ ngân hàng) |
| Tạo hình 1 nhân vật bằng **Meshy 6 Lite** (Meshy 6, 7/7.1 phải mua gói mới tải được) | 10 |
| Tô màu nhân vật đó (*Tạo Kết Cấu*) | 10 |
| Gắn xương (*Rig*) và động tác (*Animate*) | có lượt miễn phí (số điểm hiện ngay trên nút) |
| Tạo lỗi | được hoàn điểm |

- Thư viện động tác chỉ có khoảng **20 động tác cơ bản**; động tác có ổ khóa là của gói trả phí.
- **Remesh** (giảm đa giác) và **Tư thế A/T** là tính năng trả phí → không cần. Meshy chỉ gắn xương mô hình **dưới
  300.000 mặt**; nhiều hơn thì tải mô hình tĩnh.
- **Giấy phép** gói miễn phí: **CC BY 4.0** – dùng được cả cho mục đích thương mại nhưng **phải ghi công "Meshy.ai"**.

*(Theo trang giá của Meshy, tháng 10/2026 – có thể thay đổi. Số điểm thật luôn hiện trên nút trước khi bấm.)*

**Các bước với Meshy** (máy dùng tiếng Việt thì Meshy tự hiện **tiếng Việt**; hướng dẫn ghi cả tên tiếng Việt và
*tiếng Anh*):

1. Vào <https://www.meshy.ai> → đăng ký (dùng tài khoản Google cho nhanh).
2. Cột bên trái bấm **Mô hình** (*Model*, biểu tượng khối vuông). Đầu khung bên cạnh có **3 biểu tượng không có chữ**;
   Meshy mở sẵn biểu tượng thứ nhất (*Hình ảnh thành 3D*). Bấm **biểu tượng thứ ba** (chữ **T** + khối vuông xanh lá) –
   rê chuột lên sẽ hiện chữ **Văn Bản thành 3D** (*Text to 3D*).
3. Dán câu lệnh của nhân vật (mục 5) vào ô nhập chữ, rồi chọn:
   - **Mô hình AI** (*AI Model*): Meshy để sẵn **Meshy 6** hoặc **Meshy 7.1 - Flagship** → bấm vào ô đó, **đổi sang
     Meshy 6 Lite** ⚠️ – gói miễn phí không tải về được mô hình Meshy 6/7; mô hình Meshy 7.1 lại thường quá
     300.000 mặt nên không gắn xương được.
   - **Số lượng thế hệ**: để **1**.
   - **Tư thế** (*Pose*): chọn **A** nếu chọn được mà không tốn thêm điểm; có ổ khóa thì bỏ qua.
   - Giấy phép: **CC BY 4.0**. Các mục khác để mặc định.
   - Nhìn số điểm trên nút **Tạo ra** (*Generate*): khoảng **10**. Thấy 20 trở lên: xem lại *Mô hình AI* và
     *Số lượng thế hệ*.
4. Bấm **Tạo ra** → chờ 1–2 phút → hiện **bản nháp** màu xám (chưa tô màu; rê chuột lên để xoay xem). Chưa ưng: sửa
   vài chữ trong câu lệnh rồi tạo lại.
5. Bấm vào bản nháp (có nhiều thì chọn bản ưng nhất) → hiện bảng **Xác nhận tạo ra** → mục **Tạo Kết Cấu**
   (*Generate Texture*) chọn **Có** (*With Texture*) → xác nhận (thêm khoảng **10** điểm). Chọn "Không" thì nhân vật
   **không có màu**. Mọi kết quả được lưu trong **Tài sản** (*Assets*).
   Không thấy bảng này (mô hình hiện ngay màu xám)? Bấm nút **Texture** ở thanh công cụ dưới mô hình; ô **AI Model**
   trong bảng Texture để **Meshy 6 Lite** cho chắc tải về được → tạo (khoảng **10** điểm).
6. **Gắn xương:** trước hết xem số **Mặt** (*Faces*) ở góc trên bên trái khung xem mô hình: **trên 300.000** thì Meshy
   không cho gắn xương (đòi *Remesh* – tính năng trả phí) → bỏ qua bước 6–7, tải mô hình **tĩnh** ở bước 8.
   Dưới 300.000: bấm **Hoạt hình** (*Animate*) hoặc **Áp rig cho mô hình** (*Rig*). Meshy tự nhận dạng nhân vật; nếu
   được hỏi, kéo các điểm khớp (cằm, vai, cổ tay, khuỷu tay, đầu gối, háng) vào đúng chỗ → xác nhận. Đừng chọn
   *Smart Rig* (kiểu này chưa dùng được thư viện động tác). Xong bước này có sẵn 2 động tác **Walking** (đi) và
   **Running** (chạy).
7. **Thêm động tác** (*Thêm hoạt hình*) từ **Thư viện hoạt ảnh**: gõ tìm **Idle** (đứng yên – quan trọng nhất), thêm
   các động tác khác ở bảng dưới nếu không có ổ khóa.
8. **Tải xuống** (*Download*) → định dạng **GLB** → phần động tác chọn **Tất cả đã được thêm vào** (*All Added*): mọi
   động tác nằm gọn trong **một tệp**, chỉ tốn **1 lượt tải**.
9. Gửi tệp cho trò chơi như **Bước 3** ở mục 2 (nhờ Copilot, hoặc tự chép vào `mo-hinh-ai`).

| Động tác | Gõ tìm trong thư viện Meshy | Gói miễn phí |
|---|---|---|
| Đứng yên (bắt buộc) | Idle (hoặc Idle 02, Idle 03) | ✅ có |
| Đi | Walking | ✅ có sẵn sau bước gắn xương |
| Chạy | Running | ✅ có sẵn sau bước gắn xương |
| Vui mừng | Funny Dancing, Cheer, Clap | có thể bị khóa |
| Vẫy tay | Wave, Hello | có thể bị khóa |
| Nói chuyện | Talk, Talking | có thể bị khóa |
| Nhảy | Jump | có thể bị khóa |

- Tối thiểu chỉ cần **Idle** (đứng yên). Thiếu động tác nào, trò chơi tự dùng động tác gần giống
  (vẫy tay → vui mừng → nói → đứng yên; chạy → đi nhanh hơn).
- Tên các nút trên Meshy có thể hơi khác theo thời gian – cứ tìm chữ **Rig**, **Hoạt hình/Animate** và
  **Tải xuống/Download → GLB**.
- Gắn xương bị lỗi, hoặc Meshy đòi mua gói? Vẫn dùng được: tải mô hình **tĩnh** (chưa gắn xương) – trò chơi tự cho
  nhân vật nhún nhảy, "thở", lắc lư.
- **Dùng ảnh mẫu với Meshy** (thay cho câu lệnh chữ ở bước 2–3): **Mô hình → biểu tượng thứ nhất (Hình ảnh thành 3D
  / Image to 3D)**, cũng đổi sang **Meshy 6 Lite**; Meshy hỏi tô màu (**Kết Cấu** / *Texture*) thì chọn **Có**.
- **Vẽ ảnh ngay trong Meshy** (mục **Hình ảnh** bên trái): rê chuột lên ảnh sẽ hiện nút **Hình ảnh thành 3D** –
  ⚠️ **đừng bấm ngay**: nút này tạo luôn bằng **Meshy 6/7.1** (20 điểm, gói miễn phí **không tải về được**). Bấm nút
  **⚙** bên cạnh trước (*Cài Đặt Tạo Mô Hình*) → **Mô hình AI: Meshy 6 Lite**, rồi mới bấm **Hình ảnh thành 3D**.

## 4. Mẹo và thứ tự nên làm

- **Ảnh mẫu quyết định kết quả**: nền trơn, nhìn thẳng, tay tách khỏi người, hai chân có khe hở, không có gì che tay
  (ba lô to lộ ra sau tay dễ bị dính vào tay). Vẽ vài ảnh rồi chọn ảnh giống phong cách các nhân vật khác nhất.
- **Tay để trống**: câu lệnh cố ý không cho nhân vật cầm đồ (bản đồ, gậy, quyền trượng…) – mô hình gọn hơn, gắn
  xương (nếu có) không lỗi.
- **Ít chi tiết nhỏ**: chi tiết càng to, tròn, rõ màu thì càng đẹp khi nhìn từ xa trong trò chơi.

**Thứ tự gợi ý** (HY 3D cho khoảng 20 lượt mỗi ngày – nên làm từng con, xem trong trò chơi rồi mới làm tiếp):

1. **Chú Gấu** ✅, **Thỏ Bông** ✅, **Cô Mèo** ✅, **Bác Cú** ✅ (đã xong – Tencent HY 3D).
2. **Robot Bíp** ✅, **Chú Hề Bibo** ✅, **Bác Voi** ✅, **Nhà Vua** ✅, **Hiệp Sĩ Thỏ** ✅ (đã xong – Tencent HY 3D).
3. Cô Sóc, **Ông Rùa** ✅, **Bạn Nai** ✅ (đã xong – Tencent HY 3D).
4. **Bé trai** ✅, **Bé gái** ✅ (nhân vật chính, đã xong – Tencent HY 3D), rồi thêm **bộ đồ** cho bé dần dần, mỗi lần
   một bộ (mục 8).
5. **Thú cưng** ✅ – cả 7 con: Cún, Mèo, Thỏ, Gấu trúc, Cáo, Chim cánh cụt, Khủng long (đã xong – Tencent HY 3D).
6. **Thú Sở Thú** ✅ – cả 6 con: Hươu cao cổ, Khỉ, Chim cánh cụt, Ngựa vằn, Hà mã, Sư tử (đã xong – Tencent HY 3D).
7. **Dân làng** ✅ – cả 6 người, mỗi người một tệp: Bé Na, Anh Tí, Chị Mai, Bé Bin, Bà Ba, Chú Tư (đã xong – Tencent
   HY 3D, mục 5.13–5.18).

**Dân làng:** mỗi người có **tệp riêng** (`be-na.glb`, `anh-ti.glb`, `chi-mai.glb`, `be-bin.glb`, `ba-ba.glb`,
`chu-tu.glb`) – không dùng tên chung `dan-lang.glb` (công cụ sẽ nhắc đổi tên). Ở Lâu Đài, Sở Thú và trò chơi
*Ghép số*, vài nhân vật dùng chung hình dân làng: Lính gác Piko và linh vật *Ghép số* (hình Anh Tí), Thị vệ Mây
(Bé Bin), Quan thư ký (Bà Ba), Chú Tư Giữ Thú (Chú Tư).

## 5. Câu lệnh từng nhân vật

Sao chép **nguyên khung** câu lệnh (bấm nút sao chép ở góc khung, hoặc bôi đen → Ctrl+C).
Dùng **Tencent HY 3D** thì mỗi nhân vật chỉ có **một tệp** (vd. `gau.glb`) – bỏ qua dòng **Tệp** bên dưới (dòng này
dành cho Meshy, có động tác).
Dòng **Tệp** cho biết nhân vật cần những động tác nào – đuôi tên tệp: `-dung` đứng yên (Idle) · `-di` đi (Walking) ·
`-chay` chạy (Running) · `-nhay` nhảy · `-vay-tay` vẫy tay · `-noi` nói chuyện · `-vui` vui mừng.
Tải gộp **Tất cả đã được thêm vào** thì chỉ có **một tệp** – tự làm thì đặt tên `gau.glb`; tên riêng từng động tác
(`gau-di.glb`…) chỉ dùng khi tải mỗi động tác một tệp. Nhờ Copilot lắp thì **không cần đổi tên** tệp.

### 5.1. Chú Gấu – bạn đồng hành (đi theo bé khắp nơi) ⭐ ✅ đã có mô hình AI (Tencent HY 3D)

Tệp: `gau-dung.glb` (Idle) · `gau-di.glb` (Walk) · `gau-chay.glb` (Run) · `gau-nhay.glb` (Jump) ·
`gau-vay-tay.glb` (Wave) · `gau-noi.glb` (Talk) · `gau-vui.glb` (Cheer)

```text
A friendly brown bear explorer standing on two legs: warm brown fur, light tan belly and muzzle, round ears, beige safari explorer hat with a brown band, teal scarf, small green backpack with straps. Cute chibi 3D cartoon for a kids game: big round head, small round body, short limbs, big shiny eyes, friendly smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from body, legs apart, facing front, empty hands, no base, no background.
```

### 5.2. Thỏ Bông – hướng dẫn viên ở Làng ⭐ ✅ đã có mô hình AI (Tencent HY 3D)

Tệp: `tho-dung.glb` · `tho-noi.glb` · `tho-vay-tay.glb` · `tho-vui.glb`

```text
A sweet white bunny standing on two legs: fluffy white fur, long upright ears with pink inside, pink nose, teal vest with a little pink bow at the collar, small round fluffy tail. Cute chibi 3D cartoon for a kids game: big round head, small round body, short limbs, big shiny eyes, friendly smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from body, legs apart, facing front, empty hands, no base, no background.
```

### 5.3. Cô Mèo – bán hàng ở Làng ⭐ ✅ đã có mô hình AI (Tencent HY 3D)

Tệp: `meo-dung.glb` · `meo-di.glb` · `meo-noi.glb` · `meo-vay-tay.glb` · `meo-vui.glb`

```text
A kind orange tabby cat shopkeeper lady standing on two legs: orange fur with darker stripes on the forehead, pointy ears with pink inside, white whiskers, pink nose, sunny yellow apron with a small pocket, curled tail. Cute chibi 3D cartoon for a kids game: big round head, small round body, short limbs, big shiny eyes, friendly smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from body, legs apart, facing front, empty hands, no base, no background.
```

### 5.4. Bác Cú – canh Cầu Phép Cộng trong Rừng ⭐ ✅ đã có mô hình AI (Tencent HY 3D)

Tệp: `cu-dung.glb` · `cu-noi.glb` · `cu-vay-tay.glb` · `cu-vui.glb`

Gọng kính **dày** và tua mũ **ngắn, dày**: chi tiết mảnh dễ bị đứt hoặc thủng khi tạo mô hình 3D.

```text
A wise brown owl teacher standing on two legs: round chubby body, brown feathers, cream belly with small feather spots, little ear tufts, big round glasses with thick frames, small yellow beak, wings as short arms, orange feet, navy graduation cap with a short thick gold tassel. Cute chibi 3D cartoon for a kids game: big round head, small round body, short limbs, big shiny eyes, friendly smile, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, wings slightly away from body, facing front, no base, no background.
```

### 5.5. Robot Bíp – gác Mê Cung ✅ đã có mô hình AI (Tencent HY 3D)

Robot bay lơ lửng, không có chân → **không cần gắn xương**. Chỉ tải mô hình: `robot.glb`
(trò chơi tự cho robot bay bồng bềnh, lắc lư).

Không vẽ vòng bay hay ánh sáng phát sáng (HY 3D không làm được phần trong suốt, phát sáng – trò chơi tự thêm vòng bay), ăng-ten **dày** cho khỏi gãy, và ở bước 1 thay *"plain white background"* bằng *"plain light grey background"* để thân trắng không lẫn vào nền.

```text
A cute little helper robot. One rounded cube body in soft matte white with mint trim, a big dark navy screen on the front with two big bright cyan eyes and a cyan smile (flat colors, no glow), a mint band across the lower front, one short thick antenna with a big round cyan ball on top, short thick rounded arms with round mint mitten hands, no legs, smooth rounded bottom. Cute chibi 3D cartoon for a kids game, soft rounded shapes, pastel matte vinyl toy look. Full body including the antenna, arms slightly away from the body, facing front, empty hands. No hover ring, no base, no ground, no shadow.
```

### 5.6. Chú Hề Bibo – Khu Vui Chơi ✅ đã có mô hình AI (Tencent HY 3D)

Tệp: `chu-he-dung.glb` · `chu-he-noi.glb` · `chu-he-vay-tay.glb` · `chu-he-vui.glb`

Găng tay **tròn**, cổ áo xếp nếp **dày** và **quả bông** trên đỉnh mũ (chi tiết mảnh dễ bị thủng khi tạo 3D), miệng **cười khép** cho hiền, ở bước 1 dùng *"plain light grey background"* vì có nhiều phần trắng, và ghi rõ *"He is a human, not a bear"* vì ảnh mẫu phong cách là chú gấu (AI dễ vẽ thêm lông, tai thú).

```text
A sweet, friendly human clown, cute and NOT scary: fair skin, no face paint, small round red nose, big shiny eyes, rosy cheeks, gentle closed-mouth smile, orange hair with big round colorful fluffy puffs on both sides, small purple cone party hat with a round pompom on top, thick puffy white ruffle collar, rainbow striped shirt, blue shorts, round white cartoon gloves, chunky red sneakers. Cute chibi 3D cartoon for a kids game: big round head, small round body, short thick limbs, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from body, legs apart, facing front, empty hands, no base, no ground, no shadow. He is a human, not a bear: no fur, no animal ears, no muzzle.
```

### 5.7. Bác Voi – giữ cổng Sở Thú ✅ đã có mô hình AI (Tencent HY 3D)

Tệp: `voi-dung.glb` · `voi-noi.glb` · `voi-vay-tay.glb` · `voi-vui.glb`

Tai, vòi và ngà đều **dày** (chi tiết mảnh dễ bị thủng khi tạo 3D), và đội **mũ lưỡi trai** của nhân viên sở thú thay cho mũ thám hiểm để không giống mũ của Chú Gấu.

```text
A big, gentle elephant zoo keeper standing upright on two legs: soft blue-grey skin, lighter belly, big rounded ears that are thick and soft like a plush toy (not paper-thin) with light pink inside, a short thick trunk that ends above the chest with the tip curled slightly up (not touching the body), two short thick rounded white tusks, round feet with light toenails, small khaki zoo keeper cap with a short thick front brim, khaki vest with a big gold star badge. Cute chibi 3D cartoon for a kids game: big round head, small round body, short thick limbs, big shiny eyes, friendly smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from body, legs apart, facing front, empty hands, no base, no ground, no shadow.
```

### 5.8. Nhà Vua – Lâu Đài ✅ đã có mô hình AI (Tencent HY 3D)

Tệp: `vua-dung.glb` · `vua-noi.glb` · `vua-vay-tay.glb` · `vua-vui.glb`

Vương miện răng **ngắn, dày** có đá đỏ to, áo choàng chỉ **tới gối** (không chạm đất), **tay để trống** (không cầm quyền trượng – chi tiết mảnh dễ bị thủng khi tạo 3D), ở bước 1 dùng *"plain light grey background"* vì râu và cổ áo màu trắng, và ghi rõ *"He is a human, not a bear"* vì ảnh mẫu phong cách là chú gấu.

```text
A kind, chubby old king (chibi human): fair skin, big shiny eyes, rosy cheeks, friendly smile under a big fluffy white mustache, short round fluffy white beard, short white hair, chunky gold crown with short thick rounded points and a few big round red gems, knee-length purple robe with gold trim, thick puffy white collar, short thick red cape hanging behind him to the knees (not touching the ground), purple trousers, chunky brown boots. Cute chibi 3D cartoon for a kids game: big round head, small round body, short thick limbs, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from body, legs apart, facing front, empty hands, no base, no ground, no shadow. He is a human, not a bear: no fur, no animal ears, no muzzle.
```

### 5.9. Hiệp Sĩ Thỏ – giữ các phòng thử thách ở Lâu Đài (một tệp dùng cho mọi hiệp sĩ) ✅ đã có mô hình AI (Tencent HY 3D)

Tệp: `hiep-si-dung.glb` · `hiep-si-noi.glb` · `hiep-si-vay-tay.glb` · `hiep-si-vui.glb`

Tai **dày**, hơi tách nhau (chi tiết mảnh dễ bị thủng khi tạo 3D), mũ **hở mặt** để thấy cả khuôn mặt, giáp **bạc**, **không cầm kiếm, khiên**, ở bước 1 dùng *"plain white background"* (nền trắng) vì giáp bạc dễ lẫn vào nền xám, và ghi rõ *"It is a bunny, not a bear"* vì ảnh mẫu phong cách là chú gấu.

```text
A brave, friendly bunny knight standing on two legs: warm cream fur, big shiny eyes, rosy cheeks, pink nose, friendly smile, a rounded open-face matte light silver helmet covering only the top of the head (no visor, whole face visible), two long bunny ears with pink inside standing straight up out of the helmet, slightly apart, thick and soft like a plush toy (not paper-thin), rounded matte light silver chest armor with gold trim and a big gold star in the middle, short thick royal blue cape hanging behind to the knees (not touching the ground), chunky brown boots. Cute chibi 3D cartoon for a kids game: big round head, small round body, short thick limbs, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from body, legs apart, facing front, empty hands, no sword, no shield, no base, no ground, no shadow. It is a bunny, not a bear: no round bear ears.
```

> Muốn hiệp sĩ cầm khiên: thay `empty hands, no sword, no shield` bằng `holding a small thick round blue shield with a gold star`
> (gắn xương có thể kém chính xác hơn).

### 5.10. Cô Sóc – Rừng Thông Thái, Mê Cung

Tệp: `soc-dung.glb` · `soc-di.glb` · `soc-noi.glb` · `soc-vay-tay.glb` · `soc-vui.glb`

```text
A cheerful squirrel girl standing on two legs: orange-brown fur, cream belly and muzzle, small round ears, very big fluffy curled tail, small green leaf hair clip, light green scarf. Cute chibi 3D cartoon for a kids game: big round head, small round body, short limbs, big shiny eyes, friendly smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from body, legs apart, facing front, empty hands, no base, no background.
```

### 5.11. Ông Rùa – Rừng Thông Thái, Mê Cung ✅ đã có mô hình AI (Tencent HY 3D)

Tệp: `rua-dung.glb` · `rua-noi.glb` · `rua-vay-tay.glb` · `rua-vui.glb`

Kính **gọng nâu đậm, dày** (gọng mảnh dễ bị thủng khi tạo 3D), lông mày và râu là **một túm tròn dày** (không phải sợi mảnh), mai **rộng hơn người** để thấy viền mai ở hai bên, tay **tách khỏi mai** và **không cầm gậy**, ở bước 1 dùng *"plain light grey background"* vì lông mày và râu màu trắng, và ghi rõ *"He is a turtle, not a bear"* vì ảnh mẫu phong cách là chú gấu.

```text
A kind, wise grandpa turtle standing upright on two legs: soft green skin, smooth round head with no ears, round glasses with thick dark brown frames, thick bushy white eyebrows, a short thick rounded white beard under the chin (one soft puff, not thin strands), pale yellow-green belly plate with big soft rounded segments, a big brown dome shell on his back with a thick rounded golden-tan rim and big soft hexagon patterns, the shell is wider than his body so its rim shows clearly on both sides, round feet. Cute chibi 3D cartoon for a kids game: big round head, small round body, short thick limbs, big shiny eyes, warm closed-mouth smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from body with a clear gap between the arms and the shell, legs apart, facing front, empty hands, no walking stick, no base, no ground, no shadow. He is a turtle, not a bear: smooth skin, no fur, no ears.
```

### 5.12. Bạn Nai – Rừng Thông Thái, Sở Thú ✅ đã có mô hình AI (Tencent HY 3D)

Tệp: `nai-dung.glb` · `nai-di.glb` · `nai-noi.glb` · `nai-vay-tay.glb` · `nai-vui.glb`

Mô hình đã có: tai **to, dày**, lòng tai hồng (tai mảnh dễ bị thủng khi tạo 3D), nụ sừng nhỏ, đốm trắng ở tay; đuôi trắng hơi lệch xuống hông phải (giống ảnh mẫu) – trong trò chơi nhìn không thấy lỗi. Thân tròn, ít chi tiết mảnh nên chỉ cần 30 000 tam giác (`"tam-giac": 30000`, xem `HUONG-DAN-MO-HINH-AI.md`).

```text
A shy baby deer (fawn) standing upright on two legs: light caramel fur with small white spots, cream belly and muzzle, big pointy ears with pink inside, tiny brown antler nubs, small white fluffy tail. Cute chibi 3D cartoon for a kids game: big round head, small round body, short limbs, big shiny eyes, friendly smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from body, legs apart, facing front, empty hands, no base, no background.
```

### 5.13. Bé Na – dân làng: cô bé heo con khoảng 5 tuổi (Làng, Khu Vui Chơi, màn hình tiêu đề) ✅ đã có mô hình AI (Tencent HY 3D)

Tệp: `be-na.glb`

Sáu dân làng (mục 5.13–5.18) **mỗi người một tệp riêng** và đều dùng *"plain light grey background"* ở bước 1. Đuôi xoăn của Bé Na nhỏ, mảnh – trong trò chơi hơi mờ đi, không sao.

```text
A sweet little piglet girl (about 5 years old) standing upright on two legs: soft light pink skin, a round pink snout with two small nostrils, small floppy triangle ears that are thick and soft (not paper-thin), a tiny curly tail at the back, one big thick rounded yellow flower hair clip beside one ear, a sky-blue short-sleeved dress with small white flower dots that ends above the knees, small round pink feet. Cute chibi 3D cartoon for a kids game: big round head, small round body, short thick limbs, big shiny eyes, friendly closed-mouth smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from the body with a clear gap under each arm, legs apart with a clear gap between them, facing front, empty hands, no base, no ground, no shadow.
```

### 5.14. Anh Tí – dân làng: cậu bé vịt con khoảng 12 tuổi (Làng; Lính gác Piko ở Lâu Đài; linh vật trò chơi *Ghép số*) ✅ đã có mô hình AI (Tencent HY 3D)

Tệp: `anh-ti.glb`

Mỏ **khép** (cười mỉm); ghi rõ *"No hat, no sailor shirt, no bow tie"* để không giống chú vịt nổi tiếng trong phim hoạt hình.

```text
A cheerful duckling boy, an older child about 12 years old (a little taller and slimmer than a toddler, still chibi), standing upright on two legs: bright yellow feathers, a small soft tuft of feathers on top of the head, a wide flat rounded orange beak that stays closed in a smile, short thick rounded wings shaped like arms with small rounded wing-tip hands, orange webbed feet, a red T-shirt with a small white star on the chest, blue denim shorts. No hat, no sailor shirt, no bow tie. Cute chibi 3D cartoon for a kids game: big round head, small round body, short thick limbs, big shiny eyes, friendly closed-mouth smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from the body with a clear gap under each arm, legs apart with a clear gap between them, facing front, empty hands, no base, no ground, no shadow.
```

### 5.15. Chị Mai – dân làng: cô bé cún khoảng 12 tuổi (Làng, Khu Vui Chơi, màn hình tiêu đề) ✅ đã có mô hình AI (Tencent HY 3D)

Tệp: `chi-mai.glb`

Tai dài, **dày**, buông cạnh má (tai mảnh dễ bị thủng khi tạo 3D) – không chạm tay khi nhân vật nhún nhảy, nói chuyện.

```text
A kind big-sister puppy girl, about 12 years old (a little taller and slimmer than a toddler, still chibi), standing upright on two legs: warm caramel-brown fur, cream muzzle and belly, a small black nose, long floppy dark brown ears that are thick and soft (not paper-thin) and hang beside her cheeks, a short soft brown tail, a mint-green short-sleeved dress with a round white collar and a small yellow flower on the chest that ends above the knees, small brown paws. Cute chibi 3D cartoon for a kids game: big round head, small round body, short thick limbs, big shiny eyes, friendly closed-mouth smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from the body with a clear gap under each arm, legs apart with a clear gap between them, facing front, empty hands, no base, no ground, no shadow.
```

### 5.16. Bé Bin – dân làng: cậu bé chuột hamster khoảng 5 tuổi (Khu Vui Chơi; Thị vệ Mây ở Lâu Đài) ✅ đã có mô hình AI (Tencent HY 3D)

Tệp: `be-bin.glb`

HY 3D tự thêm một **đuôi chuột dài, mảnh màu hồng** (ảnh mẫu không có) – vẫn giữ; trò chơi tính chỗ đứng, bóng và khung chân dung theo thân, không theo đuôi.

```text
A tiny cheerful hamster boy (about 5 years old) standing upright on two legs: golden-tan fur with a cream face and cream belly, chubby round cheeks, small round ears that are thick and soft (not paper-thin) with pink inside, a tiny pink nose, a sunny yellow T-shirt and blue shorts, small pink paws. Cute chibi 3D cartoon for a kids game: big round head, small round body, short thick limbs, big shiny eyes, friendly closed-mouth smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from the body with a clear gap under each arm, legs apart with a clear gap between them, facing front, empty hands, no base, no ground, no shadow.
```

### 5.17. Bà Ba – dân làng: bà ếch (Làng – *Câu đố của Bà Ba*; Quan thư ký ở Lâu Đài) ✅ đã có mô hình AI (Tencent HY 3D)

Tệp: `ba-ba.glb`

Kính gọng **dày** (gọng mảnh dễ bị thủng khi tạo 3D), áo bà ba tím. Hai vành kính có hai màu (tím nhạt và xanh lá đậm) giống ảnh mẫu – giữ nguyên.

```text
A kind, gentle frog grandma standing upright on two legs: soft green skin, pale cream belly and chin, big round eyes on top of the head with small smile lines at the corners, small round glasses with thick soft frames (not thin wire), a loose purple Vietnamese-style blouse with long sleeves, no collar and a row of small round buttons down the front, loose dark brown trousers, small green feet. Cute chibi 3D cartoon for a kids game: big round head, small round body, short thick limbs, big shiny eyes, friendly closed-mouth smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from the body with a clear gap under each arm, legs apart with a clear gap between them, facing front, empty hands, no base, no ground, no shadow.
```

### 5.18. Chú Tư – dân làng: chú gà trống (Khu Vui Chơi; Chú Tư Giữ Thú ở Sở Thú) ✅ đã có mô hình AI (Tencent HY 3D)

Tệp: `chu-tu.glb`

Mào ba khối tròn **dày**, yếm và mỏ ngắn, đuôi xòe **ngắn, dày** sau lưng (không che tay). Chỉ mô hình AI là gà trống – thiếu tệp hoặc tệp lỗi thì trò chơi dùng hình **gà con** dựng bằng code như trước.

```text
A friendly grown-up rooster uncle (a little taller than the children, still chibi) standing upright on two legs: warm golden-orange feathers with a cream chest, a big bright red comb on top of the head made of three thick rounded bumps, a small thick red wattle under a short yellow beak that stays closed in a smile, short thick rounded wings shaped like arms with small rounded wing-tip hands, a short fan of thick rounded tail feathers in dark green and brown behind his back (not covering his arms), yellow-orange feet, an orange short-sleeved shirt with white buttons, dark blue trousers. Cute chibi 3D cartoon for a kids game: big round head, small round body, short thick limbs, big shiny eyes, friendly closed-mouth smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from the body with a clear gap under each arm, legs apart with a clear gap between them, facing front, empty hands, no base, no ground, no shadow.
```

## 6. Thú cưng & thú Sở Thú (không bắt buộc)

Phần lớn là thú 4 chân → **chỉ cần một tệp mô hình** (tên ở đầu mỗi dòng), làm như mục 2 – trò chơi tự cho thú
nhún nhảy, lắc lư. (Meshy gắn xương được thú 4 chân nhưng ít động tác phù hợp; muốn thử thì Rigging rồi tải động tác
đứng yên và đi nếu thư viện có.)

Đoạn phong cách chung (đã ghép sẵn trong từng câu lệnh bên dưới):
*Cute chibi 3D cartoon for a kids game … pastel matte vinyl toy look. Full body, facing front, no base, no background.*

**Thú cưng** (chạy theo bé):

- `cun.glb` – Cún con ✅ đã có mô hình AI (Tencent HY 3D)
  ```text
  A little puppy standing on four legs: golden tan fur, cream muzzle and chest, darker floppy ears, blue collar with a round gold tag, small curled tail. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```
- `meo-con.glb` – Mèo mướp con ✅ đã có mô hình AI (Tencent HY 3D)
  ```text
  A little tabby kitten standing on four legs: light brown fur with dark grey stripes, pointy ears with pink inside, pink nose, white whiskers, tail curled up. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```
- `tho-con.glb` – Thỏ con ✅ đã có mô hình AI (Tencent HY 3D)
  ```text
  A little white bunny sitting on four paws: fluffy white fur, long ears with pink inside, pink nose, small round fluffy tail. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```
- `gau-truc.glb` – Gấu trúc con ✅ đã có mô hình AI (Tencent HY 3D)
  ```text
  A chubby baby panda standing on four legs: white fur, black round ears, black eye patches, black legs. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```
- `cao.glb` – Cáo con ✅ đã có mô hình AI (Tencent HY 3D)
  ```text
  A little fox standing on four legs: bright orange fur, white chest and muzzle, black paws, pointy ears, big fluffy tail with a white tip. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```
- `chim-canh-cut.glb` – Chim cánh cụt con ✅ đã có mô hình AI (Tencent HY 3D)
  ```text
  A baby penguin standing upright: dark navy back, white belly, small orange beak and feet, short flippers. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```
- `khung-long.glb` – Khủng long tí hon ✅ đã có mô hình AI (Tencent HY 3D)
  ```text
  A tiny friendly dinosaur standing on two legs: teal green skin, mint belly, small rounded spikes on its back, tiny arms, short thick tail. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```

**Thú Sở Thú** (đứng trong chuồng):

- `huou-cao-co.glb` – Hươu cao cổ ✅ đã có mô hình AI (Tencent HY 3D)
  ```text
  A gentle giraffe standing on four legs: long neck, yellow fur with brown patches, small horns, cream muzzle. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```
- `khi.glb` – Khỉ ✅ đã có mô hình AI (Tencent HY 3D)
  ```text
  A playful little monkey standing on two legs: brown fur, beige face, belly and ears, long curled tail. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```
- `canh-cut-lon.glb` – Chim cánh cụt (Sở Thú) ✅ đã có mô hình AI (Tencent HY 3D)
  ```text
  A penguin standing upright: dark navy back, white belly, yellow patches near the neck, orange beak and feet. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```
- `ngua-van.glb` – Ngựa vằn ✅ đã có mô hình AI (Tencent HY 3D)
  ```text
  A cute zebra standing on four legs: white fur with bold black stripes, black mane, dark muzzle. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```
- `ha-ma.glb` – Hà mã ✅ đã có mô hình AI (Tencent HY 3D)
  ```text
  A chubby hippo standing on four legs: lavender grey skin, pink cheeks and belly, small round ears, wide smiling mouth. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```
- `su-tu.glb` – Sư tử ✅ đã có mô hình AI (Tencent HY 3D)
  ```text
  A friendly lion standing on four legs: golden fur, big fluffy orange mane, cream muzzle, tail with a tuft. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```

## 7. Dùng trang khác (Tripo3D…)

Câu lệnh trên dùng được cho mọi trang tạo mô hình 3D. Ví dụ **Tripo3D** (<https://www.tripo3d.ai>) cũng có gói miễn phí
và tải được **GLB**, nhưng **hãy đọc kỹ điều khoản**: gói miễn phí của một số trang chỉ cho dùng **phi thương mại**
và để mô hình ở chế độ **công khai**. Ghi đúng nguồn vào mục `"nguon"` (vd. `"Tripo3D – CC BY 4.0"`).

## 8. Bé (nhân vật chính) và bộ đồ

**Bé trai** và **bé gái** là mô hình AI (Tencent HY 3D) ✅ đã có. Học sinh chọn bé trai hoặc bé gái khi tạo hồ sơ (đổi
lại được trong **Túi đồ**). Trò chơi **tự dựng xương** cho bé từ dáng đứng chữ A, nên bé đi, chạy, nhảy, vẫy tay thật
– không cần gắn xương trên trang AI. Mũ, ba lô, phụ kiện, thú cưng và ván trượt vẫn là đồ riêng, trò chơi tự gắn lên bé.

**Bộ đồ** (bán ở **Cửa hàng** của Cô Mèo, mặc trong **Túi đồ**): mỗi bộ đồ là **một tệp riêng cho từng bé** – bé trai
mặc đồ thể thao là một tệp, bé gái mặc đồ thể thao là một tệp khác. Thêm bộ đồ **không cần sửa code**: tạo mô hình,
đặt tên tệp đúng, chạy `CapNhatMoHinh.bat` (hoặc gửi tệp cho Copilot) là cửa hàng có bộ đồ mới.

| Tên tệp | Là |
|---|---|
| `be-trai.glb` | Bé trai mặc **Đồ thường ngày** (bộ đồ có sẵn, miễn phí cho mọi học sinh) |
| `be-gai.glb` | Bé gái mặc **Đồ thường ngày** |
| `be-trai-<bộ đồ>.glb` | Bé trai mặc bộ đồ đó, vd. `be-trai-the-thao.glb`, `be-trai-phi-hanh-gia.glb` |
| `be-gai-<bộ đồ>.glb` | Bé gái mặc bộ đồ đó, vd. `be-gai-the-thao.glb`, `be-gai-vay-cong-chua.glb` |

- Cùng một bộ đồ thì đặt **cùng tên** cho hai bé (`be-trai-the-thao.glb`, `be-gai-the-thao.glb`): cửa hàng coi là
  **một món** – học sinh đổi sang bé kia vẫn mặc được bộ đã mua.
- Bộ đồ có thể **chỉ có cho một bé** (vd. váy công chúa chỉ cho bé gái): cửa hàng chỉ bày bộ đồ có tệp cho bé đang chơi.
- **Tên, giá, biểu tượng**: không ghi gì thì công cụ tự đặt tên theo tên tệp (vd. `the-thao` → *Đồ thể thao*), giá
  **60 xu**, biểu tượng 👕. Muốn đổi: mục `"bo-do"` trong `mo-hinh-ai\cau-hinh.json` (mục 4 của
  [HUONG-DAN-MO-HINH-AI.md](HUONG-DAN-MO-HINH-AI.md)).
- Cài đặt của bộ đồ **lấy theo bé** (`be-trai`, `be-gai` trong `cau-hinh.json`): chiều cao, hướng, vật liệu, cỡ ảnh
  (`anh`), sửa vệt nứt (`sua-vet-nut`), chỗ gắn mũ/balo (`gan-do`)… – không cần ghi lại.

**Ảnh mẫu phải đúng dáng** (để trò chơi dựng được xương cho bé):

- Đứng **dáng chữ A**: hai tay dang chéo xuống khoảng **45°**, **hở rõ dưới mỗi nách**; hai chân tách, **hở rõ giữa
  hai chân**; nhìn thẳng; **tay để trống**.
- **Không** mũ, kính, ba lô, khăn quàng (đó là đồ riêng trong túi đồ, trò chơi tự gắn); nền **xám nhạt trơn** (câu
  lệnh bên dưới đã ghi sẵn – không cần thêm gì vào cuối).
- **Quần dài, quần soóc**: bé bước chân đẹp nhất. **Váy ngắn trên đầu gối** vẫn bước được (vạt váy kéo giãn theo chân
  nên kém gọn hơn quần một chút). **Váy dài**, áo choàng che kín chân vẫn dùng được, nhưng bé chỉ **nhún nhảy** như
  các bạn thú (không bước chân) – công cụ báo rõ bé dùng cách nào (dòng *Dáng đi* dưới đây).
- Khi chạy công cụ, mỗi tệp của bé có một dòng **Dáng đi**: *🚶 ĐI BẰNG CHÂN* là tốt; *⚠ NHÚN NHẢY* thì ngay bên dưới
  có lý do và cách sửa (thường là vẽ lại ảnh mẫu cho hở nách, hở chân rõ hơn).

**Các bước** (dùng **Google Gemini** vì cần đính kèm ảnh mẫu):

1. **Bé trai**: đính kèm ảnh mẫu của Gấu `gau-anh-mau-3.png`, dán câu lệnh 8.1. Ảnh ưng nhất lưu thành
   **`be-trai-anh-mau.png`**.
2. **Bé gái**: đính kèm `be-trai-anh-mau.png` (để hai bé cùng một phong cách), dán câu lệnh 8.2. Ảnh ưng nhất lưu
   thành **`be-gai-anh-mau.png`**.
3. **Bộ đồ**: đính kèm ảnh mẫu của **đúng bé đó** (`be-trai-anh-mau.png` hoặc `be-gai-anh-mau.png`), dán câu lệnh 8.3.
   Bộ đồ cho cả hai bé thì làm hai lần: mỗi bé một ảnh mẫu, một mô hình.
4. Tạo mô hình trên **Tencent HY 3D** như mục 2 → tải **GLB** → nhắn Copilot (vd. *"xong bé gái đồ thể thao"*), hoặc
   đổi tên tệp như bảng trên, chép vào `mo-hinh-ai` rồi nhấp đúp `CapNhatMoHinh.bat`.

### 8.1. Bé trai ✅ đã có mô hình AI (Tencent HY 3D)

Tệp: `be-trai.glb` · Gemini: đính kèm `gau-anh-mau-3.png` · ảnh chọn được lưu thành `be-trai-anh-mau.png`

```text
Use the attached bear only as a style reference (same 3D render style, proportions and soft materials). Draw a new character: A cheerful Vietnamese boy, about 7 years old: light warm skin, neat short black hair with soft rounded bangs, close to the head, big shiny dark brown eyes, rosy cheeks, friendly closed-mouth smile, sky-blue T-shirt with a small yellow star on the chest, blue jeans, red sneakers with white soles. Cute chibi 3D cartoon for a kids game: big round head, small round body, short thick limbs, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms held out about 45 degrees from the body with a clear gap under each arm, legs apart with a clear gap between them, facing front, empty hands with short thick rounded fingers, no base, no ground, no shadow. He is a human child, not a bear: no fur, no animal ears, no muzzle. No hat, no glasses, no hair accessories, no backpack, no scarf. 3D render, front view, plain light grey background, square image.
```

### 8.2. Bé gái ✅ đã có mô hình AI (Tencent HY 3D)

Tệp: `be-gai.glb` · Gemini: đính kèm `be-trai-anh-mau.png` · ảnh chọn được lưu thành `be-gai-anh-mau.png`

Bé gái mặc **quần soóc** (không mặc váy) để hai chân tách rời, bước chân đẹp; hai bím tóc **ngắn, dày, sát đầu** để
không chạm vai khi bé chạy.

```text
Use the attached boy only as a style reference (same 3D render style, face style, proportions and soft materials). Draw his classmate, a cheerful Vietnamese girl, about 7 years old: light warm skin, black hair with soft bangs and two short thick rounded pigtails close to the head, tied with small pink hair ties, big shiny dark brown eyes, rosy cheeks, friendly closed-mouth smile, pink T-shirt with a small white heart on the chest, light purple shorts, pink sneakers with white soles. Cute chibi 3D cartoon for a kids game: big round head, small round body, short thick limbs, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms held out about 45 degrees from the body with a clear gap under each arm, legs apart with a clear gap between them, facing front, empty hands with short thick rounded fingers, no base, no ground, no shadow. No hat, no glasses, no backpack, no scarf, no skirt. 3D render, front view, plain light grey background, square image.
```

### 8.3. Bộ đồ

Tệp: `be-trai-<bộ đồ>.glb` · `be-gai-<bộ đồ>.glb` · Gemini: đính kèm `be-trai-anh-mau.png` hoặc `be-gai-anh-mau.png`

Câu lệnh chung – thay `<OUTFIT>` bằng bộ đồ muốn vẽ (tả bằng tiếng Anh):

```text
Use the attached child as the same character: keep exactly the same face, hair, skin, body proportions, pose and 3D render style. Change only the clothes to: <OUTFIT>. Keep the arms held out with a clear gap under each arm and a clear gap between the legs, empty hands, no hat, no glasses, no backpack. 3D render, front view, plain light grey background, square image.
```

Gợi ý thay `<OUTFIT>` (ghi rõ *no helmet*, *no sword*: mũ là đồ riêng trong túi đồ, còn tay cần để trống):

- **Đồ thể thao** – `be-trai-the-thao.glb`, `be-gai-the-thao.glb`
  ```text
  a red sports jersey with a big white number 10, white sports shorts, red and white sneakers
  ```
- **Đồ phi hành gia** – `be-trai-phi-hanh-gia.glb`, `be-gai-phi-hanh-gia.glb`
  ```text
  a puffy white astronaut suit with blue and orange details, chunky white boots, no helmet
  ```
- **Đồ hiệp sĩ nhỏ** – `be-trai-hiep-si-nho.glb`, `be-gai-hiep-si-nho.glb`
  ```text
  small silver knight armor with gold trim over a blue tunic, brown boots, no helmet, no sword
  ```
- **Váy công chúa** (chỉ bé gái) – `be-gai-vay-cong-chua.glb`. Váy **ngắn trên đầu gối** để chân còn bước được.
  ```text
  a puffy light pink princess dress with gold trim that ends above the knees, pink shoes
  ```

Bốn bộ đồ trên công cụ đã biết sẵn tên tiếng Việt và biểu tượng (⚽ 🚀 🛡️ 👑). Bộ đồ khác thì đặt tên trong mục
`"bo-do"` của `cau-hinh.json`, hoặc viết tên tệp có dấu (vd. `be-gai-đồ-mùa-hè.glb` → *Đồ mùa hè*).

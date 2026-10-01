# Câu lệnh tạo nhân vật 3D bằng AI (Meshy)

Tệp này có sẵn **câu mô tả tiếng Anh** cho từng nhân vật của trò chơi. Thầy cô chỉ cần **sao chép → dán vào Meshy →
tải tệp về → chép vào thư mục `mo-hinh-ai`**. Phần lắp vào trò chơi xem ở [HUONG-DAN-MO-HINH-AI.md](HUONG-DAN-MO-HINH-AI.md).

> Mỗi câu lệnh đã kèm sẵn một đoạn "phong cách chung" (chibi, đầu to, màu pastel, đứng thẳng, nhìn thẳng)
> để cả dàn nhân vật **đồng bộ** với nhau và với khung cảnh trò chơi. Không cần sửa gì.

---

## 1. Chi phí (gói miễn phí của Meshy)

| Việc | Điểm (credit) |
|---|---|
| Mỗi tháng được tặng | **100 điểm** (không cần thẻ ngân hàng, cộng lại vào ngày 1 hằng tháng) |
| Tạo 1 mô hình – *Text to 3D* (Meshy 6) | 20 |
| Tạo 1 mô hình – *Image to 3D* | 20 (Meshy 6) · 25 (Meshy 7) |
| Gắn xương (*Rig*), động tác (*Animate*), giảm đa giác (*Remesh*) | **miễn phí** |
| Tạo lỗi | được hoàn điểm |

→ Mỗi tháng làm được **4–5 nhân vật**. Nên chừa 20 điểm để làm lại khi chưa ưng.

**Giấy phép:** mô hình tạo bằng gói miễn phí dùng giấy phép **CC BY 4.0** – được dùng cả cho mục đích thương mại
nhưng **phải ghi công "Meshy.ai"**. Trò chơi tự hiện dòng ghi công trong mục **⚙️ Cài đặt** khi có mô hình AI
(ghi nguồn vào mục `"nguon"` – Copilot làm giúp khi lắp mô hình).

*(Điểm và giấy phép theo trang giá của Meshy, tháng 10/2026 – có thể thay đổi.)*

## 2. Các bước (khoảng 10 phút/nhân vật)

1. Vào <https://www.meshy.ai> → đăng ký (dùng tài khoản Google cho nhanh).
2. Ở thanh bên trái chọn **Text to 3D**. Dán câu lệnh của nhân vật (mục 5).
   - Chọn mô hình **High Detail → Meshy 6** (Text to 3D chỉ có Meshy 6).
   - Nếu có mục **Pose** → chọn **A-pose** (giúp gắn xương tốt). Có mục **Symmetry (đối xứng)** → bật.
   - Trước khi bấm, bảng hiện số điểm sẽ dùng – kiểm tra là **20**.
3. Bấm **Generate** → chờ 1–2 phút → xoay xem các phía. Chưa ưng: sửa vài chữ trong câu lệnh rồi tạo lại.
   Mọi kết quả được lưu trong **My Models**.
4. **Remesh** (miễn phí): đặt khoảng **20.000** mặt → chạy. Meshy khuyên làm bước này trước khi gắn xương
   (mô hình quá 300.000 mặt sẽ không gắn được); màu sắc vẫn giữ nguyên.
5. **Rigging** (miễn phí): Meshy tự nhận dạng nhân vật. Nếu được hỏi, kéo các điểm khớp (cằm, vai, cổ tay,
   khuỷu tay, đầu gối, háng) vào đúng chỗ → xác nhận. Xong bước này Meshy **tặng sẵn 2 động tác Đi và Chạy**.
6. **Animate** (miễn phí): tìm thêm động tác trong thư viện hơn 500 động tác (gõ tìm theo bảng dưới) → xem thử →
   **Download → GLB**. Mỗi động tác tải thành **một tệp riêng** (tải cả tệp Đi và Chạy).
7. Gửi tệp cho trò chơi – chọn một trong hai cách:
   - **Dễ nhất – nhờ Copilot:** cứ để các tệp trong thư mục **Tải xuống (Downloads)**, **giữ nguyên tên**, rồi nhắn
     Copilot **"xong Gấu"** (tên nhân vật vừa làm). Copilot tự tìm tệp, đặt tên, tối ưu, chỉnh cỡ/hướng, kiểm tra
     trong trò chơi, đóng gói lại và đưa lên bản chơi trên web. **Làm xong con nào thì nhắn con đó** để tệp không lẫn.
   - **Tự làm:** đổi tên tệp theo danh sách của nhân vật ở mục 5, chép vào **`E:\VuongQuocToanHoc\mo-hinh-ai`**,
     rồi nhấp đúp `CapNhatMoHinh.bat` (cách này chỉ cập nhật bản chơi offline trên máy).

| Động tác | Gõ tìm trong thư viện Meshy | Đuôi tên tệp | Ví dụ |
|---|---|---|---|
| Đứng yên (bắt buộc) | Idle | `-dung` | `gau-dung.glb` |
| Đi | *(có sẵn sau bước Rigging)* Walk, Walking | `-di` | `gau-di.glb` |
| Chạy | *(có sẵn sau bước Rigging)* Run, Running | `-chay` | `gau-chay.glb` |
| Nhảy | Jump | `-nhay` | `gau-nhay.glb` |
| Vẫy tay | Wave, Waving, Hello | `-vay-tay` | `gau-vay-tay.glb` |
| Nói chuyện | Talk, Talking | `-noi` | `gau-noi.glb` |
| Vui mừng | Cheer, Happy, Dance, Clap | `-vui` | `gau-vui.glb` |

- Tối thiểu chỉ cần tệp **đứng yên** (`-dung`). Thiếu động tác nào, trò chơi tự dùng động tác gần giống
  (vẫy tay → vui mừng → nói → đứng yên; chạy → đi nhanh hơn).
- Tên các nút trên Meshy có thể hơi khác theo thời gian – cứ tìm chữ **Remesh**, **Rigging**, **Animate** và
  **Download → GLB**.
- Gắn xương bị lỗi hoặc không gắn được? Vẫn dùng được: chỉ tải mô hình tĩnh (tự làm thì đặt tên `gau.glb`),
  trò chơi tự cho nhân vật nhún nhảy, "thở", lắc lư.

## 3. Mẹo cho kết quả đẹp hơn (không bắt buộc)

- **Vẽ ảnh mẫu trước**: dán câu lệnh vào một trang AI vẽ tranh miễn phí (Microsoft Copilot / Bing Image Creator,
  Google Gemini…), thêm vào cuối *"3D render, front view, plain white background"*. Chọn ảnh ưng nhất →
  Meshy **Image to 3D** (20–25 điểm). Cách này dễ kiểm soát dáng vẻ hơn và các nhân vật giống nhau về phong cách hơn.
- **Tay để trống**: câu lệnh cố ý không cho nhân vật cầm đồ (bản đồ, gậy, quyền trượng…) để gắn xương không lỗi.
- **Ít chi tiết nhỏ**: chi tiết càng to, tròn, rõ màu thì càng đẹp khi nhìn từ xa trong trò chơi.

## 4. Nên làm nhân vật nào trước?

| Tháng | Nhân vật | Điểm |
|---|---|---|
| 1 | Chú Gấu, Thỏ Bông, Cô Mèo, Bác Cú (+ 20 điểm dự phòng làm lại) | 80–100 |
| 2 | Robot Bíp, Chú Hề Bibo, Bác Voi, Nhà Vua, Hiệp Sĩ Thỏ | 100 |
| 3 | Cô Sóc, Ông Rùa, Bạn Nai (+ thú sở thú nếu muốn) | 60–100 |

**Không nên thay:**

- **Dân làng** – một tệp `dan-lang.glb` sẽ thay **cả 6 loài** (heo, vịt, cún, chuột hamster, ếch, gà con) thành một
  nhân vật giống hệt nhau → làng mất đa dạng.
- **Bé** (nhân vật chính) – được dựng bằng code để thay quần áo, mũ, phụ kiện trong túi đồ.
- **Thú cưng 4 chân** – Meshy gắn xương được thú 4 chân, nhưng thư viện động tác chủ yếu dành cho nhân vật 2 chân.
  Không có động tác đi phù hợp thì thú cưng chỉ nhún nhảy khi chạy theo bé (không bước chân).
  Muốn thì thử một con trước xem có ưng không.

## 5. Câu lệnh từng nhân vật

Sao chép **nguyên khung** câu lệnh (bấm nút sao chép ở góc khung, hoặc bôi đen → Ctrl+C).
Dòng **Tệp** cho biết cần tải những động tác nào (đuôi tên tệp ứng với động tác ở bảng mục 2).
Nhờ Copilot lắp thì **không cần đổi tên** tệp.

### 5.1. Chú Gấu – bạn đồng hành (đi theo bé khắp nơi) ⭐

Tệp cần tải: `gau-dung.glb` (Idle) · `gau-di.glb` (Walk) · `gau-chay.glb` (Run) · `gau-nhay.glb` (Jump) ·
`gau-vay-tay.glb` (Wave) · `gau-noi.glb` (Talk) · `gau-vui.glb` (Cheer)

```text
A friendly brown bear explorer standing on two legs: warm brown fur, light tan belly and muzzle, round ears, beige safari explorer hat with a brown band, teal scarf, small green backpack with straps. Cute chibi 3D cartoon for a kids game: big round head, small round body, short limbs, big shiny eyes, friendly smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from body, legs apart, facing front, empty hands, no base, no background.
```

### 5.2. Thỏ Bông – hướng dẫn viên ở Làng ⭐

Tệp: `tho-dung.glb` · `tho-noi.glb` · `tho-vay-tay.glb` · `tho-vui.glb`

```text
A sweet white bunny standing on two legs: fluffy white fur, long upright ears with pink inside, pink nose, teal vest with a little pink bow at the collar, small round fluffy tail. Cute chibi 3D cartoon for a kids game: big round head, small round body, short limbs, big shiny eyes, friendly smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from body, legs apart, facing front, empty hands, no base, no background.
```

### 5.3. Cô Mèo – bán hàng ở Làng ⭐

Tệp: `meo-dung.glb` · `meo-di.glb` · `meo-noi.glb` · `meo-vay-tay.glb` · `meo-vui.glb`

```text
A kind orange tabby cat shopkeeper lady standing on two legs: orange fur with darker stripes on the forehead, pointy ears with pink inside, white whiskers, pink nose, sunny yellow apron with a small pocket, curled tail. Cute chibi 3D cartoon for a kids game: big round head, small round body, short limbs, big shiny eyes, friendly smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from body, legs apart, facing front, empty hands, no base, no background.
```

### 5.4. Bác Cú – canh Cầu Phép Cộng trong Rừng ⭐

Tệp: `cu-dung.glb` · `cu-noi.glb` · `cu-vay-tay.glb` · `cu-vui.glb`

```text
A wise brown owl teacher standing on two legs: round chubby body, brown feathers, cream belly with small feather spots, little ear tufts, big round glasses, small yellow beak, wings as short arms, orange feet, navy graduation cap with a gold tassel. Cute chibi 3D cartoon for a kids game: big round head, small round body, short limbs, big shiny eyes, friendly smile, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, wings slightly away from body, facing front, no base, no background.
```

### 5.5. Robot Bíp – gác Mê Cung

Robot bay lơ lửng, không có chân → **không cần gắn xương**. Chỉ tải mô hình: `robot.glb`
(trò chơi tự cho robot bay bồng bềnh, lắc lư).

```text
A cute little helper robot: glossy white and mint rounded cube body, dark screen face with glowing cyan eyes and a smile, small antenna with a glowing ball on top, short rounded arms, no legs, floating on a glowing cyan hover ring. Cute chibi 3D cartoon for a kids game, soft rounded shapes, pastel toy look. Full body, arms slightly away from body, facing front, no base, no background.
```

### 5.6. Chú Hề Bibo – Khu Vui Chơi

Tệp: `chu-he-dung.glb` · `chu-he-noi.glb` · `chu-he-vay-tay.glb` · `chu-he-vui.glb`

```text
A sweet friendly clown, cute and NOT scary: fair skin, no face paint, small round red nose, orange hair with colorful fluffy puffs on both sides, small purple party hat, white ruffle collar, rainbow striped shirt, blue shorts, red sneakers. Cute chibi 3D cartoon for a kids game: big round head, small round body, short limbs, big shiny eyes, friendly smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from body, legs apart, facing front, empty hands, no base, no background.
```

### 5.7. Bác Voi – giữ cổng Sở Thú

Tệp: `voi-dung.glb` · `voi-noi.glb` · `voi-vay-tay.glb` · `voi-vui.glb`

```text
A big friendly elephant zoo keeper standing upright on two legs: soft blue-grey skin, big floppy ears, short curled trunk, tiny white tusks, khaki safari hat, khaki vest with a gold star badge. Cute chibi 3D cartoon for a kids game: big round head, small round body, short limbs, big shiny eyes, friendly smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from body, legs apart, facing front, empty hands, no base, no background.
```

### 5.8. Nhà Vua – Lâu Đài

Tệp: `vua-dung.glb` · `vua-noi.glb` · `vua-vay-tay.glb` · `vua-vui.glb`

```text
A kind chubby old king (chibi human): gold crown, fluffy white mustache and beard, purple robe with gold trim, red cape with a white fluffy collar, brown boots. Cute chibi 3D cartoon for a kids game: big round head, small round body, short limbs, big shiny eyes, friendly smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from body, legs apart, facing front, empty hands, no base, no background.
```

### 5.9. Hiệp Sĩ Thỏ – giữ các phòng thử thách ở Lâu Đài (một tệp dùng cho mọi hiệp sĩ)

Tệp: `hiep-si-dung.glb` · `hiep-si-noi.glb` · `hiep-si-vay-tay.glb` · `hiep-si-vui.glb`

```text
A brave bunny knight standing on two legs: cream fur, long ears sticking up out of a shiny silver helmet, silver chest armor with gold trim, blue cape, pink nose, small brown boots. Cute chibi 3D cartoon for a kids game: big round head, small round body, short limbs, big shiny eyes, friendly smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from body, legs apart, facing front, empty hands, no base, no background.
```

> Muốn hiệp sĩ cầm khiên: thay `empty hands` bằng `holding a small round blue shield with a gold star`
> (gắn xương có thể kém chính xác hơn).

### 5.10. Cô Sóc – Rừng Phép Tính, Mê Cung

Tệp: `soc-dung.glb` · `soc-di.glb` · `soc-noi.glb` · `soc-vay-tay.glb` · `soc-vui.glb`

```text
A cheerful squirrel girl standing on two legs: orange-brown fur, cream belly and muzzle, small round ears, very big fluffy curled tail, small green leaf hair clip, light green scarf. Cute chibi 3D cartoon for a kids game: big round head, small round body, short limbs, big shiny eyes, friendly smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from body, legs apart, facing front, empty hands, no base, no background.
```

### 5.11. Ông Rùa – Rừng Phép Tính, Mê Cung

Tệp: `rua-dung.glb` · `rua-noi.glb` · `rua-vay-tay.glb` · `rua-vui.glb`

```text
A gentle grandpa turtle standing upright on two legs: green skin, pale green belly, big brown dome shell on his back, small round silver glasses, white bushy eyebrows, short white beard. Cute chibi 3D cartoon for a kids game: big round head, small round body, short limbs, big shiny eyes, friendly smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from body, legs apart, facing front, empty hands, no base, no background.
```

### 5.12. Bạn Nai – Rừng Phép Tính, Sở Thú

Tệp: `nai-dung.glb` · `nai-di.glb` · `nai-noi.glb` · `nai-vay-tay.glb` · `nai-vui.glb`

```text
A shy baby deer (fawn) standing upright on two legs: light caramel fur with small white spots, cream belly and muzzle, big pointy ears with pink inside, tiny brown antler nubs, small white fluffy tail. Cute chibi 3D cartoon for a kids game: big round head, small round body, short limbs, big shiny eyes, friendly smile, rosy cheeks, soft rounded shapes, pastel matte vinyl toy look. Full body, A-pose, arms slightly away from body, legs apart, facing front, empty hands, no base, no background.
```

## 6. Thú cưng & thú Sở Thú (không bắt buộc)

Phần lớn là thú 4 chân. Meshy gắn xương được thú 4 chân nhưng ít động tác phù hợp, nên **đơn giản nhất là chỉ tải
một tệp mô hình** (tên ở đầu mỗi dòng) – trò chơi tự cho thú nhún nhảy, lắc lư. Muốn thử thêm động tác: Rigging rồi
tải động tác đứng yên và đi (nếu thư viện có). Con nào đứng 2 chân (chim cánh cụt, khủng long, khỉ) làm như mục 2.

Đoạn phong cách chung (đã ghép sẵn trong từng câu lệnh bên dưới):
*Cute chibi 3D cartoon for a kids game … pastel matte vinyl toy look. Full body, facing front, no base, no background.*

**Thú cưng** (chạy theo bé):

- `cun.glb` – Cún con
  ```text
  A little puppy standing on four legs: golden tan fur, cream muzzle and chest, darker floppy ears, blue collar with a round gold tag, small curled tail. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```
- `meo-con.glb` – Mèo mướp con
  ```text
  A little tabby kitten standing on four legs: light brown fur with dark grey stripes, pointy ears with pink inside, pink nose, white whiskers, tail curled up. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```
- `tho-con.glb` – Thỏ con
  ```text
  A little white bunny sitting on four paws: fluffy white fur, long ears with pink inside, pink nose, small round fluffy tail. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```
- `gau-truc.glb` – Gấu trúc con
  ```text
  A chubby baby panda standing on four legs: white fur, black round ears, black eye patches, black legs. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```
- `cao.glb` – Cáo con
  ```text
  A little fox standing on four legs: bright orange fur, white chest and muzzle, black paws, pointy ears, big fluffy tail with a white tip. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```
- `chim-canh-cut.glb` – Chim cánh cụt con
  ```text
  A baby penguin standing upright: dark navy back, white belly, small orange beak and feet, short flippers. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```
- `khung-long.glb` – Khủng long tí hon
  ```text
  A tiny friendly dinosaur standing on two legs: teal green skin, mint belly, small rounded spikes on its back, tiny arms, short thick tail. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```

**Thú Sở Thú** (đứng trong chuồng):

- `huou-cao-co.glb` – Hươu cao cổ
  ```text
  A gentle giraffe standing on four legs: long neck, yellow fur with brown patches, small horns, cream muzzle. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```
- `khi.glb` – Khỉ
  ```text
  A playful little monkey standing on two legs: brown fur, beige face, belly and ears, long curled tail. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```
- `canh-cut-lon.glb` – Chim cánh cụt (Sở Thú)
  ```text
  A penguin standing upright: dark navy back, white belly, yellow patches near the neck, orange beak and feet. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```
- `ngua-van.glb` – Ngựa vằn
  ```text
  A cute zebra standing on four legs: white fur with bold black stripes, black mane, dark muzzle. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```
- `ha-ma.glb` – Hà mã
  ```text
  A chubby hippo standing on four legs: lavender grey skin, pink cheeks and belly, small round ears, wide smiling mouth. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```
- `su-tu.glb` – Sư tử
  ```text
  A friendly lion standing on four legs: golden fur, big fluffy orange mane, cream muzzle, tail with a tuft. Cute chibi 3D cartoon for a kids game: big round head, small round body, big shiny eyes, happy smile, soft rounded shapes, pastel matte vinyl toy look. Full body, facing front, no base, no background.
  ```

## 7. Dùng trang khác (Tripo3D…)

Câu lệnh trên dùng được cho mọi trang tạo mô hình 3D. Ví dụ **Tripo3D** (<https://www.tripo3d.ai>) cũng có gói miễn phí
và tải được **GLB**, nhưng **hãy đọc kỹ điều khoản**: gói miễn phí của một số trang chỉ cho dùng **phi thương mại**
và để mô hình ở chế độ **công khai**. Ghi đúng nguồn vào mục `"nguon"` (vd. `"Tripo3D – CC BY 4.0"`).

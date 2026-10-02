# Hướng dẫn thay nhân vật bằng mô hình AI

Trò chơi đã có sẵn đầy đủ nhân vật (dựng bằng code, phong cách pastel). Thầy cô có thể **thay bất kỳ nhân vật nào**
bằng mô hình 3D tạo bằng AI (Tencent HY 3D, Meshy, Tripo...) mà **không cần lập trình**:

1. Tạo mô hình trên trang web AI → tải về dạng **.glb**.
2. Chép tệp vào thư mục **`mo-hinh-ai`**, đặt tên theo nhân vật (vd. `gau.glb`, `gau-di.glb`).
3. Nhấp đúp **`CapNhatMoHinh.bat`** → chọn **C** để đóng gói lại → mở `ban-phat-hanh\VuongQuocToanHoc.html`.

> Dễ nhất: gửi tệp `.glb` cho **Copilot** (vd. nhắn *"xong Gấu"*) – Copilot làm hết các bước và đưa lên bản chơi trên web.

> Lần đầu chạy, máy cần có **Node.js** (bản LTS tại <https://nodejs.org>) và Internet để cài thư viện (1–3 phút).
> Những lần sau không cần Internet.

---

## 1. Tạo mô hình trên Tencent HY 3D (khuyên dùng, miễn phí)

> 📋 **Câu lệnh soạn sẵn cho từng nhân vật** (đồng bộ phong cách, chỉ việc sao chép), so sánh các trang, thứ tự nên làm
> và danh sách tệp cần tải: xem **[CAU-LENH-TAO-NHAN-VAT.md](CAU-LENH-TAO-NHAN-VAT.md)**.

1. **Vẽ ảnh mẫu**: dán câu lệnh của nhân vật vào **Microsoft Copilot** hoặc **Google Gemini**, thêm vào cuối
   *"3D render, front view, plain white background, square image"* → tải ảnh ưng nhất về. Ảnh cần: một nhân vật,
   nhìn thẳng, nền trơn, **PNG/JPG/WEBP** tối đa **10 MB**, mỗi cạnh **512–4096 px**, gần vuông.
2. Mở <https://3d.hunyuanglobal.com> (tự chuyển sang **hy3d.tencent.ai**) → **Start Using** → nhập **Gmail** →
   **Continue** → nhập **mã** được gửi qua thư (không cần đăng ký).
3. **Image-to-3D** → **Upload Image** (chọn ảnh mẫu) → **Generate Now** → chờ vài phút.
4. **Download** → **GLB**. Gửi tệp cho Copilot, hoặc đổi tên theo nhân vật (vd. `gau.glb`, mục 2), chép vào
   `mo-hinh-ai` rồi chạy `CapNhatMoHinh.bat` (mục 3).

- Miễn phí khoảng **20 lượt tạo mỗi ngày** (theo thông báo của Tencent; có thể thay đổi). Ghi công: `Tencent HY 3D`.
- Tệp rất nặng (khoảng **80 MB**, **1,5 triệu mặt**) – công cụ **tự giảm** còn khoảng 60.000 tam giác (dưới 1 MB).
- Mô hình **không có khung xương** – trò chơi tự cho nhân vật nhún nhảy, "thở", lắc lư. Nút gắn xương tự động
  (*Auto-Rigging*) của HY 3D **tốn điểm** – không bắt buộc.

**Cách khác – Meshy.ai** (<https://www.meshy.ai>): gắn xương được và có khoảng 20 động tác miễn phí (đi, chạy, vẫy
tay…), nhưng gói miễn phí chỉ tải được mô hình **Meshy 6 Lite** (tối đa 10 lần/tháng) – và tài khoản của cô **bị chặn
tải** cả loại này. Các bước chi tiết: mục 3 của [CAU-LENH-TAO-NHAN-VAT.md](CAU-LENH-TAO-NHAN-VAT.md). Khi tải
(**Download → GLB**) mô hình có động tác:

- Chọn **Tất cả đã được thêm vào** (*All Added*): **một tệp** chứa mọi động tác, đặt tên `gau.glb` – trò chơi tự nhận
  động tác theo tên (Idle, Walking, Running…). Cách này chỉ tốn 1 lượt tải.
- Hoặc tải mỗi động tác một tệp riêng: `gau.glb` (đứng yên), `gau-di.glb`, `gau-chay.glb`, `gau-vay-tay.glb`...

Tripo3D (<https://www.tripo3d.ai>) và các trang tương tự làm tương tự: tạo → (rig/animate) → tải **GLB**.

> Con vật 4 chân (hươu, khỉ, voi...) hay mô hình không có khung xương: vẫn dùng được – trò chơi tự cho nhân vật nhún
> nhảy, lắc lư, "thở" cho sinh động.

## 2. Đặt tên tệp

Tên tệp = **tên nhân vật** (+ `-` + **tên động tác** nếu là tệp động tác). Viết có dấu, không dấu hay tiếng Anh đều được.

| Nhân vật | Tên tệp chính (chọn 1) |
|---|---|
| Chú Gấu | `gau.glb`, `chu-gau.glb` |
| Thỏ Bông | `tho.glb`, `tho-bong.glb` |
| Robot Bíp | `robot.glb`, `bip.glb` |
| Cô Mèo (bán hàng) | `meo.glb`, `co-meo.glb` |
| Bác Cú | `cu.glb`, `bac-cu.glb` |
| Cô Sóc | `soc.glb`, `co-soc.glb` |
| Ông Rùa | `rua.glb`, `ong-rua.glb` |
| Bạn Nai | `nai.glb`, `ban-nai.glb` |
| Bác Voi | `voi.glb`, `bac-voi.glb` |
| Nhà Vua | `vua.glb`, `nha-vua.glb` |
| Hiệp Sĩ Thỏ | `hiep-si.glb` |
| Chú Hề Bibo | `chu-he.glb`, `bibo.glb` |
| Dân làng (*không khuyến khích*: một tệp sẽ thay **cả 6 loài** heo, vịt, cún, hamster, ếch, gà con) | `dan-lang.glb` |
| Thú cưng: cún, mèo con, thỏ con, gấu trúc, cáo, chim cánh cụt, khủng long | `cun.glb`, `meo-con.glb`, `tho-con.glb`, `gau-truc.glb`, `cao.glb`, `chim-canh-cut.glb`, `khung-long.glb` |
| Sở thú: hươu cao cổ, khỉ, cánh cụt, ngựa vằn, hà mã, sư tử | `huou-cao-co.glb`, `khi.glb`, `canh-cut-lon.glb`, `ngua-van.glb`, `ha-ma.glb`, `su-tu.glb` |

| Động tác | Đuôi tên tệp | Ví dụ |
|---|---|---|
| Đứng yên | `-dung` | `gau-dung.glb` |
| Đi | `-di` | `gau-di.glb` |
| Chạy | `-chay` | `gau-chay.glb` |
| Nhảy | `-nhay` | `gau-nhay.glb` |
| Vẫy tay | `-vay-tay` | `gau-vay-tay.glb` |
| Nói chuyện | `-noi` | `gau-noi.glb` |
| Vui mừng / nhảy múa | `-vui` | `gau-vui.glb` |
| Ngồi | `-ngoi` | `gau-ngoi.glb` |
| Ăn | `-an` | `gau-an.glb` |

Cách viết khác cũng được: `gau@di.glb`, `gau-walk.glb`. Nếu chỉ có tệp động tác (không có `gau.glb`),
công cụ lấy tệp "đứng yên" làm mô hình chính. Tệp gộp nhiều động tác (tải bằng *Tất cả đã được thêm vào*) chỉ cần
đặt tên `gau.glb`; tên động tác lạ thì khai báo trong `cau-hinh.json` (mục 4).

Nhân vật chính (bé) được dựng bằng code để **thay quần áo, mũ, phụ kiện** trong túi đồ – nên không thay bằng mô hình AI.

## 3. Chạy công cụ `CapNhatMoHinh.bat`

Nhấp đúp `CapNhatMoHinh.bat`. Công cụ sẽ:

- nhận tên nhân vật/động tác, báo lỗi nếu tên tệp sai;
- **tối ưu**: thu nhỏ ảnh (WebP 1024 px), nén lưới; mô hình quá nặng (> 60.000 tam giác, vd. 1,5 triệu mặt của
  HY 3D) được **tự giảm** còn khoảng 60.000 tam giác mà vẫn giữ dáng và độ mịn (tệp 80 MB → dưới 1 MB);
- tệp động tác chỉ giữ phần chuyển động (nhẹ hơn nhiều);
- chép kết quả vào `src\assets\models\ai\` và tạo bảng ghi công `GHI-CONG.md`;
- **chỉ làm lại nhân vật có tệp trong `mo-hinh-ai`**: nhân vật đã lắp từ trước (kể cả lắp trên máy khác) được **giữ
  nguyên** – trong `mo-hinh-ai` chỉ cần để tệp của nhân vật mới;
- hỏi có **đóng gói lại** trò chơi không → chọn **C**.

Đọc thông báo: dòng **✔** là thành công, **ℹ** là thông tin (vd. mô hình chưa có khung xương, nhân vật cũ được giữ
nguyên), **⚠** là lưu ý, **✖** là lỗi cần sửa, **🗑** là tệp cũ đã xóa.

Tùy chọn nâng cao (gõ trong cửa sổ lệnh – trong thư mục trò chơi, gõ `cmd` vào thanh địa chỉ rồi Enter):
`CapNhatMoHinh.bat --anh 2048` (ảnh nét hơn), `--giam 0.5` (giảm số tam giác còn 50%), `--xem` (chỉ kiểm tra,
không ghi tệp), `--go gau` (gỡ mô hình – xem dưới).

**Gỡ một mô hình AI**: gõ `CapNhatMoHinh.bat --go gau` (tên viết như tên tệp; nhiều nhân vật: `--go gau,tho`) –
công cụ xóa mô hình, cài đặt và dòng ghi công của nhân vật đó; trò chơi tự quay về nhân vật có sẵn. Hoặc nhắn
Copilot *"gỡ mô hình Gấu"*. Chỉ xóa tệp trong `mo-hinh-ai` thì **không** gỡ được (mô hình đã lắp được giữ nguyên);
ngược lại, nếu `mo-hinh-ai` còn tệp của nhân vật vừa gỡ thì xóa luôn, kẻo lần chạy sau lắp lại.

## 4. Tinh chỉnh (không bắt buộc)

Nếu nhân vật quá to/nhỏ, quay lưng lại, hay màu bị lạ: mở **`mo-hinh-ai\cau-hinh.json`** bằng Notepad (chưa có thì
đổi tên `cau-hinh.mau.json` thành `cau-hinh.json`) rồi sửa, chỉ ghi những nhân vật cần chỉnh, rồi chạy lại
`CapNhatMoHinh.bat` (không cần tệp gốc – nhân vật đã lắp vẫn nhận cài đặt mới):

```json
{
  "gau": { "chieu-cao": 1.9, "xoay": 0, "vat-lieu": "mem", "nguon": "Tencent HY 3D (hy3d.tencent.ai)" },
  "tho": { "chieu-cao": 1.35 }
}
```

| Mục | Ý nghĩa |
|---|---|
| `chieu-cao` | Chiều cao trong game (mét). Bỏ trống = bằng nhân vật có sẵn. |
| `xoay` | Xoay thêm (độ) nếu nhân vật quay lưng/quay ngang: thử `180`, `90`, `-90`. |
| `vat-lieu` | `mem` (mặc định – mịn, không bóng, hợp phong cách pastel), `hoat-hinh` (tô bóng kiểu hoạt hình), `goc` (giữ nguyên vật liệu gốc). |
| `nang-len` / `ha-xuong` | Nâng/hạ nhân vật (mét) nếu bị lơ lửng hoặc lún. |
| `toc-do-di`, `toc-do-chay` | Tốc độ phát động tác đi/chạy (1 = bình thường; 1.3 = nhanh hơn). |
| `an` | Ẩn bớt chi tiết theo tên lưới, vd. `["Sword"]`. |
| `dong-tac` | Chỉ rõ động tác nào dùng vào việc gì khi trò chơi nhận nhầm (tên các động tác được in ra lúc chạy công cụ), vd. `{ "vui": "FunnyDancing_01", "dung": "Idle_02" }`. Tên việc: `dung`, `di`, `chay`, `nhay`, `vay-tay`, `noi`, `vui`, `ngoi`, `an`. |
| `nguon` | Nguồn & giấy phép – ghi vào bảng ghi công. |

Lưu ý: tệp JSON dùng dấu ngoặc kép `"`, các mục cách nhau bằng dấu phẩy, không có dấu phẩy sau mục cuối.

## 5. Lỗi thường gặp

| Thông báo | Cách sửa |
|---|---|
| *không nhận ra nhân vật* | Đổi tên tệp theo bảng ở mục 2 (vd. `gau.glb`). |
| *game chỉ dùng định dạng GLB* | Tải lại ở dạng `.glb` (không dùng `.fbx`, `.obj`); nếu là `.zip` thì giải nén. |
| *chưa có khung xương* | Bình thường (HY 3D không có khung xương) – trò chơi tự cho nhân vật nhún nhảy. Muốn cử động thật: gắn xương (Meshy Rig/Animate, HY 3D Auto-Rigging – tốn điểm) rồi tải lại. Không bắt buộc. |
| *không có tệp gốc trong mo-hinh-ai – giữ nguyên mô hình đã lắp* | Bình thường – nhân vật đã lắp được giữ. Muốn gỡ: `--go <tên>` (mục 3). |
| *tệp không có động tác nào* | Khi tải tệp động tác, chọn kèm Animation. |
| Nhân vật quay lưng | `"xoay": 180` trong `cau-hinh.json`. |
| Nhân vật quá to/nhỏ | `"chieu-cao": ...` trong `cau-hinh.json`. |
| *Chưa có Node.js* | Cài Node.js bản LTS từ <https://nodejs.org>, rồi chạy lại. |

## 6. Bản quyền & ghi công

- Mô hình tạo bằng **gói miễn phí** của các trang AI thường kèm điều kiện **ghi công** (vd. Meshy: CC BY 4.0) – hãy
  đọc điều khoản của trang và ghi nguồn vào mục `"nguon"` (vd. `"Tencent HY 3D (hy3d.tencent.ai)"`,
  `"Meshy.ai – CC BY 4.0"`).
- Bảng ghi công tự động: `src\assets\models\ai\GHI-CONG.md`.
- Trong trò chơi, mục **⚙️ Cài đặt** tự hiện dòng ghi công (vd. *🧸 Mô hình nhân vật 3D: Tencent HY 3D
  (hy3d.tencent.ai)*) khi có mô hình AI – đủ điều kiện ghi công kiểu CC BY.
- Tệp gốc tải về để trong `mo-hinh-ai` (không đưa vào kho mã); trò chơi chỉ dùng bản đã tối ưu.

# Hướng dẫn thay nhân vật bằng mô hình AI

Trò chơi đã có sẵn đầy đủ nhân vật (dựng bằng code, phong cách pastel). Thầy cô có thể **thay bất kỳ nhân vật nào**
bằng mô hình 3D tạo bằng AI (Meshy, Tripo...) mà **không cần lập trình**:

1. Tạo mô hình trên trang web AI → tải về dạng **.glb**.
2. Chép tệp vào thư mục **`mo-hinh-ai`**, đặt tên theo nhân vật (vd. `gau.glb`, `gau-di.glb`).
3. Nhấp đúp **`CapNhatMoHinh.bat`** → chọn **C** để đóng gói lại → mở `ban-phat-hanh\VuongQuocToanHoc.html`.

> Lần đầu chạy, máy cần có **Node.js** (bản LTS tại <https://nodejs.org>) và Internet để cài thư viện (1–3 phút).
> Những lần sau không cần Internet.

---

## 1. Tạo mô hình trên Meshy.ai (gợi ý)

> 📋 **Câu lệnh soạn sẵn cho từng nhân vật** (đồng bộ phong cách, chỉ việc sao chép), bảng chi phí điểm, thứ tự nên làm
> và danh sách tệp cần tải: xem **[CAU-LENH-TAO-NHAN-VAT.md](CAU-LENH-TAO-NHAN-VAT.md)**.

1. Vào <https://www.meshy.ai>, đăng nhập. Gói miễn phí: 100 điểm/tháng ≈ 4–5 nhân vật có màu; **chỉ tải về được mô hình
   làm bằng Meshy 6 Lite**, tối đa 10 lần/tháng.
2. Cột trái bấm **Mô hình** (*Model*) → đầu khung có 3 biểu tượng không có chữ: biểu tượng **thứ ba** là
   **Văn Bản thành 3D** (*Text to 3D*, dán câu lệnh); biểu tượng **thứ nhất** là **Hình ảnh thành 3D** (*Image to 3D*,
   ảnh nhân vật nền trơn, nhìn thẳng). **Mô hình AI: đổi sang Meshy 6 Lite** (Meshy để sẵn Meshy 6 – gói miễn phí không
   tải về được). Chọn tư thế **A** (A-pose) nếu được.
3. Chọn bản nháp ưng ý → **Tạo Kết Cấu: Có** (*With Texture*) để nhân vật có màu.
4. **Remesh** (giảm đa giác) là tính năng trả phí – không bắt buộc: `CapNhatMoHinh.bat` tự giảm đa giác khi mô hình
   quá nặng. (Meshy chỉ từ chối gắn xương khi mô hình quá 300.000 mặt.)
5. **Rigging** (gắn khung xương) – Meshy tặng sẵn động tác *Walking* (đi) và *Running* (chạy).
   Sau đó vào **Animate** chọn thêm: *Idle* (đứng), *Wave* (vẫy tay), *Talk* (nói), *Dance/Cheer* (vui mừng)...
   (gói miễn phí chỉ có khoảng 20 động tác cơ bản – động tác có ổ khóa là của gói trả phí).
6. **Download → định dạng GLB**:
   - Chọn **Tất cả đã được thêm vào** (*All Added*): **một tệp** chứa mọi động tác, đặt tên `gau.glb` – trò chơi tự nhận
     động tác theo tên (Idle, Walking, Running…). Cách này chỉ tốn 1 lượt tải.
   - Hoặc tải mỗi động tác một tệp riêng: `gau.glb` (đứng yên), `gau-di.glb`, `gau-chay.glb`, `gau-vay-tay.glb`...

Tripo3D (<https://www.tripo3d.ai>) và các trang tương tự làm tương tự: tạo → (rig/animate) → tải **GLB**.

> Con vật 4 chân (hươu, khỉ, voi...): Meshy gắn xương được nhưng ít động tác phù hợp. Không gắn xương cũng không sao:
> mô hình vẫn dùng được, trò chơi tự cho nhân vật nhún nhảy, lắc lư, "thở" cho sinh động.

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
- **tối ưu**: thu nhỏ ảnh (WebP 1024 px), nén lưới, tự giảm đa giác nếu mô hình quá nặng (> 60.000 tam giác);
- tệp động tác chỉ giữ phần chuyển động (nhẹ hơn nhiều);
- chép kết quả vào `src\assets\models\ai\` và tạo bảng ghi công `GHI-CONG.md`;
- hỏi có **đóng gói lại** trò chơi không → chọn **C**.

Đọc thông báo: dòng **✔** là thành công, **⚠** là lưu ý (vd. mô hình chưa có khung xương), **✖** là lỗi cần sửa.

Tùy chọn nâng cao (gõ trong cửa sổ lệnh): `CapNhatMoHinh.bat --anh 2048` (ảnh nét hơn),
`--giam 0.5` (giảm số tam giác còn 50%), `--xem` (chỉ kiểm tra, không ghi tệp).

**Gỡ một mô hình AI**: xóa tệp của nhân vật đó trong `mo-hinh-ai` rồi chạy lại `CapNhatMoHinh.bat` –
trò chơi tự quay về nhân vật có sẵn.

## 4. Tinh chỉnh (không bắt buộc)

Nếu nhân vật quá to/nhỏ, quay lưng lại, hay màu bị lạ: đổi tên `mo-hinh-ai\cau-hinh.mau.json` thành
**`cau-hinh.json`** rồi sửa (mở bằng Notepad), chỉ ghi những nhân vật cần chỉnh:

```json
{
  "gau": { "chieu-cao": 2.0, "xoay": 180, "vat-lieu": "mem", "nguon": "Meshy.ai – CC BY 4.0" },
  "tho": { "chieu-cao": 1.35 }
}
```

| Mục | Ý nghĩa |
|---|---|
| `chieu-cao` | Chiều cao trong game (mét). Bỏ trống = bằng nhân vật có sẵn. |
| `xoay` | Xoay thêm (độ) nếu nhân vật quay lưng/quay ngang: thử `180`, `90`, `-90`. |
| `vat-lieu` | `mem` (mặc định, hợp phong cách pastel), `hoat-hinh` (tô bóng kiểu hoạt hình), `goc` (giữ nguyên). |
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
| *CHƯA có khung xương* | Vào Meshy → Animate/Rig rồi tải lại; hoặc để nguyên (nhân vật chỉ nhún nhảy). |
| *tệp không có động tác nào* | Khi tải tệp động tác, chọn kèm Animation. |
| Nhân vật quay lưng | `"xoay": 180` trong `cau-hinh.json`. |
| Nhân vật quá to/nhỏ | `"chieu-cao": ...` trong `cau-hinh.json`. |
| *Chưa có Node.js* | Cài Node.js bản LTS từ <https://nodejs.org>, rồi chạy lại. |

## 6. Bản quyền & ghi công

- Mô hình tạo bằng **gói miễn phí** của các trang AI thường kèm giấy phép yêu cầu **ghi công**
  (ví dụ CC BY 4.0) – hãy đọc điều khoản của trang và ghi nguồn vào mục `"nguon"`.
- Bảng ghi công tự động: `src\assets\models\ai\GHI-CONG.md`.
- Trong trò chơi, mục **⚙️ Cài đặt** tự hiện dòng ghi công (vd. *🧸 Mô hình nhân vật 3D: Meshy.ai – CC BY 4.0*)
  khi có mô hình AI – đủ điều kiện ghi công của CC BY.
- Tệp gốc tải về để trong `mo-hinh-ai` (không đưa vào kho mã); trò chơi chỉ dùng bản đã tối ưu.

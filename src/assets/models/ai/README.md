# Mô hình AI (tự động)

Thư mục này do công cụ `tools/xu-ly-mo-hinh.mjs` (nhấp đúp `CapNhatMoHinh.bat`) tạo ra từ các tệp trong `mo-hinh-ai/`.
Đừng chép tay vào đây – xem hướng dẫn `HUONG-DAN-MO-HINH-AI.md` ở thư mục gốc.

- `<khóa>.glb` – mô hình chính (vd. `npc_bear.glb`)
- `<khóa>@<động tác>.glb` – tệp chỉ chứa chuyển động (vd. `npc_bear@walk.glb`)
- `player_trai.glb`, `player_gai.glb` – bé trai, bé gái (nhân vật chính) mặc **Đồ thường ngày**; từ `be-trai.glb`,
  `be-gai.glb`
- `player_<bé>__<bộ đồ>.glb` – một bộ đồ của bé (vd. `player_trai__the_thao.glb` từ `be-trai-the-thao.glb`)
- `config.json` – cài đặt từng mô hình (chiều cao, hướng xoay, vật liệu, ghi công, bộ đồ trong cửa hàng). Công cụ
  **ghi lại tệp này mỗi lần chạy** từ `mo-hinh-ai/cau-hinh.json` – đừng sửa tay, hãy sửa `cau-hinh.json`
- `GHI-CONG.md` – nguồn gốc / giấy phép các mô hình

Mỗi lần chạy, công cụ chỉ làm lại nhân vật có tệp gốc trong `mo-hinh-ai/`; nhân vật đã lắp mà không có tệp gốc
(vd. lắp trên máy khác) được giữ nguyên. Gỡ một nhân vật: `CapNhatMoHinh.bat --go gau`.

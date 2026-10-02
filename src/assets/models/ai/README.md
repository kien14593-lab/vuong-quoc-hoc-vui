# Mô hình AI (tự động)

Thư mục này do công cụ `tools/xu-ly-mo-hinh.mjs` (nhấp đúp `CapNhatMoHinh.bat`) tạo ra từ các tệp trong `mo-hinh-ai/`.
Đừng chép tay vào đây – xem hướng dẫn `HUONG-DAN-MO-HINH-AI.md` ở thư mục gốc.

- `<khóa>.glb` – mô hình chính (vd. `npc_bear.glb`)
- `<khóa>@<động tác>.glb` – tệp chỉ chứa chuyển động (vd. `npc_bear@walk.glb`)
- `config.json` – tinh chỉnh (chiều cao, hướng xoay, vật liệu, ghi công)
- `GHI-CONG.md` – nguồn gốc / giấy phép các mô hình

Mỗi lần chạy, công cụ chỉ làm lại nhân vật có tệp gốc trong `mo-hinh-ai/`; nhân vật đã lắp mà không có tệp gốc
(vd. lắp trên máy khác) được giữ nguyên. Gỡ một nhân vật: `CapNhatMoHinh.bat --go gau`.

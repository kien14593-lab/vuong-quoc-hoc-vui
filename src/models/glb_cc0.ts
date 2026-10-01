/**
 * Mô hình CC0 (Quaternius, Kenney, KayKit, Poly Pizza...) thay cho mô hình dựng bằng code, cùng khóa.
 *  - Tệp gốc tải về: asset-src/  (không đưa vào game)
 *  - Tệp đã tối ưu:  src/assets/models/cc0/<bộ>/<tên>.glb
 *  - Ghi công:       src/assets/models/CREDITS.md
 *
 * Đã thử (10/2026): RobotExpressive (three.js), Quaternius Cute Animated Monsters / Ultimate Animated Animals,
 * KayKit Adventurers. So sánh cạnh nhau trong thư viện xem thử, các mô hình dựng bằng code hiện tại dễ thương và
 * hợp phong cách pastel hơn → chưa thay mô hình nào. Nhân vật chính sẽ được thay bằng mô hình AI (xem glb_ai.ts,
 * HUONG-DAN-MO-HINH-AI.md).
 *
 * Cách thêm:
 *   import foxUrl from '../assets/models/cc0/quaternius/fox.glb?url';
 *   cc0('pet_fox', { src: foxUrl, kind: 'quad', credit: 'Fox – Quaternius Ultimate Animated Animals, CC0' });
 * Tối ưu tệp: npx gltf-transform optimize IN.glb OUT.glb --compress meshopt --texture-compress webp --texture-size 512
 *             --join false --flatten false --instance false --palette false --simplify false
 */
import { defineGlbModel } from './glb';

export const CC0_MODELS: string[] = [];

/** Khai báo + ghi lại khóa (để thống kê). */
export function cc0(key: string, spec: Parameters<typeof defineGlbModel>[1]): void {
  CC0_MODELS.push(key);
  defineGlbModel(key, { source: 'cc0', ...spec });
}

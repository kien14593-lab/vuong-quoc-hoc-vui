import type { ZoneId } from '../core/state';
import type { MiniResult } from '../minigames/base';

/**
 * Cầu nối điều hướng giữa khu vực ↔ ứng dụng (tránh vòng lặp import).
 * `game/app.ts` gán các hàm thật khi khởi động.
 */
export const nav = {
  /** Chuyển sang khu vực khác (có hiệu ứng mờ dần). */
  go(_to: ZoneId, _spawn?: string): void {},
  /** Chơi một mini-game rồi quay lại khu vực hiện tại. Trả về kết quả (null nếu thoát giữa chừng). */
  mini(_id: string): Promise<MiniResult | null> {
    return Promise.resolve(null);
  },
  /** Lưu (nếu còn hồ sơ đang chơi) rồi về màn hình tiêu đề. */
  title(): void {},
};

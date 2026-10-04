import type { Grade } from '../math/types';

/**
 * So sánh khi nhập tệp sao lưu trùng hồ sơ đã có trên máy (bảng "Trên máy này" / "Trong tệp").
 * Chỉ tính toán và tạo chữ – không đụng tới bộ nhớ hay giao diện.
 */

/** Một bên của bảng so sánh. */
export interface ImportSide {
  name: string;
  grade: Grade;
  stars: number;
  level: number;
  /** Lần chơi cuối; null = không rõ (tệp xuất từ bản rất cũ không ghi ngày). */
  lastPlayed: number | null;
}

export interface ImportCompare {
  file: ImportSide;
  /** Bản cùng hồ sơ đang có trên máy; null = hồ sơ mới, nhập luôn không cần hỏi. */
  device: ImportSide | null;
  /** Hồ sơ này đang được chơi. */
  playing: boolean;
  /** Tệp cũ hơn bản trên máy – nhập sẽ mất tiến trình mới hơn. */
  older: boolean;
}

export interface ImportRow {
  label: string;
  device: string;
  file: string;
  differs: boolean;
}

export const UNKNOWN_DATE = 'không rõ ngày';
export const OLDER_WARNING = 'Tệp này cũ hơn bản trên máy — nhập sẽ mất tiến trình mới hơn.';

/** Thời điểm hợp lệ (số mili giây > 0) hoặc null. */
export function playedAt(t: unknown): number | null {
  return typeof t === 'number' && Number.isFinite(t) && t > 0 ? t : null;
}

/** Ngày giờ kiểu dd/mm/yyyy HH:mm theo giờ của máy; không có → "không rõ ngày". */
export function formatPlayed(t: number | null): string {
  if (t === null) return UNKNOWN_DATE;
  const d = new Date(t);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** Tệp cũ hơn bản trên máy? So theo phút – đúng như giờ hiện trong bảng. Thiếu ngày ở một bên → không cảnh báo. */
export function isOlder(file: number | null, device: number | null): boolean {
  return file !== null && device !== null && Math.floor(file / 60000) < Math.floor(device / 60000);
}

/** Lời hỏi, các dòng của bảng so sánh và lời cảnh báo (nếu tệp cũ hơn). */
export function importSummary(c: ImportCompare & { device: ImportSide }): { text: string; rows: ImportRow[]; warning: string | null } {
  const { device, file } = c;
  const text = c.playing
    ? `Hồ sơ của ${device.name} đang được chơi. Nhập tệp sẽ thay toàn bộ tiến trình hiện tại bằng bản trong tệp, rồi game về màn hình chính để tải lại hồ sơ.`
    : `Máy này đã có hồ sơ của ${device.name}. Nhập tệp sẽ thay toàn bộ tiến trình trên máy bằng bản trong tệp.`;
  const row = (label: string, a: string, b: string): ImportRow => ({ label, device: a, file: b, differs: a !== b });
  return {
    text,
    rows: [
      row('Tên', device.name, file.name),
      row('Lớp', String(device.grade), String(file.grade)),
      row('⭐ Ngôi sao', String(device.stars), String(file.stars)),
      row('Cấp', String(device.level), String(file.level)),
      row('Chơi lần cuối', formatPlayed(device.lastPlayed), formatPlayed(file.lastPlayed)),
    ],
    warning: c.older ? OLDER_WARNING : null,
  };
}

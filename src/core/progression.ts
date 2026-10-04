import type { Subject, SubjectMode } from '../math/types';

/** Cấp độ, kinh nghiệm, phần thưởng câu hỏi và huy hiệu. */

/** Số câu đúng ngay lần đầu cho huy hiệu Đôi Tai Vàng / Bậc Thầy Đánh Vần. */
export const EN_BADGE_GOAL = 20;

export interface LevelDef {
  level: number;
  xp: number;
  title: string;
  unlocks: string[];
}

/** Danh hiệu dùng chung cho mọi môn (bé học Toán, Tiếng Anh hay cả hai đều thấy cùng tên). */
export const LEVELS: LevelDef[] = [
  { level: 1, xp: 0, title: 'Bạn nhỏ ham học', unlocks: ['Ngôi Làng Khởi Đầu', 'Rừng Thông Thái', 'Mê Cung Kỳ Bí'] },
  { level: 2, xp: 100, title: 'Nhà thám hiểm', unlocks: ['Ván trượt, mèo mướp, thỏ trắng', 'Áo hoodie, tai thỏ, ủng vàng', 'Mini-game: Câu cá số, Tàu hỏa, Siêu thị'] },
  { level: 3, xp: 250, title: 'Thợ săn kiến thức', unlocks: ['Lâu Đài Trí Tuệ', 'Gấu trúc, cáo nhỏ', 'Mũ thám hiểm, áo choàng siêu nhân', 'Mini-game: Đồng hồ bí ẩn, Xây nhà, Chia bánh'] },
  { level: 4, xp: 450, title: 'Phù thủy thông thái', unlocks: ['Chim cánh cụt', 'Mũ và áo phù thủy, áo cầu vồng', 'Hạt cây phép thuật, đàn piano'] },
  { level: 5, xp: 750, title: 'Bậc thầy Trí Tuệ', unlocks: ['Khủng long tí hon', 'Giày tên lửa', 'Danh hiệu Bậc thầy Trí Tuệ'] },
];

export const MAX_LEVEL = LEVELS[LEVELS.length - 1].level;

export function levelFromXp(xp: number): number {
  let lv = 1;
  for (const l of LEVELS) if (xp >= l.xp) lv = l.level;
  return lv;
}

export function levelDef(level: number): LevelDef {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level - 1))];
}

export function levelProgress(xp: number): { level: number; cur: number; need: number; pct: number; max: boolean } {
  const level = levelFromXp(xp);
  if (level >= MAX_LEVEL) return { level, cur: xp - levelDef(level).xp, need: 0, pct: 1, max: true };
  const base = levelDef(level).xp;
  const next = levelDef(level + 1).xp;
  return { level, cur: xp - base, need: next - base, pct: (xp - base) / (next - base), max: false };
}

/** XP theo số lần thử (kịch bản: khuyến khích, không phạt). */
export function xpForAttempts(attempts: number): number {
  return attempts <= 1 ? 10 : attempts === 2 ? 6 : attempts === 3 ? 4 : 2;
}

export function coinsForAttempts(attempts: number): number {
  return attempts <= 1 ? 3 : 1;
}

export interface BadgeDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
  /** Huy hiệu của riêng một môn: chỉ hiện trong danh sách khi bé học môn đó (hoặc đã nhận rồi). */
  subject?: Subject;
}

/** Mã huy hiệu (id) không bao giờ đổi: huy hiệu đã nhận vẫn còn và hiện tên mới. */
export const BADGES: BadgeDef[] = [
  { id: 'cong-sieu-toc', name: 'Cộng Siêu Tốc', icon: '⚡', color: '#ffb703', desc: 'Đạt 3 sao trong trò Bắn đáp án (Toán).', subject: 'math' },
  { id: 'tu-vung-sieu-toc', name: 'Từ Vựng Siêu Tốc', icon: '⚡', color: '#ffd60a', desc: 'Đạt 3 sao trong trò Bắn từ (Tiếng Anh).', subject: 'english' },
  { id: 'vua-me-cung', name: 'Vua Mê Cung', icon: '🌀', color: '#8e7dff', desc: 'Thoát khỏi Mê Cung Kỳ Bí.' },
  { id: 'bang-nhan', name: 'Bảng Nhân', icon: '✖️', color: '#ff7aa2', desc: 'Vượt qua Phòng Bảng Nhân trong Lâu Đài (Toán).', subject: 'math' },
  { id: 'nha-ngon-ngu-nhi', name: 'Nhà Ngôn Ngữ Nhí', icon: '🔤', color: '#7bdff2', desc: 'Vượt qua Phòng Từ Vựng trong Lâu Đài (Tiếng Anh).', subject: 'english' },
  { id: 'nha-toan-hoc', name: 'Nhà Thông Thái', icon: '👑', color: '#ffd166', desc: 'Hoàn thành thử thách của Nhà Vua.' },
  { id: 'nha-tham-hiem', name: 'Nhà Thám Hiểm Vương Quốc', icon: '🧭', color: '#52b788', desc: 'Giúp chú Gấu đến sở thú.' },
  { id: 'doi-tai-vang', name: 'Đôi Tai Vàng', icon: '👂', color: '#f9c74f', desc: `Nghe và chọn đúng ngay lần đầu ${EN_BADGE_GOAL} câu tiếng Anh.`, subject: 'english' },
  { id: 'bac-thay-danh-van', name: 'Bậc Thầy Đánh Vần', icon: '✏️', color: '#b5e48c', desc: `Đánh vần, nhận chữ cái đúng ngay lần đầu ${EN_BADGE_GOAL} câu.`, subject: 'english' },
  { id: 'ngoi-sao-lang', name: 'Ngôi Sao Của Làng', icon: '⭐', color: '#ffc8dd', desc: 'Tìm đủ 5 ngôi sao giúp Thỏ Bông.' },
  { id: 'ban-muong-thu', name: 'Bạn Của Muông Thú', icon: '🦒', color: '#f4a261', desc: 'Chăm sóc hươu, khỉ và chim cánh cụt.' },
  { id: 'vua-tro-choi', name: 'Vua Trò Chơi', icon: '🎡', color: '#4cc9f0', desc: 'Nhận đủ 4 vé ở Khu Vui Chơi.' },
  { id: 'hiep-si', name: 'Hiệp Sĩ Lâu Đài', icon: '🛡️', color: '#90caf9', desc: 'Vượt qua cả ba phòng thử thách của Lâu Đài.' },
  { id: 'nha-lam-vuon', name: 'Nhà Làm Vườn', icon: '🌻', color: '#95d5b2', desc: 'Thu hoạch cây trồng đầu tiên.' },
  { id: 'nguoi-mua-sam', name: 'Người Mua Sắm Giỏi', icon: '🛍️', color: '#ffafcc', desc: 'Mua món đồ đầu tiên ở cửa hàng.' },
  { id: 'cham-chi', name: 'Chăm Chỉ', icon: '📅', color: '#a0c4ff', desc: 'Học và chơi trong 3 ngày khác nhau.' },
  { id: 'tram-cau', name: 'Trăm Câu Hỏi', icon: '💯', color: '#ff99c8', desc: 'Trả lời 100 câu hỏi.' },
  { id: 'tram-tu', name: 'Trăm Từ Tiếng Anh', icon: '💯', color: '#cdb4db', desc: 'Trả lời 100 câu hỏi tiếng Anh.', subject: 'english' },
  { id: 'nha-vo-dich', name: 'Nhà Vô Địch Mini-game', icon: '🎮', color: '#b8f2e6', desc: 'Chơi 6 mini-game khác nhau.' },
];

export function badgeDef(id: string): BadgeDef | undefined {
  return BADGES.find((b) => b.id === id);
}

/** Huy hiệu hiện trong danh sách: huy hiệu chung, huy hiệu của môn bé đang học, hoặc huy hiệu bé đã nhận. */
export function badgeVisible(b: BadgeDef, mode: SubjectMode, earned: boolean): boolean {
  return earned || !b.subject || mode === 'both' || mode === b.subject;
}

import { canListen } from '../core/speech';
import { profile } from '../core/state';
import type { EnTopic, Grade, Subject } from '../math/types';
import { castleRooms, type CastleSlot } from './subject';

/**
 * Ba phòng thử thách của Lâu Đài Trí Tuệ. Vị trí, màu và cờ hoàn thành (castle.mul / frac / geo) giữ nguyên;
 * tên, biểu tượng và kĩ năng đổi theo môn của từng phòng.
 */
export type RoomId = CastleSlot;
export const ROOM_IDS: RoomId[] = ['mul', 'frac', 'geo'];

export interface RoomLook {
  title: string;
  short: string;
  icon: string;
  /** Ký hiệu trên huy hiệu tường, huy hiệu sàn và biển tên. */
  symbol: string;
  /** Ký hiệu trên lá cờ (lá cờ hẹp: tối đa 2 ký tự). */
  bannerSym: string;
  /** Kĩ năng của phòng Tiếng Anh (phòng Toán: rỗng). */
  en: EnTopic[];
}

export interface RoomCfg extends RoomLook {
  id: RoomId;
  flag: `castle.${RoomId}`;
  subject: Subject;
  color: string;
  x: number;
  z: number;
}

const PLACES: Record<RoomId, { color: string; x: number; z: number }> = {
  mul: { color: '#c7b3ff', x: -18, z: 5.2 },
  frac: { color: '#8fd3ff', x: 18, z: 5.2 },
  geo: { color: '#9be09b', x: -18, z: -8.2 },
};

export const MATH_ROOMS: Record<RoomId, RoomLook> = {
  mul: { title: 'Phòng Bảng Nhân', short: 'Bảng Nhân', icon: '✖️', symbol: '×', bannerSym: '×', en: [] },
  frac: { title: 'Phòng Phân Số', short: 'Phân Số', icon: '½', symbol: '½', bannerSym: '½', en: [] },
  geo: { title: 'Phòng Hình Học', short: 'Hình Học', icon: '△', symbol: '△', bannerSym: '△', en: [] },
};

/**
 * Phòng Tiếng Anh: Từ Vựng; Lắng Nghe (máy không có giọng tiếng Anh: Ghép Hình cho Lớp 1–2, Đánh Vần cho
 * Lớp 3–5); Chữ Cái (Lớp 1–2) hoặc Mẫu Câu (Lớp 3–5).
 */
export function englishRoom(id: RoomId, grade: Grade, listen: boolean): RoomLook {
  const small = grade <= 2;
  if (id === 'mul') return { title: 'Phòng Từ Vựng', short: 'Từ Vựng', icon: '🔤', symbol: 'Aa', bannerSym: 'Aa', en: ['en_vocab'] };
  if (id === 'frac') {
    if (listen) return { title: 'Phòng Lắng Nghe', short: 'Lắng Nghe', icon: '👂', symbol: '👂', bannerSym: '👂', en: ['en_listen'] };
    if (small) return { title: 'Phòng Ghép Hình', short: 'Ghép Hình', icon: '🧩', symbol: '🧩', bannerSym: '🧩', en: ['en_vocab'] };
    return { title: 'Phòng Đánh Vần', short: 'Đánh Vần', icon: '✏️', symbol: 'ABC', bannerSym: '✏️', en: ['en_spell'] };
  }
  if (small) return { title: 'Phòng Chữ Cái', short: 'Chữ Cái', icon: '🔠', symbol: 'abc', bannerSym: 'ab', en: ['en_phonics'] };
  return { title: 'Phòng Mẫu Câu', short: 'Mẫu Câu', icon: '💬', symbol: '💬', bannerSym: '💬', en: ['en_sentence'] };
}

/** Cấu hình ba phòng theo môn của từng phòng (phòng Toán: đúng như bản chỉ có Toán). */
export function roomConfigs(subjects: Record<RoomId, Subject>, grade: Grade, listen: boolean): Record<RoomId, RoomCfg> {
  const out = {} as Record<RoomId, RoomCfg>;
  for (const id of ROOM_IDS) {
    const s = subjects[id];
    const look = s === 'math' ? MATH_ROOMS[id] : englishRoom(id, grade, listen);
    out[id] = { ...look, id, flag: `castle.${id}`, subject: s, ...PLACES[id] };
  }
  return out;
}

/** Ba phòng của hồ sơ đang chơi ("Cả hai": chia 2 + 1, lưu theo hồ sơ). */
export function currentRooms(): Record<RoomId, RoomCfg> {
  return roomConfigs(castleRooms(), profile().grade, canListen());
}

/** "Bảng Nhân, Phân Số và Hình Học" – tên ngắn của ba phòng cho lời thoại. */
export function roomList(rooms: Record<RoomId, RoomCfg>): string {
  const names = ROOM_IDS.map((id) => rooms[id].short);
  return `${names[0]}, ${names[1]} và ${names[2]}`;
}

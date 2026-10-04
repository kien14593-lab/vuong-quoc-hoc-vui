/**
 * Giọng đọc riêng của từng nhân vật (thuần, kiểm thử được).
 *
 * Khóa là mã ổn định, không dùng tên hiển thị: khóa CAST (tho, gau…), dân làng v0…v5 (theo thứ tự VILLAGERS
 * trong game/cast.ts) và 'kid' (người chơi).
 * - base 'nu': giọng dẫn chuyện (giọng bé chọn trong Cài đặt, không thì giọng tiếng Việt tốt nhất, ví dụ Hoài My).
 * - base 'nam': giọng nam (Nam Minh, Microsoft An…); máy không có giọng nam thì dùng giọng dẫn chuyện đọc trầm hơn.
 * - rate nhân với tốc độ đọc trong Cài đặt; pitch là cao độ (1 = bình thường).
 */
export type VoiceBase = 'nu' | 'nam';

export interface VoiceProfile {
  base: VoiceBase;
  rate: number;
  pitch: number;
  /** Ưu tiên giọng có tên / voiceURI khớp mẫu này nếu máy có (dành cho sau này – chưa nhân vật nào dùng). */
  prefer?: RegExp;
}

/** Giọng dẫn chuyện: câu hỏi, lời khen, gợi ý, mini-game, biển báo và người nói không có giọng riêng. */
export const NARRATOR: VoiceProfile = { base: 'nu', rate: 0.95, pitch: 1 };

export const VOICE_PROFILES: Readonly<Record<string, VoiceProfile>> = {
  tho: { base: 'nu', rate: 1.0, pitch: 1.08 }, // Thỏ Bông
  meo: { base: 'nu', rate: 0.97, pitch: 1.04 }, // Cô Mèo
  soc: { base: 'nu', rate: 1.08, pitch: 1.1 }, // Cô Sóc
  nai: { base: 'nu', rate: 1.0, pitch: 1.1 }, // Bạn Nai
  v0: { base: 'nu', rate: 1.12, pitch: 1.15 }, // Bé Na
  v2: { base: 'nu', rate: 1.03, pitch: 1.05 }, // Chị Mai
  v3: { base: 'nu', rate: 1.12, pitch: 1.15 }, // Bé Bin (em bé – giọng nữ cao)
  v4: { base: 'nu', rate: 0.8, pitch: 0.92 }, // Bà Ba
  gau: { base: 'nam', rate: 0.9, pitch: 0.97 }, // Chú Gấu
  cu: { base: 'nam', rate: 0.88, pitch: 0.95 }, // Bác Cú
  robot: { base: 'nam', rate: 1.12, pitch: 1.1 }, // Robot Bíp
  he: { base: 'nam', rate: 1.1, pitch: 1.08 }, // Chú Hề Bibo
  voi: { base: 'nam', rate: 0.88, pitch: 0.92 }, // Bác Voi
  vua: { base: 'nam', rate: 0.85, pitch: 0.88 }, // Nhà Vua
  hiepsi: { base: 'nam', rate: 0.97, pitch: 0.98 }, // Hiệp Sĩ Thỏ
  rua: { base: 'nam', rate: 0.8, pitch: 0.9 }, // Ông Rùa
  v1: { base: 'nam', rate: 1.05, pitch: 1.08 }, // Anh Tí
  v5: { base: 'nam', rate: 0.97, pitch: 0.98 }, // Chú Tư
  kid: { base: 'nu', rate: 1.08, pitch: 1.15 }, // người chơi
};

/**
 * Hồ sơ giọng cho người nói `who`. Không có mã / mã lạ / tắt "Giọng nhân vật" trong Cài đặt → giọng dẫn chuyện.
 */
export function voiceProfile(who: string | null | undefined, charVoices = true): { id: string; profile: VoiceProfile } {
  if (charVoices && who && Object.prototype.hasOwnProperty.call(VOICE_PROFILES, who)) return { id: who, profile: VOICE_PROFILES[who] };
  return { id: 'narrator', profile: NARRATOR };
}

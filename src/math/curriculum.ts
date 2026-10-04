import type { EnTopic, Grade, MathTopic, Subject, Topic } from './types';

export interface TopicInfo {
  name: string;
  icon: string;
  subject: Subject;
  maxLevel: number;
  /** Mức bắt đầu theo lớp 1..5. */
  start: [number, number, number, number, number];
  /** Mức cao nhất theo lớp 1..5 (nếu có; mặc định chỉ giới hạn bởi start + 3). */
  max?: [number, number, number, number, number];
}

const M = 'math' as const;
const E = 'english' as const;

export const TOPICS: Record<Topic, TopicInfo> = {
  count: { name: 'Đếm số', icon: '🔢', subject: M, maxLevel: 5, start: [1, 4, 5, 5, 5] },
  compare: { name: 'So sánh số', icon: '⚖️', subject: M, maxLevel: 6, start: [1, 3, 4, 5, 6] },
  add: { name: 'Phép cộng', icon: '➕', subject: M, maxLevel: 8, start: [1, 5, 7, 8, 8] },
  sub: { name: 'Phép trừ', icon: '➖', subject: M, maxLevel: 8, start: [1, 5, 7, 8, 8] },
  mul: { name: 'Phép nhân', icon: '✖️', subject: M, maxLevel: 7, start: [1, 2, 4, 6, 7] },
  div: { name: 'Phép chia', icon: '➗', subject: M, maxLevel: 7, start: [1, 2, 4, 6, 7] },
  sequence: { name: 'Dãy số', icon: '🚂', subject: M, maxLevel: 5, start: [1, 2, 3, 4, 5] },
  time: { name: 'Thời gian', icon: '🕐', subject: M, maxLevel: 5, start: [1, 2, 3, 4, 5] },
  length: { name: 'Độ dài', icon: '📏', subject: M, maxLevel: 5, start: [1, 2, 3, 4, 5] },
  money: { name: 'Tiền và mua sắm', icon: '💰', subject: M, maxLevel: 5, start: [1, 2, 3, 4, 5] },
  geometry: { name: 'Hình học', icon: '🔷', subject: M, maxLevel: 5, start: [1, 2, 3, 4, 5] },
  perimeter: { name: 'Chu vi', icon: '📐', subject: M, maxLevel: 5, start: [1, 1, 1, 3, 4] },
  area: { name: 'Diện tích', icon: '🟩', subject: M, maxLevel: 5, start: [1, 1, 1, 2, 4] },
  fraction: { name: 'Phân số', icon: '🍕', subject: M, maxLevel: 6, start: [1, 1, 1, 4, 5] },
  decimal: { name: 'Số thập phân', icon: '🔟', subject: M, maxLevel: 6, start: [1, 1, 1, 1, 2] },
  ratio: { name: 'Tỉ số – phần trăm', icon: '⚗️', subject: M, maxLevel: 5, start: [1, 1, 1, 1, 3] },
  word: { name: 'Toán có lời văn', icon: '📖', subject: M, maxLevel: 7, start: [1, 2, 4, 5, 6] },
  en_vocab: { name: 'Từ vựng', icon: '🔤', subject: E, maxLevel: 5, start: [1, 1, 1, 2, 2], max: [3, 4, 4, 5, 5] },
  en_listen: { name: 'Nghe', icon: '👂', subject: E, maxLevel: 4, start: [1, 1, 1, 1, 2], max: [2, 2, 3, 4, 4] },
  en_phonics: { name: 'Chữ cái & âm', icon: '🅰️', subject: E, maxLevel: 3, start: [1, 1, 1, 1, 1], max: [3, 3, 3, 3, 3] },
  en_spell: { name: 'Chính tả', icon: '✏️', subject: E, maxLevel: 5, start: [1, 1, 2, 2, 3], max: [2, 3, 5, 5, 5] },
  en_sentence: { name: 'Mẫu câu', icon: '💬', subject: E, maxLevel: 4, start: [1, 1, 1, 1, 2], max: [1, 1, 4, 4, 4] },
  en_numbers: { name: 'Số đếm', icon: '🔢', subject: E, maxLevel: 4, start: [1, 1, 1, 2, 2], max: [3, 3, 4, 4, 4] },
  en_time: { name: 'Giờ & lịch', icon: '🕒', subject: E, maxLevel: 4, start: [1, 1, 1, 1, 2], max: [1, 1, 1, 4, 4] },
};

/** Mọi chủ đề Toán (thứ tự như bảng TOPICS). */
export const ALL_TOPICS = (Object.keys(TOPICS) as Topic[]).filter((t) => TOPICS[t].subject === 'math') as MathTopic[];
/** Mọi chủ đề Tiếng Anh. */
export const EN_TOPICS = (Object.keys(TOPICS) as Topic[]).filter((t) => TOPICS[t].subject === 'english') as EnTopic[];

export function topicSubject(topic: Topic): Subject {
  return TOPICS[topic].subject;
}

export function isEnTopic(topic: Topic): topic is EnTopic {
  return TOPICS[topic].subject === 'english';
}

export const GRADE_NAMES: Record<Grade, string> = { 1: 'Lớp 1', 2: 'Lớp 2', 3: 'Lớp 3', 4: 'Lớp 4', 5: 'Lớp 5' };

/** Các chủ đề phù hợp với từng lớp (dùng cho thử thách hỗn hợp và bảng theo dõi). */
export const GRADE_TOPICS: Record<Grade, MathTopic[]> = {
  1: ['count', 'compare', 'add', 'sub', 'geometry', 'sequence', 'length', 'time', 'money', 'word'],
  2: ['add', 'sub', 'mul', 'div', 'length', 'time', 'compare', 'sequence', 'money', 'geometry', 'word', 'count'],
  3: ['mul', 'div', 'fraction', 'perimeter', 'area', 'add', 'sub', 'time', 'length', 'money', 'geometry', 'word', 'sequence', 'compare'],
  4: ['fraction', 'decimal', 'ratio', 'geometry', 'area', 'perimeter', 'word', 'mul', 'div', 'add', 'sub', 'compare', 'money', 'time', 'length', 'sequence'],
  5: ['fraction', 'decimal', 'ratio', 'geometry', 'area', 'perimeter', 'word', 'mul', 'div', 'time', 'length', 'money', 'compare'],
};

/** Trọng tâm của Mê Cung Kỳ Bí theo lớp (kịch bản mục 4.3). */
export const MAZE_TOPICS: Record<Grade, MathTopic[]> = {
  1: ['count', 'add', 'sub', 'geometry'],
  2: ['add', 'sub', 'mul', 'div', 'length', 'time'],
  3: ['mul', 'div', 'fraction', 'perimeter', 'area'],
  4: ['fraction', 'decimal', 'ratio', 'geometry', 'area', 'word'],
  5: ['fraction', 'decimal', 'ratio', 'geometry', 'area', 'word'],
};

/**
 * Chủ đề Tiếng Anh theo lớp. Lớp 1–2: làm quen qua hình và âm thanh (không có mẫu câu);
 * từ Lớp 3 (môn bắt buộc theo GDPT 2018) thêm chính tả, mẫu câu; Lớp 4–5 thêm giờ và lịch.
 */
export const EN_GRADE_TOPICS: Record<Grade, EnTopic[]> = {
  1: ['en_vocab', 'en_listen', 'en_phonics', 'en_numbers'],
  2: ['en_vocab', 'en_listen', 'en_phonics', 'en_spell', 'en_numbers'],
  3: ['en_vocab', 'en_listen', 'en_spell', 'en_sentence', 'en_numbers'],
  4: ['en_vocab', 'en_listen', 'en_spell', 'en_sentence', 'en_numbers', 'en_time'],
  5: ['en_vocab', 'en_listen', 'en_spell', 'en_sentence', 'en_numbers', 'en_time'],
};

/** Chủ đề "nền tảng" (số đếm, giờ, lịch) – không thuộc riêng Unit nào. */
export const EN_FOUNDATION: EnTopic[] = ['en_numbers', 'en_time'];

/**
 * Khi thầy cô đặt "Đang học đến Unit N": giữ phần câu hỏi nền tảng (số đếm, giờ, lịch) khoảng `share` (20%)
 * để các Unit đang học chiếm phần lớn. Trả về bảng trọng số mới (không sửa bảng cũ); trọng số tối thiểu 0.05
 * giống pickTopic.
 */
export function capFoundation(
  topics: readonly Topic[],
  weights: Partial<Record<Topic, number>> = {},
  share = 0.2,
): Partial<Record<Topic, number>> {
  const w = (t: Topic) => Math.max(0.05, weights[t] ?? 1);
  const isF = (t: Topic) => (EN_FOUNDATION as Topic[]).includes(t);
  let F = 0;
  let C = 0;
  for (const t of topics) {
    if (isF(t)) F += w(t);
    else C += w(t);
  }
  if (!F || !C || F / (F + C) <= share) return weights;
  const k = ((share / (1 - share)) * C) / F;
  const out: Partial<Record<Topic, number>> = { ...weights };
  for (const t of topics) if (isF(t)) out[t] = w(t) * k;
  return out;
}

export function startLevel(topic: Topic, grade: Grade): number {
  return TOPICS[topic].start[grade - 1];
}

/** Mức cao nhất mà hệ thống thích ứng có thể nâng lên với một lớp. */
export function maxLevelFor(topic: Topic, grade: Grade): number {
  const t = TOPICS[topic];
  return Math.min(t.maxLevel, startLevel(topic, grade) + 3, t.max ? t.max[grade - 1] : Infinity);
}

export function isGradeTopic(topic: Topic, grade: Grade): boolean {
  return isEnTopic(topic) ? EN_GRADE_TOPICS[grade].includes(topic) : GRADE_TOPICS[grade].includes(topic);
}

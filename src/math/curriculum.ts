import type { Grade, Topic } from './types';

export interface TopicInfo {
  name: string;
  icon: string;
  maxLevel: number;
  /** Mức bắt đầu theo lớp 1..5. */
  start: [number, number, number, number, number];
}

export const TOPICS: Record<Topic, TopicInfo> = {
  count: { name: 'Đếm số', icon: '🔢', maxLevel: 5, start: [1, 4, 5, 5, 5] },
  compare: { name: 'So sánh số', icon: '⚖️', maxLevel: 6, start: [1, 3, 4, 5, 6] },
  add: { name: 'Phép cộng', icon: '➕', maxLevel: 8, start: [1, 5, 7, 8, 8] },
  sub: { name: 'Phép trừ', icon: '➖', maxLevel: 8, start: [1, 5, 7, 8, 8] },
  mul: { name: 'Phép nhân', icon: '✖️', maxLevel: 7, start: [1, 2, 4, 6, 7] },
  div: { name: 'Phép chia', icon: '➗', maxLevel: 7, start: [1, 2, 4, 6, 7] },
  sequence: { name: 'Dãy số', icon: '🚂', maxLevel: 5, start: [1, 2, 3, 4, 5] },
  time: { name: 'Thời gian', icon: '🕐', maxLevel: 5, start: [1, 2, 3, 4, 5] },
  length: { name: 'Độ dài', icon: '📏', maxLevel: 5, start: [1, 2, 3, 4, 5] },
  money: { name: 'Tiền và mua sắm', icon: '💰', maxLevel: 5, start: [1, 2, 3, 4, 5] },
  geometry: { name: 'Hình học', icon: '🔷', maxLevel: 5, start: [1, 2, 3, 4, 5] },
  perimeter: { name: 'Chu vi', icon: '📐', maxLevel: 5, start: [1, 1, 1, 3, 4] },
  area: { name: 'Diện tích', icon: '🟩', maxLevel: 5, start: [1, 1, 1, 2, 4] },
  fraction: { name: 'Phân số', icon: '🍕', maxLevel: 6, start: [1, 1, 1, 4, 5] },
  decimal: { name: 'Số thập phân', icon: '🔟', maxLevel: 6, start: [1, 1, 1, 1, 2] },
  ratio: { name: 'Tỉ số – phần trăm', icon: '⚗️', maxLevel: 5, start: [1, 1, 1, 1, 3] },
  word: { name: 'Toán có lời văn', icon: '📖', maxLevel: 7, start: [1, 2, 4, 5, 6] },
};

export const ALL_TOPICS = Object.keys(TOPICS) as Topic[];

export const GRADE_NAMES: Record<Grade, string> = { 1: 'Lớp 1', 2: 'Lớp 2', 3: 'Lớp 3', 4: 'Lớp 4', 5: 'Lớp 5' };

/** Các chủ đề phù hợp với từng lớp (dùng cho thử thách hỗn hợp và bảng theo dõi). */
export const GRADE_TOPICS: Record<Grade, Topic[]> = {
  1: ['count', 'compare', 'add', 'sub', 'geometry', 'sequence', 'length', 'time', 'money', 'word'],
  2: ['add', 'sub', 'mul', 'div', 'length', 'time', 'compare', 'sequence', 'money', 'geometry', 'word', 'count'],
  3: ['mul', 'div', 'fraction', 'perimeter', 'area', 'add', 'sub', 'time', 'length', 'money', 'geometry', 'word', 'sequence', 'compare'],
  4: ['fraction', 'decimal', 'ratio', 'geometry', 'area', 'perimeter', 'word', 'mul', 'div', 'add', 'sub', 'compare', 'money', 'time', 'length', 'sequence'],
  5: ['fraction', 'decimal', 'ratio', 'geometry', 'area', 'perimeter', 'word', 'mul', 'div', 'time', 'length', 'money', 'compare'],
};

/** Trọng tâm của Mê Cung Kỳ Bí theo lớp (kịch bản mục 4.3). */
export const MAZE_TOPICS: Record<Grade, Topic[]> = {
  1: ['count', 'add', 'sub', 'geometry'],
  2: ['add', 'sub', 'mul', 'div', 'length', 'time'],
  3: ['mul', 'div', 'fraction', 'perimeter', 'area'],
  4: ['fraction', 'decimal', 'ratio', 'geometry', 'area', 'word'],
  5: ['fraction', 'decimal', 'ratio', 'geometry', 'area', 'word'],
};

export function startLevel(topic: Topic, grade: Grade): number {
  return TOPICS[topic].start[grade - 1];
}

/** Mức cao nhất mà hệ thống thích ứng có thể nâng lên với một lớp. */
export function maxLevelFor(topic: Topic, grade: Grade): number {
  return Math.min(TOPICS[topic].maxLevel, startLevel(topic, grade) + 3);
}

export function isGradeTopic(topic: Topic, grade: Grade): boolean {
  return GRADE_TOPICS[grade].includes(topic);
}

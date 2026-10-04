import { describe, expect, it } from 'vitest';
import {
  ALL_TOPICS,
  EN_FOUNDATION,
  EN_GRADE_TOPICS,
  EN_TOPICS,
  GRADE_TOPICS,
  MAZE_TOPICS,
  TOPICS,
  isEnTopic,
  isGradeTopic,
  maxLevelFor,
  startLevel,
  topicSubject,
} from '../src/math/curriculum';
import { generate } from '../src/math/engine';
import { ballsQuestion, beatTopic, scripted, usesScripted, type BeatId } from '../src/math/scripted';
import { setMathRng } from '../src/math/util';
import { Rng } from '../src/core/rng';
import type { Grade, MathTopic, Question, Topic } from '../src/math/types';

const GRADES: Grade[] = [1, 2, 3, 4, 5];

/*
 * Bảng chương trình Toán TRƯỚC khi thêm môn Tiếng Anh (chép nguyên văn).
 * Học sinh chọn môn Toán phải thấy trò chơi y như cũ, nên các bảng này không được đổi.
 */
const MATH_BEFORE: Record<MathTopic, { name: string; icon: string; maxLevel: number; start: number[] }> = {
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

const GRADE_TOPICS_BEFORE: Record<Grade, MathTopic[]> = {
  1: ['count', 'compare', 'add', 'sub', 'geometry', 'sequence', 'length', 'time', 'money', 'word'],
  2: ['add', 'sub', 'mul', 'div', 'length', 'time', 'compare', 'sequence', 'money', 'geometry', 'word', 'count'],
  3: ['mul', 'div', 'fraction', 'perimeter', 'area', 'add', 'sub', 'time', 'length', 'money', 'geometry', 'word', 'sequence', 'compare'],
  4: ['fraction', 'decimal', 'ratio', 'geometry', 'area', 'perimeter', 'word', 'mul', 'div', 'add', 'sub', 'compare', 'money', 'time', 'length', 'sequence'],
  5: ['fraction', 'decimal', 'ratio', 'geometry', 'area', 'perimeter', 'word', 'mul', 'div', 'time', 'length', 'money', 'compare'],
};

const MAZE_TOPICS_BEFORE: Record<Grade, MathTopic[]> = {
  1: ['count', 'add', 'sub', 'geometry'],
  2: ['add', 'sub', 'mul', 'div', 'length', 'time'],
  3: ['mul', 'div', 'fraction', 'perimeter', 'area'],
  4: ['fraction', 'decimal', 'ratio', 'geometry', 'area', 'word'],
  5: ['fraction', 'decimal', 'ratio', 'geometry', 'area', 'word'],
};

const BEATS: BeatId[] = [
  'villageBoxes', 'shopFruit', 'forestBridge', 'forestRock', 'bearBridge', 'bearStones', 'mazeDoor',
  'coaster', 'balls', 'wheel', 'giraffe', 'monkey', 'penguins',
];

/** FNV-1a 32 bit. */
function fnv(s: string, h = 0x811c9dc5): number {
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Bỏ `id` (có chứa thời điểm tạo) để cùng hạt giống luôn cho cùng chuỗi. */
const json = (q: Question) => JSON.stringify({ ...q, id: undefined });

/** "Dấu vân tay" của toàn bộ câu hỏi Toán sinh ra từ một hạt giống cố định. */
function mathFingerprint(): string {
  setMathRng(Rng.seeded(20250607));
  let h = 0x811c9dc5;
  for (const topic of Object.keys(MATH_BEFORE) as MathTopic[]) {
    for (let level = 1; level <= MATH_BEFORE[topic].maxLevel; level++) {
      for (const grade of GRADES) {
        for (const support of [false, true]) h = fnv(json(generate(topic, level, { grade, support })), h);
      }
    }
  }
  const theme = { who: 'Khỉ', item: 'quả chuối', unit: 'quả', emoji: '🍌' };
  for (const grade of GRADES) for (let level = 1; level <= 7; level++) h = fnv(json(generate('word', level, { grade, theme })), h);
  for (const beat of BEATS) {
    for (const grade of GRADES) {
      h = fnv(`${beat}:${grade}:${beatTopic(beat, grade)}:${usesScripted(beat, grade)}`, h);
      h = fnv(json(scripted(beat, { grade })), h);
    }
  }
  for (const grade of GRADES) h = fnv(json(ballsQuestion({ grade })), h);
  return h.toString(16);
}

describe('Môn Toán giữ nguyên như trước khi có Tiếng Anh', () => {
  it('bảng chủ đề Toán (tên, biểu tượng, mức) và thứ tự ALL_TOPICS', () => {
    expect(ALL_TOPICS).toEqual(Object.keys(MATH_BEFORE));
    for (const t of ALL_TOPICS) {
      const { name, icon, maxLevel, start } = TOPICS[t];
      expect({ name, icon, maxLevel, start }).toEqual(MATH_BEFORE[t]);
      expect(TOPICS[t].subject).toBe('math');
      expect(TOPICS[t].max).toBeUndefined();
    }
  });

  it('chủ đề theo lớp và trọng tâm Mê Cung', () => {
    expect(GRADE_TOPICS).toEqual(GRADE_TOPICS_BEFORE);
    expect(MAZE_TOPICS).toEqual(MAZE_TOPICS_BEFORE);
  });

  it('mức bắt đầu, mức cao nhất và chủ đề của lớp', () => {
    for (const t of ALL_TOPICS) {
      for (const g of GRADES) {
        const start = MATH_BEFORE[t].start[g - 1];
        expect(startLevel(t, g)).toBe(start);
        expect(maxLevelFor(t, g)).toBe(Math.min(MATH_BEFORE[t].maxLevel, start + 3));
        expect(isGradeTopic(t, g)).toBe(GRADE_TOPICS_BEFORE[g].includes(t));
      }
    }
  });

  it('cùng hạt giống → cùng câu hỏi Toán như trước (dấu vân tay)', () => {
    // Giá trị này được tính từ mã Toán trước khi thêm Tiếng Anh. Nếu cố ý sửa bộ sinh câu hỏi Toán,
    // hãy kiểm tra kĩ rồi cập nhật giá trị mới.
    expect(mathFingerprint()).toBe('90f99ac0');
    expect(mathFingerprint()).toBe(mathFingerprint());
  });
});

describe('Chủ đề Tiếng Anh trong chương trình', () => {
  it('tách bạch hai môn', () => {
    expect(EN_TOPICS.length).toBeGreaterThan(0);
    for (const t of EN_TOPICS) {
      expect(t.startsWith('en_')).toBe(true);
      expect(isEnTopic(t)).toBe(true);
      expect(topicSubject(t)).toBe('english');
    }
    for (const t of ALL_TOPICS) {
      expect(isEnTopic(t)).toBe(false);
      expect(topicSubject(t)).toBe('math');
    }
    expect([...ALL_TOPICS, ...EN_TOPICS].sort()).toEqual((Object.keys(TOPICS) as Topic[]).sort());
  });

  it('chủ đề theo lớp: Lớp 1–2 nghe-nhìn, Lớp 3–5 thêm chính tả và mẫu câu', () => {
    for (const g of GRADES) {
      const list = EN_GRADE_TOPICS[g];
      expect(new Set(list).size).toBe(list.length);
      for (const t of list) expect(EN_TOPICS).toContain(t);
      expect(list).toContain('en_vocab');
      expect(list).toContain('en_listen');
      expect(list.includes('en_phonics')).toBe(g <= 2);
      expect(list.includes('en_sentence')).toBe(g >= 3);
      expect(list.includes('en_spell')).toBe(g >= 2);
      expect(list.includes('en_time')).toBe(g >= 4);
      for (const t of EN_TOPICS) expect(isGradeTopic(t, g)).toBe(list.includes(t));
    }
    for (const t of EN_FOUNDATION) expect(EN_TOPICS).toContain(t);
  });

  it('mức bắt đầu và mức cao nhất hợp lệ', () => {
    for (const t of EN_TOPICS) {
      const info = TOPICS[t];
      expect(info.max).toBeDefined();
      for (const g of GRADES) {
        const lo = startLevel(t, g);
        const hi = maxLevelFor(t, g);
        expect(lo).toBeGreaterThanOrEqual(1);
        expect(hi).toBeGreaterThanOrEqual(lo);
        expect(hi).toBeLessThanOrEqual(info.maxLevel);
        expect(hi).toBeLessThanOrEqual(info.max![g - 1]);
      }
    }
  });
});

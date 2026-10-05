import { describe, expect, it, vi } from 'vitest';
import { AttemptTracker, FEEDBACK, feedbackLine } from '../src/game/challenge';
import type { Question } from '../src/math/types';

vi.mock('../src/core/audio', () => ({ audio: { setDuck: () => {} }, sfx: () => {} }));

/**
 * Phản hồi khi bé chọn sai:
 * - Gợi ý và các bước chỉ hiện MỘT lần – trong bóng nói trợ giúp. Dòng phản hồi dưới câu hỏi để trống ở hai mức đó
 *   (trước đây "💡 Gợi ý: …" / "🧩 Mình cùng làm từng bước nhé!" hiện hai lần).
 * - Trò chơi nhỏ chỉ có một dòng phản hồi → vẫn dùng nguyên r.message (đủ gợi ý).
 * - Không vật nào trong trò chơi / thế giới được tô màu theo đáp án đúng (cửa xanh ở Mê cung lộ đáp án).
 */
const QUESTION_UI = import.meta.glob<string>('../src/ui/question.ts', { query: '?raw', import: 'default', eager: true });
const SCENES = import.meta.glob<string>(['../src/minigames/**/*.ts', '../src/world/**/*.ts'], { query: '?raw', import: 'default', eager: true });

function makeQ(): Question {
  return {
    id: 'test',
    topic: 'add',
    level: 1,
    prompt: '2 + 3 = ?',
    speech: '2 cộng 3 bằng mấy?',
    choices: ['4', '5', '6', '7'].map((v) => ({ label: v, value: v })),
    answer: '5',
    hint: 'Bắt đầu từ 2 rồi đếm thêm 3.',
    steps: ['Bắt đầu từ 2.', 'Đếm thêm: 3, 4, 5.', 'Vậy 2 + 3 = 5.'],
    grade: 1,
  } as Question;
}

describe('dòng phản hồi dưới câu hỏi', () => {
  it('sai lần 1: nhắc thử lại; lần 2 – gợi ý, lần 3 – từng bước: để trống (bóng nói đã hiện)', () => {
    const t = new AttemptTracker(makeQ());
    const r1 = t.submit('4');
    expect(r1.stage).toBe('retry');
    expect(feedbackLine(r1)).toBe(FEEDBACK.retry);
    const r2 = t.submit('6');
    expect(r2.stage).toBe('hint');
    expect(feedbackLine(r2)).toBe('');
    const r3 = t.submit('7');
    expect(r3.stage).toBe('steps');
    expect(feedbackLine(r3)).toBe('');
    const r4 = t.submit('5');
    expect(r4.correct).toBe(true);
    expect(feedbackLine(r4)).toBe(FEEDBACK.correct);
  });

  it('đúng ngay: khen', () => {
    const r = new AttemptTracker(makeQ()).submit('5');
    expect(r).toMatchObject({ correct: true, stage: 'correct' });
    expect(feedbackLine(r)).toBe(FEEDBACK.correct);
  });

  it('r.message vẫn mang đủ gợi ý cho trò chơi nhỏ (chỉ có một dòng phản hồi)', () => {
    const q = makeQ();
    const t = new AttemptTracker(q);
    t.submit('4');
    expect(t.submit('6').message).toBe(FEEDBACK.hint + q.hint);
    expect(t.submit('7').message).toBe(FEEDBACK.steps);
  });

  it('bảng câu hỏi và thẻ đề bài lấy dòng phản hồi qua feedbackLine (không in lại r.message)', () => {
    const code = Object.values(QUESTION_UI)[0];
    expect(code).toBeTruthy();
    expect(code).not.toMatch(/rich\(r\.message\)/);
    expect(code.match(/=\s*feedbackLine\(r\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe('không tô màu theo đáp án đúng', () => {
  // Một biểu thức chọn màu theo đúng / sai, ví dụ `correct ? '#7bd389' : '#d7a56d'`.
  const GIVEAWAY = /\b(correct|right|isRight|answer|ok|good|accept)\b[^;\n?]{0,40}\?\s*('#[0-9a-f]{3,8}'|PAL\.\w+|0x[0-9a-f]{6}|'(green|red)')\s*:/i;

  it('mẫu kiểm tra bắt được lỗi cũ của Mê cung', () => {
    expect(GIVEAWAY.test(`const door = this.answerGate(c.label, correct ? '#7bd389' : '#d7a56d');`)).toBe(true);
    expect(GIVEAWAY.test(`g.userData.ok ? 0x7bd389 : 0xd7a56d`)).toBe(true);
    expect(GIVEAWAY.test(`const door = this.answerGate(c.label, DOOR_COLOR);`)).toBe(false);
  });

  it('trò chơi nhỏ và thế giới', () => {
    const files = Object.keys(SCENES);
    expect(files.some((f) => f.endsWith('/games/maze_run.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('/zones/maze.ts'))).toBe(true);
    const bad: string[] = [];
    for (const [path, code] of Object.entries(SCENES)) {
      code.split('\n').forEach((line, i) => {
        if (GIVEAWAY.test(line)) bad.push(`${path}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(bad).toEqual([]);
  });
});

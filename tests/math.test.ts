import { describe, expect, it } from 'vitest';
import { generate, isCorrect } from '../src/math/engine';
import { ALL_TOPICS, TOPICS, maxLevelFor, startLevel } from '../src/math/curriculum';
import { initialSkill, updateSkill } from '../src/math/adaptive';
import { ballsQuestion, scripted, type BeatId } from '../src/math/scripted';
import { fmt, parseVi, setMathRng } from '../src/math/util';
import { Rng } from '../src/core/rng';
import type { Grade, Question } from '../src/math/types';

const GRADES: Grade[] = [1, 2, 3, 4, 5];
const BAD = /NaN|undefined|Infinity|null|\[object/;

function checkQuestion(q: Question) {
  expect(q.choices.length).toBeGreaterThanOrEqual(2);
  expect(q.choices.length).toBeLessThanOrEqual(5);
  const values = q.choices.map((c) => c.value);
  expect(new Set(values).size).toBe(values.length);
  expect(values).toContain(q.answer);
  if (q.accept) for (const a of q.accept) expect(values).toContain(a);
  expect(q.prompt.length).toBeGreaterThan(0);
  expect(q.hint.length).toBeGreaterThan(0);
  expect(q.steps.length).toBeGreaterThan(0);
  const text = [q.prompt, q.context ?? '', q.hint, q.speech, ...q.steps, ...q.choices.map((c) => c.label)].join(' | ');
  expect(text).not.toMatch(BAD);
  for (const c of q.choices) expect(c.label.startsWith('−') || c.label.startsWith('-')).toBe(false);
}

/** Kiểm tra tính đúng của các phép tính dạng "a op b = ?". */
function checkArithmetic(q: Question) {
  const m = q.prompt.match(/^([\d\s\u00a0,]+) ([+−×:]) ([\d\s\u00a0,]+) = \?$/);
  if (!m) return;
  const a = parseVi(m[1]);
  const b = parseVi(m[3]);
  const op = m[2];
  if (op === ':' && q.answer.includes('dư')) {
    const [qq, rr] = q.answer.split('dư').map((s) => parseVi(s));
    expect(qq * b + rr).toBe(a);
    expect(rr).toBeLessThan(b);
    return;
  }
  const expected = op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b;
  expect(Math.abs(parseVi(q.answer) - expected)).toBeLessThan(1e-6);
}

describe('Math engine – sinh câu hỏi', () => {
  setMathRng(Rng.seeded(12345));
  for (const topic of ALL_TOPICS) {
    it(`chủ đề ${topic} hợp lệ ở mọi mức`, () => {
      for (let level = 1; level <= TOPICS[topic].maxLevel; level++) {
        for (const grade of GRADES) {
          for (const support of [false, true]) {
            for (let i = 0; i < 25; i++) {
              const q = generate(topic, level, { grade, support });
              expect(q.topic).toBe(topic);
              checkQuestion(q);
              checkArithmetic(q);
              expect(isCorrect(q, q.answer)).toBe(true);
            }
          }
        }
      }
    });
  }

  it('chế độ hỗ trợ dùng ít lựa chọn hơn', () => {
    const q = generate('add', 2, { grade: 3, support: true });
    expect(q.choices.length).toBe(3);
  });
});

describe('Câu hỏi theo kịch bản', () => {
  const expected: [BeatId, string][] = [
    ['villageBoxes', '3'],
    ['shopFruit', '2 xu'],
    ['forestBridge', '7'],
    ['forestRock', '5'],
    ['bearBridge', '12'],
    ['bearStones', '15'],
    ['mazeDoor', '17'],
    ['coaster', '18'],
    ['wheel', '21'],
    ['giraffe', '6'],
    ['monkey', '7'],
    ['penguins', '12'],
  ];
  for (const [beat, ans] of expected) {
    it(`${beat} → ${ans}`, () => {
      const q = scripted(beat, { grade: 1 });
      checkQuestion(q);
      expect(q.answer).toBe(ans);
    });
  }
  it('ném bóng: chấp nhận mọi số lớn hơn 17', () => {
    const q = scripted('balls', { grade: 1 });
    expect(isCorrect(q, '18')).toBe(true);
    expect(isCorrect(q, '20')).toBe(true);
    expect(isCorrect(q, '25')).toBe(true);
    expect(isCorrect(q, '15')).toBe(false);
    for (const grade of GRADES) for (let i = 0; i < 30; i++) checkQuestion(ballsQuestion({ grade }));
  });
});

describe('Điều chỉnh độ khó', () => {
  it('tăng mức sau 3 câu đúng ngay lần đầu (3 + 2 → 7 + 5 → …)', () => {
    let s = initialSkill('add', 1);
    expect(s.level).toBe(1);
    for (let i = 0; i < 3; i++) s = updateSkill(s, 1, 'add', 1).state;
    expect(s.level).toBe(2);
    for (let i = 0; i < 3; i++) s = updateSkill(s, 1, 'add', 1).state;
    expect(s.level).toBe(3);
  });
  it('giảm mức và bật hỗ trợ khi gặp khó khăn', () => {
    let s = { ...initialSkill('add', 2) };
    const start = s.level;
    let r = updateSkill(s, 3, 'add', 2);
    s = r.state;
    expect(s.support).toBe(true);
    expect(r.change).toBe(null);
    r = updateSkill(s, 4, 'add', 2);
    expect(r.change).toBe('down');
    expect(r.state.level).toBe(start - 1);
  });
  it('không vượt quá mức trần của lớp', () => {
    let s = initialSkill('add', 1);
    for (let i = 0; i < 60; i++) s = updateSkill(s, 1, 'add', 1).state;
    expect(s.level).toBe(maxLevelFor('add', 1));
    expect(startLevel('add', 1)).toBe(1);
  });
  it('không xuống dưới mức 1', () => {
    let s = initialSkill('count', 1);
    for (let i = 0; i < 10; i++) s = updateSkill(s, 5, 'count', 1).state;
    expect(s.level).toBe(1);
  });
});

describe('Định dạng số kiểu Việt Nam', () => {
  it('dấu phẩy thập phân và khoảng cách hàng nghìn', () => {
    expect(fmt(0.5)).toBe('0,5');
    expect(fmt(3.14)).toBe('3,14');
    expect(fmt(1234)).toBe('1234');
    expect(fmt(12345)).toBe('12\u00a0345');
    expect(parseVi('12\u00a0345')).toBe(12345);
    expect(parseVi('2,5')).toBe(2.5);
    expect(fmt(0.1 + 0.2)).toBe('0,3');
  });
});

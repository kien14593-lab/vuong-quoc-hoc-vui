import { genAdd, genCompare, genCount, genDiv, genMul, genSequence, genSub } from './gen/arith';
import { genArea, genGeometry, genPerimeter } from './gen/geometry';
import { genDecimal, genFraction, genRatio, genWord } from './gen/advanced';
import { genLength, genMoney, genTime } from './gen/measure';
import { TOPICS } from './curriculum';
import type { GenOptions, MathTopic, Question, Topic } from './types';
import { rand } from './util';

export type Gen = (level: number, o: GenOptions) => Question;

export const GENERATORS: Record<MathTopic, Gen> = {
  count: genCount,
  compare: genCompare,
  add: genAdd,
  sub: genSub,
  mul: genMul,
  div: genDiv,
  sequence: genSequence,
  time: genTime,
  length: genLength,
  money: genMoney,
  geometry: genGeometry,
  perimeter: genPerimeter,
  area: genArea,
  fraction: genFraction,
  decimal: genDecimal,
  ratio: genRatio,
  word: genWord,
};

/** Bảo đảm câu hỏi hợp lệ: lựa chọn không trùng nhau và luôn chứa đáp án. */
export function sanitize(q: Question): Question {
  const seen = new Set<string>();
  const choices = q.choices.filter((c) => {
    if (seen.has(c.value)) return false;
    seen.add(c.value);
    return true;
  });
  if (!seen.has(q.answer)) {
    choices.splice(rand().int(0, choices.length), 0, { label: q.answer, value: q.answer });
  }
  return { ...q, choices };
}

export function generate(topic: MathTopic, level: number, o: GenOptions): Question {
  const lv = Math.max(1, Math.min(TOPICS[topic].maxLevel, Math.round(level)));
  return sanitize(GENERATORS[topic](lv, o));
}

/** Kiểm tra một giá trị có phải đáp án đúng không. */
export function isCorrect(q: Question, value: string): boolean {
  if (q.accept && q.accept.length) return q.accept.includes(value);
  return q.answer === value;
}

/** Chọn chủ đề có trọng số (ưu tiên chủ đề yếu). */
export function pickTopic<T extends Topic>(topics: T[], weights?: Partial<Record<Topic, number>>): T {
  const R = rand();
  if (!weights) return R.pick(topics);
  const ws = topics.map((t) => Math.max(0.05, weights[t] ?? 1));
  const total = ws.reduce((a, b) => a + b, 0);
  let x = R.float(0, total);
  for (let i = 0; i < topics.length; i++) {
    x -= ws[i];
    if (x <= 0) return topics[i];
  }
  return topics[topics.length - 1];
}

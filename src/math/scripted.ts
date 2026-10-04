/**
 * Các câu hỏi cố định lấy đúng theo kịch bản (dùng cho lớp 1–2),
 * và bảng chủ đề thay thế để sinh câu hỏi phù hợp cho lớp 3–5.
 */
import type { GenOptions, Grade, MathTopic, Question } from './types';
import { MINUS, TIMES, fmt, makeQ, numChoices, choiceCount, rand } from './util';
import { addSteps, mulSteps, subSteps } from './gen/arith';

export type BeatId =
  | 'villageBoxes'
  | 'shopFruit'
  | 'forestBridge'
  | 'forestRock'
  | 'bearBridge'
  | 'bearStones'
  | 'mazeDoor'
  | 'coaster'
  | 'balls'
  | 'wheel'
  | 'giraffe'
  | 'monkey'
  | 'penguins';

function fixed(values: number[]): { label: string; value: string }[] {
  return values.map((v) => ({ label: fmt(v), value: fmt(v) }));
}

const SCRIPTED: Record<BeatId, (o: GenOptions) => Question> = {
  villageBoxes: () =>
    makeQ({
      topic: 'count',
      level: 1,
      prompt: 'Có tất cả bao nhiêu chiếc hộp?',
      visual: { kind: 'objects', emoji: '📦', groups: [3] },
      choices: fixed([2, 3, 4]),
      answer: '3',
      hint: 'Hãy đếm từng chiếc hộp: chỉ tay vào mỗi hộp và đếm 1, 2, 3.',
      steps: ['Chỉ tay vào chiếc hộp thứ nhất: 1.', 'Chiếc hộp tiếp theo: 2. Rồi chiếc cuối cùng: 3.', 'Có tất cả 3 chiếc hộp.'],
    }),
  shopFruit: (o) => {
    const c = numChoices(2, [3, 1, 8, 5], choiceCount(o.grade, o.support), { format: (v) => `${v} xu` });
    return makeQ({
      topic: 'money',
      level: 2,
      context: 'Em có 10 xu. Táo giá 5 xu, chuối giá 3 xu.',
      prompt: 'Mua mỗi loại một quả thì còn lại bao nhiêu xu?',
      visual: { kind: 'money', items: [{ emoji: '🍎', name: 'táo', price: 5 }, { emoji: '🍌', name: 'chuối', price: 3 }], budget: 10 },
      ...c,
      hint: 'Tính tiền táo và chuối trước: 5 + 3. Rồi lấy 10 trừ đi.',
      steps: ['Táo 5 xu, chuối 3 xu: 5 + 3 = 8 xu.', `Em có 10 xu: 10 ${MINUS} 8 = 2.`, 'Còn lại 2 xu.'],
    });
  },
  forestBridge: (o) => {
    const c = numChoices(7, [6, 8, 5, 1], choiceCount(o.grade, o.support));
    return makeQ({ topic: 'add', level: 2, context: 'Cây cầu bị nâng lên. Bảng hỏi:', prompt: '4 + 3 = ?', visual: { kind: 'objects', emoji: '🟫', groups: [4, 3], op: '+' }, ...c, hint: 'Hãy đếm từng nhóm khúc gỗ rồi gộp lại.', steps: addSteps(4, 3) });
  },
  forestRock: (o) => {
    const c = numChoices(5, [4, 6, 11, 3], choiceCount(o.grade, o.support));
    return makeQ({ topic: 'sub', level: 2, context: 'Tảng đá chặn đường. Trên đá khắc:', prompt: `8 ${MINUS} 3 = ?`, visual: { kind: 'objects', emoji: '🌑', groups: [8], op: '-', crossOut: 3 }, ...c, hint: 'Bắt đầu từ 8 rồi đếm lùi 3 bước.', steps: subSteps(8, 3) });
  },
  bearBridge: (o) => {
    const c = numChoices(12, [11, 13, 2, 10], choiceCount(o.grade, o.support));
    return makeQ({ topic: 'add', level: 3, context: 'Cây cầu bị khóa. Cầu cần 7 tấm ván và thêm 5 tấm ván nữa.', prompt: '7 + 5 = ?', visual: { kind: 'objects', emoji: '🟫', groups: [7, 5], op: '+' }, ...c, hint: 'Bắt đầu từ 7, đếm thêm 5: 8, 9, 10, 11, 12.', steps: addSteps(7, 5) });
  },
  bearStones: () =>
    makeQ({
      topic: 'compare',
      level: 2,
      prompt: 'Chọn viên đá lớn nhất.',
      visual: { kind: 'compare', values: ['12', '8', '15'], style: 'stones' },
      choices: fixed([12, 8, 15]),
      answer: '15',
      hint: 'So sánh hàng chục trước: 8 chưa đủ 1 chục. 12 và 15 đều có 1 chục – so sánh tiếp hàng đơn vị.',
      steps: ['8 bé hơn 10 nên bé nhất.', '12 và 15 cùng có 1 chục; 5 đơn vị lớn hơn 2 đơn vị.', 'Vậy 15 là lớn nhất.'],
    }),
  mazeDoor: (o) => {
    const c = numChoices(17, [16, 18, 7, 15], choiceCount(o.grade, o.support));
    return makeQ({ topic: 'add', level: 4, prompt: '12 + 5 = ?', ...c, hint: 'Bắt đầu từ 12 rồi đếm thêm 5.', steps: addSteps(12, 5) });
  },
  coaster: (o) => {
    const c = numChoices(18, [9, 12, 24, 15], choiceCount(o.grade, o.support));
    return makeQ({
      topic: 'mul',
      level: 3,
      context: 'Tàu lượn có 3 toa, mỗi toa 6 chỗ ngồi.',
      prompt: `6 ${TIMES} 3 = ?`,
      visual: { kind: 'groups', emoji: '🪑', groups: 3, each: 6 },
      ...c,
      hint: 'Hãy đếm từng nhóm: 6, rồi 12, rồi 18.',
      steps: mulSteps(6, 3),
    });
  },
  balls: () =>
    makeQ({
      topic: 'compare',
      level: 4,
      prompt: 'Hãy ném bóng vào số lớn hơn 17.',
      visual: { kind: 'compare', values: ['12', '15', '18', '20', '25'], style: 'balls' },
      choices: fixed([12, 15, 18, 20, 25]),
      answer: '18',
      accept: ['18', '20', '25'],
      hint: 'Số lớn hơn 17 là số đứng sau 17 khi đếm: 18, 19, 20…',
      steps: ['Đếm: …15, 16, 17, 18, 19, 20…', '12 và 15 đứng trước 17. 18, 20, 25 đứng sau 17.', 'Ném vào 18, 20 hoặc 25 đều đúng!'],
    }),
  wheel: () =>
    makeQ({
      topic: 'compare',
      level: 2,
      prompt: 'Chọn số lớn nhất để quay vòng quay!',
      visual: { kind: 'compare', values: ['12', '18', '15', '21'], style: 'cards' },
      choices: fixed([12, 18, 15, 21]),
      answer: '21',
      hint: 'So sánh hàng chục trước: số nào có 2 chục?',
      steps: ['12, 18, 15 đều có 1 chục.', '21 có 2 chục.', 'Vậy 21 là số lớn nhất.'],
    }),
  giraffe: (o) => {
    const c = numChoices(6, [5, 7, 4, 8], choiceCount(o.grade, o.support));
    return makeQ({
      topic: 'word',
      level: 2,
      context: 'Có 3 bạn hươu cao cổ, mỗi bạn muốn ăn 2 quả táo.',
      prompt: 'Cần tất cả bao nhiêu quả táo?',
      visual: { kind: 'groups', emoji: '🍎', groups: 3, each: 2 },
      ...c,
      hint: 'Hãy đếm từng nhóm táo: mỗi nhóm 2 quả.',
      steps: ['Bạn hươu thứ nhất: 2 quả.', 'Đếm thêm từng nhóm: 2, 4, 6.', 'Cần tất cả 6 quả táo.'],
    });
  },
  monkey: (o) => {
    const c = numChoices(7, [6, 8, 17, 5], choiceCount(o.grade, o.support));
    return makeQ({
      topic: 'word',
      level: 2,
      context: 'Có 12 quả chuối. Khỉ ăn 5 quả.',
      prompt: 'Còn lại bao nhiêu quả chuối?',
      visual: { kind: 'objects', emoji: '🍌', groups: [12], op: '-', crossOut: 5 },
      ...c,
      hint: 'Bắt đầu từ 12 rồi đếm lùi 5 bước.',
      steps: subSteps(12, 5),
    });
  },
  penguins: (o) => {
    const c = numChoices(12, [10, 11, 13, 7], choiceCount(o.grade, o.support));
    return makeQ({
      topic: 'mul',
      level: 1,
      context: 'Các bạn chim cánh cụt đứng thành 3 nhóm, mỗi nhóm 4 bạn.',
      prompt: 'Có tất cả bao nhiêu bạn chim cánh cụt?',
      visual: { kind: 'groups', emoji: '🐧', groups: 3, each: 4 },
      ...c,
      hint: 'Hãy đếm từng nhóm: 4, rồi 8, rồi 12.',
      steps: ['Mỗi nhóm có 4 bạn.', 'Đếm theo nhóm: 4, 8, 12.', 'Có tất cả 12 bạn chim cánh cụt.'],
    });
  },
};

/** Chủ đề dùng để sinh câu hỏi cho lớp 3, 4, 5 tại mỗi tình huống. */
const BEAT_TOPICS: Record<BeatId, [MathTopic, MathTopic, MathTopic]> = {
  villageBoxes: ['count', 'count', 'count'],
  shopFruit: ['money', 'money', 'money'],
  forestBridge: ['add', 'fraction', 'decimal'],
  forestRock: ['sub', 'sub', 'decimal'],
  bearBridge: ['mul', 'mul', 'fraction'],
  bearStones: ['compare', 'fraction', 'decimal'],
  mazeDoor: ['mul', 'fraction', 'decimal'],
  coaster: ['mul', 'mul', 'mul'],
  balls: ['compare', 'compare', 'compare'],
  wheel: ['div', 'div', 'ratio'],
  giraffe: ['word', 'word', 'word'],
  monkey: ['word', 'ratio', 'ratio'],
  penguins: ['mul', 'area', 'area'],
};

export function beatTopic(beat: BeatId, grade: Grade): MathTopic {
  if (grade <= 2) return SCRIPTED[beat]({ grade }).topic as MathTopic;
  return BEAT_TOPICS[beat][grade - 3];
}

/** Có dùng câu hỏi cố định của kịch bản không? */
export function usesScripted(beat: BeatId, grade: Grade): boolean {
  return beat === 'villageBoxes' || grade <= 2;
}

export function scripted(beat: BeatId, o: GenOptions): Question {
  return SCRIPTED[beat](o);
}

/** Câu hỏi "ném bóng vào số lớn hơn …" có nhiều đáp án đúng – phiên bản theo lớp. */
export function ballsQuestion(o: GenOptions): Question {
  if (o.grade <= 2) return SCRIPTED.balls(o);
  const R = rand();
  if (o.grade === 3) {
    const t = R.int(12, 60) * 10 + 7;
    const vals = [t - R.int(20, 50), t - R.int(1, 9), t + R.int(1, 9), t + R.int(20, 40), t + R.int(50, 90)];
    const big = vals.filter((v) => v > t);
    return makeQ({
      topic: 'compare',
      level: 5,
      prompt: `Hãy ném bóng vào số lớn hơn ${fmt(t)}.`,
      visual: { kind: 'compare', values: vals.map(fmt), style: 'balls' },
      choices: fixed(R.shuffle(vals)),
      answer: fmt(big[0]),
      accept: big.map(fmt),
      hint: 'So sánh từ hàng trăm, rồi hàng chục, rồi hàng đơn vị.',
      steps: [`Lần lượt so sánh từng số với ${fmt(t)}.`, `Các số lớn hơn ${fmt(t)}: ${big.map(fmt).join(', ')}.`, 'Ném vào bất kì số nào trong đó đều đúng!'],
    });
  }
  const base = R.int(1, 5);
  const t = base + 0.7;
  const vals = [base + 0.2, base + 0.5, base + 0.75, base + 1, base + 1.5].map((v) => Math.round(v * 100) / 100);
  const big = vals.filter((v) => v > t);
  return makeQ({
    topic: 'decimal',
    level: 2,
    prompt: `Hãy ném bóng vào số lớn hơn ${fmt(t)}.`,
    visual: { kind: 'compare', values: vals.map(fmt), style: 'balls' },
    choices: fixed(R.shuffle(vals)),
    answer: fmt(big[0]),
    accept: big.map(fmt),
    hint: 'So sánh phần nguyên trước, rồi hàng phần mười, hàng phần trăm.',
    steps: [`Viết ${fmt(t)} thành ${fmt(t)}0 để so sánh dễ hơn.`, `Các số lớn hơn ${fmt(t)}: ${big.map(fmt).join('; ')}.`, 'Ném vào bất kì số nào trong đó đều đúng!'],
  });
}

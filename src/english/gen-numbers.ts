/**
 * Số đếm (mọi lớp) và giờ – ngày – tháng (Lớp 4–5; Lớp 1–3 chỉ giờ đúng).
 */
import type { Grade, Question } from '../math/types';
import { hasTag, isCountable, plural } from './frames';
import { type Ctx, letterClue, mk, pickWord } from './gen-core';
import { numberWord, ordinalShort, ordinalWord } from './words';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Số lớn nhất được hỏi: Lớp 1 ≤ 10, Lớp 2 ≤ 15 (≤ 10 trước Unit 13), Lớp 3 ≤ 20, Lớp 4–5 ≤ 100. */
export function maxNumber(g: Grade, n: number | null): number {
  if (g === 1) return 10;
  if (g === 2) return n !== null && n < 13 ? 10 : 15;
  if (g === 3) return 20;
  return 100;
}

/** Các số gần n, khác nhau (ưu tiên `first`, rồi ±1, ±2…). */
export function near(c: Ctx, n: number, lo: number, hi: number, first: number[] = []): number[] {
  const out: number[] = [];
  const add = (x: number, force = false) => {
    if (out.length < c.k - 1 && x !== n && x >= 0 && !out.includes(x) && (force || (x >= lo && x <= hi))) out.push(x);
  };
  first.forEach((x) => add(x, true));
  c.R.shuffle([n + 1, n - 1, n + 2, n - 2]).forEach((x) => add(x));
  for (let i = 3; out.length < c.k - 1 && i <= hi; i++) {
    add(n + i);
    add(n - i);
  }
  return out;
}

const reverse = (n: number) => (n >= 10 && n < 100 && n % 10 !== 0 ? (n % 10) * 10 + Math.floor(n / 10) : -1);
export const choiceList = (c: Ctx, xs: number[], label: (x: number) => string) =>
  c.R.shuffle(xs.map((x) => ({ label: label(x), value: String(x) })));

/** "one, two, three" – dài thì rút gọn để mỗi câu tiếng Anh không quá 8 từ. */
export function counting(n: number): string {
  if (n <= 5) return Array.from({ length: n }, (_, i) => numberWord(i + 1)).join(', ');
  return `one, two, three, …, ${numberWord(n - 1)}, ${numberWord(n)}`;
}

const NO_COUNT = new Set(['number', 'letter', 'word', 'name', 'spell']);

/** L1: đếm hình (Lớp 1–2: chọn "5 five"; Lớp 3–5: «How many cats?» → chọn từ). */
function countQ(c: Ctx, level: number): Question | null {
  const w = pickWord(c, (x) => isCountable(x) && /^[a-z]+$/.test(x.w) && !hasTag(x, 'place', 'room', 'family') && !NO_COUNT.has(x.w));
  if (!w) return null;
  const hi = Math.min(10, maxNumber(c.g, c.n));
  const n = c.R.int(1, hi);
  const ds = near(c, n, 1, hi);
  if (ds.length < c.k - 1) return null;
  const visual = { kind: 'objects' as const, emoji: w.e, groups: [n] };
  if (c.g <= 2) {
    const ask = `Đếm xem có bao nhiêu ${w.vi}.`;
    return mk(c, level, {
      prompt: ask,
      speech: ask,
      visual,
      choices: choiceList(c, [n, ...ds], (x) => (c.o.short ? String(x) : `${x} ${numberWord(x)}`)),
      answer: String(n),
      hint: 'Chỉ vào từng hình và đếm: «one, two, three».',
      steps: [`Đếm: «${counting(n)}».`, `Có ${n} ${w.vi}. Số ${n} tiếng Anh là «${numberWord(n)}».`, `Đáp án: ${n}`],
      en: numberWord(n),
    });
  }
  const q = `How many ${plural(w)}?`;
  return mk(c, level, {
    context: 'Nhìn hình và trả lời.',
    prompt: `«${q}»`,
    speech: `«${q}»`,
    visual,
    choices: choiceList(c, [n, ...ds], numberWord),
    answer: String(n),
    hint: `«${q}» nghĩa là “Có bao nhiêu ${w.vi}?”. Đếm từng hình nhé.`,
    steps: [`Đếm: «${counting(n)}».`, `Có ${n} ${w.vi} → «${numberWord(n)}».`, `Đáp án: ${numberWord(n)}`],
    en: `${q} ${cap(numberWord(n))}.`,
  });
}

/** Ví dụ số tròn chục khác số đang hỏi: «forty» 40, «fifty» 50… */
function tyExamples(n: number): string {
  return [20, 30, 40, 50]
    .filter((x) => x !== n)
    .slice(0, 2)
    .map((x) => `«${numberWord(x)}» ${x}`)
    .join(', ');
}

function numberHint(n: number): string {
  if (n === 100) return '«hundred» nghĩa là “trăm”.';
  if (n > 20 && n % 10 !== 0) {
    const t = n - (n % 10);
    return `«${numberWord(n)}» ghép từ «${numberWord(t)}» (${t}) và «${numberWord(n % 10)}» (${n % 10}).`;
  }
  if (n >= 13 && n <= 19) return 'Số có đuôi «-teen» là các số từ 13 đến 19.';
  if (n >= 20 && n % 10 === 0) return `Số có đuôi «-ty» là số tròn chục: ${tyExamples(n)}…`;
  return n > 1 ? `Đếm tiếp: «${numberWord(n - 1)}» là ${n - 1}, số tiếp theo là…` : '«one» là số nhỏ nhất.';
}

/** Chữ ↔ số: "«seven» là số mấy?" hoặc "Số 7 tiếng Anh là gì?". */
function wordDigitQ(c: Ctx, level: number, lo: number, hi: number, pickN?: number, first: number[] = []): Question | null {
  const n = pickN ?? c.R.int(lo, hi);
  const ds = near(c, n, lo, hi, first.length ? first : [reverse(n)].filter((x) => x > 0 && x <= hi));
  if (ds.length < c.k - 1) return null;
  const toDigit = c.o.short || pickN !== undefined || c.R.chance(0.5);
  const steps = [`«${numberWord(n)}» là số ${n}.`, numberHint(n), `Đáp án: ${toDigit ? n : numberWord(n)}`];
  if (toDigit) {
    const ask = `«${numberWord(n)}» là số mấy?`;
    return mk(c, level, {
      prompt: ask, speech: ask, choices: choiceList(c, [n, ...ds], String), answer: String(n),
      hint: numberHint(n), steps, en: numberWord(n),
    });
  }
  const ask = `Số ${n} tiếng Anh là gì?`;
  return mk(c, level, {
    prompt: ask, speech: ask, choices: choiceList(c, [n, ...ds], numberWord), answer: String(n),
    hint: toWordHint(n, ds), steps, en: numberWord(n),
  });
}

/** Gợi ý chiều số → chữ: dạy cách ghép số, không đọc luôn đáp án. */
function toWordHint(n: number, ds: number[]): string {
  const clue = letterClue(numberWord(n), ds.map(numberWord));
  if (n > 20 && n < 100 && n % 10 !== 0) {
    const t = n - (n % 10);
    return `${n} = ${t} + ${n % 10}. Số ${t} là «${numberWord(t)}».`;
  }
  if (n >= 13 && n <= 19) return `Số từ 13 đến 19 có đuôi «-teen». ${clue}`;
  if (n >= 20 && n < 100 && n % 10 === 0) return `Số tròn chục có đuôi «-ty». ${clue}`;
  return clue;
}

/** Gợi ý khi nghe – không lộ đáp án. */
function listenHint(n: number): string {
  if (n >= 13 && n <= 19) return 'Bấm 🔊 nghe lại. Số có đuôi «-teen» là các số từ 13 đến 19.';
  if (n >= 20 && n < 100 && n % 10 === 0) return `Bấm 🔊 nghe lại. Số có đuôi «-ty» là số tròn chục: ${tyExamples(n)}…`;
  if (n > 20 && n < 100) return `Bấm 🔊 nghe lại. Phần đầu là số chục (${tyExamples(n - (n % 10))}…), phần sau là số đơn vị.`;
  return 'Bấm 🔊 nghe lại, rồi đếm nhẩm bằng tiếng Anh tới số vừa nghe.';
}

/** Nghe số → chọn chữ số. */
function listenNumberQ(c: Ctx, level: number, lo: number, hi: number): Question | null {
  if (!c.o.listen) return null;
  const n = c.R.int(lo, hi);
  const ds = near(c, n, lo, hi);
  if (ds.length < c.k - 1) return null;
  return mk(c, level, {
    prompt: 'Nghe và chọn số đúng.',
    speech: `Nghe nhé: «${numberWord(n)}». Chọn số đúng.`,
    visual: { kind: 'listen' },
    listen: true,
    choices: choiceList(c, [n, ...ds], String),
    answer: String(n),
    hint: listenHint(n),
    steps: [`Bạn vừa nghe «${numberWord(n)}».`, `«${numberWord(n)}» là số ${n}.`, `Đáp án: ${n}`],
    en: numberWord(n),
  });
}

/** L4 Lớp 3: «-teen» hay «-ty» (thirteen 13 – thirty 30). */
function teensQ(c: Ctx, level: number): Question | null {
  const d = c.R.int(3, 9);
  const teen = c.R.chance(0.5);
  const n = teen ? 10 + d : d * 10;
  return wordDigitQ(c, level, 1, 100, n, [teen ? d * 10 : 10 + d, d]);
}

/** L4 Lớp 4: số có hai chữ số, phương án đảo chữ số (45 – 54). */
function swapQ(c: Ctx, level: number): Question | null {
  let n = 0;
  for (let i = 0; i < 10 && reverse(n) <= 0; i++) n = c.R.int(21, 98);
  if (reverse(n) <= 0 || reverse(n) === n) return null;
  return wordDigitQ(c, level, 10, 99, n, [reverse(n)]);
}

/** Gợi ý số thứ tự: nói về đuôi khi đuôi phân biệt được, còn không thì chỉ ra số gốc. */
function ordinalHint(n: number, ds: number[]): string {
  const suf = (x: number) => ordinalShort(x).slice(-2);
  if (ds.every((d) => suf(d) !== suf(n))) {
    const ex = [1, 2, 3, 4]
      .filter((x) => x !== n)
      .slice(0, 3)
      .map((x) => `«${ordinalWord(x)}» ${ordinalShort(x)}`)
      .join(', ');
    return `Đuôi viết tắt là hai chữ cuối của từ: ${ex}.`;
  }
  const tens = n - (n % 10);
  if (n > 20 && n % 10) return `«${ordinalWord(n)}» ghép từ «${numberWord(tens)}» (${tens}) và «${ordinalWord(n % 10)}» (thứ ${n % 10}).`;
  return `«${ordinalWord(n)}» là số thứ tự của «${numberWord(n)}».`;
}

/** L4 Lớp 5: số thứ tự (twenty-first → 21st). */
function ordinalQ(c: Ctx, level: number): Question | null {
  const n = c.R.int(1, 31);
  const ds = near(c, n, 1, 31, [reverse(n)].filter((x) => x > 0 && x <= 31));
  if (ds.length < c.k - 1) return null;
  const ask = `«${ordinalWord(n)}» viết tắt là gì?`;
  return mk(c, level, {
    prompt: ask,
    speech: ask,
    choices: c.R.shuffle([n, ...ds].map((x) => ({ label: ordinalShort(x), value: ordinalShort(x) }))),
    answer: ordinalShort(n),
    hint: ordinalHint(n, ds),
    steps: [`«${ordinalWord(n)}» là thứ ${n}.`, `Viết tắt: số ${n} + đuôi ${ordinalShort(n).slice(-2)}.`, `Đáp án: ${ordinalShort(n)}`],
    en: ordinalWord(n),
  });
}

export function numbers(c: Ctx, level: number): Question | null {
  const hi = maxNumber(c.g, c.n);
  if (level <= 1) return countQ(c, 1);
  if (c.g <= 2) {
    if (level === 2) return listenNumberQ(c, 2, 1, hi) ?? wordDigitQ(c, 2, 1, hi);
    return wordDigitQ(c, 3, 1, hi);
  }
  if (level === 2) return wordDigitQ(c, 2, 1, hi);
  if (level === 3) return listenNumberQ(c, 3, 1, hi) ?? wordDigitQ(c, 3, 1, hi);
  return c.g === 3 ? teensQ(c, 4) : c.g === 4 ? swapQ(c, 4) : ordinalQ(c, 4);
}

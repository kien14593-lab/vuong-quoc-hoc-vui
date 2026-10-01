import { Rng, rng as defaultRng } from '../core/rng';
import type { Choice, Question, Topic } from './types';

let R: Rng = defaultRng;
/** Cho phép kiểm thử thay RNG bằng RNG có gieo hạt. */
export function setMathRng(r: Rng): void {
  R = r;
}
export function rand(): Rng {
  return R;
}

export const MINUS = '−';
export const TIMES = '×';
export const DIVIDE = ':';
const NBSP = '\u00a0';

/** Làm tròn để tránh lỗi số thực (0.1 + 0.2). */
export function round(n: number, digits = 6): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Định dạng số kiểu Việt Nam: dấu phẩy thập phân, cách nhóm nghìn với số từ 10 000. */
export function fmt(n: number): string {
  const v = round(n);
  const neg = v < 0;
  const abs = Math.abs(v);
  const [intPart, decPart] = abs.toString().split('.');
  let intStr = intPart;
  if (abs >= 10000) {
    intStr = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  }
  const s = decPart ? `${intStr},${decPart}` : intStr;
  return neg ? `${MINUS}${s}` : s;
}

/** Đọc lại số từ chuỗi định dạng Việt Nam. */
export function parseVi(s: string): number {
  return Number(s.replace(/\u00a0|\s/g, '').replace(MINUS, '-').replace(',', '.'));
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export function fracStr(n: number, d: number): string {
  return `${n}/${d}`;
}

export function simplify(n: number, d: number): [number, number] {
  const g = gcd(n, d);
  return [n / g, d / g];
}

let qCounter = 0;
export function qid(topic: Topic): string {
  qCounter = (qCounter + 1) % 1_000_000;
  return `${topic}-${Date.now().toString(36)}-${qCounter}`;
}

/**
 * Tạo các lựa chọn số: đáp án + các phương án nhiễu hợp lý.
 * Bảo đảm không trùng, không âm (trừ khi cho phép) và luôn chứa đáp án.
 */
export function numChoices(
  answer: number,
  distractors: number[],
  count: number,
  opts: { min?: number; integer?: boolean; format?: (n: number) => string; step?: number } = {},
): { choices: Choice[]; answer: string } {
  const min = opts.min ?? 0;
  const format = opts.format ?? fmt;
  const step = opts.step ?? (Number.isInteger(answer) ? 1 : 0.1);
  const ans = round(answer);
  const seen = new Set<number>([ans]);
  const pool: number[] = [];
  const accept = (v: number) => {
    const x = round(v);
    if (seen.has(x) || x < min || !Number.isFinite(x)) return;
    if (opts.integer !== false && Number.isInteger(ans) && !Number.isInteger(x)) return;
    seen.add(x);
    pool.push(x);
  };
  for (const d of R.shuffle([...distractors])) accept(d);
  let k = 1;
  while (pool.length < count - 1 && k < 200) {
    accept(ans + k * step);
    if (pool.length < count - 1) accept(ans - k * step);
    k++;
  }
  const picked = pool.slice(0, count - 1);
  const all = R.shuffle([ans, ...picked]);
  return {
    choices: all.map((v) => ({ label: format(v), value: format(v) })),
    answer: format(ans),
  };
}

/** Tạo các lựa chọn dạng chữ. */
export function textChoices(answer: string, distractors: string[], count: number): { choices: Choice[]; answer: string } {
  const uniq = [...new Set(distractors.filter((d) => d !== answer))];
  const picked = R.shuffle(uniq).slice(0, count - 1);
  const all = R.shuffle([answer, ...picked]);
  return { choices: all.map((v) => ({ label: v, value: v })), answer };
}

/** Chuyển biểu thức toán sang câu đọc tiếng Việt. */
export function speakExpr(text: string): string {
  return text
    .replace(/(\d+)\/(\d+)/g, '$1 phần $2')
    .replace(/(\d),(\d)/g, '$1 phẩy $2')
    .replace(/\s*\+\s*/g, ' cộng ')
    .replace(/\s*[−-]\s*/g, ' trừ ')
    .replace(/\s*×\s*/g, ' nhân ')
    .replace(/\s+:\s+/g, ' chia ')
    .replace(/\s*=\s*\?/g, ' bằng mấy?')
    .replace(/\s*=\s*/g, ' bằng ')
    .replace(/\s*>\s*/g, ' lớn hơn ')
    .replace(/\s*<\s*/g, ' bé hơn ')
    .replace(/cm²/g, 'xăng-ti-mét vuông')
    .replace(/m²/g, 'mét vuông')
    .replace(/\bcm\b/g, 'xăng-ti-mét')
    .replace(/\bdm\b/g, 'đề-xi-mét')
    .replace(/\bkm\b/g, 'ki-lô-mét')
    .replace(/%/g, ' phần trăm')
    .replace(/\s+/g, ' ')
    .trim();
}

export function choiceCount(grade: number, support?: boolean): number {
  if (support) return 3;
  return grade <= 1 ? 3 : 4;
}

/** Khung tạo câu hỏi với các trường mặc định. */
export function makeQ(q: Omit<Question, 'id' | 'speech'> & { speech?: string }): Question {
  return { id: qid(q.topic), speech: q.speech ?? speakExpr(`${q.context ? q.context + ' ' : ''}${q.prompt}`), ...q };
}

export const COUNT_ITEMS = [
  { emoji: '📦', name: 'chiếc hộp' },
  { emoji: '⭐', name: 'ngôi sao' },
  { emoji: '🍎', name: 'quả táo' },
  { emoji: '🐤', name: 'chú gà con' },
  { emoji: '🌸', name: 'bông hoa' },
  { emoji: '🐟', name: 'con cá' },
  { emoji: '🎈', name: 'quả bóng bay' },
  { emoji: '🍓', name: 'quả dâu' },
  { emoji: '🦋', name: 'con bướm' },
  { emoji: '🍄', name: 'cây nấm' },
] as const;

/**
 * Câu hỏi Tiếng Anh cho các tình huống trong truyện (thay câu hỏi cố định của Toán): cùng cảnh, cùng cách
 * chơi – đếm hộp, quầy trái cây, cầu, tảng đá, đá kê chân, tàu lượn, ném bóng, vòng quay, vườn thú.
 */
import type { BeatId } from '../math/scripted';
import type { EnTopic, Question, Visual } from '../math/types';
import { BANK, type Word, conflicts } from './bank';
import { hasTag } from './frames';
import {
  type Ctx, type EnOptions, distractors, giveaway, letterClue, meaning, mk, pickWord, wordChoices, wordSteps,
} from './gen-core';
import { choiceList, counting, maxNumber, near } from './gen-numbers';
import { numberWord } from './words';

export interface BeatSpec {
  /** Kĩ năng được hỏi và ghi điểm (null = bộ chọn môn tự chọn kĩ năng cần luyện). */
  topic: EnTopic | null;
  /** Tùy chọn riêng của tình huống (nhãn ngắn cho đá 3D, chỉ hỏi đồ ăn…). */
  opts?: Partial<EnOptions>;
  /** Câu hỏi riêng của tình huống; null = để bộ sinh chung hỏi. */
  build?: (c: Ctx, level: number) => Question | null;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------------- Đếm (hộp, ghế tàu lượn, chuối) ---------------- */

interface Count {
  n: number;
  /** Tên đồ vật bằng tiếng Việt ("chiếc hộp"). */
  vi: string;
  /** Danh từ số nhiều tiếng Anh ("boxes"). */
  noun: string;
  visual: Visual;
  hint: string;
  /** Bước giải đầu tiên (mặc định: đếm từng cái). */
  first?: string;
  /** Phương án nhiễu nên có (ví dụ thiếu/thừa một toa). */
  near?: number[];
}

function countBeat(c: Ctx, level: number, s: Count): Question | null {
  const hi = maxNumber(c.g, c.n);
  if (s.n > hi) return null;
  const ds = near(c, s.n, 1, hi, (s.near ?? []).filter((x) => x >= 1 && x <= hi));
  if (ds.length < c.k - 1) return null;
  const n = s.n;
  const first = s.first ?? `Đếm: «${counting(n)}».`;
  if (c.g <= 2) {
    const ask = `Đếm xem có bao nhiêu ${s.vi}.`;
    return mk(c, level, {
      prompt: ask,
      speech: ask,
      visual: s.visual,
      choices: choiceList(c, [n, ...ds], (x) => `${x} ${numberWord(x)}`),
      answer: String(n),
      hint: s.hint,
      steps: [first, `Có ${n} ${s.vi}. Số ${n} tiếng Anh là «${numberWord(n)}».`, `Đáp án: ${n} ${numberWord(n)}`],
      en: numberWord(n),
    });
  }
  const q = `How many ${s.noun}?`;
  return mk(c, level, {
    context: 'Nhìn hình và trả lời.',
    prompt: `«${q}»`,
    speech: `«${q}»`,
    visual: s.visual,
    choices: choiceList(c, [n, ...ds], numberWord),
    answer: String(n),
    hint: `«${q}» nghĩa là “Có bao nhiêu ${s.vi}?”. ${s.hint}`,
    steps: [first, `Có ${n} ${s.vi} → «${numberWord(n)}».`, `Đáp án: ${numberWord(n)}`],
    en: `${q} ${cap(numberWord(n))}.`,
  });
}

const boxes = (c: Ctx, level: number) =>
  countBeat(c, level, {
    n: 3,
    vi: 'chiếc hộp',
    noun: 'boxes',
    visual: { kind: 'objects', emoji: '📦', groups: [3] },
    hint: 'Chỉ tay vào từng chiếc hộp và đếm: «one, two, three».',
  });

function coaster(c: Ctx, level: number): Question | null {
  const [cl, ch, sl, sh] = c.g <= 2 ? [2, 3, 2, 3] : c.g === 3 ? [2, 4, 2, 5] : [3, 5, 4, 6];
  const cars = c.R.int(cl, ch);
  const seats = c.R.int(sl, sh);
  const n = cars * seats;
  const skip = Array.from({ length: cars }, (_, i) => numberWord((i + 1) * seats)).join(', ');
  return countBeat(c, level, {
    n,
    vi: 'chiếc ghế',
    noun: 'seats',
    visual: { kind: 'groups', emoji: '🪑', groups: cars, each: seats },
    hint: c.g <= 2 ? 'Đếm lần lượt từng chiếc ghế trên mỗi toa nhé.' : `Mỗi toa có ${seats} ghế – đếm theo từng toa nhé.`,
    first: c.g <= 2 ? undefined : `Có ${cars} toa, mỗi toa ${seats} ghế. Đếm theo từng toa: «${skip}».`,
    near: c.g <= 2 ? [] : [n - seats, n + seats],
  });
}

function bananas(c: Ctx, level: number): Question | null {
  const [lo, hi] = c.g <= 2 ? [3, 10] : c.g === 3 ? [6, 15] : [11, 20];
  const n = c.R.int(lo, Math.min(hi, maxNumber(c.g, c.n)));
  return countBeat(c, level, {
    n,
    vi: 'quả chuối',
    noun: 'bananas',
    visual: { kind: 'objects', emoji: '🍌', groups: [n] },
    hint: 'Chỉ vào từng quả chuối và đếm thật chậm.',
  });
}

/* ---------------- Quầy trái cây của Cô Mèo ---------------- */

const isFruit = (w: Word) => w.pic && hasTag(w, 'fruit');

function shopFruit(c: Ctx, level: number): Question | null {
  if (level <= 1) {
    const w = pickWord(c, isFruit);
    if (!w) return null;
    const ds = distractors(c, w, { ok: isFruit, label: (x) => x.e });
    if (ds.length < c.k - 1) return null;
    const { choices, answer } = wordChoices(c, w, ds, 'e');
    const ask = `Cô Mèo cần mua «${w.w}». Bạn chọn giúp cô nhé!`;
    return mk(c, level, { prompt: ask, speech: ask, choices, answer, hint: meaning(w), steps: wordSteps(w, w.e), en: w.w });
  }
  const w = pickWord(c, (x) => isFruit(x) && !giveaway(x));
  if (!w) return null;
  const ds = distractors(c, w, { ok: isFruit });
  if (ds.length < c.k - 1) return null;
  const { choices, answer } = wordChoices(c, w, ds, 'w');
  const ask = level === 2 ? 'Cô Mèo cần mua loại quả này. Tiếng Anh gọi là gì?' : `Cô Mèo cần mua “${w.vi}”. Tiếng Anh là gì?`;
  return mk(c, level, {
    prompt: ask,
    speech: ask,
    visual: { kind: 'picture', emoji: w.e, caption: level === 2 ? w.vi : undefined, hex: w.hex },
    choices,
    answer,
    hint: letterClue(w.w, ds.map((d) => d.w)),
    steps: wordSteps(w, w.w),
    en: w.w,
  });
}

/* ---------------- Ném bóng ---------------- */

/** Nhóm từ để ném bóng (Lớp 3–5): tên nhóm bằng tiếng Việt. */
const BALL_GROUPS: Record<string, string> = {
  animal: 'con vật',
  fruit: 'trái cây',
  colour: 'màu sắc',
  clothes: 'trang phục',
  transport: 'phương tiện đi lại',
  body: 'bộ phận cơ thể',
};
/** Từ sai lấy từ các nhóm đồ vật rõ ràng khác hẳn nhóm cần ném. */
const BALL_OTHERS = [...Object.keys(BALL_GROUPS), 'school', 'toy', 'home', 'kitchen'];
/** Nhãn dễ khiến bé phân vân với nhóm cần ném (cà chua – trái cây, thịt gà – con vật…). */
const BALL_AVOID: Record<string, string[]> = {
  animal: ['food', 'people', 'family'],
  fruit: ['food', 'veg', 'drink', 'nature'],
  colour: ['shape', 'nature'],
  body: ['illness', 'health', 'feeling'],
};

let tagIndex: Map<string, { any: Set<string>; every: Set<string> }> | null = null;

/** Nhãn của một chữ ở mọi lớp: `any` = có ở ít nhất một nơi, `every` = có ở mọi nơi (fish: con vật/món ăn). */
function tagsOf(s: string): { any: Set<string>; every: Set<string> } {
  if (!tagIndex) {
    tagIndex = new Map();
    for (const w of BANK) {
      const k = w.w.toLowerCase();
      const e = tagIndex.get(k);
      if (!e) {
        tagIndex.set(k, { any: new Set(w.tags), every: new Set(w.tags) });
        continue;
      }
      w.tags.forEach((t) => e.any.add(t));
      for (const t of [...e.every]) if (!w.tags.includes(t)) e.every.delete(t);
    }
  }
  return tagIndex.get(s.toLowerCase()) ?? { any: new Set(), every: new Set() };
}

const ballWord = (w: Word) => /^[a-z]{2,8}$/.test(w.w);

/** Lớp 1–2: ném vào hình đúng của từ được đọc. */
function ballsPicture(c: Ctx, level: number): Question | null {
  const w = pickWord(c, (x) => x.pic && !giveaway(x));
  if (!w) return null;
  const ds = distractors(c, w, { ok: (x) => x.pic, label: (x) => x.e });
  if (ds.length < c.k - 1) return null;
  const { choices, answer } = wordChoices(c, w, ds, 'e');
  const ask = `Ném bóng vào hình «${w.w}».`;
  return mk(c, level, { prompt: ask, speech: ask, choices, answer, hint: meaning(w), steps: wordSteps(w, w.e), en: w.w });
}

/** Lớp 3–5: 5 quả bóng có chữ, ném vào một từ thuộc nhóm (có 2–3 đáp án đúng). */
function ballsGroup(c: Ctx, level: number): Question | null {
  const words = [...c.pool, ...c.prev].filter(ballWord);
  const rightOf = (g: string) => words.filter((w) => tagsOf(w.w).every.has(g));
  const groups = Object.keys(BALL_GROUPS).filter((g) => rightOf(g).length >= 3);
  if (!groups.length) return null;
  const inPool = (g: string) => c.pool.filter((w) => ballWord(w) && tagsOf(w.w).every.has(g)).length;
  const g = c.R.pick(groups.flatMap((x) => (inPool(x) >= 3 ? [x, x, x] : [x])));
  const nRight = c.R.int(2, 3);
  const nWrong = c.k - nRight;
  if (nWrong < 2) return null;
  const chosen: Word[] = [];
  const take = (list: Word[], n: number): Word[] => {
    const out: Word[] = [];
    for (const w of list) {
      if (out.length >= n) break;
      if (chosen.some((x) => x.w === w.w || conflicts(x, w))) continue;
      chosen.push(w);
      out.push(w);
    }
    return out;
  };
  const rank = (list: Word[]) => [...c.R.shuffle(list.filter((w) => c.pool.includes(w))), ...c.R.shuffle(list.filter((w) => !c.pool.includes(w)))];
  const right = take(rank(rightOf(g)), nRight);
  const avoid = [g, ...(BALL_AVOID[g] ?? [])];
  const others = BALL_OTHERS.filter((t) => t !== g);
  const wrongPool = words.filter((w) => {
    const t = tagsOf(w.w);
    return !avoid.some((a) => t.any.has(a)) && others.some((o) => t.any.has(o));
  });
  const wrong = take(rank(wrongPool), nWrong);
  if (right.length < nRight || wrong.length < nWrong) return null;
  c.target = right[0];
  const name = BALL_GROUPS[g];
  const ask = `Hãy ném bóng vào một từ chỉ ${name}.`;
  const list = (ws: Word[]) => ws.map((w) => `«${w.w}» (${w.vi})`).join(', ');
  return mk(c, level, {
    prompt: ask,
    speech: ask,
    choices: c.R.shuffle([...right, ...wrong]).map((w) => ({ label: w.w, value: w.w })),
    answer: right[0].w,
    accept: right.map((w) => w.w),
    hint: `${meaning(wrong[0])} Đó không phải ${name}. Đọc các từ còn lại nhé!`,
    steps: [
      `Các từ không chỉ ${name}: ${list(wrong)}.`,
      `Các từ chỉ ${name}: ${list(right)}.`,
      `Ném vào bất kì từ nào chỉ ${name} đều đúng!`,
    ],
  });
}

const balls = (c: Ctx, level: number) => (c.g <= 2 ? ballsPicture(c, level) : ballsGroup(c, level));

/* ---------------- Bảng tình huống ---------------- */

/** Nhãn ngắn trên vật 3D (đá kê chân, vòng quay): không hỏi câu nghe vì vật không phát được âm. */
const ON_STONES: Partial<EnOptions> = { short: true, listen: false };

export const BEATS: Record<BeatId, BeatSpec> = {
  villageBoxes: { topic: 'en_numbers', build: boxes },
  shopFruit: { topic: 'en_vocab', opts: { tags: ['fruit'], strict: true }, build: shopFruit },
  forestBridge: { topic: 'en_listen' },
  forestRock: { topic: 'en_spell' },
  bearBridge: { topic: 'en_vocab' },
  bearStones: { topic: 'en_vocab', opts: { ...ON_STONES, count: 3 } },
  mazeDoor: { topic: null },
  coaster: { topic: 'en_numbers', build: coaster },
  balls: { topic: 'en_vocab', opts: { short: true, count: 5 }, build: balls },
  wheel: { topic: 'en_vocab', opts: { ...ON_STONES, count: 4 } },
  giraffe: { topic: 'en_vocab', opts: { tags: ['fruit', 'food', 'veg'], strict: true } },
  monkey: { topic: 'en_numbers', build: bananas },
  penguins: { topic: 'en_listen', opts: { tags: ['animal'] } },
};

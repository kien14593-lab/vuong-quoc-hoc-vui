/**
 * Câu hỏi Tiếng Anh riêng của các mini-game, khi vật thể 3D cần đúng loại: món hàng, khối hình – màu,
 * đồng hồ, toa tàu… Mỗi bộ dựng trả về null khi lớp/Unit chưa có đủ từ phù hợp – trò chơi dùng câu hỏi chung.
 * Mọi câu hỏi, gợi ý và ví dụ đều tự soạn.
 */
import { maxLevelFor } from '../math/curriculum';
import type { EnTopic, Question } from '../math/types';
import type { Word } from './bank';
import {
  type Ctx, type EnOptions, distractors, giveaway, hasAny, isStrict, letterClue, makeCtx, meaning, mk, pickWord,
  remember, textChoices, valid, wordChoices, wordSteps,
} from './gen-core';
import { gapFills } from './gen-letters';
import { choiceList, counting, maxNumber, near } from './gen-numbers';
import { nearHours, timeOpen } from './gen-time';
import { G1_LETTERS, clampUnit, phonicsTargets } from './units';
import { ALPHABET, DAYS, DAYS_VI, MONTHS, MONTHS_VI, article, numberWord, spellOut, timeVi, timeWords } from './words';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Thử dựng ở mức `level` (không quá `max` và mức tối đa của lớp), mỗi mức 6 lần, rồi hạ dần mức.
 * Kết quả phải qua `valid` như mọi câu hỏi Tiếng Anh khác.
 */
function tryBuild<T>(
  o: EnOptions,
  topic: EnTopic,
  level: number,
  max: number,
  make: (c: Ctx, L: number) => T | null,
  qOf: (r: T) => Question,
): T | null {
  const top = Math.max(1, Math.min(Math.round(level) || 1, max, maxLevelFor(topic, o.grade)));
  for (let L = top; L >= 1; L--) {
    for (let i = 0; i < 6; i++) {
      const c = makeCtx(o, topic);
      let r: T | null = null;
      try {
        r = make(c, L);
      } catch (e) {
        if (isStrict()) throw e;
      }
      if (r && valid(qOf(r), c)) {
        remember(c.target);
        return r;
      }
    }
  }
  return null;
}

/* ---------------- Món đồ: siêu thị, bánh pizza, cho khỉ ăn ---------------- */

export type ItemKind = 'shop' | 'pizza' | 'monkey';

const ITEM_TAGS: Record<ItemKind, string[]> = {
  shop: ['fruit', 'food', 'veg', 'drink', 'toy', 'school', 'clothes'],
  pizza: ['food', 'veg', 'fruit'],
  monkey: ['fruit'],
};
/** Khỉ: thiếu trái cây đã học thì cho ăn thêm rau củ và đồ ăn (không có thịt, cá). */
const MONKEY_WIDE = ['fruit', 'veg', 'food'];
const ITEM_SKIP = new Set(['number', 'plus', 'minus', 'question', 'lunch', 'salt']);
const MEAT = new Set(['fish', 'chicken', 'meat', 'hot dog']);

const ITEM_TEXT: Record<ItemKind, { want: (w: string) => string; pick: string; look: string; name: string }> = {
  shop: {
    want: (w) => `Mua «${w}» nào!`,
    pick: 'Chạm vào món hàng đúng.',
    look: 'Món hàng này tiếng Anh là gì?',
    name: 'Chạm vào món hàng có tên đúng.',
  },
  pizza: {
    want: (w) => `Đầu bếp cần «${w}»!`,
    pick: 'Chạm vào đĩa đúng nhé.',
    look: 'Đầu bếp cần món này. Tiếng Anh là gì?',
    name: 'Chạm vào đĩa có tên đúng.',
  },
  monkey: {
    want: (w) => `Khỉ muốn ăn «${w}»!`,
    pick: 'Chạm vào món ăn đúng nhé.',
    look: 'Khỉ muốn ăn món này. Tiếng Anh là gì?',
    name: 'Chạm vào món ăn có tên đúng.',
  },
};

function itemFit(kind: ItemKind, tags: string[]): (w: Word) => boolean {
  return (w) =>
    w.pic &&
    hasAny(w, tags) &&
    /^[a-z][a-z ]*$/.test(w.w) &&
    w.w.length <= 8 &&
    !ITEM_SKIP.has(w.w) &&
    !(kind === 'pizza' && w.w === 'pizza') &&
    !(kind === 'monkey' && (w.tags.includes('animal') || MEAT.has(w.w)));
}

/**
 * Một món đồ đúng loại của trò chơi, chỉ trong các từ bé đã học (lớp này đến Unit N, và lớp dưới).
 * L1: nghe/đọc từ → chạm món có hình đúng; L2: nhìn hình → chọn tên; L3: nghĩa tiếng Việt → chọn tên.
 * Nhãn luôn ngắn (hình, hoặc từ ≤ 8 chữ cái). Null nếu chưa học đủ món.
 */
export function itemRound(o: EnOptions, level: number, kind: ItemKind): Question | null {
  const opts: EnOptions = { ...o, short: true, tags: ITEM_TAGS[kind] };
  return tryBuild(
    opts,
    'en_vocab',
    level,
    3,
    (c, L) => {
      let known = [...c.pool, ...c.prev].filter(itemFit(kind, ITEM_TAGS[kind]));
      if (kind === 'monkey' && known.length < c.k) known = [...c.pool, ...c.prev].filter(itemFit(kind, MONKEY_WIDE));
      if (known.length < c.k) return null;
      const set = new Set(known);
      const ok = (x: Word) => set.has(x);
      const w = pickWord(c, (x) => ok(x) && (L === 1 || !giveaway(x)));
      if (!w) return null;
      const t = ITEM_TEXT[kind];
      if (L === 1) {
        const ds = distractors(c, w, { ok, label: (x) => x.e });
        if (ds.length < c.k - 1) return null;
        const ask = t.want(w.w);
        return mk(c, 1, {
          context: t.pick,
          prompt: ask,
          speech: ask,
          ...wordChoices(c, w, ds, 'e'),
          hint: meaning(w),
          steps: wordSteps(w, w.e),
          en: w.w,
        });
      }
      const ds = distractors(c, w, { ok });
      if (ds.length < c.k - 1) return null;
      const base = {
        context: t.name,
        ...wordChoices(c, w, ds, 'w'),
        hint: letterClue(w.w, ds.map((d) => d.w)),
        steps: wordSteps(w, w.w),
        en: w.w,
      };
      if (L === 2) {
        return mk(c, 2, { ...base, prompt: t.look, speech: t.look, visual: { kind: 'picture', emoji: w.e, caption: w.vi } });
      }
      const ask = `“${w.vi}” tiếng Anh là gì?`;
      return mk(c, 3, { ...base, prompt: ask, speech: ask });
    },
    (q) => q,
  );
}

/* ---------------- Bánh pizza: tô số miếng ---------------- */

export interface ToppingRound {
  q: Question;
  /** Số miếng của bánh. */
  pieces: number;
  /** Số miếng cần tô. */
  n: number;
}

/** Tô đúng số miếng bánh đọc bằng tiếng Anh (bé chạm từng miếng rồi bấm nút xong). */
export function toppingRound(o: EnOptions, level: number, done = 'XONG'): ToppingRound | null {
  return tryBuild(
    o,
    'en_numbers',
    level,
    2,
    (c, L) => {
      const pieces = c.g <= 2 ? 6 : 8;
      const hi = Math.min(maxNumber(c.g, c.n), pieces - 1, L === 1 ? 5 : 99);
      const n = c.R.int(2, hi);
      const word = numberWord(n);
      const ds = near(c, n, 1, pieces);
      if (ds.length < c.k - 1) return null;
      const q = mk(c, L, {
        prompt: `Tô «${word}» miếng bánh rồi bấm ${done}!`,
        speech: `Tô «${word}» miếng bánh.`,
        choices: choiceList(c, [n, ...ds], numberWord),
        answer: String(n),
        hint: `Đếm bằng tiếng Anh: «${counting(n)}» – dừng ở «${word}».`,
        steps: [`«${word}» là số ${n}.`, `Đếm từng miếng: «${counting(n)}».`, `Tô ${n} miếng rồi bấm ${done}!`],
        en: word,
      });
      return { q, pieces, n };
    },
    (r) => r.q,
  );
}

/* ---------------- Xây nhà: khối hình và màu ---------------- */

export const BLOCK_SHAPES = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond'] as const;
export type BlockShape = (typeof BLOCK_SHAPES)[number];

export interface Block {
  value: string;
  shape: BlockShape;
  hex: string;
}

export interface BlockRound {
  q: Question;
  /** Các khối (không có chữ – bé chọn theo hình và màu). */
  blocks: Block[];
}

/** Màu tươi cho khối khi chỉ hỏi hình. */
const PAINT = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#fb8c00', '#8e24aa'];
const isShape = (w: Word): boolean => w.tags.includes('shape') && (BLOCK_SHAPES as readonly string[]).includes(w.w);

/**
 * Chọn khối để xây nhà. L1: theo hình («circle»); L2: theo màu («red»); L3: màu + hình («a red star»).
 * Khối không ghi chữ nên bé phải hiểu từ. Chỉ dùng hình/màu đã học; null nếu chưa học đủ 3 hình
 * (Lớp 1, Lớp 2 trước Unit 13). Chưa học màu (Lớp 3 trước Unit 9) thì chỉ hỏi hình.
 */
export function blockRound(o: EnOptions, level: number): BlockRound | null {
  return tryBuild(
    { ...o, count: 3 },
    'en_vocab',
    level,
    3,
    (c, L) => {
      const known = [...c.pool, ...c.prev];
      const shapes = known.filter(isShape);
      const colours = known.filter((w) => w.tags.includes('colour') && !!w.hex);
      if (shapes.length < c.k) return null;
      const mode = colours.length >= c.k ? Math.min(L, 3) : 1;
      const shapeSet = new Set(shapes);
      const colourSet = new Set(colours);
      if (mode === 1) {
        const w = pickWord(c, (x) => shapeSet.has(x));
        if (!w) return null;
        const ds = distractors(c, w, { ok: (x) => shapeSet.has(x) });
        if (ds.length < c.k - 1) return null;
        const paint = c.R.shuffle([...PAINT]);
        const ask = `Chọn khối «${w.w}» để xây nhà nhé!`;
        const { choices, answer } = wordChoices(c, w, ds, 'w');
        const q = mk(c, 1, { prompt: ask, speech: ask, choices, answer, hint: meaning(w), steps: wordSteps(w, w.w), en: w.w });
        return { q, blocks: choices.map((x, i) => ({ value: x.value, shape: x.value as BlockShape, hex: paint[i] })) };
      }
      if (mode === 2) {
        const w = pickWord(c, (x) => colourSet.has(x));
        if (!w) return null;
        const ds = distractors(c, w, { ok: (x) => colourSet.has(x) });
        if (ds.length < c.k - 1) return null;
        const shape = c.R.pick(['square', 'circle', 'star', 'heart'] as BlockShape[]);
        const ask = `Chọn khối màu «${w.w}» nhé!`;
        const { choices, answer } = wordChoices(c, w, ds, 'w');
        const hex = new Map([w, ...ds].map((x) => [x.w, x.hex as string]));
        const q = mk(c, 2, { prompt: ask, speech: ask, choices, answer, hint: meaning(w), steps: wordSteps(w, w.w), en: w.w });
        return { q, blocks: choices.map((x) => ({ value: x.value, shape, hex: hex.get(x.value) as string })) };
      }
      const col = pickWord(c, (x) => colourSet.has(x));
      const shp = c.R.pick(shapes);
      if (!col) return null;
      const otherShape = distractors(c, shp, { ok: (x) => shapeSet.has(x), n: 1 })[0];
      const otherColour = distractors(c, col, { ok: (x) => colourSet.has(x), n: 1 })[0];
      if (!otherShape || !otherColour) return null;
      const combos = [
        { col, shp },
        { col, shp: otherShape },
        { col: otherColour, shp },
      ];
      const name = (x: { col: Word; shp: Word }) => `${x.col.w} ${x.shp.w}`;
      const ans = name(combos[0]);
      const choices = c.R.shuffle(combos.map((x) => ({ label: name(x), value: name(x), x })));
      const phrase = `${article(col.w)} ${ans}`;
      const ask = `Chọn khối «${phrase}» nhé!`;
      const q = mk(c, 3, {
        prompt: ask,
        speech: ask,
        choices: choices.map(({ label, value }) => ({ label, value })),
        answer: ans,
        hint: `Hai từ: «${col.w}» là màu, «${shp.w}» là hình. Tìm khối đúng cả hai.`,
        steps: [meaning(col), meaning(shp), `Đáp án: khối ${shp.vi} ${col.vi}`],
        en: phrase,
      });
      return {
        q,
        blocks: choices.map(({ value, x }) => ({ value, shape: x.shp.w as BlockShape, hex: x.col.hex as string })),
      };
    },
    (r) => r.q,
  );
}

/* ---------------- Đồng hồ: đọc giờ và kéo kim ---------------- */

export interface ClockRound {
  q: Question;
  h: number;
  m: number;
}

const pad2 = (m: number) => String(m).padStart(2, '0');
const wrap12 = (h: number) => ((h - 1 + 12) % 12) + 1;
/** Giá trị đáp án của trò đồng hồ: "7:30" (giờ 1–12). */
export const clockValue = (h: number, m: number): string => `${wrap12(h)}:${pad2(m)}`;

type HM = { h: number; m: number };

const CLOCK_WRONG: Record<number, (h: number) => HM[]> = {
  30: (h) => [{ h: h + 1, m: 30 }, { h, m: 0 }, { h: h - 1, m: 30 }, { h: h + 1, m: 0 }],
  15: (h) => [{ h, m: 45 }, { h, m: 30 }, { h: h - 1, m: 15 }, { h: h + 1, m: 15 }],
  45: (h) => [{ h, m: 15 }, { h, m: 30 }, { h: h + 1, m: 45 }, { h: h - 1, m: 45 }],
};

const READ_HINT: Record<number, string> = {
  0: 'Kim dài chỉ số 12 là giờ đúng: «… o\'clock». Kim ngắn chỉ số mấy?',
  30: 'Kim dài chỉ số 6 là «half past» (rưỡi). Kim ngắn vừa qua số nào?',
  15: 'Kim dài chỉ số 3 là «quarter past» (… giờ 15). Kim ngắn vừa qua số nào?',
  45: 'Kim dài chỉ số 9 là «quarter to» (kém 15). Kim ngắn sắp tới số nào?',
};

const SET_HINT: Record<number, string> = {
  0: '«o\'clock» là giờ đúng: kim dài chỉ số 12, kim ngắn chỉ số giờ.',
  30: '«half past» là rưỡi: kim dài chỉ số 6, kim ngắn đặt ở số giờ.',
  15: '«quarter past» là … giờ 15: kim dài chỉ số 3, kim ngắn đặt ở số giờ.',
};

function readHow(h: number, m: number): string {
  const H = wrap12(h);
  if (m === 0) return `Kim dài chỉ số 12, kim ngắn chỉ số ${H} → ${H} giờ đúng.`;
  if (m === 30) return `Kim dài chỉ số 6 → «half past»; kim ngắn nằm giữa ${H} và ${wrap12(h + 1)} → đã qua ${H} giờ.`;
  if (m === 15) return `Kim dài chỉ số 3 → «quarter past»; kim ngắn vừa qua số ${H}.`;
  return `Kim dài chỉ số 9 → «quarter to» (kém 15); kim ngắn sắp tới số ${wrap12(h + 1)}.`;
}

function setHow(h: number, m: number): string {
  const H = wrap12(h);
  if (m === 0) return `Kéo kim ngắn tới số ${H}, kim dài tới số 12.`;
  return `Kéo kim ngắn tới số ${H}, kim dài tới số ${m / 5}.`;
}

/**
 * Trò đồng hồ. 'read': nhìn đồng hồ → chọn câu «half past seven»; 'set': đọc câu → kéo kim
 * (đáp án "7:30"). L1 giờ đúng, L2 rưỡi, L3 15 phút (kéo kim: chỉ «quarter past»).
 * Lớp 1–3: chỉ giờ đúng. Lớp 4 trước Unit 2 cũng chỉ hỏi giờ đúng (ôn lại).
 */
export function clockRound(o: EnOptions, level: number, mode: 'read' | 'set'): ClockRound | null {
  const t = timeOpen(o.grade, clampUnit(o.grade, o.units ?? null));
  const max = o.grade <= 3 || !t.clock ? 1 : 3;
  return tryBuild(
    o,
    'en_time',
    level,
    max,
    (c, L) => {
      const m = L === 1 ? 0 : L === 2 ? 30 : mode === 'set' ? 15 : c.R.pick([15, 45]);
      const h = c.R.int(1, m === 0 ? t.hours : 12);
      const wrong = m === 0 ? nearHours(c, h, t.hours).map((x) => ({ h: x, m: 0 })) : CLOCK_WRONG[m](h);
      const list: HM[] = [{ h, m }];
      const seen = new Set([clockValue(h, m)]);
      for (const x of wrong) {
        if (list.length >= c.k) break;
        const v = clockValue(x.h, x.m);
        if (seen.has(v)) continue;
        seen.add(v);
        list.push(x);
      }
      if (list.length < c.k) return null;
      const say = timeWords(h, m);
      const answer = clockValue(h, m);
      const label = (x: HM) => (mode === 'read' ? timeWords(x.h, x.m) : clockValue(x.h, x.m));
      const choices = c.R.shuffle(list.map((x) => ({ label: label(x), value: clockValue(x.h, x.m) })));
      if (mode === 'read') {
        const q = mk(c, L, {
          prompt: 'Nhìn đồng hồ: «What time is it?»',
          speech: '«What time is it?»',
          visual: { kind: 'clock', h: wrap12(h), m },
          choices,
          answer,
          hint: READ_HINT[m],
          steps: [readHow(h, m), `${cap(timeVi(h, m))} là «${say}».`, `Đáp án: ${say}`],
          en: `It's ${say}.`,
        });
        return { q, h: wrap12(h), m };
      }
      const q = mk(c, L, {
        prompt: `Kéo kim để chỉ «${say}»`,
        speech: `Kéo kim đồng hồ để chỉ «${say}».`,
        choices,
        answer,
        hint: SET_HINT[m],
        steps: [`«${say}» là ${timeVi(h, m)}.`, setHow(h, m), `Đáp án: ${answer}`],
        en: `It's ${say}.`,
      });
      return { q, h: wrap12(h), m };
    },
    (r) => r.q,
  );
}
/* ---------------- Tàu hỏa: toa còn thiếu ---------------- */

export interface TrainRound {
  q: Question;
  /** Chữ trên 5 toa; toa trống ghi '?'. */
  cars: string[];
  /** Vị trí toa trống. */
  missing: number;
  /** Chữ hiện trên toa trống khi bé chọn đúng. */
  fill: string;
}

const CARS = 5;
const upLow = (ch: string) => ch.toUpperCase() + ch;

/** Sắp theo khoảng cách tới `x` (gần trước), các khoảng cách bằng nhau thì xếp ngẫu nhiên. */
function nearest<T>(c: Ctx, items: T[], dist: (t: T) => number): T[] {
  return items
    .map((t) => ({ t, s: dist(t) + c.R.next() * 0.9 }))
    .sort((a, b) => a.s - b.s)
    .map((x) => x.t);
}

/** Lớp 1–2: 5 chữ cái liền nhau trong bảng chữ cái, thiếu một toa. Chỉ dùng chữ bé đã học tới Unit N. */
function letterTrain(c: Ctx, L: number): TrainRound | null {
  const known = new Set(
    c.g === 1 ? phonicsTargets(1, c.n) : [...G1_LETTERS, ...phonicsTargets(2, c.n).filter((s) => s.length === 1)],
  );
  const starts: number[] = [];
  for (let s = 0; s + CARS <= ALPHABET.length; s++) {
    if (ALPHABET.slice(s, s + CARS).every((x) => known.has(x))) starts.push(s);
  }
  if (!starts.length) return null;
  const first = c.R.pick(starts);
  const run = ALPHABET.slice(first, first + CARS);
  const missing = L === 1 ? c.R.int(1, CARS - 2) : c.R.int(0, CARS - 1);
  const ans = run[missing];
  const at = ALPHABET.indexOf(ans);
  const outside = [...known].filter((x) => !run.includes(x));
  const inside = run.filter((x, i) => i !== missing && Math.abs(i - missing) === 1);
  const wrong = [...nearest(c, outside, (x) => Math.abs(ALPHABET.indexOf(x) - at)), ...c.R.shuffle(inside)].slice(0, c.k - 1);
  if (wrong.length < c.k - 1) return null;
  const choices = c.R.shuffle([ans, ...wrong].map((x) => ({ label: upLow(x), value: x })));
  const order = run.map((x) => x.toUpperCase()).join(', ');
  const near =
    missing > 0
      ? `Sau «${run[missing - 1].toUpperCase()}» là «${ans.toUpperCase()}».`
      : `Trước «${run[1].toUpperCase()}» là «${ans.toUpperCase()}».`;
  const q = mk(c, L, {
    context: 'Chạm vào thùng hàng có chữ cái đúng.',
    prompt: 'Chữ cái nào còn thiếu trên đoàn tàu?',
    speech: 'Chữ cái nào còn thiếu trên đoàn tàu?',
    choices,
    answer: ans,
    hint: `Đọc bảng chữ cái từ «${run[0].toUpperCase()}» rồi dừng ở toa trống.`,
    steps: [`Thứ tự: «${order}».`, near, `Đáp án: ${upLow(ans)}`],
    en: order,
  });
  return { q, cars: run.map((x, i) => (i === missing ? '?' : upLow(x))), missing, fill: upLow(ans) };
}

/** Từ 5 chữ cái có hình, thiếu một chữ ở giữa hoặc cuối (như câu điền chữ, mỗi toa một chữ). */
function spellTrain(c: Ctx, L: number): TrainRound | null {
  const w = pickWord(c, (x) => x.pic && /^[a-z]{5}$/.test(x.w) && !giveaway(x));
  if (!w) return null;
  for (const at of c.R.shuffle(L === 1 ? [1, 2, 3] : [1, 2, 3, 4])) {
    const f = gapFills(c, w.w, at);
    if (!f) continue;
    const q = mk(c, L, {
      context: 'Chạm vào thùng hàng có chữ cái đúng.',
      prompt: 'Toa nào thiếu chữ cái? Ghép thành tên của hình.',
      speech: `Chữ cái nào còn thiếu? «${w.w}»`,
      visual: { kind: 'picture', emoji: w.e, caption: w.vi },
      ...textChoices(c, f.ans, f.wrong),
      hint: `${c.o.listen ? 'Bấm 🔊 nghe lại và chú ý âm ở chỗ trống.' : 'Đọc nhẩm cả từ thật chậm và chú ý chỗ trống.'} Không phải «${f.wrong[0]}».`,
      steps: [meaning(w), `Đánh vần: «${spellOut(w.w)}».`, `Đáp án: ${f.ans}`],
      en: w.w,
    });
    return { q, cars: [...w.w].map((x, i) => (i === at ? '?' : x)), missing: at, fill: w.w[at] };
  }
  return null;
}

/** Số trên toa (chữ số), thùng hàng ghi số bằng tiếng Anh. L1 +1, L2 +2, L3 đếm lùi, L4 (Lớp 4–5) +10. */
function numberTrain(c: Ctx, L: number): TrainRound | null {
  const max = maxNumber(c.g, c.n);
  const top = Math.min(max, 20);
  let seq: number[];
  let hint: string;
  if (L === 4 && c.g >= 4) {
    const s = c.R.int(1, 6) * 10;
    seq = [0, 1, 2, 3, 4].map((i) => s + i * 10);
    hint = 'Mỗi toa tăng 10: «ten, twenty, thirty…»';
  } else if (L >= 3) {
    const s = c.R.int(5, top);
    seq = [0, 1, 2, 3, 4].map((i) => s - i);
    hint = 'Đếm lùi: mỗi toa bớt đi 1.';
  } else if (L === 2) {
    const s = c.R.int(1, top - 8);
    seq = [0, 1, 2, 3, 4].map((i) => s + i * 2);
    hint = 'Mỗi toa tăng 2: đếm cách một số.';
  } else {
    const s = c.R.int(1, top - 4);
    seq = [0, 1, 2, 3, 4].map((i) => s + i);
    hint = 'Mỗi toa tăng 1: đếm tiếp theo thứ tự.';
  }
  const missing = L === 1 ? c.R.int(1, CARS - 2) : c.R.int(0, CARS - 1);
  const ans = seq[missing];
  const lo = Math.min(...seq);
  const hi = Math.max(...seq);
  const cand: number[] = [];
  if (ans % 10 === 0 && ans >= 10) cand.push(10 + ans / 10, ans / 10, lo - 10, hi + 10);
  else if (ans >= 3 && ans <= 9) cand.push(ans + 10);
  else if (ans >= 13 && ans <= 19) cand.push(ans - 10, (ans - 10) * 10);
  if (L === 2) cand.push(...c.R.shuffle([ans - 1, ans + 1]));
  for (let d = 1; d <= 10; d++) cand.push(...c.R.shuffle([lo - d, hi + d]));
  const wrong: number[] = [];
  for (const x of cand) {
    if (wrong.length >= c.k - 1) break;
    if (x < 1 || x > max || seq.includes(x) || wrong.includes(x)) continue;
    wrong.push(x);
  }
  if (wrong.length < c.k - 1) return null;
  const word = numberWord(ans);
  const q = mk(c, L, {
    context: 'Chạm vào thùng hàng có số đúng.',
    prompt: 'Toa trống là số mấy? Chọn số bằng tiếng Anh.',
    speech: 'Toa trống là số mấy?',
    choices: choiceList(c, [ans, ...wrong], numberWord),
    answer: String(ans),
    hint,
    steps: [`Dãy số: ${seq.join(', ')}.`, `Số ${ans} tiếng Anh là «${word}».`, `Đáp án: ${word}`],
    en: seq.map(numberWord).join(', '),
  });
  return { q, cars: seq.map((x, i) => (i === missing ? '?' : String(x))), missing, fill: String(ans) };
}

/** Lớp 4–5: 5 thứ (hoặc tháng) liền nhau, thiếu một toa. */
function calendarTrain(c: Ctx, L: number): TrainRound | null {
  const t = timeOpen(c.g, c.n);
  const kinds = [t.days ? 'days' : null, t.months ? 'months' : null].filter(Boolean) as ('days' | 'months')[];
  if (!kinds.length) return null;
  const isDay = c.R.pick(kinds) === 'days';
  const list = isDay ? DAYS : MONTHS;
  const vi = isDay ? DAYS_VI : MONTHS_VI;
  const s = c.R.int(0, list.length - 1);
  const idx = [0, 1, 2, 3, 4].map((i) => (s + i) % list.length);
  const run = idx.map((i) => list[i]);
  const missing = L === 1 ? c.R.int(1, CARS - 2) : c.R.int(0, CARS - 1);
  const ans = run[missing];
  const outside = list.filter((x) => !run.includes(x));
  const inside = run.filter((x) => x !== ans);
  const wrong = [...c.R.shuffle(outside), ...c.R.shuffle(inside)].slice(0, c.k - 1);
  if (wrong.length < c.k - 1) return null;
  const what = isDay ? 'Thứ' : 'Tháng';
  const near =
    missing > 0 ? `Sau «${run[missing - 1]}» là ${what.toLowerCase()} nào?` : `Trước «${run[1]}» là ${what.toLowerCase()} nào?`;
  const q = mk(c, L, {
    context: 'Chạm vào thùng hàng có chữ đúng.',
    prompt: `${what} nào còn thiếu trên đoàn tàu?`,
    speech: `${what} nào còn thiếu trên đoàn tàu?`,
    ...textChoices(c, ans, wrong),
    hint: near,
    steps: [`Thứ tự: «${run.join(', ')}».`, `${cap(vi[idx[missing]])} là «${ans}».`, `Đáp án: ${ans}`],
    en: run.join(', '),
  });
  return { q, cars: run.map((x, i) => (i === missing ? '?' : x)), missing, fill: ans };
}

/**
 * Trò tàu hỏa theo chủ đề: chữ cái (Lớp 1–2), điền chữ (Lớp 2+), thứ/tháng (Lớp 4–5), số (mọi lớp).
 * Null khi chủ đề không hợp với lớp/Unit – trò chơi thử lại với số đếm.
 */
export function trainRound(o: EnOptions, topic: EnTopic, level: number): TrainRound | null {
  const q = (r: TrainRound) => r.q;
  if (topic === 'en_phonics' && o.grade <= 2) return tryBuild(o, topic, level, 2, letterTrain, q);
  if (topic === 'en_spell' && o.grade >= 2) return tryBuild(o, topic, level, 2, spellTrain, q);
  if (topic === 'en_time' && o.grade >= 4) return tryBuild(o, topic, level, 2, calendarTrain, q);
  if (topic === 'en_numbers') return tryBuild(o, topic, level, 4, numberTrain, q);
  return null;
}
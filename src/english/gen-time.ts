/**
 * Giờ (kiểu Anh), thứ trong tuần, tháng trong năm.
 * Lớp 1–3: chỉ giờ đúng (trò Đồng hồ). Lớp 4: mở dần theo Unit (2: giờ, 3: thứ, 4: tháng). Lớp 5: tất cả.
 */
import type { Choice, Grade, Question } from '../math/types';
import { NAMES } from './frames';
import { type Ctx, mk, textChoices } from './gen-core';
import { maxNumber } from './gen-numbers';
import { DAYS, DAYS_VI, MONTHS, MONTHS_VI, numberWord, thirdPerson, timeVi, timeWords } from './words';

export interface TimeOpen {
  clock: boolean;
  days: boolean;
  months: boolean;
  /** Giờ lớn nhất trên đồng hồ (Lớp 1 chỉ đếm tới 10). */
  hours: number;
}

export function timeOpen(g: Grade, n: number | null): TimeOpen {
  const hours = Math.min(12, maxNumber(g, n));
  if (g <= 3) return { clock: true, days: false, months: false, hours };
  if (g >= 5 || n === null) return { clock: true, days: true, months: true, hours };
  return { clock: n >= 2, days: n >= 3, months: n >= 4, hours };
}

export function timeAvailable(g: Grade, n: number | null): boolean {
  const t = timeOpen(g, n);
  return t.clock || t.days || t.months;
}

interface T {
  h: number;
  m: number;
}

const wrap = (h: number) => ((h - 1 + 12) % 12) + 1;
const val = (t: T) => `${wrap(t.h)}:${String(t.m).padStart(2, '0')}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fits = (s: string, c: Ctx) => !c.o.short || s.length <= 8;

function timeChoices(c: Ctx, ans: T, wrong: T[], label: (t: T) => string): { choices: Choice[]; answer: string } | null {
  const list = [ans];
  const seen = new Set([val(ans)]);
  for (const t of wrong) {
    if (list.length >= c.k) break;
    if (seen.has(val(t))) continue;
    seen.add(val(t));
    list.push(t);
  }
  if (list.length < c.k) return null;
  return { choices: c.R.shuffle(list.map((t) => ({ label: label(t), value: val(t) }))), answer: val(ans) };
}

/** Một câu hỏi đồng hồ: có hình đồng hồ, hoặc (nhãn ngắn) câu tiếng Anh → chọn giờ dạng số "7:30". */
function clockQ(c: Ctx, level: number, t: T, wrong: T[], hint: string, shortHint: string, how: string): Question | null {
  const say = timeWords(t.h, t.m);
  if (c.o.short) {
    const ch = timeChoices(c, t, wrong, val);
    if (!ch) return null;
    return mk(c, level, {
      context: 'Chọn giờ đúng.',
      prompt: `«${say}»`,
      speech: `«${say}»`,
      ...ch,
      hint: shortHint,
      steps: [`«${say}» là ${timeVi(t.h, t.m)}.`, `Viết bằng số: ${val(t)}.`, `Đáp án: ${val(t)}`],
      en: `It's ${say}.`,
    });
  }
  const label = (x: T) => (c.g <= 2 ? timeWords(x.h, x.m) : `It's ${timeWords(x.h, x.m)}.`);
  const ch = timeChoices(c, t, wrong, label);
  if (!ch) return null;
  return mk(c, level, {
    context: 'Nhìn đồng hồ và trả lời.',
    prompt: '«What time is it?»',
    speech: '«What time is it?»',
    visual: { kind: 'clock', h: wrap(t.h), m: t.m },
    ...ch,
    hint,
    steps: [how, `${cap(timeVi(t.h, t.m))} là «${say}».`, `Đáp án: ${label(t)}`],
    en: `It's ${say}.`,
  });
}

/** Giờ gần h (không vượt quá giờ lớn nhất của lớp). */
function nearHours(c: Ctx, h: number, hours: number): number[] {
  const out: number[] = [];
  for (const d of c.R.shuffle([1, -1, 2, -2]).concat([3, -3, 4, -4])) {
    const x = hours < 12 ? h + d : wrap(h + d);
    if (x >= 1 && x <= hours && x !== h && !out.includes(x)) out.push(x);
  }
  return out;
}

function oclockQ(c: Ctx, level: number, hours: number): Question | null {
  const h = c.R.int(1, hours);
  return clockQ(
    c, level, { h, m: 0 },
    nearHours(c, h, hours).map((x) => ({ h: x, m: 0 })),
    'Kim dài chỉ số 12 là giờ đúng: «… o\'clock». Kim ngắn chỉ số mấy?',
    '«o\'clock» là giờ đúng (phút :00). Số đứng trước «o\'clock» là số giờ.',
    `Kim dài chỉ số 12, kim ngắn chỉ số ${h} → ${h} giờ đúng.`,
  );
}

/** Ví dụ ở giờ khác (không trùng phương án) để dạy cách nói mà không lộ đáp án. */
const exampleHour = (h: number) => wrap(h + 5);

function halfQ(c: Ctx, level: number): Question | null {
  const h = c.R.int(1, 12);
  const ex = exampleHour(h);
  return clockQ(
    c, level, { h, m: 30 },
    [{ h: h + 1, m: 30 }, { h, m: 0 }, { h: h - 1, m: 30 }, { h: h + 1, m: 0 }],
    'Kim dài chỉ số 6 là «half past» (rưỡi). Kim ngắn vừa qua số nào?',
    `«half past» là rưỡi: «half past ${numberWord(ex)}» là ${val({ h: ex, m: 30 })}.`,
    `Kim dài chỉ số 6 → «half past»; kim ngắn nằm giữa ${wrap(h)} và ${wrap(h + 1)} → đã qua ${wrap(h)} giờ.`,
  );
}

function quarterQ(c: Ctx, level: number): Question | null {
  const h = c.R.int(1, 12);
  const m = c.R.pick([15, 45]);
  const ex = exampleHour(h);
  const exText = m === 15 ? `quarter past ${numberWord(ex)}` : `quarter to ${numberWord(wrap(ex + 1))}`;
  return clockQ(
    c, level, { h, m },
    m === 15
      ? [{ h, m: 45 }, { h, m: 30 }, { h: h - 1, m: 15 }, { h: h + 1, m: 15 }]
      : [{ h, m: 15 }, { h, m: 30 }, { h: h + 1, m: 45 }, { h: h - 1, m: 45 }],
    'Kim dài chỉ số 3 là «quarter past» (… giờ 15), chỉ số 9 là «quarter to» (kém 15).',
    `${m === 15 ? '«quarter past» là … giờ 15' : '«quarter to» là kém 15'}: «${exText}» là ${val({ h: ex, m })}.`,
    m === 15
      ? `Kim dài chỉ số 3 → «quarter past»; kim ngắn vừa qua số ${wrap(h)}.`
      : `Kim dài chỉ số 9 → «quarter to» (kém 15); kim ngắn sắp tới số ${wrap(h + 1)}.`,
  );
}

/* ---------------- Thứ, tháng ---------------- */

function afterQ(c: Ctx, level: number, list: string[], vi: string[], unit: 'ngày' | 'tháng'): Question | null {
  const L = list.length;
  const at = (i: number) => list[(i + L) % L];
  const idx = c.R.shuffle(list.map((_, i) => i)).filter((i) => fits(at(i), c) && fits(at(i + 1), c));
  if (!idx.length) return null;
  const i = idx[0];
  const wrong = [at(i + 2), at(i - 1), at(i + 3), at(i + 4)].filter((x) => fits(x, c)).slice(0, c.k - 1);
  if (wrong.length < c.k - 1) return null;
  const ask = `Sau «${at(i)}» là ${unit} nào?`;
  const j = (i + 1) % L;
  return mk(c, level, {
    prompt: ask,
    speech: ask,
    ...textChoices(c, at(i + 1), wrong),
    hint: `«${at(i)}» là ${vi[i]}. ${unit === 'ngày' ? 'Ngày' : 'Tháng'} tiếp theo là ${vi[j]}.`,
    steps: [`Thứ tự: «${at(i - 1)}, ${at(i)}, ${at(i + 1)}».`, `${cap(vi[j])} là «${at(i + 1)}».`, `Đáp án: ${at(i + 1)}`],
    en: at(i + 1),
  });
}

const dayAfterQ = (c: Ctx, level: number) => afterQ(c, level, DAYS, DAYS_VI, 'ngày');
const monthAfterQ = (c: Ctx, level: number) => afterQ(c, level, MONTHS, MONTHS_VI, 'tháng');

/** «Today is Monday.» → ngày mai (Lớp 5: cả hôm qua). */
function todayQ(c: Ctx, level: number): Question | null {
  const i = c.R.int(0, 6);
  const tomorrow = c.g < 5 || c.R.chance(0.5);
  const at = (x: number) => DAYS[(x + 7) % 7];
  const j = (i + (tomorrow ? 1 : -1) + 7) % 7;
  const wrong = [at(i), at(tomorrow ? i - 1 : i + 1), at(tomorrow ? i + 2 : i - 2)].slice(0, c.k - 1);
  const ask = tomorrow ? 'Ngày mai là ngày nào?' : 'Hôm qua là ngày nào?';
  return mk(c, level, {
    context: `«Today is ${DAYS[i]}.»`,
    prompt: ask,
    speech: ask,
    ...textChoices(c, DAYS[j], wrong),
    hint: `«today» là hôm nay. ${tomorrow ? 'Ngày mai là ngày ngay sau' : 'Hôm qua là ngày ngay trước'} hôm nay.`,
    steps: [
      `«Today is ${DAYS[i]}.» – Hôm nay là ${DAYS_VI[i]}.`,
      `${tomorrow ? 'Ngày mai' : 'Hôm qua'} là ${DAYS_VI[j]} – «${DAYS[j]}».`,
      `Đáp án: ${DAYS[j]}`,
    ],
    en: tomorrow ? `Tomorrow is ${DAYS[j]}.` : `Yesterday was ${DAYS[j]}.`,
  });
}

/* ---------------- Đọc thời gian biểu ---------------- */

/** Hoạt động trong ngày; giờ theo 24 giờ để giữ đúng thứ tự trong ngày. */
const ACTS = [
  { en: 'get up', vi: 'thức dậy', hs: [5, 6] },
  { en: 'have breakfast', vi: 'ăn sáng', hs: [6] },
  { en: 'go to school', vi: 'đi học', hs: [6, 7] },
  { en: 'have lunch', vi: 'ăn trưa', hs: [11] },
  { en: 'go home', vi: 'về nhà', hs: [16, 17] },
  { en: 'have dinner', vi: 'ăn tối', hs: [18, 19] },
  { en: 'go to bed', vi: 'đi ngủ', hs: [20, 21] },
];

function routineQ(c: Ctx, level: number): Question | null {
  const mins = c.g >= 5 ? [0, 15, 30] : [0, 30];
  for (let tries = 0; tries < 10; tries++) {
    const [ai, bi] = c.R.sample([0, 1, 2, 3, 4, 5, 6], 2).sort((x, y) => x - y);
    const a = ACTS[ai];
    const b = ACTS[bi];
    const ta = { h: c.R.pick(a.hs), m: c.R.pick(mins) };
    const tb = { h: c.R.pick(b.hs), m: c.R.pick(mins) };
    if (ta.h * 60 + ta.m >= tb.h * 60 + tb.m || val(ta) === val(tb)) continue;
    const p = c.R.pick(NAMES);
    const s1 = `${p.name} ${thirdPerson(a.en)} at ${timeWords(ta.h, ta.m)}.`;
    const s2 = `${p.sex === 'm' ? 'He' : 'She'} ${thirdPerson(b.en)} at ${timeWords(tb.h, tb.m)}.`;
    const askA = c.R.chance(0.5);
    const [x, tx, sx, other] = askA ? [a, ta, s1, tb] : [b, tb, s2, ta];
    const wrong = [other, { h: tx.h + 1, m: tx.m }, { h: tx.h, m: tx.m === 30 ? 0 : 30 }, { h: tx.h - 1, m: tx.m }];
    const ch = timeChoices(c, tx, wrong, (t) => timeVi(t.h, t.m));
    if (!ch) continue;
    const ask = `${p.name} ${x.vi} lúc mấy giờ?`;
    return mk(c, level, {
      context: `«${s1} ${s2}»`,
      prompt: ask,
      speech: ask,
      ...ch,
      hint: `Tìm câu có «${thirdPerson(x.en)}» (${x.vi}).`,
      steps: [`Câu: «${sx}»`, `«${timeWords(tx.h, tx.m)}» là ${timeVi(tx.h, tx.m)}.`, `Đáp án: ${timeVi(tx.h, tx.m)}`],
      en: sx,
    });
  }
  return null;
}

type Maker = (c: Ctx, level: number) => Question | null;

function firstOf(c: Ctx, level: number, makers: (Maker | false)[]): Question | null {
  for (const m of c.R.shuffle(makers.filter((x): x is Maker => !!x))) {
    const q = m(c, level);
    if (q) return q;
  }
  return null;
}

export function time(c: Ctx, level: number): Question | null {
  const t = timeOpen(c.g, c.n);
  const L = c.o.short ? Math.min(level, 3) : level;
  let q: Question | null = null;
  if (L >= 4) q = firstOf(c, 4, [t.clock && routineQ, t.days && todayQ]);
  if (!q && L >= 3) q = firstOf(c, 3, [t.clock && quarterQ, t.months && monthAfterQ]);
  if (!q && L >= 2) q = firstOf(c, 2, [t.clock && halfQ, t.days && dayAfterQ]);
  if (!q) q = firstOf(c, 1, [t.clock && ((cc: Ctx, l: number) => oclockQ(cc, l, t.hours)), !t.clock && t.days && dayAfterQ]);
  return q;
}

/**
 * Câu hỏi từ vựng và câu hỏi nghe (từ, câu ngắn) cho mọi lớp.
 */
import type { Question } from '../math/types';
import type { Word } from './bank';
import { frameFor, frameText } from './frames';
import {
  type Ctx, distractors, giveaway, letterClue, meaning, mk, pickWord, viClue, wordChoices, wordSteps,
} from './gen-core';

const fits = (c: Ctx) => (w: Word) => !c.o.short || w.w.length <= 8;
const unitWord = (w: Word) => (w.w.includes(' ') ? 'cụm từ' : 'từ');

/** L1: nghe/đọc từ → chọn hình. */
function wordToPicture(c: Ctx, level: number): Question | null {
  const w = pickWord(c, (x) => x.pic);
  if (!w) return null;
  const ds = distractors(c, w, { ok: (x) => x.pic, label: (x) => x.e });
  if (ds.length < c.k - 1) return null;
  const { choices, answer } = wordChoices(c, w, ds, 'e');
  const ask = `Hình nào là «${w.w}»?`;
  return mk(c, level, { prompt: ask, speech: ask, choices, answer, hint: meaning(w), steps: wordSteps(w, w.e), en: w.w });
}

/** L2: nhìn hình → chọn từ. */
function pictureToWord(c: Ctx, level: number): Question | null {
  const w = pickWord(c, (x) => x.pic && fits(c)(x) && !giveaway(x));
  if (!w) return null;
  const ds = distractors(c, w, { ok: fits(c) });
  if (ds.length < c.k - 1) return null;
  const { choices, answer } = wordChoices(c, w, ds, 'w');
  const ask = 'Hình này tiếng Anh là gì?';
  return mk(c, level, {
    prompt: ask,
    speech: ask,
    visual: { kind: 'picture', emoji: w.e, caption: w.vi, hex: w.hex },
    choices,
    answer,
    hint: letterClue(w.w, ds.map((d) => d.w)),
    steps: wordSteps(w, w.w),
    en: w.w,
  });
}

/** L3: nghĩa tiếng Việt → từ tiếng Anh. */
function viToEn(c: Ctx, level: number): Question | null {
  const w = pickWord(c, (x) => fits(c)(x) && !giveaway(x));
  if (!w) return null;
  const ds = distractors(c, w, { ok: fits(c) });
  if (ds.length < c.k - 1) return null;
  const { choices, answer } = wordChoices(c, w, ds, 'w');
  const ask = `“${w.vi}” tiếng Anh là gì?`;
  return mk(c, level, {
    prompt: ask,
    speech: ask,
    visual: w.pic ? { kind: 'picture', emoji: w.e, hex: w.hex } : undefined,
    choices,
    answer,
    hint: letterClue(w.w, ds.map((d) => d.w)),
    steps: wordSteps(w, w.w),
    en: w.w,
  });
}

/** L4: từ tiếng Anh → nghĩa tiếng Việt. */
function enToVi(c: Ctx, level: number): Question | null {
  const w = pickWord(c, (x) => !giveaway(x));
  if (!w) return null;
  const ds = distractors(c, w, { label: (x) => x.vi });
  if (ds.length < c.k - 1) return null;
  const { choices, answer } = wordChoices(c, w, ds, 'vi');
  const ask = `«${w.w}» nghĩa là gì?`;
  return mk(c, level, { prompt: ask, speech: ask, choices, answer, hint: viClue(w, ds), steps: wordSteps(w, w.vi), en: w.w });
}

/** L5: ôn từ của các lớp dưới bằng một kiểu câu hỏi bất kì. */
function review(c: Ctx, level: number): Question | null {
  if (!c.prev.length) return null;
  const r: Ctx = { ...c, pool: c.prev, prev: c.pool };
  const kinds = c.o.short ? [wordToPicture, pictureToWord, viToEn] : [wordToPicture, pictureToWord, viToEn, enToVi];
  const q = c.R.pick(kinds)(r, level);
  c.target = r.target;
  return q;
}

export function vocab(c: Ctx, level: number): Question | null {
  if (level >= 5) return review(c, level);
  if (level === 1) return wordToPicture(c, level);
  if (level === 2) return pictureToWord(c, level);
  if (level === 3 || c.o.short) return viToEn(c, level);
  return enToVi(c, level);
}

/* ---------------- Nghe ---------------- */

/** L1: nghe từ → chọn hình. */
function listenPicture(c: Ctx, level: number): Question | null {
  const w = pickWord(c, (x) => x.pic);
  if (!w) return null;
  const ds = distractors(c, w, { ok: (x) => x.pic, label: (x) => x.e });
  if (ds.length < c.k - 1) return null;
  const { choices, answer } = wordChoices(c, w, ds, 'e');
  return mk(c, level, {
    prompt: 'Nghe và chọn hình đúng.',
    speech: `Nghe nhé: «${w.w}». Chọn hình đúng.`,
    visual: { kind: 'listen' },
    listen: true,
    choices,
    answer,
    hint: `Bấm 🔊 để nghe lại. ${unitWord(w) === 'từ' ? 'Từ' : 'Cụm từ'} bạn nghe bắt đầu bằng chữ «${w.w[0].toLowerCase()}».`,
    steps: [`Bạn vừa nghe ${unitWord(w)} «${w.w}».`, meaning(w), `Đáp án: ${w.e}`],
    en: w.w,
  });
}

/** L2: nghe từ → chọn từ. */
function listenWord(c: Ctx, level: number): Question | null {
  const w = pickWord(c, fits(c));
  if (!w) return null;
  const ds = distractors(c, w, { ok: fits(c) });
  if (ds.length < c.k - 1) return null;
  const { choices, answer } = wordChoices(c, w, ds, 'w');
  return mk(c, level, {
    prompt: 'Nghe và chọn từ đúng.',
    speech: `Nghe nhé: «${w.w}». Chọn từ đúng.`,
    visual: { kind: 'listen' },
    listen: true,
    choices,
    answer,
    hint: `Bấm 🔊 để nghe lại. ${letterClue(w.w, ds.map((d) => d.w))}`,
    steps: [`Bạn vừa nghe ${unitWord(w)} «${w.w}».`, meaning(w), `Đáp án: ${w.w}`],
    en: w.w,
  });
}

/** L3: nghe một câu ngắn → chọn hình (mọi phương án điền được vào cùng khung câu). */
function listenFrame(c: Ctx, level: number): Question | null {
  const w = pickWord(c, (x) => x.pic && !!frameFor(x));
  if (!w) return null;
  const f = frameFor(w);
  if (!f) return null;
  const ds = distractors(c, w, { ok: (x) => x.pic && frameFor(x)?.key === f.key, label: (x) => x.e });
  if (ds.length < c.k - 1) return null;
  const { choices, answer } = wordChoices(c, w, ds, 'e');
  const text = frameText(f);
  return mk(c, level, {
    prompt: 'Nghe câu và chọn hình đúng.',
    speech: `Nghe nhé: «${text}» Chọn hình đúng.`,
    visual: { kind: 'listen' },
    listen: true,
    choices,
    answer,
    hint: `Bấm 🔊 để nghe lại. Chú ý từ «${w.w}».`,
    steps: [`Câu bạn nghe: «${text}»`, meaning(w), `Đáp án: ${w.e}`],
    en: text,
  });
}

/** Câu hỏi nghe L1–L3 (L4 – nghe đoạn văn – ở gen-sentence). */
export function listenQ(c: Ctx, level: number): Question | null {
  if (level <= 1) return listenPicture(c, level);
  if (level === 2) return listenWord(c, level);
  return listenFrame(c, level);
}

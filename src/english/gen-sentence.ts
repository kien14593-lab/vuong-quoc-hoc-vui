/**
 * Câu hỏi mẫu câu (Lớp 3–5): điền khung câu, hỏi – đáp, ngữ pháp ngắn, đọc/nghe đoạn văn ngắn.
 */
import type { Question, Visual } from '../math/types';
import type { Word } from './bank';
import { NAMES, frameFor, frameGap, frameText } from './frames';
import { type Ctx, distractors, giveaway, letterClue, meaning, mk, pickWord, sentencesOf, textChoices, viq, wordLabel } from './gen-core';
import { GRAMMAR } from './grammar';
import { QA_PATTERNS, gateOpen } from './qa';
import { QA_ITEMS } from './qa-items';
import { MINI_TEXTS } from './texts';

const recentItems: string[] = [];
function noteItem(key: string): void {
  recentItems.push(key);
  if (recentItems.length > 8) recentItems.shift();
}

/** L1: nhìn hình, điền từ vào khung câu (mọi phương án điền vừa cùng khung). */
function frameQ(c: Ctx, level: number): Question | null {
  const she = c.R.chance(0.5);
  const fill = (x: Word) => frameFor(x, she)?.fill ?? '';
  const w = pickWord(c, (x) => x.pic && !!frameFor(x, she) && (!c.o.short || fill(x).length <= 8) && !giveaway(x));
  if (!w) return null;
  const f = frameFor(w, she);
  if (!f) return null;
  const ds = distractors(c, w, {
    ok: (x) => x.pic && frameFor(x, she)?.key === f.key && (!c.o.short || fill(x).length <= 8),
    label: fill,
  });
  if (ds.length < c.k - 1) return null;
  const choices = c.R.shuffle([w, ...ds].map((x) => ({ label: fill(x), value: x.w })));
  const gap = `«${frameGap(f)}»`;
  // Gợi ý tính trên chữ hiện trên nút (“a runny nose”, “swimming”), bỏ mạo từ đứng đầu.
  const ART = /^(a|an|some) (?=\S)/i;
  const core = (s: string) => s.replace(ART, '');
  return mk(c, level, {
    context: 'Nhìn hình, chọn từ đúng điền vào chỗ trống.',
    prompt: gap,
    speech: gap,
    visual: { kind: 'picture', emoji: w.e, caption: w.vi, hex: w.hex },
    choices,
    answer: w.w,
    hint: letterClue(core(f.fill), ds.map((d) => core(fill(d))), ART.exec(f.fill)?.[1]),
    steps: [meaning(w), `Câu đầy đủ: «${frameText(f)}»`, `Đáp án: ${f.fill}`],
    en: frameText(f),
  });
}

/** L2a: hỏi – đáp theo mẫu, câu trả lời ghép từ một từ trong ngân hàng. */
function patternQ(c: Ctx, level: number): Question | null {
  const open = QA_PATTERNS.filter((p) => gateOpen(p.gate, c.g, c.n));
  for (const pat of c.R.shuffle([...open]).slice(0, 5)) {
    const w = pickWord(c, (x) => pat.pick(x) && !giveaway(x));
    if (!w) continue;
    const people = NAMES.filter((n) => !pat.sexed || !w.sex || n.sex === w.sex);
    const p = c.R.pick(people);
    const ds = distractors(c, w, {
      ok: (x) => pat.pick(x) && (!pat.sexed || !x.sex || x.sex === p.sex),
      label: (x) => pat.say(x, p),
    });
    if (ds.length < c.k - 1) continue;
    const q = pat.q(p, w);
    const vi = pat.vi(p, w);
    const say = pat.say(w, p);
    const visual: Visual =
      pat.id === 'colour' ? { kind: 'picture', hex: w.hex } : { kind: 'picture', emoji: w.e, caption: w.vi, hex: w.hex };
    return mk(c, level, {
      context: 'Nhìn hình và chọn câu trả lời đúng.',
      prompt: `«${q}»`,
      speech: `«${q}»`,
      visual,
      choices: c.R.shuffle([w, ...ds].map((x) => ({ label: pat.say(x, p), value: x.w }))),
      answer: w.w,
      hint: `«${q}» nghĩa là ${viq(vi)} ${meaning(w)}`,
      steps: [`«${q}» nghĩa là ${viq(vi)}`, meaning(w), `Đáp án: ${say}`],
      en: `${q} ${say}`,
    });
  }
  return null;
}

/** L2b: hỏi – đáp theo chủ đề Unit (câu tự viết, phương án sai không phải câu trả lời hợp lí). */
function itemQ(c: Ctx, level: number): Question | null {
  const open = QA_ITEMS.filter((it) => it.grade < c.g || (it.grade === c.g && (c.n === null || it.unit <= c.n)));
  const fresh = open.filter((it) => !recentItems.includes(it.q + it.answer));
  const list = fresh.length ? fresh : open;
  if (!list.length) return null;
  const own = list.filter((it) => it.grade === c.g);
  const it = c.R.pick(own.length && c.R.chance(0.7) ? own : list);
  noteItem(it.q + it.answer);
  const { choices, answer } = textChoices(c, it.answer, c.R.sample(it.wrong, Math.min(c.k - 1, it.wrong.length)));
  return mk(c, level, {
    context: 'Chọn câu trả lời đúng.',
    prompt: `«${it.q}»`,
    speech: `«${it.q}»`,
    choices,
    answer,
    hint: `«${it.q}» nghĩa là ${viq(it.vi)} Câu trả lời phải hợp với câu hỏi này.`,
    steps: [`«${it.q}» nghĩa là ${viq(it.vi)}`, `Câu trả lời hợp lí: «${it.answer}»`, `Đáp án: ${it.answer}`],
    en: `${it.q} ${it.answer}`,
  });
}

/** L3: điền ngữ pháp ngắn (am/is/are, a/an, this/these, can, have/has…). */
function grammarQ(c: Ctx, level: number): Question | null {
  const open = GRAMMAR.filter((g) => gateOpen(g.gate, c.g, c.n));
  const pool = [...c.pool, ...c.prev];
  for (const gr of c.R.shuffle([...open]).slice(0, 5)) {
    const it = gr.make(c.R, pool);
    if (!it) continue;
    const wrong = c.R.sample(it.wrong, Math.min(c.k - 1, it.wrong.length));
    if (c.o.short && [it.answer, ...wrong].some((x) => x.length > 8)) continue;
    const { choices, answer } = textChoices(c, it.answer, wrong);
    const visual: Visual | undefined = it.objects
      ? { kind: 'objects', emoji: it.objects.emoji, groups: it.objects.groups }
      : it.emoji
        ? { kind: 'picture', emoji: it.emoji, caption: it.caption }
        : undefined;
    return mk(c, level, {
      context: visual ? 'Nhìn hình và chọn từ đúng để điền vào chỗ trống.' : 'Chọn từ đúng để điền vào chỗ trống.',
      prompt: `«${it.gap}»`,
      speech: `«${it.gap}»`,
      visual,
      choices,
      answer,
      hint: it.rule,
      steps: [it.rule, `Câu đúng: «${it.full}»`, `Đáp án: ${it.answer}`],
      en: it.full,
    });
  }
  return null;
}

/** Đoạn văn 2–3 câu → câu hỏi tiếng Việt, đáp án là hình + nghĩa. `listen` = chỉ nghe, không hiện chữ. */
function textQ(c: Ctx, level: number, listen: boolean): Question | null {
  const open = MINI_TEXTS.filter((t) => gateOpen(t.gate, c.g, c.n));
  for (const mt of c.R.shuffle([...open]).slice(0, 5)) {
    const w = pickWord(c, (x) => mt.pick(x) && !giveaway(x));
    if (!w) continue;
    const ds = distractors(c, w, { ok: (x) => mt.pick(x), label: (x) => x.vi });
    if (ds.length < c.k - 1) continue;
    const { text, ask } = mt.make(w, c.R.pick(NAMES), c.R);
    const sents = sentencesOf(text);
    const i = Math.max(0, sents.findIndex((s) => s.toLowerCase().includes(w.w.toLowerCase())));
    // Chỉ kèm hình khi mọi phương án đều có hình, để không phương án nào “lạc” kiểu.
    const lab = [w, ...ds].every((x) => x.pic) ? wordLabel : (x: Word) => x.vi;
    const choices = c.R.shuffle([w, ...ds].map((x) => ({ label: lab(x), value: x.w })));
    const steps = [`Đoạn văn: «${text}»`, meaning(w), `Đáp án: ${lab(w)}`];
    if (listen) {
      return mk(c, level, {
        prompt: `Nghe đoạn văn rồi trả lời: ${ask}`,
        speech: `Nghe nhé: «${text}» ${ask}`,
        visual: { kind: 'listen' },
        listen: true,
        choices,
        answer: w.w,
        hint: `Bấm 🔊 nghe lại và chú ý câu thứ ${i + 1}.`,
        steps,
        en: text,
      });
    }
    return mk(c, level, {
      context: `«${text}»`,
      prompt: ask,
      speech: ask,
      choices,
      answer: w.w,
      hint: `Đọc kĩ câu thứ ${i + 1}: «${sents[i] ?? text}»`,
      steps,
      en: text,
    });
  }
  return null;
}

/** Câu hỏi nghe L4: nghe đoạn văn ngắn (Lớp 4–5). */
export function listenText(c: Ctx, level: number): Question | null {
  return textQ(c, level, true);
}

export function sentence(c: Ctx, level: number): Question | null {
  if (level <= 1 || (level === 2 && c.o.short)) return frameQ(c, 1);
  if (level === 2) return c.R.chance(0.5) ? (patternQ(c, 2) ?? itemQ(c, 2)) : (itemQ(c, 2) ?? patternQ(c, 2));
  if (level === 3 || c.o.short) return grammarQ(c, 3);
  return textQ(c, 4, false);
}

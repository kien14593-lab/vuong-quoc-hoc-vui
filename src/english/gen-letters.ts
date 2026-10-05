/**
 * Câu hỏi chữ cái – âm đầu (Lớp 1–2) và chính tả (Lớp 2–5).
 */
import type { Question } from '../math/types';
import { type Word, isBankWord } from './bank';
import { COMMON } from './common';
import { type Ctx, giveaway, letterClue, meaning, mk, pickWord, textChoices, weighted, wordChoices, wordSteps, distractors } from './gen-core';
import { hidesSilent } from './silent';
import { G1_LETTERS, G2_SOUNDS, phonicsTargets } from './units';
import { ALPHABET, US_SPELLINGS, VOWELS, spellOut } from './words';

/** Chuỗi là một từ có thật → không dùng làm phương án sai (tránh hai đáp án đúng). */
export function isRealWord(s: string): boolean {
  const x = s.toLowerCase();
  return COMMON.has(x) || isBankWord(x) || US_SPELLINGS.includes(x);
}

const isVowel = (ch: string) => VOWELS.includes(ch);
const CONSONANTS = 'bcdfghklmnprstvw'.split('');
const G2_START = G2_SOUNDS.filter((s) => s.kind === 'start').map((s) => s.sound);
const plain = (min: number, max: number) => new RegExp(`^[a-z]{${min},${max}}$`);
const shuffled = <T>(c: Ctx, a: readonly T[]): T[] => c.R.shuffle([...a]);

/** Từ bắt đầu "sạch" bằng chữ/âm `t`: cat (không phải city, chair), tiger (không phải three, hour)… */
export function startsClean(word: string, t: string): boolean {
  const w = word.toLowerCase();
  if (!w.startsWith(t) || hidesSilent(w, 0, t.length)) return false;
  if (t === 'c') return /^c[aoulr]/.test(w);
  if (t === 'g') return /^g[aoulr]|^g(irl|ift|ive|et)/.test(w);
  if (t === 's') return /^s[^h]/.test(w);
  if (t === 't' || t === 'p') return w[1] !== 'h';
  if (t === 'w') return !/^w[rh]/.test(w);
  if (t === 'k') return !/^kn/.test(w);
  return true;
}

/** Từ bắt đầu bằng chữ/âm `t` và nghe được chữ đó (ví dụ trong lời gợi ý: không lấy «eye» cho «e», «hour» cho «h»). */
const startsHeard = (word: string, t: string) =>
  isVowel(t) ? word.startsWith(t) && !hidesSilent(word, 0, t.length) : startsClean(word, t);

/** Từ bắt đầu bằng chữ/âm dễ nhầm với `t` (cùng chữ hoặc cùng âm: c/k/q, f/ph, s/ce…). */
export function startsAlike(word: string, t: string): boolean {
  const w = word.toLowerCase();
  let a: string[];
  if (['c', 'k', 'q', 'qu'].includes(t)) a = ['c', 'k', 'q'];
  else if (t === 'g' || t === 'j') a = ['g', 'j'];
  else a = [t, ...({ f: ['ph'], s: ['ce', 'ci', 'cy'], n: ['kn'], r: ['wr'], sh: ['ch', 's'] }[t] ?? [])];
  return a.some((x) => w.startsWith(x));
}

/** Chữ cái học sinh đã gặp (ưu tiên làm phương án sai). */
function knownLetters(c: Ctx): string[] {
  if (c.g === 1) return G1_LETTERS;
  if (c.g === 2) return [...G1_LETTERS, ...G2_START.filter((s) => s.length === 1)];
  return ALPHABET;
}

/** Ô chữ của từ; chỗ trống (null) thay cho `len` chữ từ vị trí `at`. */
function tiles(word: string, at: number, len: number): (string | null)[] {
  return [...word.slice(0, at), null, ...word.slice(at + len)];
}

/** Chữ thay vào chỗ trống mà không tạo thành từ có thật (theo thứ tự ưu tiên của `pool`). */
function fills(c: Ctx, word: string, at: number, ans: string, pool: string[], skip?: (made: string) => boolean): string[] | null {
  const pre = word.slice(0, at);
  const post = word.slice(at + ans.length);
  const out: string[] = [];
  for (const x of pool) {
    if (out.length >= c.k - 1) break;
    const made = pre + x + post;
    if (x === ans || out.includes(x) || isRealWord(made) || skip?.(made)) continue;
    out.push(x);
  }
  return out.length >= c.k - 1 ? out : null;
}

/**
 * Chữ đúng và các chữ sai cho chỗ trống một chữ ở vị trí `at` (nguyên âm ↔ nguyên âm, phụ âm ↔ phụ âm).
 * null khi chữ ở đó là chữ câm (w trong write, b trong climb…): bé nghe từ cũng không đoán ra.
 */
export function gapFills(c: Ctx, word: string, at: number): { ans: string; wrong: string[] } | null {
  if (hidesSilent(word, at)) return null;
  const ans = word[at];
  const pool = shuffled(c, isVowel(ans) ? VOWELS : CONSONANTS).filter((x) => !soundsAlike(word, at, ans, x));
  const wrong = fills(c, word, at, ans, pool);
  return wrong ? { ans, wrong } : null;
}

function example(c: Ctx, ok: (x: Word) => boolean, not: Word[]): Word | undefined {
  const fit = (x: Word) => x.pic && !not.includes(x) && !not.some((n) => n.e === x.e) && ok(x);
  return shuffled(c, c.pool.filter(fit))[0] ?? shuffled(c, c.prev.filter(fit))[0];
}

/* ---------------- Âm đầu (Lớp 1–2) ---------------- */

function phonicsTarget(c: Ctx): string {
  const own = phonicsTargets(c.g, c.n);
  if (!own.length || (c.g === 2 && c.R.chance(0.3))) return c.R.pick(G1_LETTERS);
  return weighted(c.R, own, own.map((_, i) => (c.n !== null && i >= own.length - 2 ? 2 : 1)));
}

/** L1: từ nào bắt đầu bằng chữ «b»? (nguyên âm: từ nào có chữ «a»?) */
function startsWithQ(c: Ctx, level: number, t: string): Question | null {
  const vowel = isVowel(t);
  const fit = (x: Word) => x.pic && /^[a-z][a-z ]*$/.test(x.w) && (!c.o.short || x.w.length <= 8);
  const has = (x: Word) => (vowel ? x.w.includes(t) : startsClean(x.w, t));
  const w = pickWord(c, (x) => fit(x) && has(x), true);
  if (!w) return null;
  const ds = distractors(c, w, { ok: (x) => fit(x) && !(vowel ? x.w.includes(t) : startsAlike(x.w, t)) });
  if (ds.length < c.k - 1) return null;
  const { choices, answer } = wordChoices(c, w, ds, 'ew');
  const what = t.length > 1 ? 'âm' : 'chữ';
  const ask = vowel ? `Từ nào có chữ «${t}»?` : `Từ nào bắt đầu bằng ${what} «${t}»?`;
  const look = vowel ? 'Nhìn kĩ từng chữ cái trong mỗi từ.' : 'Nhìn chữ cái đầu tiên của mỗi từ.';
  const ex = example(c, has, [w, ...ds]);
  return mk(c, level, {
    prompt: ask,
    speech: ask,
    choices,
    answer,
    hint: ex ? `${look} Ví dụ: «${ex.w}» ${ex.e} ${vowel ? 'có' : 'bắt đầu bằng'} ${what} «${t}».` : look,
    steps: [vowel ? `«${w.w}» có chữ «${t}».` : `«${w.w}» bắt đầu bằng ${what} «${t}».`, meaning(w), `Đáp án: ${w.e} ${w.w}`],
    en: w.w,
  });
}

/** Chữ/âm đầu của từ (có hình): phonics L2 (t = âm đang học) và chính tả L1 (t = null). */
function firstLetterQ(c: Ctx, level: number, t: string | null): Question | null {
  const ok = (x: Word) =>
    (x.pic || c.g >= 3) && plain(3, 8).test(x.w) && (t ? startsClean(x.w, t) : !hidesSilent(x.w, 0)) && !giveaway(x);
  const w = pickWord(c, ok, !!t);
  if (!w) return null;
  const head = t ?? w.w[0];
  const pool =
    head.length > 1
      ? shuffled(c, ['sh', 'ch', 'th', 'wh', 'qu', 'cl', 'tr', 'st'])
      : [
          ...shuffled(c, knownLetters(c).filter((x) => isVowel(x) === isVowel(head))),
          ...shuffled(c, isVowel(head) ? VOWELS : CONSONANTS),
        ];
  const ds = fills(c, w.w, 0, head, pool, (made) => startsAlike(made, head));
  if (!ds) return null;
  const { choices, answer } = textChoices(c, head, ds);
  const what = head.length > 1 ? 'Âm' : 'Chữ cái';
  const ask = `${what} đầu tiên là gì?`;
  const ex = example(c, (x) => startsHeard(x.w, head), [w]);
  return mk(c, level, {
    prompt: ask,
    speech: `${ask} «${w.w}»`,
    visual: { kind: 'letters', tiles: tiles(w.w, 0, head.length), emoji: w.pic ? w.e : undefined, caption: w.vi },
    choices,
    answer,
    hint: ex
      ? `«${ex.w}» ${ex.e} cũng bắt đầu bằng ${what.toLowerCase()} này.`
      : c.o.listen
        ? `Bấm 🔊 nghe lại ${w.pic ? 'tên hình' : 'từ này'} và chú ý âm đầu tiên.`
        : w.pic
          ? 'Đọc nhẩm tên hình và chú ý âm đầu tiên.'
          : `Nhớ lại từ tiếng Anh nghĩa là “${w.vi}” và chú ý âm đầu tiên.`,
    steps: [`${w.pic ? 'Tên hình' : 'Từ'}: «${w.w}» – ${w.vi}.`, `«${w.w}» bắt đầu bằng «${head}».`, `Đáp án: ${head}`],
    en: w.w,
  });
}

const RHYME = ['bcdegptvz', 'flmnsx', 'ahjk', 'iy', 'quw'];

/** L3: nghe tên chữ cái → chọn chữ (các phương án không vần với nhau). */
function letterListen(c: Ctx, level: number, t: string): Question | null {
  if (!c.o.listen || t.length !== 1) return null;
  const group = RHYME.find((g) => g.includes(t)) ?? t;
  const pool = [...new Set([...shuffled(c, knownLetters(c)), ...shuffled(c, ALPHABET)])];
  const ds = pool.filter((x) => x.length === 1 && !group.includes(x)).slice(0, c.k - 1);
  if (ds.length < c.k - 1) return null;
  const T = t.toUpperCase();
  const ex = example(c, (x) => startsHeard(x.w, t), []);
  return mk(c, level, {
    prompt: 'Nghe và chọn chữ cái đúng.',
    speech: `Nghe nhé: «${t}». Chọn chữ cái đúng.`,
    visual: { kind: 'listen' },
    listen: true,
    choices: c.R.shuffle([t, ...ds].map((x) => ({ label: `${x.toUpperCase()} ${x}`, value: x }))),
    answer: t,
    hint: ex ? `Bấm 🔊 nghe lại. Chữ này đứng đầu từ «${ex.w}» ${ex.e}.` : 'Bấm 🔊 nghe lại tên chữ cái.',
    steps: [`Bạn vừa nghe tên chữ cái «${t}».`, `Đáp án: ${T} ${t}`],
    en: t,
  });
}

export function phonics(c: Ctx, level: number): Question | null {
  const t = phonicsTarget(c);
  if (level >= 3) return letterListen(c, 3, t) ?? firstLetterQ(c, 2, t);
  if (level === 2) return firstLetterQ(c, 2, t);
  return startsWithQ(c, 1, t);
}

/* ---------------- Chính tả (Lớp 2–5) ---------------- */

const CONS_DIGRAPHS = ['sh', 'ch', 'th', 'wh', 'ph', 'ck', 'ng'];
const VOWEL_DIGRAPHS = ['ee', 'ea', 'oo', 'ai', 'ay', 'oa', 'ou', 'ow', 'oi', 'oy', 'ar', 'or', 'er', 'ir', 'ur', 'ie'];

/** Nhóm chữ ghép thường đọc giống nhau (deer – dear, nurse – nirse…). */
const ALIKE_GROUPS = [['ee', 'ea', 'ie'], ['oo', 'ou'], ['ai', 'ay'], ['oi', 'oy'], ['ou', 'ow'], ['oa', 'ow'], ['er', 'ir', 'ur', 'or']];
const R_VOWELS = ['ar', 'er', 'ir', 'or', 'ur'];
const BEFORE_R = ['oo', 'oa', 'ou'];

/**
 * Chữ `x` điền vào chỗ trống (thay cho `ans`) có thể nghe giống hệt từ đúng → không dùng làm phương án sai.
 * Nguyên âm sau nhóm nguyên âm đầu thường là âm nhẹ (teacher – teachar, lantern – lantarn,
 * favourite – favurrite, famous – famoas) nên cũng bỏ.
 */
export function soundsAlike(word: string, at: number, ans: string, x: string): boolean {
  if (ALIKE_GROUPS.some((g) => g.includes(ans) && g.includes(x))) return true;
  const next = word[at + ans.length] ?? '';
  if (next === 'r' && BEFORE_R.includes(ans) && BEFORE_R.includes(x)) return true;
  const m = /[aeiou]+/.exec(word);
  const later = !!m && at >= m.index + m[0].length;
  if (later && R_VOWELS.includes(ans) && R_VOWELS.includes(x)) return true;
  if (later && ans.length === 1 && isVowel(ans) && isVowel(x)) return true;
  const weak = /^(r|s$)/.test(word.slice(at + ans.length));
  if (later && weak && VOWEL_DIGRAPHS.includes(ans) && VOWEL_DIGRAPHS.includes(x)) return true;
  const pair = (a: string, b: string) => (ans === a && x === b) || (ans === b && x === a);
  if (pair('ch', 'ck') || (word[at - 1] === 't' && pair('ch', 'sh'))) return true;
  return pair('c', 'k') || (/[eiy]/.test(next) && pair('c', 's'));
}

/** Chữ ghép nguyên âm đứng trọn một nhóm nguyên âm (không lấy «ur» trong «favourite», «ir» trong «giraffe»). */
const wholeVowel = (word: string, at: number, d: string) =>
  !isVowel(word[at - 1] ?? '') && !isVowel(word[at + d.length] ?? '');

const spellOk = (c: Ctx, min = 3) => (x: Word) =>
  (x.pic || c.g >= 3) && plain(min, c.o.short ? 8 : 10).test(x.w) && !giveaway(x);

function gapQ(c: Ctx, level: number, w: Word, at: number, ans: string, wrong: string[]): Question {
  const { choices, answer } = textChoices(c, ans, wrong);
  const ask = ans.length > 1 ? 'Điền hai chữ cái còn thiếu.' : 'Điền chữ cái còn thiếu.';
  return mk(c, level, {
    prompt: ask,
    speech: `${ask} «${w.w}»`,
    visual: { kind: 'letters', tiles: tiles(w.w, at, ans.length), emoji: w.pic ? w.e : undefined, caption: w.vi },
    choices,
    answer,
    hint: `${c.o.listen ? 'Bấm 🔊 nghe lại và chú ý âm ở chỗ trống.' : 'Đọc nhẩm cả từ thật chậm và chú ý chỗ trống.'} Không phải «${wrong[0]}».`,
    steps: [meaning(w), `Đánh vần: «${spellOut(w.w)}».`, `Đáp án: ${ans}`],
    en: w.w,
  });
}

/** L2: chữ còn thiếu ở giữa hoặc cuối từ (nguyên âm ↔ nguyên âm, phụ âm ↔ phụ âm). */
function middleLetterQ(c: Ctx, level: number): Question | null {
  const w = pickWord(c, spellOk(c, 4));
  if (!w) return null;
  for (const at of shuffled(c, [...Array(w.w.length - 1).keys()].map((i) => i + 1))) {
    const f = gapFills(c, w.w, at);
    if (f) return gapQ(c, level, w, at, f.ans, f.wrong);
  }
  return null;
}

type Spot = { at: number; d: string; fam: string[] };

/** Các chỗ có thể khoét hai chữ ghép trong từ, kèm các chữ ghép thay thế hợp lệ (đủ c.k − 1). */
function digraphSpots(c: Ctx, word: string): { s: Spot; pool: string[] }[] {
  const out: { s: Spot; pool: string[] }[] = [];
  for (const fam of [CONS_DIGRAPHS, VOWEL_DIGRAPHS]) {
    for (const d of fam) {
      for (let i = word.indexOf(d); i >= 0; i = word.indexOf(d, i + 1)) {
        if (fam === VOWEL_DIGRAPHS && !wholeVowel(word, i, d)) continue;
        if (hidesSilent(word, i, d.length)) continue;
        const made = (x: string) => word.slice(0, i) + x + word.slice(i + d.length);
        const pool = fam.filter((x) => x !== d && !soundsAlike(word, i, d, x) && !isRealWord(made(x)));
        if (pool.length >= c.k - 1) out.push({ s: { at: i, d, fam }, pool });
      }
    }
  }
  return out;
}

/** L3: hai chữ ghép còn thiếu (sh, ch, th… / ee, ea, oo…), phương án cùng nhóm. */
function digraphQ(c: Ctx, level: number): Question | null {
  const w = pickWord(c, (x) => spellOk(c, 3)(x) && digraphSpots(c, x.w).length > 0);
  if (!w) return null;
  for (const { s, pool } of shuffled(c, digraphSpots(c, w.w))) {
    const ds = fills(c, w.w, s.at, s.d, shuffled(c, pool));
    if (ds) return gapQ(c, level, w, s.at, s.d, ds);
  }
  return null;
}

const missCache = new Map<string, string[]>();

/** Các cách viết sai hay gặp của một từ (đảo chữ, thiếu/thừa chữ đôi, nhầm nguyên âm, bỏ e cuối). */
export function misspellings(word: string): string[] {
  const hit = missCache.get(word);
  if (hit) return hit;
  const out = new Set<string>();
  const add = (s: string) => {
    if (s !== word && /^[a-z]+$/.test(s) && !isRealWord(s)) out.add(s);
  };
  const n = word.length;
  for (let i = 1; i < n - 1; i++) {
    if (word[i] !== word[i + 1]) add(word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2));
  }
  for (let i = 1; i < n; i++) {
    const ch = word[i];
    if (isVowel(ch)) continue;
    if (ch === word[i - 1]) add(word.slice(0, i) + word.slice(i + 1));
    else if (i < n - 1 && ch !== word[i + 1] && /[bdglmnprt]/.test(ch)) add(word.slice(0, i) + ch + word.slice(i));
  }
  const SWAP: Record<string, string[]> = { a: ['e'], e: ['a', 'i'], i: ['e'], o: ['u'], u: ['o'] };
  for (let i = 0; i < n; i++) for (const r of SWAP[word[i]] ?? []) add(word.slice(0, i) + r + word.slice(i + 1));
  if (n > 3 && word.endsWith('e') && !isVowel(word[n - 2])) add(word.slice(0, -1));
  const list = [...out];
  missCache.set(word, list);
  return list;
}

/** L4: từ nào viết đúng chính tả? */
function correctSpellingQ(c: Ctx, level: number): Question | null {
  const w = pickWord(c, (x) => spellOk(c, 4)(x) && misspellings(x.w).length >= c.k - 1);
  if (!w) return null;
  const wrong = c.R.sample(misspellings(w.w), c.k - 1);
  const { choices, answer } = textChoices(c, w.w, wrong);
  const ask = 'Từ nào viết đúng chính tả?';
  return mk(c, level, {
    prompt: ask,
    speech: `${ask} «${w.w}»`,
    visual: { kind: 'picture', emoji: w.pic ? w.e : undefined, caption: w.vi },
    choices,
    answer,
    hint: letterClue(w.w, wrong),
    steps: wordSteps(w, w.w),
    en: w.w,
  });
}

/** L5: các chữ cái bị xáo trộn → chọn từ đúng (phương án sai là cách xếp khác, không thành từ). */
function scrambleQ(c: Ctx, level: number): Question | null {
  const w = pickWord(c, (x) => spellOk(c, 4)(x) && x.w.length <= 8 && new Set(x.w).size >= 3);
  if (!w) return null;
  const word = w.w;
  const swaps = new Set<string>();
  for (let i = 0; i < word.length; i++) {
    for (let j = i + 1; j < word.length; j++) {
      if (word[i] === word[j]) continue;
      const a = [...word];
      [a[i], a[j]] = [a[j], a[i]];
      const s = a.join('');
      if (!isRealWord(s)) swaps.add(s);
    }
  }
  if (swaps.size < c.k - 1) return null;
  const wrong = c.R.sample([...swaps], c.k - 1);
  let mixed = word;
  const badMix = (s: string) => s === word || wrong.includes(s) || isRealWord(s);
  for (let i = 0; i < 12 && badMix(mixed); i++) mixed = shuffled(c, [...word]).join('');
  if (badMix(mixed)) return null;
  const { choices, answer } = textChoices(c, word, wrong);
  const ask = 'Xếp các chữ cái thành từ đúng.';
  return mk(c, level, {
    prompt: ask,
    speech: `${ask} «${word}»`,
    visual: { kind: 'letters', tiles: [...mixed], emoji: w.pic ? w.e : undefined, caption: w.vi },
    choices,
    answer,
    hint: letterClue(word, wrong),
    steps: wordSteps(w, word),
    en: word,
  });
}

export function spell(c: Ctx, level: number): Question | null {
  if (level <= 1) return firstLetterQ(c, 1, null);
  if (level === 2) return middleLetterQ(c, 2);
  if (level === 3) return digraphQ(c, 3);
  if (level === 4) return correctSpellingQ(c, 4);
  return scrambleQ(c, 5);
}

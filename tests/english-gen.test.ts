import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { BANK, conflicts } from '../src/english/bank';
import { BLOCKED } from '../src/english/common';
import { isCountable } from '../src/english/frames';
import { englishQuestion, forgetRecent, pickSet, resolveTopic, setStrict, type EnOptions, type Word } from '../src/english/gen';
import { balanced, englishParts, giveaway, hasPhrase, sentencesOf, shortLen, viClue, viParts, wordCount } from '../src/english/gen-core';
import { isRealWord, misspellings, soundsAlike } from '../src/english/gen-letters';
import { hidesSilent } from '../src/english/silent';
import { G1_LETTERS, phonicsTargets, unitCount } from '../src/english/units';
import { spellOut } from '../src/english/words';
import { capFoundation, EN_FOUNDATION, EN_GRADE_TOPICS, EN_TOPICS, maxLevelFor } from '../src/math/curriculum';
import type { EnTopic, Grade, Question, Topic } from '../src/math/types';
import { setMathRng } from '../src/math/util';
import { emojiIssues } from './emoji12';

const GRADES: Grade[] = [1, 2, 3, 4, 5];
const SEEDS = Number(process.env.EN_SEEDS) || 10;
const FALLBACK = 'Chọn hình đúng: «cat»';
const BAD = /NaN|undefined|Infinity|null|\[object/;
const VI = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;
const norm = (s: string) => s.trim().toLowerCase();
const tokens = (s: string) => s.toLowerCase().split(/[^a-z']+/).filter(Boolean);

type Variant = { name: string; o: Partial<EnOptions>; exact: boolean };

function variants(g: Grade): Variant[] {
  return [
    { name: 'listen', o: { listen: true }, exact: true },
    { name: 'nolisten', o: { listen: false }, exact: true },
    { name: 'support', o: { listen: true, support: true }, exact: true },
    { name: 'short', o: { listen: true, short: true }, exact: false },
    { name: 'N1', o: { listen: true, units: 1 }, exact: false },
    { name: 'Nmid', o: { listen: true, units: Math.floor(unitCount(g) / 2) }, exact: false },
    { name: 'count', o: { listen: true, count: g <= 2 ? 2 : 6 }, exact: false },
  ];
}

function texts(q: Question): string[] {
  return [q.prompt, q.context ?? '', q.speech, q.hint, ...q.steps, ...q.choices.map((c) => c.label), q.en ?? ''];
}

/** Mọi đoạn tiếng Anh của câu hỏi: q.en, phần «…», nhãn phương án. */
function englishOf(q: Question): string[] {
  return [q.en ?? '', ...texts(q).flatMap(englishParts)];
}

function hasWord(hay: string, needle: string): boolean {
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}($|[^\\p{L}\\p{N}])`, 'iu').test(hay);
}

/** Từ không có emoji nào đúng nghĩa (🧽 là bọt biển, 🗄️ là tủ hồ sơ, 📋 là bìa kẹp giấy) → không bao giờ hiện hình. */
const NO_PICTURE = ['rubber', 'desk', 'board'];
const NO_PICTURE_EMOJI = [...new Set(BANK.filter((w) => NO_PICTURE.includes(w.w)).map((w) => w.e.replace(/\uFE0F/g, '')))];

/** Kiểm tra một câu hỏi; trả về danh sách vi phạm "luật: chi tiết". */
function audit(q: Question, t: EnTopic, L: number, o: EnOptions, v: Variant): string[] {
  const out: string[] = [];
  const bad = (rule: string, detail = '') => out.push(`${rule}: ${detail}`);
  const g = o.grade;
  if (q.prompt === FALLBACK) return [`fallback: ${t} L${L}`];
  const rt = resolveTopic(t, o);
  if (q.topic !== rt) bad('topic', `${q.topic} ≠ ${rt}`);
  if (q.level < 1 || q.level > maxLevelFor(q.topic, g)) bad('level-range', String(q.level));
  const top = Math.max(1, Math.min(L, maxLevelFor(rt, g)));
  if (v.exact && q.level !== top && !(q.topic === 'en_phonics' && top === 3 && q.level === 2)) {
    bad('lowered', `${q.topic} L${top} → L${q.level}`);
  }

  const n = q.choices.length;
  const k = o.count ? Math.max(2, Math.min(g <= 2 ? 3 : 6, o.count)) : g <= 2 || o.support ? 3 : 4;
  if (n < 2 || n > 6 || (g <= 2 && n > 3) || n > k) bad('nchoices', String(n));
  const vals = q.choices.map((c) => c.value);
  const labels = q.choices.map((c) => norm(c.label));
  if (new Set(vals).size !== n || new Set(labels).size !== n || labels.some((l) => !l)) bad('dup', labels.join(' | '));
  if (!vals.includes(q.answer)) bad('answer', q.answer);
  if (o.short) for (const c of q.choices) if (shortLen(c.label) > 8) bad('short', c.label);

  for (const s of texts(q)) {
    if (BAD.test(s)) bad('bad-text', s);
    if (!balanced(s)) bad('unbalanced', s);
    if (emojiIssues(s).length) bad('emoji', s);
  }
  const shownEmoji = [(q.visual as { emoji?: string } | undefined)?.emoji ?? '', ...texts(q)].map((s) => s.replace(/\uFE0F/g, ''));
  for (const e of NO_PICTURE_EMOJI) if (shownEmoji.some((s) => s.includes(e))) bad('no-picture', `${e} ${q.en ?? q.prompt}`);
  for (const e of englishOf(q)) {
    for (const s of sentencesOf(e)) if (wordCount(s) > 8) bad('long-en', s);
    for (const x of tokens(e)) if (BLOCKED.has(x)) bad('blocked', e);
  }
  for (const c of q.choices) for (const x of tokens(`${c.label} ${c.value}`)) if (BLOCKED.has(x)) bad('blocked', c.value);
  if (!q.en) bad('no-en', q.prompt);

  if (!o.listen) {
    if (q.listen || q.visual?.kind === 'listen') bad('listen-off', q.prompt);
    if (texts(q).some((s) => s.includes('🔊'))) bad('listen-off-icon', q.hint);
  }
  if (q.listen) {
    if (!q.en) bad('listen-en', q.prompt);
    else {
      const shown = `${q.prompt} ${q.context ?? ''}`;
      if (shown.includes(`«${q.en}»`) || (q.en.length >= 3 && hasWord(shown, q.en))) bad('listen-shown', shown);
    }
  }
  if (!VI.test(q.hint)) bad('hint-vi', q.hint);
  if (!q.steps.length || q.steps.some((s) => !s.trim())) bad('steps', q.steps.join(' / '));

  const answerLabel = q.choices.find((c) => c.value === q.answer)?.label ?? '';
  const al = answerLabel.replace(/[^\p{L}\p{N}', -]/gu, '').trim();
  const rule = q.choices.every((c) => hasWord(q.hint, c.label.trim()));
  const range = /^\d+$/.test(al) && new RegExp(`từ \\d+ đến \\d+`).test(q.hint);
  const shownQ = `${q.prompt} ${q.context ?? ''}`;
  // Cả nhãn lẫn từng nghĩa tách dấu phẩy ("thời gian, giờ" → "thời gian", "giờ").
  const parts = [al, ...al.split(/\s*,\s*/)].map((p) => p.trim()).filter((p) => p.length >= 2);
  const leak = parts.find((p) => hasWord(q.hint, p) && !hasWord(shownQ, p));
  if (leak && !rule && !range) bad('hint-answer', `${leak} ⊂ ${q.hint}`);
  if (q.en && /^\d+$/.test(q.answer) && q.hint.includes(`«${q.en}» ${q.answer}`)) bad('hint-number', q.hint);

  if (q.visual?.kind === 'letters') {
    const tiles = q.visual.tiles;
    const gap = tiles.indexOf(null);
    if (gap >= 0) {
      const fill = (x: string) => tiles.map((c) => (c === null ? x : c)).join('');
      if (q.en && fill(q.answer).toLowerCase() !== q.en.toLowerCase()) bad('letters-fill', `${fill(q.answer)} ≠ ${q.en}`);
      if (q.en && hidesSilent(q.en, gap, q.answer.length)) bad('silent-gap', `${fill('_'.repeat(q.answer.length))} «${q.answer}»`);
      for (const c of q.choices) {
        if (c.value !== q.answer && (isRealWord(fill(c.value)) || BLOCKED.has(fill(c.value)))) bad('letters-real', fill(c.value));
      }
    } else {
      const word = (q.en ?? '').toLowerCase();
      const mixed = tiles.join('');
      if ([...mixed].sort().join('') !== [...word].sort().join('')) bad('scramble-letters', `${mixed} / ${word}`);
      if (mixed === word || isRealWord(mixed)) bad('scramble-real', mixed);
    }
    for (const c of tiles) if (c !== null && !/^[a-z]$/i.test(c)) bad('tile', String(c));
  }
  if (q.topic === 'en_spell') {
    if (q.level >= 4) for (const c of q.choices) if (c.value !== q.answer && isRealWord(c.value)) bad('spell-real', c.value);
    if (q.en && q.en.length > 1 && q.hint.includes(spellOut(q.en))) bad('spell-hint', q.hint);
  }
  if (q.topic === 'en_vocab' && q.level >= 2 && q.level <= 4) {
    const w = BANK.find((x) => x.w === q.en);
    if (w && giveaway(w)) bad('giveaway', w.w);
  }
  return out;
}

function runGrade(g: Grade): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const v of variants(g)) {
    const o: EnOptions = { grade: g, ...v.o };
    for (const t of EN_TOPICS) {
      const maxL = Math.max(1, maxLevelFor(resolveTopic(t, o), g));
      for (let L = 1; L <= maxL; L++) {
        for (let s = 0; s < SEEDS; s++) {
          forgetRecent();
          setMathRng(Rng.seeded(`${g}|${v.name}|${t}|${L}|${s}`));
          const q = englishQuestion(t, L, o);
          for (const x of audit(q, t, L, o, v)) {
            const rule = x.slice(0, x.indexOf(':'));
            const list = found.get(rule) ?? [];
            if (list.length < 6) list.push(`g${g} ${v.name} ${t} L${L} #${s} → ${x}`);
            found.set(rule, list);
          }
        }
      }
    }
  }
  return found;
}

describe('Bộ sinh câu hỏi Tiếng Anh – mọi lớp × chủ đề × mức × tùy chọn', () => {
  setStrict(true);
  for (const g of GRADES) {
    it(`Lớp ${g}`, () => {
      const found = runGrade(g);
      expect([...found.values()].flat()).toEqual([]);
    }, 120000);
  }
});

describe('Bộ sinh câu hỏi Tiếng Anh – hàm trợ giúp', () => {
  setStrict(true);

  it('soundsAlike: chữ thay vào mà nghe giống hệt thì không dùng làm phương án sai', () => {
    const yes: [string, number, string, string][] = [
      ['teeth', 1, 'ee', 'ea'], ['house', 1, 'ou', 'ow'], ['cat', 0, 'c', 'k'], ['pencil', 3, 'c', 's'],
      ['teacher', 5, 'e', 'a'], ['favourite', 3, 'ou', 'oo'], ['kitchen', 3, 'ch', 'sh'], ['duck', 2, 'ck', 'ch'],
    ];
    const no: [string, number, string, string][] = [['shorts', 0, 'sh', 'ch'], ['cat', 1, 'a', 'o']];
    for (const [w, at, a, x] of yes) expect(soundsAlike(w, at, a, x), `${w}: ${a} → ${x}`).toBe(true);
    for (const [w, at, a, x] of no) expect(soundsAlike(w, at, a, x), `${w}: ${a} → ${x}`).toBe(false);
  });

  it('misspellings: lỗi viết hay gặp, không bao giờ là từ có thật', () => {
    expect(misspellings('rabbit')).toContain('rabit');
    expect(misspellings('school').length).toBeGreaterThan(0);
    for (const w of ['rabbit', 'school', 'teacher', 'kitchen', 'favourite', 'apple', 'house', 'pencil']) {
      for (const m of misspellings(w)) {
        expect(m).not.toBe(w);
        expect(m).toMatch(/^[a-z]+$/);
        expect(isRealWord(m), `${w} → ${m}`).toBe(false);
      }
    }
  });

  it('isCountable: chỉ danh từ đếm được, số ít, có hình', () => {
    expect(isCountable(BANK.find((w) => w.w === 'cat')!)).toBe(true);
    const notNouns = BANK.filter((w) => w.tags.some((t) => ['action', 'adj', 'colour', 'feeling', 'weather'].includes(t)));
    expect(notNouns.length).toBeGreaterThan(20);
    for (const w of notNouns) expect(isCountable(w), w.w).toBe(false);
    for (const w of BANK.filter(isCountable)) expect(w.pic && !w.pw && !w.nc, w.w).toBe(true);
  });

  it('pickSet: hình khác nhau, không gây nhầm, đúng nhãn và độ dài', () => {
    const check = (ws: Word[], n: number) => {
      expect(ws.length).toBe(n);
      expect(new Set(ws.map((w) => w.e)).size).toBe(n);
      for (const w of ws) expect(w.pic, w.w).toBe(true);
      for (let i = 0; i < ws.length; i++) {
        for (let j = i + 1; j < ws.length; j++) expect(conflicts(ws[i], ws[j]), `${ws[i].w} / ${ws[j].w}`).toBe(false);
      }
    };
    for (const g of GRADES) {
      for (let s = 0; s < 5; s++) {
        setMathRng(Rng.seeded(`set|${g}|${s}`));
        check(pickSet({ grade: g }, { n: 8, pic: true }), 8);
        check(pickSet({ grade: g, units: 1 }, { n: 6, pic: true }), 6);
        const food = pickSet({ grade: g, short: true }, { n: 4, tags: ['fruit', 'food'], pic: true });
        check(food, 4);
        for (const w of food) {
          expect(w.tags.some((t) => t === 'fruit' || t === 'food'), w.w).toBe(true);
          expect(w.w.length, w.w).toBeLessThanOrEqual(8);
        }
      }
    }
  });

  it('resolveTopic: chủ đề thật sự dùng theo lớp, giọng đọc và Unit', () => {
    const r = (t: EnTopic, o: EnOptions) => resolveTopic(t, o);
    expect(r('en_sentence', { grade: 1 })).toBe('en_vocab');
    expect(r('en_sentence', { grade: 2 })).toBe('en_vocab');
    expect(r('en_sentence', { grade: 3 })).toBe('en_sentence');
    expect(r('en_phonics', { grade: 2 })).toBe('en_phonics');
    expect(r('en_phonics', { grade: 3 })).toBe('en_spell');
    expect(r('en_spell', { grade: 1 })).toBe('en_phonics');
    expect(r('en_spell', { grade: 2 })).toBe('en_spell');
    expect(r('en_listen', { grade: 3, listen: true })).toBe('en_listen');
    expect(r('en_listen', { grade: 3 })).toBe('en_vocab');
    expect(r('en_listen', { grade: 3, listen: false })).toBe('en_vocab');
    expect(r('en_time', { grade: 4, units: 1 })).toBe('en_numbers');
    expect(r('en_time', { grade: 4, units: 2 })).toBe('en_time');
    expect(r('en_time', { grade: 4 })).toBe('en_time');
    expect(r('en_time', { grade: 1, units: 1 })).toBe('en_time');
    expect(r('en_vocab', { grade: 5 })).toBe('en_vocab');
  });

  it('capFoundation: số đếm, giờ – lịch chiếm khoảng 20%, không sửa bảng cũ', () => {
    const topics = EN_GRADE_TOPICS[4];
    const share = (out: Partial<Record<Topic, number>>) => {
      const w = (t: Topic) => Math.max(0.05, out[t] ?? 1);
      const F = topics.filter((t) => EN_FOUNDATION.includes(t)).reduce((a, t) => a + w(t), 0);
      return F / topics.reduce((a, t) => a + w(t), 0);
    };
    const empty: Partial<Record<Topic, number>> = {};
    expect(share(capFoundation(topics, empty))).toBeCloseTo(0.2, 6);
    expect(empty).toEqual({});
    const weights: Partial<Record<Topic, number>> = { en_vocab: 2, en_numbers: 3, en_time: 0.5 };
    const copy = { ...weights };
    const out = capFoundation(topics, weights);
    expect(weights).toEqual(copy);
    expect(out.en_vocab).toBe(2);
    expect(share(out)).toBeCloseTo(0.2, 6);
    const low: Partial<Record<Topic, number>> = { en_numbers: 0.1, en_time: 0.1 };
    expect(capFoundation(topics, low)).toBe(low);
    const math: Partial<Record<Topic, number>> = { add: 2 };
    expect(capFoundation(['add', 'sub'], math)).toBe(math);
  });

  it('Âm đầu Lớp 1–2 chỉ hỏi chữ/âm của Unit 1..N (Lớp 2 được ôn chữ Lớp 1)', () => {
    for (const g of [1, 2] as Grade[]) {
      for (let N = 1; N <= unitCount(g); N++) {
        const own = phonicsTargets(g, N);
        const allowed = new Set(g === 1 ? own : [...own, ...G1_LETTERS]);
        for (let L = 1; L <= 3; L++) {
          for (let s = 0; s < 4; s++) {
            forgetRecent();
            setMathRng(Rng.seeded(`ph|${g}|${N}|${L}|${s}`));
            const q = englishQuestion('en_phonics', L, { grade: g, units: N, listen: true });
            if (q.topic !== 'en_phonics') continue;
            const t = q.level === 1 ? /«([a-z]+)»/.exec(q.prompt)?.[1] ?? '' : q.answer;
            expect(allowed.has(t), `Lớp ${g} Unit ${N} mức ${q.level}: «${t}»`).toBe(true);
          }
        }
      }
    }
  }, 60000);

  it('Tùy chọn lạ (mức, Unit, số lựa chọn, nhãn) vẫn cho câu hỏi hợp lệ', () => {
    const odd: [number, Partial<EnOptions>][] = [
      [0, {}], [99, {}], [NaN, {}], [-3, {}], [2.6, {}],
      [2, { units: 0 }], [2, { units: 999 }], [2, { units: -4 }], [2, { units: NaN }], [2, { units: 1.4 }],
      [2, { count: 1 }], [2, { count: 99 }], [3, { count: 0 }], [2, { tags: ['không-có'] }], [2, { tags: [] }],
    ];
    for (const g of GRADES) {
      for (const t of EN_TOPICS) {
        for (const [L, extra] of odd) {
          forgetRecent();
          setMathRng(Rng.seeded(`odd|${g}|${t}|${L}|${JSON.stringify(extra)}`));
          const o: EnOptions = { grade: g, listen: true, ...extra };
          const q = englishQuestion(t, L, o);
          expect(audit(q, t, L, o, { name: 'odd', o: extra, exact: false }), `Lớp ${g} ${t} L${L} ${JSON.stringify(extra)}`).toEqual([]);
        }
      }
    }
  }, 60000);

  it('tags + strict: trò chơi chỉ nhận từ đúng loại', () => {
    for (const g of GRADES) {
      for (let s = 0; s < 8; s++) {
        forgetRecent();
        setMathRng(Rng.seeded(`strict|${g}|${s}`));
        const q = englishQuestion('en_vocab', 1, { grade: g, tags: ['fruit'], strict: true, listen: true });
        expect(BANK.some((w) => w.w === q.en && w.tags.includes('fruit')), `Lớp ${g}: ${q.en}`).toBe(true);
      }
    }
  });

  it('viClue không để lộ nghĩa đúng ("«weather» nói về thời tiết")', () => {
    expect(viParts('thời gian, giờ')).toEqual(['thời gian', 'giờ']);
    expect(hasPhrase('«weather» nói về thời tiết.', 'thời tiết')).toBe(true);
    expect(hasPhrase('cats', 'cat')).toBe(false);
    expect(hasPhrase('Đọc', 'c')).toBe(false);
    for (const w of BANK) {
      const h = viClue(w, []).replace(/«[^»]*»/g, '');
      for (const p of viParts(w.vi)) expect(hasPhrase(h, p), `${w.w}: ${viClue(w, [])}`).toBe(false);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { BANK } from '../src/english/bank';
import { BEATS } from '../src/english/beats';
import { beatOptions, beatQuestion, beatTopic, forgetRecent, setStrict, type EnOptions } from '../src/english/gen';
import { balanced, englishParts, sentencesOf, shortLen, wordCount } from '../src/english/gen-core';
import { unitCount } from '../src/english/units';
import { maxLevelFor } from '../src/math/curriculum';
import type { BeatId } from '../src/math/scripted';
import type { Grade, Question } from '../src/math/types';
import { setMathRng } from '../src/math/util';
import { emojiIssues } from './emoji12';

const GRADES: Grade[] = [1, 2, 3, 4, 5];
const BEAT_IDS = Object.keys(BEATS) as BeatId[];
const SEEDS = 12;
const BAD = /NaN|undefined|Infinity|null|\[object/;
const VI = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;
const FALLBACK = 'Chọn hình đúng: «cat»';

const tagsAll = (w: string) => BANK.filter((x) => x.w === w).map((x) => x.tags);

function variants(g: Grade): { name: string; o: Partial<EnOptions> }[] {
  return [
    { name: 'listen', o: { listen: true } },
    { name: 'nolisten', o: { listen: false } },
    { name: 'support', o: { listen: true, support: true } },
    { name: 'N1', o: { listen: true, units: 1 } },
    { name: 'Nmid', o: { listen: true, units: Math.floor(unitCount(g) / 2) } },
  ];
}

function audit(beat: BeatId, q: Question, o: EnOptions): string[] {
  const out: string[] = [];
  const bad = (rule: string, d = '') => out.push(`${rule}: ${d}`);
  const opts = { ...o, ...beatOptions(beat) };
  if (q.prompt === FALLBACK) bad('fallback', beat);
  const n = q.choices.length;
  const vals = q.choices.map((c) => c.value);
  const labels = q.choices.map((c) => c.label.trim().toLowerCase());
  if (n < 2 || (o.grade <= 2 && n > 3)) bad('nchoices', String(n));
  if (new Set(vals).size !== n || new Set(labels).size !== n) bad('dup', labels.join(' | '));
  if (!vals.includes(q.answer)) bad('answer', q.answer);
  for (const a of q.accept ?? []) if (!vals.includes(a)) bad('accept', a);
  if (opts.short) for (const c of q.choices) if (shortLen(c.label) > 8) bad('short', c.label);
  if (opts.count && n > opts.count) bad('count', String(n));
  const texts = [q.prompt, q.context ?? '', q.speech, q.hint, ...q.steps, ...q.choices.map((c) => c.label), q.en ?? ''];
  for (const s of texts) {
    if (BAD.test(s)) bad('bad-text', s);
    if (!balanced(s)) bad('unbalanced', s);
    if (emojiIssues(s).length) bad('emoji', s);
  }
  for (const e of [q.en ?? '', ...texts.flatMap(englishParts)]) {
    for (const s of sentencesOf(e)) if (wordCount(s) > 8) bad('long-en', s);
  }
  if (!VI.test(q.hint)) bad('hint-vi', q.hint);
  if (!q.steps.length) bad('steps', '');
  if (!opts.listen && (q.listen || q.visual?.kind === 'listen')) bad('listen-off', q.prompt);
  if (q.level < 1 || q.level > maxLevelFor(q.topic, o.grade)) bad('level', `${q.topic} L${q.level}`);
  const t = beatTopic(beat, o);
  if (t && q.topic !== t) bad('topic', `${q.topic} ≠ ${t}`);
  return out;
}

/** Kiểm tra riêng của những tình huống có câu hỏi tự dựng (để chắc không rơi về câu hỏi chung). */
function special(beat: BeatId, q: Question, g: Grade): string[] {
  const out: string[] = [];
  const bad = (rule: string, d = '') => out.push(`${beat}-${rule}: ${d}`);
  const v = q.visual;
  switch (beat) {
    case 'villageBoxes':
      if (q.answer !== '3' || v?.kind !== 'objects' || v.emoji !== '📦') bad('boxes', q.prompt);
      if (g >= 3 && !q.prompt.includes('«How many boxes?»')) bad('ask', q.prompt);
      break;
    case 'coaster':
      if (v?.kind !== 'groups' || String(v.groups * v.each) !== q.answer) bad('seats', `${q.answer}`);
      break;
    case 'monkey':
      if (v?.kind !== 'objects' || v.emoji !== '🍌' || String(v.groups[0]) !== q.answer) bad('bananas', q.answer);
      break;
    case 'shopFruit':
      if (!tagsAll(q.answer).some((t) => t.includes('fruit'))) bad('fruit', q.answer);
      break;
    case 'balls':
      if (g <= 2) {
        if (q.accept || q.choices.length !== 3) bad('g12', q.prompt);
      } else {
        const m = /từ chỉ (.+)\.$/.exec(q.prompt);
        const group = { 'con vật': 'animal', 'trái cây': 'fruit', 'màu sắc': 'colour', 'trang phục': 'clothes', 'phương tiện đi lại': 'transport', 'bộ phận cơ thể': 'body' }[m?.[1] ?? ''];
        if (!group) bad('group', q.prompt);
        else {
          if (q.choices.length !== 5 || !q.accept || q.accept.length < 2 || q.accept.length > 3) bad('accept', String(q.accept));
          for (const c of q.choices) {
            const tags = tagsAll(c.value);
            const right = q.accept?.includes(c.value);
            if (right && !tags.every((t) => t.includes(group))) bad('right', `${c.value} ∉ ${group}`);
            if (!right && tags.some((t) => t.includes(group))) bad('wrong', `${c.value} ∈ ${group}`);
          }
        }
      }
      break;
  }
  return out;
}

describe('Câu hỏi Tiếng Anh cho các tình huống trong truyện', () => {
  setStrict(true);
  for (const g of GRADES) {
    it(`Lớp ${g}: mọi tình huống × tùy chọn × mức đều hợp lệ`, () => {
      const found: string[] = [];
      for (const v of variants(g)) {
        const o: EnOptions = { grade: g, ...v.o };
        for (const beat of BEAT_IDS) {
          const t = beatTopic(beat, o) ?? 'en_vocab';
          for (let L = 1; L <= Math.max(1, maxLevelFor(t, g)); L++) {
            for (let s = 0; s < SEEDS; s++) {
              forgetRecent();
              setMathRng(Rng.seeded(`beat|${g}|${v.name}|${beat}|${L}|${s}`));
              const q = beatQuestion(beat, t, L, o);
              for (const x of [...audit(beat, q, o), ...special(beat, q, g)]) {
                if (found.length < 30) found.push(`g${g} ${v.name} ${beat} L${L} #${s} → ${x}`);
              }
            }
          }
        }
      }
      expect(found).toEqual([]);
    }, 60000);
  }

  it('chủ đề của tình huống theo lớp và giọng đọc', () => {
    expect(beatTopic('forestRock', { grade: 1 })).toBe('en_phonics');
    expect(beatTopic('forestRock', { grade: 4 })).toBe('en_spell');
    expect(beatTopic('forestBridge', { grade: 3, listen: false })).toBe('en_vocab');
    expect(beatTopic('forestBridge', { grade: 3, listen: true })).toBe('en_listen');
    expect(beatTopic('mazeDoor', { grade: 3 })).toBeNull();
    // Đá kê chân và vòng quay là vật 3D: nhãn ngắn, không hỏi câu nghe.
    expect(beatOptions('bearStones')).toMatchObject({ short: true, listen: false, count: 3 });
    expect(beatTopic('wheel', { grade: 5, listen: true })).toBe('en_vocab');
  });

  it('ném bóng Lớp 3–5 có nhiều nhóm từ khác nhau', () => {
    const groups = new Set<string>();
    for (const g of [3, 4, 5] as Grade[]) {
      for (let s = 0; s < 40; s++) {
        setMathRng(Rng.seeded(`groups|${g}|${s}`));
        const q = beatQuestion('balls', 'en_vocab', 2, { grade: g, listen: true });
        groups.add(/từ chỉ (.+)\.$/.exec(q.prompt)?.[1] ?? q.prompt);
      }
    }
    expect(groups.size).toBeGreaterThanOrEqual(4);
  });
});

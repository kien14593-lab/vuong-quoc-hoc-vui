import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { BANK, gradeWords, type Word } from '../src/english/bank';
import { forgetRecent, setStrict, type EnOptions } from '../src/english/gen';
import { balanced, shortLen } from '../src/english/gen-core';
import {
  BLOCK_SHAPES,
  blockRound,
  clockRound,
  clockValue,
  itemRound,
  toppingRound,
  trainRound,
  type ItemKind,
} from '../src/english/mini';
import { G1_LETTERS, phonicsTargets, unitCount } from '../src/english/units';
import { ALPHABET, DAYS, MONTHS, numberWord } from '../src/english/words';
import { EN_TOPICS } from '../src/math/curriculum';
import type { EnTopic, Grade, Question } from '../src/math/types';
import { setMathRng } from '../src/math/util';
import { MINI_ORDER, miniCard, miniShort } from '../src/minigames/registry';
import { emojiIssues } from './emoji12';

/**
 * Câu hỏi Tiếng Anh riêng của mini-game (english/mini.ts): món hàng, tô bánh, khối hình – màu, đồng hồ, toa tàu.
 * Mỗi bộ dựng chỉ dùng từ bé đã học (lớp này tới Unit N và các lớp dưới), vật thể 3D khớp với đáp án,
 * và trả về null khi chưa đủ từ (trò chơi dùng câu hỏi chung).
 */
const GRADES: Grade[] = [1, 2, 3, 4, 5];
const SEEDS = Number(process.env.EN_SEEDS) || 6;
const BAD = /NaN|undefined|Infinity|null|\[object/;
const icons = (s: string) => s.match(/\p{Extended_Pictographic}/gu)?.length ?? 0;

function unitsOf(g: Grade): (number | null)[] {
  const n = unitCount(g);
  return [...new Set([null, 1, Math.max(1, Math.floor(n / 2)), n])];
}

function seed(...k: unknown[]): void {
  forgetRecent();
  setMathRng(Rng.seeded(k.join('|')));
}

const opts = (g: Grade, units: number | null, s: number): EnOptions => ({ grade: g, units, listen: s % 2 === 0 });

/**
 * Từ bé đã học: lớp này tới Unit N, và mọi từ của các lớp dưới. Một từ có thể học ở nhiều lớp với nhãn,
 * hình khác nhau («car»: phương tiện, đồ chơi) – giữ mọi mục.
 */
function learned(g: Grade, units: number | null): Map<string, Word[]> {
  const out = new Map<string, Word[]>();
  for (const x of GRADES) {
    if (x > g) break;
    for (const w of gradeWords(x, x === g ? units : null)) out.set(w.w, [...(out.get(w.w) ?? []), w]);
  }
  return out;
}

function texts(q: Question): string[] {
  return [q.prompt, q.context ?? '', q.speech, q.hint, ...q.steps, ...q.choices.map((c) => c.label), q.en ?? ''];
}

/** Luật chung của mọi câu hỏi mini-game; trả về các vi phạm. */
function audit(q: Question, g: Grade): string[] {
  const out: string[] = [];
  const vals = q.choices.map((c) => c.value);
  const labels = q.choices.map((c) => c.label.trim().toLowerCase());
  const n = q.choices.length;
  if (n < 2 || n > 6 || (g <= 2 && n > 3)) out.push(`nchoices ${n}`);
  if (new Set(vals).size !== n || new Set(labels).size !== n || labels.some((l) => !l)) out.push(`dup ${labels.join(' | ')}`);
  if (!vals.includes(q.answer)) out.push(`answer ${q.answer}`);
  for (const s of texts(q)) {
    if (BAD.test(s)) out.push(`bad ${s}`);
    if (!balanced(s)) out.push(`unbalanced ${s}`);
    if (emojiIssues(s).length) out.push(`emoji ${s}`);
  }
  return out;
}

/** Gom tối đa 20 lỗi để báo một lần. */
function collect(run: (fail: (msg: string) => void) => void): string[] {
  const found: string[] = [];
  run((m) => {
    if (found.length < 20) found.push(m);
  });
  return found;
}

/* ------------------------------------------------------------------ */
describe('món đồ: siêu thị, bánh pizza, cho khỉ ăn', () => {
  setStrict(true);
  const TAGS: Record<ItemKind, string[]> = {
    shop: ['fruit', 'food', 'veg', 'drink', 'toy', 'school', 'clothes'],
    pizza: ['food', 'veg', 'fruit'],
    monkey: ['fruit', 'veg', 'food'],
  };
  const MEAT = ['fish', 'chicken', 'meat', 'hot dog'];
  const KINDS: ItemKind[] = ['shop', 'pizza', 'monkey'];

  for (const g of GRADES) {
    it(`Lớp ${g}`, () => {
      const found = collect((fail) => {
        for (const units of unitsOf(g)) {
          const known = learned(g, units);
          for (const kind of KINDS) {
            for (let L = 1; L <= 3; L++) {
              for (let s = 0; s < SEEDS; s++) {
                seed('item', g, units, kind, L, s);
                const q = itemRound(opts(g, units, s), L, kind);
                const at = `g${g} U${units} ${kind} L${L} #${s}`;
                if (!q) {
                  if (units === null) fail(`${at}: null`);
                  continue;
                }
                for (const x of audit(q, g)) fail(`${at}: ${x}`);
                if (q.topic !== 'en_vocab' || q.level > L) fail(`${at}: topic/level ${q.topic} L${q.level}`);
                for (const c of q.choices) {
                  const all = known.get(c.value);
                  if (!all) {
                    fail(`${at}: chưa học «${c.value}»`);
                    continue;
                  }
                  const fit = all.filter(
                    (w) => w.tags.some((t) => TAGS[kind].includes(t)) && !(kind === 'monkey' && w.tags.includes('animal')),
                  );
                  if (!fit.length) fail(`${at}: sai loại «${c.value}» ${all.map((w) => w.tags.join(',')).join(' / ')}`);
                  if (kind === 'monkey' && MEAT.includes(c.value)) fail(`${at}: khỉ ăn «${c.value}»`);
                  if (kind === 'pizza' && c.value === 'pizza') fail(`${at}: pizza trên đĩa pizza`);
                  if (shortLen(c.label) > 8) fail(`${at}: nhãn dài «${c.label}»`);
                  const label = q.level === 1 ? fit.some((w) => w.e === c.label) && icons(c.label) > 0 : c.label === c.value;
                  if (!label) fail(`${at}: nhãn «${c.label}»`);
                }
                if (q.en !== q.answer) fail(`${at}: en «${q.en}» ≠ ${q.answer}`);
                if (q.level === 2 && q.visual?.kind !== 'picture') fail(`${at}: L2 thiếu hình`);
              }
            }
          }
        }
      });
      expect(found).toEqual([]);
    }, 60000);
  }
});

/* ------------------------------------------------------------------ */
describe('bánh pizza: tô số miếng', () => {
  setStrict(true);
  for (const g of GRADES) {
    it(`Lớp ${g}`, () => {
      const found = collect((fail) => {
        for (const units of unitsOf(g)) {
          for (let L = 1; L <= 2; L++) {
            for (let s = 0; s < SEEDS; s++) {
              seed('top', g, units, L, s);
              const r = toppingRound(opts(g, units, s), L, 'TÔ XONG');
              const at = `g${g} U${units} L${L} #${s}`;
              if (!r) {
                fail(`${at}: null`);
                continue;
              }
              for (const x of audit(r.q, g)) fail(`${at}: ${x}`);
              const pieces = g <= 2 ? 6 : 8;
              if (r.pieces !== pieces) fail(`${at}: ${r.pieces} miếng`);
              if (r.n < 2 || r.n >= r.pieces || (r.q.level === 1 && r.n > 5)) fail(`${at}: tô ${r.n}/${r.pieces}`);
              if (r.q.answer !== String(r.n) || r.q.en !== numberWord(r.n)) fail(`${at}: đáp án ${r.q.answer}`);
              for (const c of r.q.choices) if (c.label !== numberWord(Number(c.value))) fail(`${at}: nhãn ${c.label}`);
              if (!r.q.prompt.includes('TÔ XONG')) fail(`${at}: nút ${r.q.prompt}`);
            }
          }
        }
      });
      expect(found).toEqual([]);
    });
  }
});

/* ------------------------------------------------------------------ */
describe('xây nhà: khối hình và màu', () => {
  setStrict(true);
  const HEX = /^#[0-9a-f]{6}$/i;

  for (const g of GRADES) {
    it(`Lớp ${g}`, () => {
      const found = collect((fail) => {
        for (const units of unitsOf(g)) {
          const known = learned(g, units);
          const all = [...known.values()].flat();
          const shapes = new Set(all.filter((w) => w.tags.includes('shape') && (BLOCK_SHAPES as readonly string[]).includes(w.w)).map((w) => w.w));
          const hexOf = new Map<string, Set<string>>();
          for (const w of all) if (w.tags.includes('colour') && w.hex) hexOf.set(w.w, (hexOf.get(w.w) ?? new Set()).add(w.hex));
          const colours = hexOf.size;
          for (let L = 1; L <= 3; L++) {
            for (let s = 0; s < SEEDS; s++) {
              seed('block', g, units, L, s);
              const r = blockRound(opts(g, units, s), L);
              const at = `g${g} U${units} L${L} #${s}`;
              if (shapes.size < 3) {
                if (r) fail(`${at}: chưa học đủ hình mà vẫn có khối`);
                continue;
              }
              if (!r) {
                fail(`${at}: null`);
                continue;
              }
              const q = r.q;
              for (const x of audit(q, g)) fail(`${at}: ${x}`);
              if (q.choices.length !== 3 || r.blocks.length !== 3) fail(`${at}: ${r.blocks.length} khối`);
              if (q.level > L || (colours < 3 && q.level !== 1)) fail(`${at}: mức ${q.level}, ${colours} màu`);
              const pairs = new Set(r.blocks.map((b) => `${b.shape}|${b.hex.toLowerCase()}`));
              if (pairs.size !== r.blocks.length) fail(`${at}: hai khối giống nhau`);
              r.blocks.forEach((b, i) => {
                if (b.value !== q.choices[i].value) fail(`${at}: khối ${i} ≠ phương án`);
                if (!BLOCK_SHAPES.includes(b.shape) || !HEX.test(b.hex)) fail(`${at}: khối ${b.shape} ${b.hex}`);
                if (q.level === 1 && b.shape !== b.value) fail(`${at}: hình ${b.shape} ≠ ${b.value}`);
                if (q.level === 2 && !hexOf.get(b.value)?.has(b.hex)) fail(`${at}: màu ${b.value} ${b.hex}`);
                if (q.level === 3) {
                  const [col, shp] = b.value.split(' ');
                  if (shp !== b.shape || !hexOf.get(col)?.has(b.hex)) fail(`${at}: khối ${b.value} = ${b.shape} ${b.hex}`);
                }
              });
              if (q.level === 2 && new Set(r.blocks.map((b) => b.shape)).size !== 1) fail(`${at}: hỏi màu nhưng khác hình`);
              const words = q.level === 3 ? q.answer.split(' ') : [q.answer];
              for (const w of words) if (!known.has(w)) fail(`${at}: chưa học «${w}»`);
            }
          }
        }
      });
      expect(found).toEqual([]);
    });
  }

  it('Lớp 1 chưa có khối (chưa học đủ 3 hình)', () => {
    for (const units of unitsOf(1)) {
      seed('block1', units);
      expect(blockRound({ grade: 1, units }, 3)).toBeNull();
    }
  });
});

/* ------------------------------------------------------------------ */
describe('đồng hồ: đọc giờ và kéo kim', () => {
  setStrict(true);
  const VALUE = /^(1[0-2]|[1-9]):(00|15|30|45)$/;

  for (const g of GRADES) {
    it(`Lớp ${g}`, () => {
      const found = collect((fail) => {
        for (const units of unitsOf(g)) {
          for (const mode of ['read', 'set'] as const) {
            for (let L = 1; L <= 3; L++) {
              for (let s = 0; s < SEEDS; s++) {
                seed('clock', g, units, mode, L, s);
                const r = clockRound(opts(g, units, s), L, mode);
                const at = `g${g} U${units} ${mode} L${L} #${s}`;
                if (!r) {
                  fail(`${at}: null`);
                  continue;
                }
                const q = r.q;
                for (const x of audit(q, g)) fail(`${at}: ${x}`);
                if (q.topic !== 'en_time') fail(`${at}: ${q.topic}`);
                if (r.h < 1 || r.h > 12 || ![0, 15, 30, 45].includes(r.m)) fail(`${at}: ${r.h}:${r.m}`);
                if (q.answer !== clockValue(r.h, r.m)) fail(`${at}: đáp án ${q.answer}`);
                for (const c of q.choices) if (!VALUE.test(c.value)) fail(`${at}: giá trị ${c.value}`);
                const oclock = g <= 3 || (g === 4 && units !== null && units < 2);
                if (oclock && r.m !== 0) fail(`${at}: lớp nhỏ hỏi ${r.m} phút`);
                if (mode === 'set') {
                  if (r.m === 45) fail(`${at}: kéo kim «quarter to»`);
                  for (const c of q.choices) if (c.label !== c.value) fail(`${at}: nhãn ${c.label}`);
                } else {
                  const v = q.visual;
                  if (v?.kind !== 'clock' || v.h !== r.h || v.m !== r.m) fail(`${at}: đồng hồ ${JSON.stringify(v)}`);
                  for (const c of q.choices) if (/\d/.test(c.label)) fail(`${at}: nhãn có số ${c.label}`);
                }
              }
            }
          }
        }
      });
      expect(found).toEqual([]);
    });
  }
});

/* ------------------------------------------------------------------ */
describe('tàu hỏa: toa còn thiếu', () => {
  setStrict(true);
  const TOPICS: EnTopic[] = ['en_phonics', 'en_spell', 'en_numbers', 'en_time'];

  /** Đoàn tàu khi đã chất thùng đúng. */
  const full = (cars: string[], missing: number, fill: string) => cars.map((x, i) => (i === missing ? fill : x));

  function consecutive(run: string[], list: string[], cyclic: boolean): boolean {
    const at = list.indexOf(run[0]);
    if (at < 0) return false;
    return run.every((x, i) => {
      const j = at + i;
      return (cyclic ? list[j % list.length] : list[j]) === x;
    });
  }

  for (const g of GRADES) {
    it(`Lớp ${g}`, () => {
      const found = collect((fail) => {
        for (const units of unitsOf(g)) {
          const letters = new Set(
            g === 1 ? phonicsTargets(1, units) : [...G1_LETTERS, ...phonicsTargets(2, units).filter((x) => x.length === 1)],
          );
          for (const topic of TOPICS) {
            for (let L = 1; L <= 4; L++) {
              for (let s = 0; s < SEEDS; s++) {
                seed('train', g, units, topic, L, s);
                const r = trainRound(opts(g, units, s), topic, L);
                const at = `g${g} U${units} ${topic} L${L} #${s}`;
                const never = (topic === 'en_phonics' && g >= 3) || (topic === 'en_spell' && g === 1) || (topic === 'en_time' && g <= 3);
                if (never) {
                  if (r) fail(`${at}: không hợp lớp mà vẫn có tàu`);
                  continue;
                }
                if (!r) {
                  if (topic === 'en_numbers' || (units === null && topic !== 'en_spell') || (topic === 'en_time' && g === 5)) {
                    fail(`${at}: null`);
                  }
                  continue;
                }
                const q = r.q;
                for (const x of audit(q, g)) fail(`${at}: ${x}`);
                if (q.level > L) fail(`${at}: mức ${q.level}`);
                if (r.cars.length !== 5 || r.cars[r.missing] !== '?' || r.cars.filter((x) => x === '?').length !== 1) {
                  fail(`${at}: toa ${r.cars.join(' ')} thiếu ${r.missing}`);
                }
                if (!r.fill || r.fill === '?') fail(`${at}: fill «${r.fill}»`);
                const train = full(r.cars, r.missing, r.fill);
                if (topic === 'en_phonics') {
                  if (r.fill !== q.answer.toUpperCase() + q.answer) fail(`${at}: fill ${r.fill} ≠ ${q.answer}`);
                  const run = train.map((x) => x.slice(-1));
                  if (!consecutive(run, ALPHABET, false)) fail(`${at}: không liền ${run.join('')}`);
                  for (const x of [...run, ...q.choices.map((c) => c.value)]) if (!letters.has(x)) fail(`${at}: chưa học chữ ${x}`);
                } else if (topic === 'en_spell') {
                  if (r.fill !== q.answer || train.join('') !== q.en) fail(`${at}: ${train.join('')} ≠ ${q.en}`);
                  if (q.visual?.kind !== 'picture') fail(`${at}: thiếu hình`);
                } else if (topic === 'en_numbers') {
                  if (r.fill !== q.answer) fail(`${at}: fill ${r.fill} ≠ ${q.answer}`);
                  const nums = train.map(Number);
                  const d = nums[1] - nums[0];
                  if (![1, 2, -1, 10].includes(d) || nums.some((x, i) => i > 0 && x - nums[i - 1] !== d)) fail(`${at}: dãy ${nums}`);
                  if (nums.some((x) => !Number.isInteger(x) || x < 0 || x > 100)) fail(`${at}: dãy ${nums}`);
                  for (const c of q.choices) if (c.label !== numberWord(Number(c.value))) fail(`${at}: nhãn ${c.label}`);
                } else {
                  if (r.fill !== q.answer) fail(`${at}: fill ${r.fill} ≠ ${q.answer}`);
                  if (!consecutive(train, DAYS, true) && !consecutive(train, MONTHS, true)) fail(`${at}: không liền ${train}`);
                }
              }
            }
          }
        }
      });
      expect(found).toEqual([]);
    }, 60000);
  }

  it('chủ đề không có đoàn tàu: null', () => {
    seed('train-other');
    for (const t of ['en_vocab', 'en_listen', 'en_sentence'] as EnTopic[]) {
      if (!EN_TOPICS.includes(t)) continue;
      expect(trainRound({ grade: 3 }, t, 1)).toBeNull();
    }
  });
});

/* ------------------------------------------------------------------ */
describe('thẻ trò chơi theo môn', () => {
  const info = {
    name: '🚂 Tàu hỏa – dãy số',
    icon: '🚂',
    skill: 'Dãy số',
    desc: 'Cách chơi Toán',
    en: { name: 'Tàu chữ cái', skill: 'Chữ cái', desc: 'Cách chơi Tiếng Anh' },
    both: 'Tàu hỏa',
  };

  it('Toán: như trước (bỏ emoji ở đầu tên)', () => {
    expect(miniCard(info, 'math')).toEqual({ name: 'Tàu hỏa – dãy số', icon: '🚂', skill: 'Dãy số', desc: 'Cách chơi Toán' });
    expect(miniShort(info, 'math')).toBe('Tàu hỏa');
  });

  it('Tiếng Anh: tên, kĩ năng, cách chơi Tiếng Anh', () => {
    expect(miniCard(info, 'english')).toEqual({ name: 'Tàu chữ cái', icon: '🚂', skill: 'Chữ cái', desc: 'Cách chơi Tiếng Anh' });
    expect(miniCard({ ...info, en: { ...info.en, icon: '🔤' } }, 'english').icon).toBe('🔤');
  });

  it('Cả hai: tên chung và kĩ năng của hai môn', () => {
    const c = miniCard(info, 'both');
    expect(c.name).toBe('Tàu hỏa');
    expect(c.icon).toBe('🚂');
    expect(c.skill).toContain('Dãy số');
    expect(c.skill).toContain('Chữ cái');
    expect(emojiIssues(c.skill)).toEqual([]);
  });

  it('chưa có bản Tiếng Anh: giữ thẻ Toán ở mọi môn', () => {
    const math = { name: 'Đồng hồ', icon: '⏰', skill: 'Thời gian', desc: 'x' };
    for (const m of ['math', 'english', 'both'] as const) expect(miniCard(math, m).name).toBe('Đồng hồ');
  });
});

/* ------------------------------------------------------------------ */
describe('mọi mini-game có bản Tiếng Anh', () => {
  const GAMES = import.meta.glob<string>('../src/minigames/games/*.ts', { query: '?raw', import: 'default', eager: true });
  const found: string[] = [];

  for (const [path, code] of Object.entries(GAMES)) {
    const at = code.indexOf('defineMini(');
    if (at < 0) continue;
    const block = code.slice(at);
    const id = block.match(/\bid:\s*'([^']*)'/)?.[1] ?? path;
    found.push(id);
    it(id, () => {
      const en = block.match(/\ben:\s*\{([\s\S]*?)\}/)?.[1] ?? '';
      const name = en.match(/\bname:\s*'([^']*)'/)?.[1] ?? '';
      expect(name, 'en.name').not.toBe('');
      expect(icons(name), name).toBe(0);
      expect(en).toMatch(/\bskill:\s*'[^']+'/);
      expect(en).toMatch(/\bdesc:\s*'[^']+'/);
      const both = block.match(/\bboth:\s*'([^']*)'/)?.[1] ?? '';
      expect(both, 'both').not.toBe('');
      expect(icons(both), both).toBe(0);
      const topics = [...(block.match(/\benTopics:\s*\[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
      expect(topics.length, 'enTopics').toBeGreaterThan(0);
      for (const t of topics) expect(EN_TOPICS as readonly string[]).toContain(t);
      expect(code.slice(0, at), 'lượt Tiếng Anh').toMatch(/\bthis\.isEn\b/);
    });
  }

  it('đủ 12 trò chơi', () => {
    expect(found.sort()).toEqual([...MINI_ORDER].sort());
  });

  it('ngân hàng có đủ hình và màu cho khối', () => {
    for (const s of BLOCK_SHAPES) expect(BANK.some((w) => w.w === s && w.tags.includes('shape')), s).toBe(true);
    expect(BANK.filter((w) => w.tags.includes('colour') && w.hex).length).toBeGreaterThanOrEqual(6);
  });
});

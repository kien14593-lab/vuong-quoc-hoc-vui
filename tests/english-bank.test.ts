import { describe, expect, it } from 'vitest';
import { BANK, BY_UNIT, TAGS, conflicts, gradeWords, isBankWord, parseLine, unitWords } from '../src/english/bank';
import { BLOCKED, COMMON } from '../src/english/common';
import { QA_ITEMS } from '../src/english/qa-items';
import { G1_LETTERS, G2_SOUNDS, UNIT_TITLES, clampUnit, phonicsTargets, unitCount, unitFocus, unitTitle } from '../src/english/units';
import {
  US_SPELLINGS, numberWord, ordinalShort, ordinalWord, past, pluralOf, spellOut, thirdPerson, timeWords, withArticle, ing,
} from '../src/english/words';
import type { Grade } from '../src/math/types';
import { emojiIssues } from './emoji12';

const GRADES: Grade[] = [1, 2, 3, 4, 5];
const UNITS: Record<Grade, number> = { 1: 16, 2: 16, 3: 20, 4: 20, 5: 20 };

const tokens = (s: string) => s.toLowerCase().split(/[^a-z']+/).filter(Boolean);
const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).filter(Boolean);
const wordCount = (s: string) => s.split(/\s+/).filter((x) => /[A-Za-z0-9]/.test(x)).length;
const emo = (e: string) => e.replace(/\uFE0F/g, '');

describe('Unit theo bộ Global Success', () => {
  it('đủ số Unit mỗi lớp (16/16/20/20/20), tên không trống, không trùng', () => {
    for (const g of GRADES) {
      expect(UNIT_TITLES[g]).toHaveLength(UNITS[g]);
      expect(BY_UNIT[g]).toHaveLength(UNITS[g]);
      expect(unitCount(g)).toBe(UNITS[g]);
      for (const t of UNIT_TITLES[g]) expect(t.trim().length).toBeGreaterThan(0);
      expect(new Set(UNIT_TITLES[g]).size).toBe(UNITS[g]);
    }
  });

  it('tên Unit theo quyết định của điều phối', () => {
    expect(UNIT_TITLES[2][12]).toBe('In the maths class');
    expect(unitTitle(2, 13)).toBe('Unit 13: In the maths class');
    expect(unitTitle(1, 3)).toBe('Unit 3: At the street market');
    expect(unitTitle(1, 99)).toBe('Unit 99');
  });

  it('chính tả Anh – Anh trong tên Unit', () => {
    for (const g of GRADES) for (const t of UNIT_TITLES[g]) for (const x of tokens(t)) expect(US_SPELLINGS).not.toContain(x);
  });
});

describe('Ngân hàng từ', () => {
  it('mỗi Unit có 8–20 từ (Lớp 4 Unit 4 có đủ 12 tháng)', () => {
    for (const g of GRADES) {
      BY_UNIT[g].forEach((u, i) => {
        expect(u.length, `Lớp ${g} Unit ${i + 1}`).toBeGreaterThanOrEqual(8);
        expect(u.length, `Lớp ${g} Unit ${i + 1}`).toBeLessThanOrEqual(20);
        expect(unitWords(g, i + 1)).toBe(u);
      });
    }
  });

  it('mỗi từ có nghĩa, hình hiển thị được trên Windows 10 và nhãn chủ đề hợp lệ', () => {
    const tags = new Set<string>(TAGS);
    for (const w of BANK) {
      expect(w.vi.trim(), w.id).not.toBe('');
      expect(w.e.trim(), w.id).not.toBe('');
      expect(emojiIssues(w.e), w.id).toEqual([]);
      expect(w.tags.length, w.id).toBeGreaterThan(0);
      for (const t of w.tags) expect(tags.has(t), `${w.id}: ${t}`).toBe(true);
      expect(w.w, w.id).toMatch(/^[A-Za-z][A-Za-z'.-]*( [A-Za-z'.-]+)*$/);
      expect(w.vi, w.id).toBe(w.vi.trim());
      if (w.hex) expect(w.hex, w.id).toMatch(/^#[0-9a-f]{6}$/i);
      if (w.pl) expect(w.pl, w.id).toMatch(/^[a-z][a-z ]*$/);
    }
  });

  it('mã từ không trùng; trong một Unit không trùng từ, không trùng hình', () => {
    expect(new Set(BANK.map((w) => w.id)).size).toBe(BANK.length);
    for (const g of GRADES) {
      BY_UNIT[g].forEach((u, i) => {
        const where = `Lớp ${g} Unit ${i + 1}`;
        expect(new Set(u.map((w) => w.w.toLowerCase())).size, where).toBe(u.length);
        expect(new Set(u.map((w) => emo(w.e))).size, where).toBe(u.length);
      });
    }
  });

  it('chính tả Anh – Anh (colour, favourite, rubber, mum…), không có cách viết kiểu Mỹ', () => {
    for (const w of ['colour', 'favourite', 'rubber', 'mum', 'doughnut']) expect(isBankWord(w), w).toBe(true);
    for (const w of BANK) {
      for (const x of tokens(`${w.w} ${w.ex ?? ''}`)) expect(US_SPELLINGS, w.id).not.toContain(x);
    }
  });

  it('không có từ nằm trong danh sách chặn', () => {
    expect(BLOCKED.size).toBeGreaterThan(0);
    for (const b of BLOCKED) expect(COMMON.has(b)).toBe(true);
    for (const w of BANK) for (const x of tokens(`${w.w} ${w.ex ?? ''}`)) expect(BLOCKED.has(x), w.id).toBe(false);
  });

  it('câu ví dụ tự soạn ngắn (≤ 8 từ mỗi câu), viết hoa đầu câu', () => {
    for (const w of BANK.filter((x) => x.ex)) {
      const ex = w.ex as string;
      expect(ex, w.id).toMatch(/^[A-Z]/);
      for (const s of sentences(ex)) expect(wordCount(s), `${w.id}: ${s}`).toBeLessThanOrEqual(8);
    }
  });

  it('parseLine đọc đúng các cờ và báo lỗi cờ lạ', () => {
    const w = parseLine('knife|con dao|🔪|kitchen|np|pw|nc|pl=knives|alt=blade|alt=cutter|grp=cut|f|hex=#aabbcc|ex=I cut it.', 3, 2);
    expect(w).toMatchObject({
      id: 'g3u2:knife', w: 'knife', vi: 'con dao', e: '🔪', tags: ['kitchen'], grade: 3, unit: 2,
      pic: false, pw: true, nc: true, pl: 'knives', alt: ['blade', 'cutter'], grp: 'cut', sex: 'f', hex: '#aabbcc', ex: 'I cut it.',
    });
    const plain = parseLine('  cat|con mèo|🐱|animal  ', 1, 1);
    expect(plain).toMatchObject({ w: 'cat', pic: true, pw: false, nc: false, alt: [], tags: ['animal'] });
    expect(plain.sex).toBeUndefined();
    expect(() => parseLine('cat|con mèo|🐱|animal|oops', 1, 1)).toThrow(/g1u1:cat/);
  });

  it('gradeWords: chỉ lấy Unit 1..N, mỗi từ một lần', () => {
    for (const g of GRADES) {
      const all = gradeWords(g);
      expect(new Set(all.map((w) => w.w.toLowerCase())).size).toBe(all.length);
      expect(all.every((w) => w.grade === g)).toBe(true);
      for (const n of [1, 3, Math.floor(UNITS[g] / 2)]) {
        const part = gradeWords(g, n);
        expect(part.every((w) => w.unit <= n), `Lớp ${g} N=${n}`).toBe(true);
        expect(part.length).toBeLessThan(all.length);
        for (const w of unitWords(g, 1)) expect(part.some((x) => x.w.toLowerCase() === w.w.toLowerCase())).toBe(true);
      }
      expect(gradeWords(g, 999)).toEqual(all);
    }
  });

  it('từ và chính nó / từ cùng hình luôn bị coi là gây nhầm', () => {
    const cat = BANK.find((w) => w.w === 'cat');
    const dog = BANK.find((w) => w.w === 'dog');
    expect(cat && dog).toBeTruthy();
    if (!cat || !dog) return;
    expect(conflicts(cat, cat)).toBe(true);
    expect(conflicts(cat, dog)).toBe(false);
    expect(conflicts(cat, { ...dog, e: cat.e })).toBe(true);
  });
});

describe('Hỏi – đáp theo Unit (Lớp 3–5)', () => {
  it('mỗi mục có 3 phương án sai, không trùng đáp án, Unit hợp lệ', () => {
    expect(QA_ITEMS.length).toBeGreaterThan(100);
    for (const it of QA_ITEMS) {
      const where = `${it.grade}.${it.unit} ${it.q}`;
      expect(it.grade).toBeGreaterThanOrEqual(3);
      expect(it.unit).toBeGreaterThanOrEqual(1);
      expect(it.unit, where).toBeLessThanOrEqual(UNITS[it.grade]);
      expect(it.wrong, where).toHaveLength(3);
      const all = [it.answer, ...it.wrong].map((s) => s.toLowerCase());
      expect(new Set(all).size, where).toBe(4);
      expect(it.vi.trim(), where).not.toBe('');
    }
  });

  it('mọi Unit Lớp 3–5 đều có ít nhất 2 mục', () => {
    for (const g of [3, 4, 5] as Grade[]) {
      for (let u = 1; u <= UNITS[g]; u++) {
        expect(QA_ITEMS.filter((x) => x.grade === g && x.unit === u).length, `Lớp ${g} Unit ${u}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('câu ngắn (≤ 8 từ), chính tả Anh – Anh, không có từ bị chặn', () => {
    for (const it of QA_ITEMS) {
      for (const s of [it.q, it.answer, ...it.wrong]) {
        for (const x of sentences(s)) expect(wordCount(x), x).toBeLessThanOrEqual(8);
        for (const x of tokens(s)) {
          expect(US_SPELLINGS, s).not.toContain(x);
          expect(BLOCKED.has(x), s).toBe(false);
        }
        expect(s).not.toMatch(/[«»]/);
      }
    }
  });
});

describe('Chữ cái và âm trọng tâm (Lớp 1–2)', () => {
  it('Lớp 1: 16 chữ khác nhau, Unit nào cũng có từ chứa chữ trọng tâm', () => {
    expect(G1_LETTERS).toHaveLength(16);
    expect(new Set(G1_LETTERS).size).toBe(16);
    G1_LETTERS.forEach((l, i) => {
      expect(l).toMatch(/^[a-z]$/);
      expect(unitFocus(1, i + 1)).toBe(l);
      const own = unitWords(1, i + 1).filter((w) => w.w.toLowerCase().includes(l));
      expect(own.length, `Unit ${i + 1} (${l})`).toBeGreaterThan(0);
    });
  });

  it('Lớp 2: 16 âm, đúng loại', () => {
    expect(G2_SOUNDS).toHaveLength(16);
    for (const s of G2_SOUNDS) expect(['start', 'end', 'pattern', 'numbers']).toContain(s.kind);
    expect(unitFocus(2, 5)).toBe('qu');
    expect(unitFocus(3, 1)).toBeNull();
  });

  it('phonicsTargets theo "Đang học đến Unit N"', () => {
    expect(phonicsTargets(1, 3)).toEqual(['b', 'c', 'a']);
    expect(phonicsTargets(1, null)).toEqual(G1_LETTERS);
    expect(phonicsTargets(2, 2)).toEqual(['p', 'k']);
    expect(phonicsTargets(2, 6)).toEqual(['p', 'k', 's', 'r', 'qu']);
    expect(phonicsTargets(3, null)).toEqual([]);
  });

  it('clampUnit đưa N về khoảng hợp lệ (null = học tất cả)', () => {
    expect(clampUnit(3, null)).toBeNull();
    expect(clampUnit(3, undefined)).toBeNull();
    expect(clampUnit(3, Number.NaN)).toBeNull();
    expect(clampUnit(3, 0)).toBe(1);
    expect(clampUnit(3, -5)).toBe(1);
    expect(clampUnit(3, 4.4)).toBe(4);
    expect(clampUnit(3, 19)).toBe(19);
    expect(clampUnit(3, 20)).toBeNull();
    expect(clampUnit(3, 25)).toBeNull();
    expect(clampUnit(1, 15)).toBe(15);
    expect(clampUnit(1, 16)).toBeNull();
  });
});

describe('Quy tắc từ (words.ts)', () => {
  it('số đếm và số thứ tự', () => {
    expect(numberWord(0)).toBe('zero');
    expect(numberWord(13)).toBe('thirteen');
    expect(numberWord(40)).toBe('forty');
    expect(numberWord(42)).toBe('forty-two');
    expect(numberWord(100)).toBe('one hundred');
    expect(() => numberWord(101)).toThrow();
    expect(() => numberWord(1.5)).toThrow();
    expect(ordinalWord(1)).toBe('first');
    expect(ordinalWord(12)).toBe('twelfth');
    expect(ordinalWord(21)).toBe('twenty-first');
    expect(ordinalWord(22)).toBe('twenty-second');
    expect(ordinalWord(30)).toBe('thirtieth');
    expect(ordinalShort(1)).toBe('1st');
    expect(ordinalShort(2)).toBe('2nd');
    expect(ordinalShort(3)).toBe('3rd');
    expect(ordinalShort(11)).toBe('11th');
    expect(ordinalShort(12)).toBe('12th');
    expect(ordinalShort(13)).toBe('13th');
    expect(ordinalShort(22)).toBe('22nd');
    expect(ordinalShort(31)).toBe('31st');
  });

  it('giờ kiểu Anh', () => {
    expect(timeWords(7, 0)).toBe("seven o'clock");
    expect(timeWords(7, 30)).toBe('half past seven');
    expect(timeWords(7, 15)).toBe('quarter past seven');
    expect(timeWords(7, 45)).toBe('quarter to eight');
    expect(timeWords(12, 45)).toBe('quarter to one');
    expect(timeWords(13, 0)).toBe("one o'clock");
    expect(timeWords(9, 20)).toBe('twenty past nine');
    expect(timeWords(9, 50)).toBe('ten to ten');
  });

  it('mạo từ, -ing, ngôi thứ ba, quá khứ, số nhiều, đánh vần', () => {
    expect(withArticle('apple')).toBe('an apple');
    expect(withArticle('banana')).toBe('a banana');
    expect(withArticle('uniform')).toBe('a uniform');
    expect(withArticle('hour')).toBe('an hour');
    expect(ing('ride a bike')).toBe('riding a bike');
    expect(ing('swim')).toBe('swimming');
    expect(ing('travel')).toBe('travelling');
    expect(ing('play football')).toBe('playing football');
    expect(thirdPerson('watch TV')).toBe('watches TV');
    expect(thirdPerson('study')).toBe('studies');
    expect(thirdPerson('play')).toBe('plays');
    expect(thirdPerson('go to school')).toBe('goes to school');
    expect(thirdPerson('have breakfast')).toBe('has breakfast');
    expect(past('go')).toBe('went');
    expect(past('visit a farm')).toBe('visited a farm');
    expect(past('stop')).toBe('stopped');
    expect(past('study')).toBe('studied');
    expect(pluralOf('teddy bear')).toBe('teddy bears');
    expect(pluralOf('box')).toBe('boxes');
    expect(pluralOf('knife')).toBe('knives');
    expect(pluralOf('baby')).toBe('babies');
    expect(pluralOf('toy')).toBe('toys');
    expect(spellOut('apple')).toBe('a-p-p-l-e');
    expect(spellOut('ice cream')).toBe('i-c-e / c-r-e-a-m');
    expect(spellOut('T-shirt')).toBe('t-s-h-i-r-t');
  });
});

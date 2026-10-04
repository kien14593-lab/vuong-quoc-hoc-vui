import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BADGES, badgeDef, badgeVisible } from '../src/core/progression';
import { Rng } from '../src/core/rng';
import { createProfile, profile, setSubjectSettings, sitePick, unloadProfile, type Profile } from '../src/core/state';
import { BEATS } from '../src/english/beats';
import { resolveTopic, setStrict } from '../src/english/gen';
import { shortLen } from '../src/english/gen-core';
import { english, loadEnglish } from '../src/english/load';
import { MATH_ROOMS, ROOM_IDS, roomConfigs, roomList, type RoomId } from '../src/game/castle-rooms';
import { adaptiveQuestion, mixedQuestion, storyQuestion } from '../src/game/challenge';
import { checkBadges } from '../src/game/story';
import {
  castleRooms,
  englishShare,
  ensureEnglish,
  isEnglishQ,
  kingPlan,
  labelQ,
  mathQ,
  mixedQ,
  need,
  noteSubject,
  pickEnTopic,
  pickSubject,
  profileSubject,
  resetStreak,
  siteSubject,
  storyQ,
  subject,
  weaker,
} from '../src/game/subject';
import { SUBJECT_MODES, TAGLINE, TEXT, siteMode, siteText, st, type TextKey } from '../src/game/subject-text';
import { EN_FOUNDATION, GRADE_TOPICS, MAZE_TOPICS, TOPICS } from '../src/math/curriculum';
import { generate } from '../src/math/engine';
import { ballsQuestion, beatTopic, scripted, type BeatId } from '../src/math/scripted';
import type { Grade, Question, Subject, SubjectMode, Topic, WordTheme } from '../src/math/types';
import { rand, setMathRng } from '../src/math/util';

/**
 * Bộ chọn môn (game/subject.ts) – mọi câu hỏi trong thế giới đi qua đây.
 * - 'math' phải y hệt bản chỉ có Toán: cùng hạt giống → cùng câu hỏi, không rút thêm số ngẫu nhiên.
 * - 'english' không bao giờ gọi bộ sinh câu Toán.
 * - 'both' nghiêng về môn cần luyện (30–70%), không quá 3 câu liền một môn; lâu đài chia 2 + 1 cố định.
 */

// Theo dõi bộ sinh câu Toán (vẫn chạy đúng hàm thật).
vi.mock('../src/math/engine', async (importOriginal) => {
  const m = await importOriginal<typeof import('../src/math/engine')>();
  return { ...m, generate: vi.fn(m.generate) };
});
vi.mock('../src/math/scripted', async (importOriginal) => {
  const m = await importOriginal<typeof import('../src/math/scripted')>();
  return { ...m, scripted: vi.fn(m.scripted), ballsQuestion: vi.fn(m.ballsQuestion), beatTopic: vi.fn(m.beatTopic) };
});
// Máy kiểm thử không có giọng đọc: tự bật / tắt "có giọng tiếng Anh".
const voice = vi.hoisted(() => ({ listen: false }));
vi.mock('../src/core/audio', () => ({ audio: { setDuck: () => {} }, sfx: () => {} }));
vi.mock('../src/core/speech', async (importOriginal) => {
  const m = await importOriginal<typeof import('../src/core/speech')>();
  return { ...m, canListen: () => voice.listen };
});

const GRADES: Grade[] = [1, 2, 3, 4, 5];
const BEAT_IDS = Object.keys(BEATS) as BeatId[];
const THEME: WordTheme = { who: 'Khỉ', item: 'quả chuối', unit: 'quả', emoji: '🍌' };
const MATH_SPIES = [generate, scripted, ballsQuestion, beatTopic].map((f) => vi.mocked(f));

let seq = 0;
function play(grade: Grade, subject: SubjectMode): Profile {
  return createProfile({ name: `Bé ${++seq}`, grade, kid: 'trai', subject });
}

function log(p: Profile, topic: Topic, n: number, attempts: number): void {
  for (let i = 0; i < n; i++) p.log.push({ t: Date.now(), topic, lv: 1, a: attempts, ms: 1000, src: 'test' });
}

/** Toán yếu hơn / Tiếng Anh yếu hơn (20 câu mỗi môn). */
function makeWeaker(p: Profile, s: Subject): void {
  p.log = [];
  log(p, 'add', 20, s === 'math' ? 3 : 1);
  log(p, 'en_vocab', 20, s === 'english' ? 3 : 1);
}

const strip = (q: Question): Question => ({ ...q, id: '' });

/** Hai cách ra câu hỏi cho cùng hạt giống: cùng câu hỏi và dùng đúng bấy nhiêu số ngẫu nhiên. */
function same(a: () => Question, b: () => Question, seed: string): void {
  setMathRng(Rng.seeded(seed));
  const qa = strip(a());
  const na = rand().next();
  setMathRng(Rng.seeded(seed));
  const qb = strip(b());
  const nb = rand().next();
  expect(qa, seed).toEqual(qb);
  expect(na, `${seed}: số ngẫu nhiên đã dùng`).toBe(nb);
}

function maxRun(xs: string[]): number {
  let best = 0;
  let run = 0;
  for (let i = 0; i < xs.length; i++) {
    run = i && xs[i] === xs[i - 1] ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

function checkQ(q: Question, g: Grade, where: string): void {
  const vals = q.choices.map((c) => c.value);
  expect(vals, where).toContain(q.answer);
  expect(new Set(vals).size, where).toBe(vals.length);
  // Tiếng Anh Lớp 1–2: tối đa 3 lựa chọn (câu Toán giữ nguyên như cũ).
  if (g <= 2 && isEnglishQ(q)) expect(q.choices.length, where).toBeLessThanOrEqual(3);
}

beforeAll(() => {
  vi.stubGlobal('window', globalThis);
});

afterEach(() => {
  voice.listen = false;
  setStrict(false);
  unloadProfile();
});

/* ------------------------------------------------------------------ */
describe('tải phần Tiếng Anh', () => {
  it('chưa tải xong: hồ sơ Tiếng Anh tạm chơi Toán, không lỗi', () => {
    expect(english()).toBeNull();
    play(3, 'english');
    expect(profileSubject()).toBe('english');
    expect(subject()).toBe('math');
    expect(pickSubject()).toBe('math');
    expect(isEnglishQ(mixedQ())).toBe(false);
  });

  it('hồ sơ Toán không tải phần Tiếng Anh; hồ sơ Tiếng Anh tải khi cần', async () => {
    play(2, 'math');
    expect(await ensureEnglish()).toBe(true);
    expect(english()).toBeNull();
    unloadProfile();
    play(2, 'english');
    expect(await ensureEnglish()).toBe(true);
    expect(english()).not.toBeNull();
    expect(subject()).toBe('english');
  });
});

/* ------------------------------------------------------------------ */
describe("môn 'math' – y hệt bản chỉ có Toán", () => {
  beforeAll(async () => {
    await loadEnglish();
  });

  it.each(GRADES)('Lớp %i: mixedQ / storyQ / mathQ / labelQ ra đúng câu của hàm Toán cũ', (g) => {
    play(g, 'math');
    for (let s = 0; s < 6; s++) {
      same(() => mixedQ(), () => mixedQuestion(), `mixed|${g}|${s}`);
      same(() => mixedQ({ math: MAZE_TOPICS[g], theme: THEME }), () => mixedQuestion(MAZE_TOPICS[g], THEME), `mixedT|${g}|${s}`);
      same(() => mixedQ({ site: 'forest.bridge' }), () => mixedQuestion(), `site|${g}|${s}`);
      for (const beat of BEAT_IDS) {
        same(() => storyQ(beat), () => storyQuestion(beat), `story|${g}|${beat}|${s}`);
        same(() => storyQ(beat, { theme: THEME, site: `x.${beat}` }), () => storyQuestion(beat, THEME), `storyT|${g}|${beat}|${s}`);
      }
      for (const t of GRADE_TOPICS[g]) {
        same(() => mathQ(t, { levelDelta: 1, theme: THEME }), () => adaptiveQuestion(t, { levelDelta: 1, theme: THEME }), `mathQ|${g}|${t}|${s}`);
      }
      same(() => labelQ(pickSubject(), () => storyQ('mazeDoor'), { count: 3 }), () => storyQuestion('mazeDoor'), `label|${g}|${s}`);
    }
  });

  it('không rút số ngẫu nhiên, không lưu môn cho thử thách cố định, mọi phòng và Nhà Vua là Toán', () => {
    play(4, 'math');
    for (let s = 0; s < 20; s++) {
      setMathRng(Rng.seeded(`pick|${s}`));
      expect(pickSubject()).toBe('math');
      expect(siteSubject('forest.rock')).toBe('math');
      const x = rand().next();
      setMathRng(Rng.seeded(`pick|${s}`));
      expect(rand().next()).toBe(x);
    }
    expect(castleRooms()).toEqual({ mul: 'math', frac: 'math', geo: 'math' });
    expect(kingPlan()).toEqual(['math', 'math', 'math', 'math', 'math']);
    expect(profile().picks).toEqual({});
  });

  it('mọi câu đều là Toán', () => {
    play(1, 'math');
    for (let i = 0; i < 40; i++) expect(isEnglishQ(mixedQ())).toBe(false);
    for (const beat of BEAT_IDS) expect(isEnglishQ(storyQ(beat))).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
describe("môn 'english' – không gọi bộ sinh câu Toán", () => {
  beforeAll(async () => {
    await loadEnglish();
  });
  beforeEach(() => {
    for (const f of MATH_SPIES) f.mockClear();
  });

  it.each(GRADES)('Lớp %i: câu đố, truyện, nhãn trên vật 3D đều là Tiếng Anh', (g) => {
    for (const listen of [false, true]) {
      voice.listen = listen;
      play(g, 'english');
      setStrict(true);
      for (let s = 0; s < 4; s++) {
        setMathRng(Rng.seeded(`en|${g}|${listen}|${s}`));
        const qs: [string, Question][] = [
          ['mixedQ', mixedQ()],
          ['mixedQ site', mixedQ({ site: 'village.boxes', math: GRADE_TOPICS[g] })],
          ['mixedQ fruit', mixedQ({ en: { tags: ['fruit'] } })],
          ['label', labelQ(pickSubject(), () => mathQ('add'), { count: 3 })],
          ['label site', labelQ(siteSubject('maze.door'), () => storyQ('mazeDoor', { s: 'math' }), { count: 4 })],
          ['pickEnTopic', mixedQ({ enTopics: [pickEnTopic()] })],
        ];
        for (const beat of BEAT_IDS) {
          qs.push([`story ${beat}`, storyQ(beat)]);
          qs.push([`story site ${beat}`, storyQ(beat, { site: `forest.${beat}` })]);
        }
        for (const [where, q] of qs) {
          expect(isEnglishQ(q), where).toBe(true);
          checkQ(q, g, `${g} ${where}`);
          if (!listen) expect(q.visual?.kind, where).not.toBe('listen');
        }
      }
      expect(castleRooms()).toEqual({ mul: 'english', frac: 'english', geo: 'english' });
      expect(kingPlan()).toEqual(['english', 'english', 'english', 'english', 'english']);
      expect(profile().picks).toEqual({});
      unloadProfile();
    }
    for (const f of MATH_SPIES) expect(f).not.toHaveBeenCalled();
  });

  it('nhãn trên vật 3D: từ ngắn hoặc hình, không có câu nghe', () => {
    voice.listen = true;
    for (const g of GRADES) {
      play(g, 'english');
      for (let s = 0; s < 30; s++) {
        setMathRng(Rng.seeded(`short|${g}|${s}`));
        const q = labelQ('english', () => mathQ('add'), { count: g <= 2 ? 3 : 4 });
        for (const c of q.choices) expect(shortLen(c.label), `${g}: ${c.label}`).toBeLessThanOrEqual(8);
        expect(q.visual?.kind).not.toBe('listen');
        expect(q.listen ?? false).toBe(false);
      }
      unloadProfile();
    }
    for (const f of MATH_SPIES) expect(f).not.toHaveBeenCalled();
  });

  it('"Đang học đến Unit N": câu nền tảng (số, giờ) chỉ khoảng 20%', () => {
    const p = play(4, 'english');
    setSubjectSettings({ enUnit: 3 });
    expect(p.enUnit).toBe(3);
    setMathRng(Rng.seeded('unitN'));
    let base = 0;
    const N = 3000;
    for (let i = 0; i < N; i++) if (EN_FOUNDATION.includes(pickEnTopic())) base++;
    expect(base / N).toBeGreaterThan(0.1);
    expect(base / N).toBeLessThan(0.3);
  });
});

/* ------------------------------------------------------------------ */
describe("môn 'both' – nghiêng về môn cần luyện, không bị kẹt", () => {
  beforeAll(async () => {
    await loadEnglish();
  });
  beforeEach(() => {
    resetStreak();
  });

  it('mức cần luyện và tỉ lệ câu Tiếng Anh (30–70%)', () => {
    const p = play(3, 'both');
    expect(need(p, 'math')).toBe(0.5);
    expect(englishShare(p)).toBe(0.5);
    expect(weaker(p)).toBe('english');
    makeWeaker(p, 'english');
    expect(englishShare(p)).toBe(0.7);
    expect(weaker(p)).toBe('english');
    makeWeaker(p, 'math');
    expect(englishShare(p)).toBe(0.3);
    expect(weaker(p)).toBe('math');
    const R = Rng.seeded('share');
    for (let i = 0; i < 300; i++) {
      p.log = [];
      log(p, 'add', R.int(0, 25), R.int(1, 3));
      log(p, 'en_spell', R.int(0, 25), R.int(1, 3));
      if (R.next() < 0.3) p.skills.en_vocab = { level: 1, streak: 0, struggle: 2, support: true };
      else delete p.skills.en_vocab;
      const share = englishShare(p);
      expect(share).toBeGreaterThanOrEqual(0.3);
      expect(share).toBeLessThanOrEqual(0.7);
    }
  });

  it.each([
    ['ngang nhau', null, 0.45, 0.55],
    ['Tiếng Anh yếu hơn', 'english', 0.55, 0.7],
    ['Toán yếu hơn', 'math', 0.3, 0.45],
  ] as const)('%s: không quá 3 câu liền một môn', (_name, weak, lo, hi) => {
    const p = play(5, 'both');
    if (weak) makeWeaker(p, weak);
    setMathRng(Rng.seeded(`run|${weak}`));
    const xs: Subject[] = [];
    for (let i = 0; i < 4000; i++) {
      const s = pickSubject();
      noteSubject(s);
      xs.push(s);
    }
    const en = xs.filter((s) => s === 'english').length / xs.length;
    expect(maxRun(xs)).toBeLessThanOrEqual(3);
    expect(en).toBeGreaterThan(lo);
    expect(en).toBeLessThan(hi);
  });

  it.each(GRADES)('Lớp %i: câu đố thật trộn hai môn, không quá 3 câu liền', (g) => {
    play(g, 'both');
    setMathRng(Rng.seeded(`mixed-both|${g}`));
    const xs: string[] = [];
    for (let i = 0; i < 300; i++) {
      const q = i % 3 ? mixedQ() : storyQ(BEAT_IDS[i % BEAT_IDS.length]);
      checkQ(q, g, `${g} #${i}`);
      xs.push(isEnglishQ(q) ? 'english' : 'math');
    }
    expect(maxRun(xs)).toBeLessThanOrEqual(3);
    const en = xs.filter((s) => s === 'english').length / xs.length;
    expect(en).toBeGreaterThan(0.3);
    expect(en).toBeLessThan(0.7);
  });

  it('thử thách cố định chọn môn một lần, lưu theo hồ sơ', () => {
    const p = play(3, 'both');
    setMathRng(Rng.seeded('sites'));
    const sites = Array.from({ length: 20 }, (_, i) => `site.${i}`);
    const first = sites.map((s) => siteSubject(s));
    expect(new Set(first).size).toBe(2);
    for (let i = 0; i < 5; i++) expect(sites.map((s) => siteSubject(s))).toEqual(first);
    sites.forEach((s, i) => {
      expect(sitePick(s)).toBe(first[i]);
      expect(siteMode(s)).toBe(first[i]);
      expect(siteText('bridge.title', s)).toBe(TEXT['bridge.title'][first[i]]);
      expect(isEnglishQ(storyQ('forestBridge', { site: s }))).toBe(first[i] === 'english');
    });
    expect(siteMode('chua.chon')).toBe('both');
    // Đổi sang Toán: bỏ các lựa chọn Tiếng Anh; đổi lại "Cả hai": chỉ chọn lại những nơi đã bỏ.
    setSubjectSettings({ subject: 'math' });
    expect(Object.values(p.picks).every((s) => s === 'math')).toBe(true);
    setSubjectSettings({ subject: 'both' });
    sites.forEach((s, i) => {
      if (first[i] === 'math') expect(siteSubject(s)).toBe('math');
    });
  });

  it('lâu đài: chia 2 + 1 cố định, môn cần luyện hơn được hai phòng', () => {
    const p = play(4, 'both');
    makeWeaker(p, 'math');
    const rooms = castleRooms();
    expect(rooms).toEqual({ mul: 'math', frac: 'english', geo: 'math' });
    expect(kingPlan()).toEqual(['math', 'english', 'math', 'english', 'math']);
    makeWeaker(p, 'english');
    expect(castleRooms()).toEqual(rooms);
    expect(kingPlan()).toEqual(['english', 'math', 'english', 'math', 'english']);
    for (const id of ROOM_IDS) expect(sitePick(`castle.${id}`)).toBe(rooms[id]);
  });

  it('lâu đài: đổi môn qua lại nhiều lần vẫn luôn 2 + 1, giữ phòng còn hợp lệ', () => {
    const p = play(3, 'both');
    const R = Rng.seeded('castle-walk');
    let last: Record<RoomId, Subject> | null = null;
    for (let i = 0; i < 400; i++) {
      const r = R.next();
      if (r < 0.3) setSubjectSettings({ subject: SUBJECT_MODES[R.int(0, 2)] });
      else if (r < 0.6) makeWeaker(p, R.next() < 0.5 ? 'math' : 'english');
      const mode = subject();
      const rooms = castleRooms();
      if (mode !== 'both') {
        expect(Object.values(rooms).every((s) => s === mode)).toBe(true);
        last = null;
        continue;
      }
      const en = ROOM_IDS.filter((id) => rooms[id] === 'english').length;
      expect(en === 1 || en === 2, JSON.stringify(rooms)).toBe(true);
      for (const id of ROOM_IDS) expect(sitePick(`castle.${id}`)).toBe(rooms[id]);
      if (last) expect(rooms).toEqual(last);
      last = rooms;
      expect(castleRooms()).toEqual(rooms);
    }
  });
});

/* ------------------------------------------------------------------ */
describe('ba phòng lâu đài', () => {
  const MATH_WORDS = /toán|phép|nhân|phân số|hình học|cộng|trừ|chia/i;

  it('phòng Toán giữ đúng tên cũ', () => {
    const rooms = roomConfigs({ mul: 'math', frac: 'math', geo: 'math' }, 3, true);
    expect(ROOM_IDS.map((id) => rooms[id].title)).toEqual(['Phòng Bảng Nhân', 'Phòng Phân Số', 'Phòng Hình Học']);
    expect(roomList(rooms)).toBe('Bảng Nhân, Phân Số và Hình Học');
    for (const id of ROOM_IDS) {
      expect(rooms[id]).toMatchObject({ ...MATH_ROOMS[id], id, flag: `castle.${id}`, subject: 'math' });
    }
  });

  it.each(GRADES)('Lớp %i: phòng Tiếng Anh có tên riêng, kĩ năng đúng lớp, giữ vị trí và cờ', (g) => {
    for (const listen of [true, false]) {
      const rooms = roomConfigs({ mul: 'english', frac: 'english', geo: 'english' }, g, listen);
      const math = roomConfigs({ mul: 'math', frac: 'math', geo: 'math' }, g, listen);
      expect(new Set(ROOM_IDS.map((id) => rooms[id].title)).size).toBe(3);
      for (const id of ROOM_IDS) {
        const r = rooms[id];
        expect(r.title).toMatch(/^Phòng /);
        expect(`${r.title} ${r.short}`).not.toMatch(MATH_WORDS);
        expect(Array.from(r.bannerSym).length).toBeLessThanOrEqual(2);
        expect(r.en.length).toBeGreaterThan(0);
        for (const t of r.en) expect(resolveTopic(t, { grade: g, listen, units: null }), `${g} ${id} ${t}`).toBe(t);
        expect(r.en.includes('en_listen')).toBe(listen && id === 'frac');
        expect([r.flag, r.x, r.z, r.color]).toEqual([math[id].flag, math[id].x, math[id].z, math[id].color]);
      }
      expect(roomList(rooms)).not.toMatch(MATH_WORDS);
    }
  });

  it('"Cả hai": mỗi phòng theo môn của phòng đó', () => {
    const rooms = roomConfigs({ mul: 'english', frac: 'math', geo: 'english' }, 5, true);
    expect(ROOM_IDS.map((id) => rooms[id].title)).toEqual(['Phòng Từ Vựng', 'Phòng Phân Số', 'Phòng Mẫu Câu']);
    expect(roomList(rooms)).toBe('Từ Vựng, Phân Số và Mẫu Câu');
  });
});

/* ------------------------------------------------------------------ */
describe('lời theo môn (TEXT)', () => {
  /** Cột Toán ghim lại: đúng chữ của bản chỉ có Toán (trừ ví dụ "7 + 5", "12, 8, 15" đã bỏ cho mọi môn). */
  const MATH_TEXT: Record<TextKey, string> = {
    'house.intro': 'Mình có thể trang trí phòng, trồng cây ở vườn nhỏ, xem huy hiệu và luyện tập toán ở bàn học.',
    'house.grow': 'Giải thêm bài toán để cây lớn nhé!',
    'house.bed': 'Nghỉ một chút rồi mình sẽ học toán tiếp.',
    'shop.more': 'Hãy giải toán hoặc chơi mini-game để có thêm xu nhé!',
    'village.tipBridge': 'Nghe nói trong Rừng Thông Thái có cây cầu chỉ hạ xuống khi giải đúng phép cộng đấy!',
    'village.tipCount': 'Mình thích đếm hoa lắm: 1, 2, 3, 4, 5…',
    'village.tipLevel': 'Muốn lên cấp nhanh thì hãy chơi mini-game và giải thật nhiều bài toán nhé!',
    'village.shopAsk': 'Nhưng trước tiên, bạn giải giúp cô bài toán mua trái cây này nhé!',
    'village.shopDone': 'Giỏi quá! Bạn tính tiền rất nhanh.',
    'village.bear': 'Mình muốn đến Sở Thú thăm bạn Hươu cao cổ, nhưng đường đi có nhiều thử thách toán học quá.',
    'sub.forest': 'Cộng, trừ và thử thách trực quan',
    'sub.maze': 'Giải toán để chọn đúng đường',
    'sub.zoo': 'Bài toán về động vật',
    'sub.zooZone': 'Chăm sóc động vật bằng toán học',
    'lock.castleDo': 'Hãy giải toán và chơi mini-game để lên cấp nhé!',
    'obj.levelUp': '(chơi mini-game, giải toán)',
    'bridge.obj': 'Mở Cầu Phép Cộng',
    'bridge.objStory': 'Mở Cầu Phép Cộng trong rừng',
    'bridge.quest': 'Mở Cầu Phép Cộng của Bác Cú',
    'bridge.sign': '🌉 Cầu Phép Cộng',
    'bridge.title': 'Cầu Phép Cộng',
    'bridge.label': 'Giải để hạ cầu',
    'bridge.owl': 'Muốn hạ Cầu Phép Cộng, con hãy giải phép tính trên bảng nhé!',
    'rock.buddy': 'Tảng đá to quá! Chắc phép trừ sẽ làm nó vỡ ra.',
    'rock.label': 'Giải để phá đá',
    'bearBridge.buddy': 'Cây cầu này bị khóa. Mình cần đủ tấm ván để mở nó – bạn tính giúp mình nhé!',
    'bearBridge.ask': 'Cầu này cần thêm ván mới đi qua được. Bạn tính giúp mình nhé!',
    'stones.obj': 'Chọn viên đá lớn nhất để qua suối',
    'stones.step': 'Chọn viên đá lớn nhất',
    'stones.buddy': 'Mình sẽ đứng sau bạn. Hãy chọn viên đá có số lớn nhất nhé!',
    'stones.label': 'Chọn đá lớn nhất',
    'stones.sign': 'Chọn viên đá lớn nhất',
    'maze.exit': 'Đủ 3 chìa khóa rồi. Cổng cuối đang chờ bạn giải một phép tính nữa!',
    'maze.tip': 'Nếu gặp nhiều cửa, cháu đọc câu hỏi trước rồi nhìn số trên từng cửa.',
    'maze.doors': 'Ở mỗi ngã rẽ, bạn sẽ thấy nhiều cánh cửa có số.',
    'park.tickets': 'Mỗi trò chơi toán học cho mình 1 vé.',
    'park.balls': 'Ném bóng: số nào đúng thì mục tiêu bật tung!',
    'park.welcome': 'Mỗi điểm vui chơi là một thử thách toán. Giải đúng thì bạn nhận 1 vé.',
    'park.coaster': 'Tàu lượn có 3 toa, mỗi toa 6 chỗ. Mình cùng tính số ghế nhé!',
    'zoo.keeper': 'Bạn hãy ghé từng chuồng, giải toán rồi cho các bạn thú ăn. Các bạn ấy thích bạn lắm!',
    'zoo.gate': 'Nhớ: giải toán xong thì tự tay cho các bạn ấy ăn trong thế giới nha!',
    'zoo.giraffe': 'Mình cần chuẩn bị giỏ táo trước. Hãy giải bài toán ở chuồng hươu nhé!',
    'zoo.monkey': 'Hãy chuẩn bị nải chuối bằng bài toán ở sân khỉ trước nhé!',
    'zoo.penguins': 'Hãy chuẩn bị xô cá bằng bài toán ở hồ cánh cụt trước nhé!',
    'zoo.giraffeStep': 'Giúp hươu cao cổ giải bài toán về số quả táo',
    'quest.shop': 'Giải bài toán mua trái cây của Cô Mèo',
    'quest.balls': 'Ném bóng trúng số',
    'goal.any': 'toán',
  };

  it('cột Toán đúng từng chữ như bản chỉ có Toán', () => {
    const math = Object.fromEntries(Object.entries(TEXT).map(([k, v]) => [k, v.math]));
    expect(math).toEqual(MATH_TEXT);
  });

  it('bé học Tiếng Anh / cả hai không bao giờ được bảo là đang học Toán', () => {
    const MATH = /toán|phép (cộng|trừ|nhân|chia|tính)|con số|tính tiền|tính giúp|số lớn nhất|có số/i;
    for (const [k, v] of Object.entries(TEXT)) {
      expect(v.english, k).not.toMatch(MATH);
      expect(v.both, k).not.toMatch(MATH);
      if (k !== 'goal.any') {
        expect(v.english.length, k).toBeGreaterThan(0);
        expect(v.both.length, k).toBeGreaterThan(0);
      }
      expect(v.english, k).not.toMatch(/\s{2}|^\s|\s$/);
      expect(v.both, k).not.toMatch(/\s{2}|^\s|\s$/);
    }
  });

  it('st() theo môn của hồ sơ hoặc môn được chỉ định', async () => {
    await loadEnglish();
    for (const m of SUBJECT_MODES) {
      play(3, m);
      expect(st('bridge.title')).toBe(TEXT['bridge.title'][m]);
      expect(st('bridge.title', 'english')).toBe('Cầu Từ Vựng');
      unloadProfile();
    }
  });

  it('dòng giới thiệu ở màn hình tiêu đề cố định', () => {
    expect(TAGLINE).toBe('Phiêu lưu · Khám phá · Toán & Tiếng Anh');
  });
});

/* ------------------------------------------------------------------ */
describe('huy hiệu', () => {
  const OLD_IDS = ['cong-sieu-toc', 'vua-me-cung', 'bang-nhan', 'nha-toan-hoc', 'nha-tham-hiem', 'ngoi-sao-lang', 'ban-muong-thu', 'vua-tro-choi', 'hiep-si', 'nha-lam-vuon', 'nguoi-mua-sam', 'cham-chi', 'tram-cau', 'nha-vo-dich'];

  it('mã huy hiệu cũ vẫn còn (huy hiệu đã nhận không mất), mã không trùng', () => {
    for (const id of OLD_IDS) expect(badgeDef(id), id).toBeDefined();
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    expect(new Set(BADGES.map((b) => b.name)).size).toBe(BADGES.length);
  });

  it('tên chung không nhắc tới Toán; huy hiệu riêng môn ghi rõ môn', () => {
    for (const b of BADGES) {
      if (b.subject !== 'math') expect(`${b.name} ${b.desc}`, b.id).not.toMatch(/toán/i);
      if (!b.subject) expect(`${b.name} ${b.desc}`, b.id).not.toMatch(/tiếng anh/i);
    }
    expect(BADGES.filter((b) => b.subject === 'english').length).toBeGreaterThanOrEqual(4);
  });

  it('bé chỉ học Tiếng Anh không thấy huy hiệu riêng của Toán (trừ khi đã nhận)', () => {
    for (const b of BADGES) {
      expect(badgeVisible(b, 'both', false)).toBe(true);
      expect(badgeVisible(b, 'english', false), b.id).toBe(b.subject !== 'math');
      expect(badgeVisible(b, 'math', false), b.id).toBe(b.subject !== 'english');
      for (const m of SUBJECT_MODES) expect(badgeVisible(b, m, true)).toBe(true);
    }
  });

  it('huy hiệu tự động theo số câu Tiếng Anh', () => {
    const p = play(3, 'english');
    const stat = (q: number, first: number) => ({ q, first, attempts: q, ms: 1000, last: Date.now() });
    p.stats.en_vocab = stat(50, 10);
    p.stats.en_listen = stat(25, 19);
    p.stats.en_spell = stat(10, 10);
    p.stats.en_phonics = stat(10, 9);
    checkBadges();
    expect(p.badges).toEqual([]);
    p.stats.en_listen = stat(25, 20);
    p.stats.en_phonics = stat(10, 10);
    p.stats.en_sentence = stat(5, 5);
    checkBadges();
    expect(p.badges.sort()).toEqual(['bac-thay-danh-van', 'doi-tai-vang', 'tram-cau', 'tram-tu']);
    unloadProfile();
    const m = play(3, 'math');
    m.stats.add = stat(100, 80);
    checkBadges();
    expect(m.badges).toContain('tram-cau');
    expect(m.badges).not.toContain('tram-tu');
  });
});

/* ------------------------------------------------------------------ */
describe('mọi nơi ra câu hỏi đều đi qua bộ chọn môn', () => {
  const SOURCES = import.meta.glob<string>('../src/**/*.ts', { query: '?raw', import: 'default', eager: true });

  /** Hàm sinh câu Toán chỉ bộ chọn môn được gọi thẳng. */
  const GUARDED: Record<string, string[]> = {
    '../src/game/challenge': ['adaptiveQuestion', 'storyQuestion', 'mixedQuestion'],
    '../src/math/engine': ['generate'],
    '../src/math/scripted': ['scripted', 'ballsQuestion', 'beatTopic'],
  };
  const ALLOWED = (file: string) =>
    file === '../src/game/challenge.ts' ||
    file === '../src/game/subject.ts' ||
    file.startsWith('../src/math/') ||
    // Mini-game: chuyển sang bộ chọn môn ở bước sau.
    file === '../src/minigames/base.ts';

  function resolve(file: string, spec: string): string {
    if (!spec.startsWith('.')) return spec;
    const parts = file.split('/').slice(0, -1);
    for (const s of spec.split('/')) {
      if (s === '..') parts.pop();
      else if (s !== '.') parts.push(s);
    }
    return parts.join('/').replace(/\.(ts|js)$/, '');
  }

  /** Các hàm sinh câu Toán mà một tệp nhập vào (bỏ qua `import type`). */
  function offences(file: string, text: string): string[] {
    const out: string[] = [];
    const STATIC = /^\s*import\s+(?!type\s)([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm;
    for (const m of text.matchAll(STATIC)) {
      const names = GUARDED[resolve(file, m[2])];
      if (!names) continue;
      const clause = m[1];
      if (/\*\s+as\s+/.test(clause)) {
        out.push(`${file}: import * from ${m[2]}`);
        continue;
      }
      const braces = clause.match(/\{([\s\S]*)\}/)?.[1] ?? '';
      for (const part of braces.split(',')) {
        const name = part.trim();
        if (!name || name.startsWith('type ')) continue;
        const orig = name.split(/\s+as\s+/)[0].trim();
        if (names.includes(orig)) out.push(`${file}: ${orig}`);
      }
    }
    for (const m of text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      if (GUARDED[resolve(file, m[1])]) out.push(`${file}: import(${m[1]})`);
    }
    return out;
  }

  it('bộ dò bắt được mọi kiểu nhập', () => {
    const f = '../src/world/zones/demo.ts';
    expect(offences(f, `import { sfx } from '../../core/audio';\nimport type { BeatId } from '../../math/scripted';`)).toEqual([]);
    expect(offences(f, `import { type BeatId, usesScripted } from '../../math/scripted';`)).toEqual([]);
    expect(offences(f, `import {\n  AttemptTracker,\n  mixedQuestion as mq,\n} from '../../game/challenge';`)).toEqual([`${f}: mixedQuestion`]);
    expect(offences(f, `import { generate } from '../../math/engine.ts';`)).toEqual([`${f}: generate`]);
    expect(offences(f, `import * as S from '../../math/scripted';`)).toHaveLength(1);
    expect(offences(f, `const m = await import('../../game/challenge');`)).toHaveLength(1);
    expect(offences('../src/game/demo.ts', `import { storyQuestion } from './challenge';`)).toEqual(['../src/game/demo.ts: storyQuestion']);
  });

  it('không tệp nào ngoài bộ chọn môn gọi thẳng hàm sinh câu Toán', () => {
    const files = Object.keys(SOURCES);
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain('../src/world/zones/castle.ts');
    const bad = files.filter((f) => !ALLOWED(f)).flatMap((f) => offences(f, SOURCES[f]));
    expect(bad).toEqual([]);
  });

  it('chủ đề trong nhật ký đều thuộc một môn', () => {
    for (const t of Object.keys(TOPICS) as Topic[]) expect(['math', 'english']).toContain(TOPICS[t].subject);
  });
});

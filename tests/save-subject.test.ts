import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SAVE_VERSION } from '../src/config';
import { bus } from '../src/core/events';
import { DEFAULT_OUTFIT } from '../src/core/outfits';
import {
  applySubjectSettings,
  createProfile,
  exportProfile,
  importProfile,
  listProfiles,
  loadProfile,
  newProfile,
  profile,
  readProfile,
  resetProfileProgress,
  saveNow,
  setGrade,
  setSitePick,
  setSubjectSettings,
  sitePick,
  unloadProfile,
  writeProfile,
  type Profile,
} from '../src/core/state';
import { storage } from '../src/core/storage';

/**
 * Hồ sơ v3 – môn học: hồ sơ cũ (v1 trước bé AI, v2 có bé AI) học Toán như trước, không mất gì; Unit, khóa môn,
 * môn của thử thách cố định được giữ và kiểm tra lại khi đổi môn.
 */
beforeAll(() => {
  vi.stubGlobal('window', globalThis);
});

afterEach(() => {
  unloadProfile();
});

let seq = 0;

/** Hồ sơ đúng kiểu bản v1 (chỗ mặc áo/quần/giày, chưa có bé AI, chưa có môn học). */
function v1Save(): Profile & Record<string, unknown> {
  const now = Date.now();
  return {
    v: 1,
    id: `v1-${++seq}`,
    name: `Bé Một ${seq}`,
    grade: 3,
    created: now - 86400000,
    lastPlayed: now - 3600000,
    look: { skin: 2, hair: 3, hairColor: 1, eyes: 2 },
    equipped: { shirt: 'shirt_pink', pants: 'pants_jean', shoes: 'shoes_red', hat: 'hat_cap', backpack: null, acc: null, pet: null, board: null },
    xp: 500,
    coins: 20,
    stars: 7,
    tickets: 1,
    keys: 0,
    inventory: { shirt_pink: 1, pants_jean: 1, shoes_red: 1, shirt_stripe: 1, hat_cap: 1 },
    decor: {},
    plants: [{ seed: null, growth: 0 }],
    badges: ['cham-chi'],
    flags: { 'intro.done': true, 'forest.bridge': true },
    collected: ['village.star.1'],
    quests: { stars: 'done' },
    skills: { add: { level: 4, streak: 1, struggle: 0, support: false, seen: 12 } },
    stats: { add: { q: 12, first: 9, attempts: 15, ms: 60000, last: now } },
    log: [],
    days: {},
    goals: [],
    totalMs: 99999,
    pos: { zone: 'village', x: 1, y: 2 },
    mini: {},
  } as unknown as Profile & Record<string, unknown>;
}

/** Hồ sơ đúng kiểu bản v2 (có bé AI và bộ đồ, chưa có môn học). */
function v2Save(): Profile & Record<string, unknown> {
  const p = newProfile({ name: `Bé Hai ${++seq}`, grade: 5, kid: 'trai' }) as Profile & Record<string, unknown>;
  for (const k of ['subject', 'enUnit', 'subjectLocked', 'picks']) delete p[k];
  p.v = 2;
  p.id = `v2-${seq}`;
  p.coins = 33;
  p.xp = 900;
  p.inventory = { [DEFAULT_OUTFIT]: 1, hat_wizard: 1 };
  p.flags = { 'castle.mul': true };
  return p;
}

function store(p: Profile & Record<string, unknown>): void {
  storage.setJSON(`p.${p.id}`, p);
  const list = storage.getJSON<object[]>('profiles', []).filter((s) => (s as { id: string }).id !== p.id);
  // Mục lục của bản cũ: chưa có `subject` (bản v1 còn chưa có `kid`).
  list.push({ id: p.id, name: p.name, grade: p.grade, created: p.created, lastPlayed: p.lastPlayed, look: p.look, equipped: p.equipped, level: 2, stars: p.stars });
  storage.setJSON('profiles', list);
}

const KEEP = ['name', 'grade', 'created', 'xp', 'stars', 'tickets', 'keys', 'decor', 'plants', 'badges', 'flags', 'collected', 'quests', 'skills', 'stats', 'totalMs', 'pos', 'mini'] as const;

describe('chuyển hồ sơ cũ sang v3 (môn học)', () => {
  it('phiên bản hiện tại là 3', () => {
    expect(SAVE_VERSION).toBe(3);
  });

  it('v1 → v3: qua cả bước bé AI và bước môn học; học Toán như trước', () => {
    const old = v1Save();
    store(old);
    const p = loadProfile(old.id)!;
    expect(p.v).toBe(3);
    // Bước v2 vẫn chạy: đoán bé gái (hai bím), trả xu áo sọc (15), bỏ chỗ mặc cũ.
    expect(p.kid).toBe('gai');
    expect(p.coins).toBe(20 + 15);
    expect(p.equipped).not.toHaveProperty('shirt');
    expect(p.inventory[DEFAULT_OUTFIT]).toBe(1);
    // Bước v3.
    expect(p).toMatchObject({ subject: 'math', enUnit: null, subjectLocked: false, picks: {} });
    for (const k of KEEP) expect(p[k], k).toEqual(old[k]);
  });

  it('v2 → v3: chỉ thêm môn học, không trả xu lại, giữ nguyên mọi thứ', () => {
    const old = v2Save();
    store(old);
    const p = loadProfile(old.id)!;
    expect(p.v).toBe(3);
    expect(p).toMatchObject({ subject: 'math', enUnit: null, subjectLocked: false, picks: {} });
    expect(p.coins).toBe(33);
    expect(p.refund).toBeUndefined();
    expect(p.inventory).toEqual({ [DEFAULT_OUTFIT]: 1, hat_wizard: 1 });
    expect(p.equipped).toEqual(old.equipped);
    for (const k of KEEP) expect(p[k], k).toEqual(old[k]);
  });

  it('hồ sơ v3 giữ môn học, Unit, khóa môn và môn của thử thách', () => {
    const p0 = newProfile({ name: 'Ba', grade: 4, kid: 'gai', subject: 'both' });
    p0.enUnit = 6;
    p0.subjectLocked = true;
    p0.picks = { 'forest.bridge': 'english', 'castle.mul': 'math' };
    store(p0 as Profile & Record<string, unknown>);
    const p = loadProfile(p0.id)!;
    expect(p).toMatchObject({ subject: 'both', enUnit: 6, subjectLocked: true, picks: { 'forest.bridge': 'english', 'castle.mul': 'math' } });
  });

  it('hồ sơ v3 bị bản game cũ ghi lại số phiên bản 1: vẫn giữ môn học đã chọn', () => {
    const p0 = newProfile({ name: 'Bốn', grade: 2, kid: 'trai', subject: 'english' }) as Profile & Record<string, unknown>;
    p0.enUnit = 3;
    p0.v = 1;
    store(p0);
    const p = loadProfile(p0.id)!;
    expect(p).toMatchObject({ v: 3, subject: 'english', enUnit: 3 });
  });

  it('dữ liệu sai được sửa về mặc định an toàn', () => {
    const p0 = newProfile({ name: 'Năm', grade: 1, kid: 'trai' }) as Profile & Record<string, unknown>;
    p0.subject = 'french' as never;
    p0.enUnit = 99;
    p0.subjectLocked = 'yes' as never;
    p0.picks = { a: 'english', b: 'french' } as never;
    store(p0);
    const p = loadProfile(p0.id)!;
    // Môn sai → Toán; khi đó môn Tiếng Anh đã chọn cho thử thách cũng bị bỏ.
    expect(p).toMatchObject({ subject: 'math', enUnit: null, subjectLocked: false, picks: {} });
  });

  it('Unit được giới hạn theo lớp; Unit cuối = cả năm', () => {
    const p = newProfile({ name: 'Sáu', grade: 1, kid: 'gai', subject: 'english' });
    applySubjectSettings(p, { enUnit: 0 });
    expect(p.enUnit).toBe(1);
    applySubjectSettings(p, { enUnit: 7.4 });
    expect(p.enUnit).toBe(7);
    applySubjectSettings(p, { enUnit: 16 });
    expect(p.enUnit).toBeNull();
    applySubjectSettings(p, { enUnit: null });
    expect(p.enUnit).toBeNull();
  });

  it('thẻ hồ sơ (mục lục cũ) hiện môn Toán; mục lục mới có môn đã chọn', () => {
    const a = v1Save();
    const b = v2Save();
    store(a);
    store(b);
    const list = listProfiles();
    expect(list.find((s) => s.id === a.id)).toMatchObject({ subject: 'math', kid: 'gai' });
    expect(list.find((s) => s.id === b.id)).toMatchObject({ subject: 'math' });
    const c = createProfile({ name: 'Bảy', grade: 3, kid: 'trai', subject: 'both' });
    expect(listProfiles().find((s) => s.id === c.id)).toMatchObject({ subject: 'both' });
  });
});

describe('hồ sơ mới', () => {
  it('mặc định Toán (hồ sơ tạo bằng code); bảng tạo nhân vật truyền môn đã chọn', () => {
    expect(newProfile({ name: 'A', grade: 1, kid: 'trai' })).toMatchObject({ subject: 'math', enUnit: null, subjectLocked: false, picks: {} });
    expect(newProfile({ name: 'B', grade: 5, kid: 'gai', subject: 'both' }).subject).toBe('both');
    expect(newProfile({ name: 'C', grade: 5, kid: 'gai', subject: 'english' }).subject).toBe('english');
  });
});

describe('đổi môn', () => {
  it('Cả hai → Toán: bỏ các thử thách đã chọn Tiếng Anh; cờ hoàn thành giữ nguyên', () => {
    const p = createProfile({ name: 'Tám', grade: 3, kid: 'trai', subject: 'both' });
    p.flags['forest.bridge'] = true;
    setSitePick('forest.bridge', 'english');
    setSitePick('forest.rock', 'math');
    setSubjectSettings({ subject: 'math' });
    expect(profile().picks).toEqual({ 'forest.rock': 'math' });
    expect(sitePick('forest.bridge')).toBeUndefined();
    expect(profile().flags['forest.bridge']).toBe(true);
    setSubjectSettings({ subject: 'english' });
    expect(profile().picks).toEqual({});
  });

  it('Toán → Cả hai: giữ các lựa chọn cũ', () => {
    createProfile({ name: 'Chín', grade: 3, kid: 'trai', subject: 'math' });
    setSitePick('forest.rock', 'math');
    setSubjectSettings({ subject: 'both' });
    expect(profile().picks).toEqual({ 'forest.rock': 'math' });
  });

  it('báo sự kiện "subject" khi môn hoặc Unit đổi (không báo khi chỉ đổi khóa môn)', () => {
    createProfile({ name: 'Mười', grade: 3, kid: 'gai', subject: 'math' });
    const seen: string[] = [];
    const off = bus.on('subject', (e) => seen.push(e.subject));
    setSubjectSettings({ subject: 'math' });
    setSubjectSettings({ subjectLocked: true });
    expect(profile().subjectLocked).toBe(true);
    setSubjectSettings({ subject: 'english' });
    setSubjectSettings({ enUnit: 4 });
    off();
    expect(seen).toEqual(['english', 'english']);
  });

  it('đổi lớp xóa Unit (mỗi lớp có danh sách Unit riêng)', () => {
    createProfile({ name: 'Mười Một', grade: 3, kid: 'gai', subject: 'english' });
    setSubjectSettings({ enUnit: 5 });
    setGrade(4);
    expect(profile().enUnit).toBeNull();
    expect(profile().subject).toBe('english');
  });

  it('bảng giáo viên ghi hồ sơ đang chơi: cập nhật và báo đổi môn', () => {
    const p = createProfile({ name: 'Mười Hai', grade: 2, kid: 'trai', subject: 'math' });
    const seen: string[] = [];
    const off = bus.on('subject', (e) => seen.push(e.subject));
    const copy = readProfile(p.id)!;
    applySubjectSettings(copy, { subject: 'both', enUnit: 2, subjectLocked: true });
    writeProfile(copy);
    off();
    expect(profile()).toMatchObject({ subject: 'both', enUnit: 2, subjectLocked: true });
    expect(seen).toEqual(['both']);
  });

  it('đặt lại tiến độ giữ môn học, Unit, khóa môn; xóa môn của các thử thách', () => {
    const p = createProfile({ name: 'Mười Ba', grade: 4, kid: 'gai', subject: 'english' });
    setSubjectSettings({ enUnit: 8, subjectLocked: true });
    setSitePick('castle.mul', 'english');
    const id = p.id;
    unloadProfile();
    const r = resetProfileProgress(id)!;
    expect(r).toMatchObject({ subject: 'english', enUnit: 8, subjectLocked: true, picks: {} });
  });
});

describe('sao lưu', () => {
  it('tệp xuất v1 và v2 nhập được, học Toán', () => {
    const a = v1Save();
    const pa = importProfile(JSON.stringify({ app: 'vuong-quoc-toan-hoc', version: 1, profile: a }));
    expect(pa).toMatchObject({ v: 3, subject: 'math', kid: 'gai', enUnit: null });
    const b = v2Save();
    const pb = importProfile(JSON.stringify({ app: 'vuong-quoc-toan-hoc', version: 2, profile: b }));
    expect(pb).toMatchObject({ v: 3, subject: 'math', coins: 33 });
    expect(pb.refund).toBeUndefined();
  });

  it('xuất rồi nhập lại giữ môn học, Unit, khóa môn; mã ứng dụng không đổi', () => {
    const p = createProfile({ name: 'Mười Bốn', grade: 5, kid: 'trai', subject: 'both' });
    setSubjectSettings({ enUnit: 12, subjectLocked: true });
    setSitePick('maze.exit', 'english');
    saveNow();
    const json = exportProfile(p.id);
    expect(JSON.parse(json)).toMatchObject({ app: 'vuong-quoc-toan-hoc', version: 3 });
    unloadProfile();
    const q = importProfile(json);
    expect(q).toMatchObject({ subject: 'both', enUnit: 12, subjectLocked: true, picks: { 'maze.exit': 'english' } });
  });
});

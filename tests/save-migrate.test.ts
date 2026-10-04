import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SAVE_VERSION } from '../src/config';
import { formatPlayed, importSummary, isOlder, OLDER_WARNING, UNKNOWN_DATE } from '../src/core/backup';
import { bus } from '../src/core/events';
import { RETIRED_WEAR } from '../src/core/items';
import { DEFAULT_OUTFIT } from '../src/core/outfits';
import { levelFromXp } from '../src/core/progression';
import {
  addCoins,
  checkImport,
  deleteProfile,
  equip,
  exportProfile,
  guessKid,
  hasProfile,
  importBackup,
  importProfile,
  listProfiles,
  loadProfile,
  newProfile,
  parseProfileFile,
  profile,
  readProfile,
  saveNow,
  setKid,
  storeImported,
  takeRefundNotice,
  unloadProfile,
  type Profile,
} from '../src/core/state';
import { storage } from '../src/core/storage';

/**
 * Hồ sơ cũ (trước khi có bé AI): tự đoán bé trai / bé gái, bỏ áo, quần, giày và trả lại xu cho món phải mua – đúng một lần,
 * không mất xu hay vật phẩm nào khác. Bản sao lưu cũ (tệp xuất) vẫn nhập được.
 */
beforeAll(() => {
  // state.ts hẹn giờ lưu bằng window.setTimeout (trình duyệt).
  vi.stubGlobal('window', globalThis);
});

afterEach(() => {
  unloadProfile();
});

const FREE = ['shirt_blue', 'shirt_pink', 'shirt_yellow', 'shirt_green', 'pants_jean', 'pants_skirt', 'pants_shorts', 'shoes_red'];

let seq = 0;
/** Hồ sơ đúng kiểu bản cũ (SAVE_VERSION 1: chỗ mặc áo/quần/giày, chưa có bé AI). */
function oldSave(o: { hair?: number; shirt?: string; pants?: string; shoes?: string; extra?: string[]; coins?: number } = {}): Profile & Record<string, unknown> {
  const inventory: Record<string, number> = {};
  for (const id of [...FREE, ...(o.extra ?? [])]) inventory[id] = (inventory[id] ?? 0) + 1;
  const now = Date.now();
  return {
    v: 1,
    id: `old-${++seq}`,
    name: `Bé Cũ ${seq}`,
    grade: 2,
    created: now - 86400000,
    lastPlayed: now - 3600000,
    look: { skin: 2, hair: o.hair ?? 0, hairColor: 1, eyes: 2 },
    equipped: { shirt: o.shirt ?? 'shirt_blue', pants: o.pants ?? 'pants_jean', shoes: o.shoes ?? 'shoes_red', hat: 'hat_cap', backpack: 'bag_star', acc: 'acc_cape', pet: 'pet_dog', board: 'board_skate' },
    xp: 820,
    coins: o.coins ?? 37,
    stars: 12,
    tickets: 3,
    keys: 1,
    inventory,
    decor: { rug: 'decor_rug_round', lamp: 'decor_lamp' },
    plants: [{ seed: 'seed_tomato', growth: 2 }, { seed: null, growth: 0 }, { seed: null, growth: 0 }],
    badges: ['cham-chi'],
    flags: { 'intro.done': true },
    collected: ['village.star.1'],
    quests: { stars: 'done' },
    skills: {},
    stats: {},
    log: [],
    days: {},
    goals: [],
    totalMs: 123456,
    pos: { zone: 'forest', x: 3, y: 4 },
    mini: { fishing: { best: 9, plays: 2 } },
  } as unknown as Profile & Record<string, unknown>;
}

/** Lưu hồ sơ cũ vào bộ nhớ như bản cũ đã lưu (hồ sơ + mục lục). */
function store(p: Profile & Record<string, unknown>): void {
  storage.setJSON(`p.${p.id}`, p);
  const list = storage.getJSON<object[]>('profiles', []).filter((s) => (s as { id: string }).id !== p.id);
  list.push({ id: p.id, name: p.name, grade: p.grade, created: p.created, lastPlayed: p.lastPlayed, look: p.look, equipped: p.equipped, level: 3, stars: p.stars });
  storage.setJSON('profiles', list);
}

const RICH = ['shirt_stripe', 'shirt_dress', 'shirt_robe', 'pants_purple', 'pants_red', 'shoes_rocket', 'shoes_white'];
const RICH_COINS = 15 + 30 + 120 + 20 + 15 + 90 + 10;
const KEEP = ['hat_cap', 'hat_crown', 'bag_star', 'acc_cape', 'acc_medal', 'pet_dog', 'pet_dino', 'board_skate', 'decor_sofa', 'seed_tomato', 'apple'];

describe('đoán bé trai / bé gái từ hồ sơ cũ', () => {
  it('tóc dài, hai bím → bé gái', () => {
    expect(guessKid({ look: { hair: 2 } })).toBe('gai');
    expect(guessKid({ look: { hair: 3 } })).toBe('gai');
  });

  it('đang mặc váy → bé gái', () => {
    expect(guessKid({ look: { hair: 0 }, equipped: { shirt: 'shirt_dress' } })).toBe('gai');
    expect(guessKid({ look: { hair: 1 }, equipped: { pants: 'pants_skirt' } })).toBe('gai');
    expect(guessKid({ look: { hair: 4 }, equipped: { pants: 'pants_purple' } })).toBe('gai');
  });

  it('còn lại → bé trai', () => {
    for (const hair of [0, 1, 4, 5]) expect(guessKid({ look: { hair }, equipped: { shirt: 'shirt_pink', pants: 'pants_shorts' } })).toBe('trai');
    expect(guessKid({})).toBe('trai');
    expect(guessKid({ look: null, equipped: null })).toBe('trai');
  });
});

describe('chuyển hồ sơ cũ', () => {
  it('giá trả lại đúng giá bán cũ; đồ được tặng lúc tạo hồ sơ giá 0', () => {
    for (const id of FREE) expect(RETIRED_WEAR[id], id).toBe(0);
    expect(RICH.reduce((s, id) => s + RETIRED_WEAR[id], 0)).toBe(RICH_COINS);
  });

  it('bé trai, chỉ có đồ được tặng: không trả xu, không báo', () => {
    const old = oldSave({ hair: 1 });
    store(old);
    const p = loadProfile(old.id)!;
    expect(p.v).toBe(SAVE_VERSION);
    expect(p.kid).toBe('trai');
    expect(p.coins).toBe(37);
    expect(p.refund).toBeUndefined();
    expect(takeRefundNotice()).toBe(0);
    expect(Object.keys(p.inventory).filter((id) => /^(shirt|pants|shoes)_/.test(id))).toEqual([]);
    expect(p.inventory[DEFAULT_OUTFIT]).toBe(1);
    expect(p.equipped).toEqual({ outfit: DEFAULT_OUTFIT, hat: 'hat_cap', backpack: 'bag_star', acc: 'acc_cape', pet: 'pet_dog', board: 'board_skate' });
  });

  it('bé gái mặc váy, nhiều quần áo mua: trả đúng số xu một lần, giữ mọi thứ khác', () => {
    const old = oldSave({ hair: 0, shirt: 'shirt_dress', pants: 'pants_purple', extra: [...RICH, 'shirt_star', 'shirt_star', ...KEEP], coins: 5 });
    store(old);
    const refund = RICH_COINS + 2 * 25;
    const p = loadProfile(old.id)!;
    expect(p.kid).toBe('gai');
    expect(p.coins).toBe(5 + refund);
    expect(p.refund).toBe(refund);
    for (const id of KEEP) expect(p.inventory[id], id).toBe(1);
    expect(Object.keys(p.inventory).sort()).toEqual([...KEEP, DEFAULT_OUTFIT].sort());
    // Mọi thứ khác giữ nguyên.
    for (const k of ['name', 'grade', 'created', 'xp', 'stars', 'tickets', 'keys', 'decor', 'plants', 'badges', 'flags', 'collected', 'quests', 'totalMs', 'pos', 'mini'] as const) {
      expect(p[k], k).toEqual(old[k]);
    }
    expect(p.equipped.outfit).toBe(DEFAULT_OUTFIT);
    expect(p.equipped).not.toHaveProperty('shirt');
    expect(p.equipped).not.toHaveProperty('pants');
    expect(p.equipped).not.toHaveProperty('shoes');

    // Báo một lần.
    expect(takeRefundNotice()).toBe(refund);
    expect(takeRefundNotice()).toBe(0);

    // Mở lại hồ sơ: không trả lần nữa.
    unloadProfile();
    const again = loadProfile(old.id)!;
    expect(again.coins).toBe(5 + refund);
    expect(again.refund).toBeUndefined();
    expect(takeRefundNotice()).toBe(0);
  });

  it('chưa kịp báo (thoát trước khi vào làng): lần sau vẫn báo, xu vẫn chỉ trả một lần', () => {
    const old = oldSave({ hair: 3, extra: ['shoes_star'] });
    store(old);
    loadProfile(old.id);
    unloadProfile();
    const p = loadProfile(old.id)!;
    expect(p.kid).toBe('gai');
    expect(p.coins).toBe(37 + 45);
    expect(takeRefundNotice()).toBe(45);
  });

  it('thẻ hồ sơ ở màn hình tiêu đề (mục lục cũ) có bé và bộ đồ', () => {
    const boy = oldSave({ hair: 5 });
    const girl = oldSave({ hair: 0, pants: 'pants_skirt' });
    store(boy);
    store(girl);
    const list = listProfiles();
    expect(list.find((s) => s.id === boy.id)).toMatchObject({ kid: 'trai', equipped: { outfit: DEFAULT_OUTFIT, hat: 'hat_cap' } });
    expect(list.find((s) => s.id === girl.id)).toMatchObject({ kid: 'gai', equipped: { outfit: DEFAULT_OUTFIT } });
  });

  it('bộ đồ không còn tệp mô hình → mặc "Đồ thường ngày" (vẫn giữ trong túi)', () => {
    const old = oldSave() as Profile & Record<string, unknown>;
    old.v = SAVE_VERSION;
    (old as Profile).kid = 'trai';
    (old as Profile).equipped = { outfit: 'outfit_da_xoa', hat: null, backpack: null, acc: null, pet: null, board: null };
    (old as Profile).inventory = { [DEFAULT_OUTFIT]: 1, outfit_da_xoa: 1 };
    store(old);
    const p = loadProfile(old.id)!;
    expect(p.equipped.outfit).toBe(DEFAULT_OUTFIT);
    expect(p.inventory.outfit_da_xoa).toBe(1);
  });
});

describe('sao lưu (xuất / nhập tệp)', () => {
  it('tệp xuất từ bản cũ vẫn nhập được và được trả xu', () => {
    const old = oldSave({ hair: 2, extra: ['shirt_rainbow', 'hat_wizard'] });
    const json = JSON.stringify({ app: 'vuong-quoc-toan-hoc', version: 1, profile: old }, null, 1);
    const p = importProfile(json);
    expect(p.kid).toBe('gai');
    expect(p.coins).toBe(37 + 80);
    expect(p.inventory.hat_wizard).toBe(1);
    expect(p.inventory.shirt_rainbow).toBeUndefined();
    expect(readProfile(old.id)!.coins).toBe(37 + 80);
  });

  it('xuất rồi nhập lại: không trả xu hai lần', () => {
    const old = oldSave({ extra: ['shoes_rocket'] });
    store(old);
    const json = exportProfile(old.id);
    expect(JSON.parse(json)).toMatchObject({ app: 'vuong-quoc-toan-hoc', version: SAVE_VERSION });
    const p = importProfile(json);
    expect(p.coins).toBe(37 + 90);
    const p2 = importProfile(exportProfile(p.id));
    expect(p2.coins).toBe(37 + 90);
    expect(p2.kid).toBe('trai');
  });

  it('tệp không đúng định dạng → báo lỗi', () => {
    expect(() => importProfile(JSON.stringify({ app: 'khac', profile: oldSave() }))).toThrow();
    expect(() => importProfile(JSON.stringify({ app: 'vuong-quoc-toan-hoc' }))).toThrow();
    expect(() => importProfile('{không phải json')).toThrow('Tệp không đúng định dạng.');
    expect(() => importProfile('null')).toThrow('Tệp không đúng định dạng.');
  });
});

/** Tệp sao lưu của một hồ sơ đã lưu trên máy (lấy khi chưa chơi), sửa tùy ý trước khi nhập lại. */
function backupOf(id: string, edit: (p: Profile) => void = () => {}): string {
  const data = JSON.parse(exportProfile(id)) as { profile: Profile };
  edit(data.profile);
  return JSON.stringify(data);
}

describe('nhập tệp trùng hồ sơ đang chơi', () => {
  it('hồ sơ đang chơi được gỡ khỏi bộ nhớ – các lần lưu sau không ghi đè bản vừa nhập', () => {
    const old = oldSave();
    store(old);
    const file = backupOf(old.id, (p) => {
      p.coins = 999;
      p.badges = ['cham-chi', 'tram-cau'];
    });
    loadProfile(old.id);
    addCoins(5);
    saveNow();
    const seen: (string | null)[] = [];
    const off = bus.on('profile', (e) => seen.push(e.id));
    const p = importProfile(file);
    off();
    const stillLoaded = hasProfile();
    expect(p.coins).toBe(999);
    saveNow();
    unloadProfile();
    expect(readProfile(old.id)).toMatchObject({ coins: 999, badges: ['cham-chi', 'tram-cau'] });
    expect(stillLoaded).toBe(false);
    expect(seen).toEqual([null]);
    expect(listProfiles().filter((s) => s.id === old.id)).toHaveLength(1);
    expect(loadProfile(old.id)!.coins).toBe(999);
  });

  it('lần lưu đang hẹn giờ (400 ms) bị hủy, không ghi đè bản vừa nhập', () => {
    vi.useFakeTimers();
    try {
      const old = oldSave();
      store(old);
      const file = backupOf(old.id, (p) => {
        p.coins = 999;
      });
      loadProfile(old.id);
      addCoins(5);
      importProfile(file);
      vi.advanceTimersByTime(2000);
      expect(storage.getJSON<Profile | null>(`p.${old.id}`, null)!.coins).toBe(999);
      expect(hasProfile()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('nhập hồ sơ khác: hồ sơ đang chơi giữ nguyên, lưu tiếp bình thường', () => {
    const a = oldSave();
    const b = oldSave();
    store(a);
    store(b);
    const fileB = backupOf(b.id, (p) => {
      p.coins = 555;
    });
    loadProfile(a.id);
    const me = profile();
    addCoins(5);
    importProfile(fileB);
    expect(hasProfile()).toBe(true);
    expect(profile()).toBe(me);
    expect(me.coins).toBe(37 + 5);
    saveNow();
    expect(readProfile(a.id)!.coins).toBe(37 + 5);
    expect(readProfile(b.id)!.coins).toBe(555);
  });

  it('tệp xuất từ bản cũ (có áo quần phải mua) của chính hồ sơ đang chơi: trả xu và báo đúng một lần', () => {
    const old = oldSave({ hair: 2 });
    store(old);
    const oldFile = JSON.stringify({ app: 'vuong-quoc-toan-hoc', version: 1, profile: oldSave({ hair: 2, extra: ['shirt_rainbow', 'shoes_rocket'] }) });
    const fixed = JSON.parse(oldFile) as { profile: Profile };
    fixed.profile.id = old.id;
    loadProfile(old.id);
    expect(takeRefundNotice()).toBe(0);
    importProfile(JSON.stringify(fixed));
    expect(hasProfile()).toBe(false);
    loadProfile(old.id);
    expect(profile().coins).toBe(37 + 80 + 90);
    expect(takeRefundNotice()).toBe(80 + 90);
    expect(takeRefundNotice()).toBe(0);
    unloadProfile();
    loadProfile(old.id);
    expect(profile().coins).toBe(37 + 80 + 90);
    expect(takeRefundNotice()).toBe(0);
  });

  it('chỉ đọc tệp (chưa bấm "Nhập"): không ghi gì, hồ sơ đang chơi giữ nguyên', () => {
    const old = oldSave();
    store(old);
    const file = backupOf(old.id, (p) => {
      p.coins = 999;
    });
    loadProfile(old.id);
    const me = profile();
    const before = JSON.stringify(storage.getJSON(`p.${old.id}`, null));
    const parsed = parseProfileFile(file);
    expect(parsed.id).toBe(old.id);
    expect(parsed.coins).toBe(999);
    expect(JSON.stringify(storage.getJSON(`p.${old.id}`, null))).toBe(before);
    expect(profile()).toBe(me);
    expect(() => parseProfileFile('{hỏng')).toThrow('Tệp không đúng định dạng.');
    storeImported(parsed);
    expect(hasProfile()).toBe(false);
    expect(readProfile(old.id)!.coins).toBe(999);
  });

  it('xuất / đọc hồ sơ đang chơi lấy cả thay đổi chưa kịp lưu', () => {
    const old = oldSave();
    store(old);
    loadProfile(old.id);
    addCoins(7);
    expect(readProfile(old.id)!.coins).toBe(37 + 7);
    addCoins(1);
    expect((JSON.parse(exportProfile(old.id)) as { profile: Profile }).profile.coins).toBe(37 + 8);
  });

  it('xóa hồ sơ đang chơi: hủy lần lưu đang hẹn giờ, hồ sơ không "sống lại"', () => {
    vi.useFakeTimers();
    try {
      const old = oldSave();
      store(old);
      loadProfile(old.id);
      addCoins(5);
      deleteProfile(old.id);
      vi.advanceTimersByTime(2000);
      expect(hasProfile()).toBe(false);
      expect(storage.getJSON(`p.${old.id}`, null)).toBeNull();
      expect(listProfiles().some((s) => s.id === old.id)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('nhập tệp trùng hồ sơ đã có trên máy: hỏi lại, so sánh hai bản', () => {
  type Asked = Parameters<Parameters<typeof importBackup>[1]>[0];
  /** Người lớn trả lời hộp hỏi lại ("Nhập" = true, "Thôi" = false); ghi lại những gì hộp hiện ra. */
  function answer(ok: boolean) {
    const seen: Asked[] = [];
    return {
      seen,
      ask: async (c: Asked) => {
        seen.push(c);
        return ok;
      },
    };
  }
  const onDevice = (id: string) => [storage.get(`p.${id}`), storage.get('profiles')];

  it('hồ sơ chưa có trên máy: nhập luôn, không hỏi', async () => {
    const fresh = oldSave();
    const a = answer(false);
    const done = await importBackup(JSON.stringify({ app: 'vuong-quoc-toan-hoc', version: SAVE_VERSION, profile: fresh }), a.ask);
    expect(a.seen).toHaveLength(0);
    expect(done).toMatchObject({ device: null, playing: false, older: false });
    expect(readProfile(fresh.id)).toMatchObject({ name: fresh.name, stars: 12 });
  });

  it('đã có trên máy: hỏi lại kèm bảng so sánh; bấm "Nhập" → thay bằng bản trong tệp', async () => {
    const old = oldSave();
    store(old);
    const file = backupOf(old.id, (p) => {
      p.stars = 30;
      p.xp = 5000;
      p.grade = 3;
      p.lastPlayed = old.lastPlayed + 3600000;
    });
    const a = answer(true);
    const done = await importBackup(file, a.ask);
    expect(a.seen).toHaveLength(1);
    const c = a.seen[0];
    expect(c).toMatchObject({ playing: false, older: false });
    expect(c.device).toEqual({ name: old.name, grade: 2, stars: 12, level: levelFromXp(820), lastPlayed: old.lastPlayed });
    expect(c.file).toEqual({ name: old.name, grade: 3, stars: 30, level: levelFromXp(5000), lastPlayed: old.lastPlayed + 3600000 });
    const s = importSummary(c);
    expect(s.text).toBe(`Máy này đã có hồ sơ của ${old.name}. Nhập tệp sẽ thay toàn bộ tiến trình trên máy bằng bản trong tệp.`);
    expect(s.rows.map((r) => [r.label, r.differs])).toEqual([
      ['Tên', false],
      ['Lớp', true],
      ['⭐ Ngôi sao', true],
      ['Cấp', levelFromXp(820) !== levelFromXp(5000)],
      ['Chơi lần cuối', true],
    ]);
    expect(s.rows[2]).toMatchObject({ device: '12', file: '30' });
    expect(s.warning).toBeNull();
    expect(done).toMatchObject({ playing: false });
    expect(readProfile(old.id)).toMatchObject({ stars: 30, grade: 3 });
    expect(listProfiles().filter((x) => x.id === old.id)).toHaveLength(1);
  });

  it('bấm "Thôi": trên máy không có gì thay đổi', async () => {
    const old = oldSave();
    store(old);
    const file = backupOf(old.id, (p) => {
      p.coins = 999;
    });
    const before = onDevice(old.id);
    const a = answer(false);
    expect(await importBackup(file, a.ask)).toBeNull();
    expect(a.seen).toHaveLength(1);
    expect(onDevice(old.id)).toEqual(before);
    expect(readProfile(old.id)!.coins).toBe(37);
  });

  it('đang chơi hồ sơ khác: vẫn hỏi; bấm "Nhập" → hồ sơ đang chơi giữ nguyên', async () => {
    const a = oldSave();
    const b = oldSave();
    store(a);
    store(b);
    const fileB = backupOf(b.id, (p) => {
      p.coins = 555;
    });
    loadProfile(a.id);
    const me = profile();
    const ask = answer(true);
    const done = await importBackup(fileB, ask.ask);
    expect(ask.seen).toHaveLength(1);
    expect(ask.seen[0]).toMatchObject({ playing: false, device: { name: b.name } });
    expect(done).toMatchObject({ playing: false });
    expect(profile()).toBe(me);
    expect(readProfile(b.id)!.coins).toBe(555);
  });

  it('hồ sơ đang chơi, bấm "Thôi": không lưu hộ thay đổi đang chờ, không gỡ hồ sơ, không đổi gì trên máy', async () => {
    vi.useFakeTimers();
    try {
      const old = oldSave();
      store(old);
      const file = backupOf(old.id, (p) => {
        p.coins = 999;
      });
      loadProfile(old.id);
      const me = profile();
      addCoins(5);
      const before = onDevice(old.id);
      const seen: (string | null)[] = [];
      const off = bus.on('profile', (e) => seen.push(e.id));
      const a = answer(false);
      const done = await importBackup(file, a.ask);
      off();
      expect(done).toBeNull();
      // So với bản đang chơi trong bộ nhớ (vừa tải → mới hơn tệp).
      expect(a.seen[0]).toMatchObject({ playing: true, older: true, device: { name: old.name, lastPlayed: me.lastPlayed } });
      expect(importSummary(a.seen[0]).text).toBe(`Hồ sơ của ${old.name} đang được chơi. Nhập tệp sẽ thay toàn bộ tiến trình hiện tại bằng bản trong tệp, rồi game về màn hình chính để tải lại hồ sơ.`);
      expect(onDevice(old.id)).toEqual(before);
      expect(seen).toEqual([]);
      expect(profile()).toBe(me);
      expect(me.coins).toBe(37 + 5);
      // Lần lưu hẹn giờ bình thường của game vẫn chạy như không có gì xảy ra.
      vi.advanceTimersByTime(2000);
      expect(storage.getJSON<Profile | null>(`p.${old.id}`, null)!.coins).toBe(37 + 5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('hồ sơ đang chơi, bấm "Nhập": thay bằng bản trong tệp, gỡ hồ sơ đang chơi (game về màn hình chính)', async () => {
    const old = oldSave();
    store(old);
    const file = backupOf(old.id, (p) => {
      p.coins = 999;
    });
    loadProfile(old.id);
    addCoins(5);
    const done = await importBackup(file, async () => true);
    expect(done).toMatchObject({ playing: true });
    expect(hasProfile()).toBe(false);
    saveNow();
    expect(readProfile(old.id)!.coins).toBe(999);
  });

  it('tệp cũ hơn bản trên máy (so theo phút): cảnh báo; cùng phút hoặc mới hơn: không', () => {
    const t = new Date(2026, 9, 5, 7, 4, 50).getTime();
    const dev = oldSave();
    dev.lastPlayed = t;
    store(dev);
    const before = onDevice(dev.id);
    const at = (ms: number) =>
      checkImport(
        backupOf(dev.id, (p) => {
          p.lastPlayed = ms;
        }),
      );
    const old2h = at(t - 2 * 3600000);
    expect(old2h.older).toBe(true);
    const s = importSummary({ ...old2h, device: old2h.device! });
    expect(s.warning).toBe(OLDER_WARNING);
    expect(OLDER_WARNING).toBe('Tệp này cũ hơn bản trên máy — nhập sẽ mất tiến trình mới hơn.');
    expect(s.rows[4]).toEqual({ label: 'Chơi lần cuối', device: '05/10/2026 07:04', file: '05/10/2026 05:04', differs: true });
    expect(at(t - 60000).older).toBe(true);
    expect(at(t - 40000).older).toBe(false);
    expect(at(t).older).toBe(false);
    expect(at(t + 3600000).older).toBe(false);
    expect(importSummary({ ...at(t + 3600000), device: old2h.device! }).warning).toBeNull();
    // Chỉ đọc tệp – không ghi gì.
    expect(onDevice(dev.id)).toEqual(before);
  });

  it('ngày giờ dd/mm/yyyy HH:mm theo giờ máy; không có → "không rõ ngày"', () => {
    const t0 = new Date(2026, 9, 5).getTime();
    expect(formatPlayed(new Date(2026, 9, 5, 7, 4).getTime())).toBe('05/10/2026 07:04');
    expect(formatPlayed(new Date(2025, 0, 31, 23, 59, 59).getTime())).toBe('31/01/2025 23:59');
    expect(formatPlayed(null)).toBe('không rõ ngày');
    expect(UNKNOWN_DATE).toBe('không rõ ngày');
    expect(isOlder(null, t0)).toBe(false);
    expect(isOlder(t0, null)).toBe(false);
  });

  it('tệp v1 không ghi ngày chơi: "không rõ ngày", không cảnh báo, vẫn nhập được (đoán bé, trả xu đúng một lần)', async () => {
    const dev = oldSave({ hair: 2 });
    store(dev);
    const v1 = oldSave({ hair: 2, extra: ['shirt_rainbow'] }) as Record<string, unknown>;
    v1.id = dev.id;
    delete v1.lastPlayed;
    const a = answer(true);
    const done = await importBackup(JSON.stringify({ app: 'vuong-quoc-toan-hoc', version: 1, profile: v1 }), a.ask);
    expect(a.seen).toHaveLength(1);
    const c = a.seen[0];
    expect(c.file.lastPlayed).toBeNull();
    expect(c.device.lastPlayed).toBe(dev.lastPlayed);
    expect(c.older).toBe(false);
    const s = importSummary(c);
    expect(s.rows[4]).toMatchObject({ device: formatPlayed(dev.lastPlayed), file: 'không rõ ngày', differs: true });
    expect(s.warning).toBeNull();
    expect(done!.profile.kid).toBe('gai');
    expect(readProfile(dev.id)).toMatchObject({ kid: 'gai', coins: 37 + 80 });
    expect(readProfile(dev.id)!.inventory.shirt_rainbow).toBeUndefined();
    loadProfile(dev.id);
    expect(takeRefundNotice()).toBe(80);
    expect(takeRefundNotice()).toBe(0);
  });

  it('bản trên máy không ghi ngày chơi: "không rõ ngày" ở cột "Trên máy này", không cảnh báo', () => {
    const dev = oldSave();
    store(dev);
    const file = backupOf(dev.id, (p) => {
      p.lastPlayed = 1;
    });
    const raw = storage.getJSON<Record<string, unknown>>(`p.${dev.id}`, {});
    delete raw.lastPlayed;
    storage.setJSON(`p.${dev.id}`, raw);
    const c = checkImport(file);
    expect(c.device!.lastPlayed).toBeNull();
    expect(c.file.lastPlayed).toBe(1);
    expect(c.older).toBe(false);
    expect(importSummary({ ...c, device: c.device! }).rows[4]).toMatchObject({ device: 'không rõ ngày' });
  });
});

describe('hồ sơ mới, đổi bé, mặc bộ đồ', () => {
  it('hồ sơ mới: bé đã chọn, có sẵn "Đồ thường ngày"', () => {
    const p = newProfile({ name: '  An  ', grade: 1, kid: 'gai' });
    expect(p).toMatchObject({ v: SAVE_VERSION, name: 'An', kid: 'gai', coins: 0 });
    expect(p.inventory).toEqual({ [DEFAULT_OUTFIT]: 1 });
    expect(p.equipped).toEqual({ outfit: DEFAULT_OUTFIT, hat: null, backpack: null, acc: null, pet: null, board: null });
    expect(p.look.hair).toBe(3);
    expect(newProfile({ name: '', grade: 3, kid: 'trai' }).look.hair).toBe(0);
  });

  it('đổi bé: giữ bộ đồ đã có; bộ đang mặc chưa có cho bé mới → "Đồ thường ngày"', () => {
    const old = oldSave() as Profile & Record<string, unknown>;
    store(old);
    loadProfile(old.id);
    const p = profile();
    p.inventory.outfit_chi_be_trai = 1;
    p.equipped.outfit = 'outfit_chi_be_trai';
    setKid('gai');
    expect(p.kid).toBe('gai');
    expect(p.equipped.outfit).toBe(DEFAULT_OUTFIT);
    expect(p.inventory.outfit_chi_be_trai).toBe(1);
    expect(p.equipped.hat).toBe('hat_cap');
    setKid('trai');
    expect(p.kid).toBe('trai');
    setKid('x' as never);
    expect(p.kid).toBe('trai');
  });

  it('chỉ mặc được bộ đồ có mô hình cho bé', () => {
    const old = oldSave();
    store(old);
    loadProfile(old.id);
    equip('outfit', 'outfit_khong_co');
    expect(profile().equipped.outfit).toBe(DEFAULT_OUTFIT);
    equip('outfit', null);
    expect(profile().equipped.outfit).toBe(DEFAULT_OUTFIT);
    equip('hat', null);
    expect(profile().equipped.hat).toBeNull();
    equip('hat', 'hat_wizard');
    expect(profile().equipped.hat).toBe('hat_wizard');
  });
});

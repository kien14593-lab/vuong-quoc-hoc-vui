import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SAVE_VERSION } from '../src/config';
import { RETIRED_WEAR } from '../src/core/items';
import { DEFAULT_OUTFIT } from '../src/core/outfits';
import {
  equip,
  exportProfile,
  guessKid,
  importProfile,
  listProfiles,
  loadProfile,
  newProfile,
  profile,
  readProfile,
  setKid,
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

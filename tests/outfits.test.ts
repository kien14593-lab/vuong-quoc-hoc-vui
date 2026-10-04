import { describe, expect, it } from 'vitest';
import { ITEMS, item } from '../src/core/items';
import {
  DEFAULT_OUTFIT,
  KIDS,
  OUTFIT_ICON,
  OUTFIT_PRICE,
  OUTFITS,
  isKid,
  isKidModel,
  keysFromFiles,
  kidKey,
  kidModelDefaults,
  kidOutfits,
  outfitCatalog,
  outfitFits,
  outfitKey,
  playerKey,
} from '../src/core/outfits';

/**
 * Bộ đồ của bé (core/outfits.ts): danh mục tự dựng từ tên tệp mô hình AI (player_trai__<mã>.glb...) + cấu hình
 * (config.json, công cụ ghi từ mục "bo-do" trong cau-hinh.json) – thêm bộ đồ mới không cần sửa code.
 */
const FILES = import.meta.glob('../src/assets/models/ai/*.glb');

describe('danh mục bộ đồ dựng từ tệp', () => {
  it('chưa có tệp bộ đồ nào: chỉ có "Đồ thường ngày" miễn phí cho cả hai bé', () => {
    const list = outfitCatalog(['player_trai', 'player_gai', 'npc_bear']);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: DEFAULT_OUTFIT, name: 'Đồ thường ngày', cat: 'outfit', price: 0, models: { trai: 'player_trai', gai: 'player_gai' } });
  });

  it('mỗi tệp player_<bé>__<mã> là một bộ đồ; bộ đồ có thể chỉ có cho một bé', () => {
    const list = outfitCatalog(['player_trai', 'player_gai', 'player_trai__the_thao', 'player_gai__the_thao', 'player_gai__vay_cong_chua', 'npc_bear', 'pet_dog']);
    expect(list.map((o) => o.id)).toEqual([DEFAULT_OUTFIT, 'outfit_the_thao', 'outfit_vay_cong_chua']);
    const sport = list[1];
    expect(sport.models).toEqual({ trai: 'player_trai__the_thao', gai: 'player_gai__the_thao' });
    // Chưa ghi tên/giá/biểu tượng: dùng giá trị mặc định.
    expect(sport).toMatchObject({ cat: 'outfit', name: 'Đồ the thao', price: OUTFIT_PRICE, icon: OUTFIT_ICON, level: 1 });
    expect(list[2].models).toEqual({ gai: 'player_gai__vay_cong_chua' });
  });

  it('tên, giá, biểu tượng, cấp lấy từ cấu hình; xếp theo giá rồi theo tên', () => {
    const list = outfitCatalog(['player_gai__vay_cong_chua', 'player_trai__phi_hanh_gia', 'player_gai__phi_hanh_gia', 'player_trai__the_thao', 'player_gai__the_thao'], {
      player_gai__vay_cong_chua: { outfit: { name: 'Váy công chúa', price: 120, icon: '👗', level: 3 } },
      player_gai__phi_hanh_gia: { outfit: { name: 'Phi hành gia', price: 100.4, icon: '🚀' } },
      player_trai__phi_hanh_gia: { outfit: { name: 'Phi hành gia', price: 100.4, icon: '🚀' } },
      player_trai__the_thao: { outfit: { name: 'Đồ thể thao', price: 0 } },
    });
    expect(list.map((o) => [o.id, o.name, o.price])).toEqual([
      [DEFAULT_OUTFIT, 'Đồ thường ngày', 0],
      ['outfit_the_thao', 'Đồ thể thao', 0],
      ['outfit_phi_hanh_gia', 'Phi hành gia', 100],
      ['outfit_vay_cong_chua', 'Váy công chúa', 120],
    ]);
    expect(list[2].icon).toBe('🚀');
    expect(list[3]).toMatchObject({ icon: '👗', level: 3, models: { gai: 'player_gai__vay_cong_chua' } });
  });

  it('bỏ qua giá/cấp không hợp lệ trong cấu hình', () => {
    const [, o] = outfitCatalog(['player_trai__ao_mua'], { player_trai__ao_mua: { outfit: { price: -5, level: 0 } } });
    expect(o).toMatchObject({ id: 'outfit_ao_mua', price: OUTFIT_PRICE, level: 1 });
  });

  it('tên tệp → khóa: chữ thường, bỏ tệp hoạt cảnh (<khóa>@<vai>.glb)', () => {
    expect(keysFromFiles(['/src/assets/models/ai/player_trai.glb', '/src/assets/models/ai/npc_bear@walk.glb', '/assets/Player_Gai__The_Thao.glb', 'x/pet_dog.GLB'])).toEqual([
      'player_trai',
      'player_gai__the_thao',
      'pet_dog',
    ]);
  });
});

describe('khóa mô hình bé', () => {
  const list = new Map(outfitCatalog(['player_trai', 'player_gai', 'player_trai__the_thao', 'player_gai__the_thao', 'player_gai__vay_cong_chua']).map((o) => [o.id, o]));

  it('đồ thường ngày (hoặc chưa mặc gì) → mô hình bé', () => {
    for (const kid of KIDS) {
      expect(outfitKey(kid, DEFAULT_OUTFIT, list)).toBe(kidKey(kid));
      expect(outfitKey(kid, null, list)).toBe(kidKey(kid));
      expect(outfitKey(kid, undefined, list)).toBe(kidKey(kid));
    }
    expect(kidKey('trai')).toBe('player_trai');
    expect(kidKey('gai')).toBe('player_gai');
  });

  it('bộ đồ → mô hình của đúng bé; bé không có bộ đồ đó → null', () => {
    expect(outfitKey('trai', 'outfit_the_thao', list)).toBe('player_trai__the_thao');
    expect(outfitKey('gai', 'outfit_the_thao', list)).toBe('player_gai__the_thao');
    expect(outfitKey('gai', 'outfit_vay_cong_chua', list)).toBe('player_gai__vay_cong_chua');
    expect(outfitKey('trai', 'outfit_vay_cong_chua', list)).toBeNull();
    expect(outfitKey('trai', 'outfit_khong_co', list)).toBeNull();
  });

  it('playerKey: bộ đồ không có cho bé (hoặc đã mất tệp) → bé mặc đồ thường ngày', () => {
    for (const kid of KIDS) {
      expect(playerKey(kid, DEFAULT_OUTFIT)).toBe(kidKey(kid));
      expect(playerKey(kid, 'outfit_khong_co')).toBe(kidKey(kid));
      expect(playerKey(kid, null)).toBe(kidKey(kid));
    }
  });

  it('isKid', () => {
    expect(isKid('trai')).toBe(true);
    expect(isKid('gai')).toBe(true);
    for (const v of ['boy', '', null, undefined, 1, 'Trai']) expect(isKid(v)).toBe(false);
  });

  it('bé và mọi bộ đồ nạp như nhau: tự dựng xương, lệch mipmap -1; nhân vật khác không đổi', () => {
    for (const k of ['player_trai', 'player_gai', 'player_trai__the_thao', 'player_gai__vay_cong_chua']) {
      expect(isKidModel(k), k).toBe(true);
      expect(kidModelDefaults(k), k).toEqual({ autoRig: true, mipBias: -1 });
    }
    for (const k of ['player', 'npc_bear', 'pet_dog', 'player_ban', 'player_trai__', 'npc_player_trai']) {
      expect(isKidModel(k), k).toBe(false);
      expect(kidModelDefaults(k), k).toEqual({});
    }
  });
});

describe('danh mục thật (src/assets/models/ai)', () => {
  const keys = keysFromFiles(Object.keys(FILES));

  it('có mô hình bé trai và bé gái', () => {
    expect(keys).toContain('player_trai');
    expect(keys).toContain('player_gai');
  });

  it('"Đồ thường ngày" đứng đầu, ai cũng mặc được', () => {
    expect(OUTFITS[0].id).toBe(DEFAULT_OUTFIT);
    expect(OUTFITS[0].price).toBe(0);
    for (const kid of KIDS) {
      expect(kidOutfits(kid)[0].id).toBe(DEFAULT_OUTFIT);
      expect(outfitFits(kid, DEFAULT_OUTFIT)).toBe(true);
      expect(outfitFits(kid, 'outfit_khong_co')).toBe(false);
      expect(outfitFits(kid, null)).toBe(false);
    }
  });

  it('mỗi tệp bộ đồ có trong danh mục, đúng bé', () => {
    for (const key of keys.filter((k) => /^player_(trai|gai)__/.test(k))) {
      const [, kid, code] = /^player_(trai|gai)__(.+)$/.exec(key)!;
      const o = OUTFITS.find((x) => x.id === `outfit_${code}`);
      expect(o, key).toBeDefined();
      expect(o!.models?.[kid as 'trai' | 'gai'], key).toBe(key);
      expect(outfitFits(kid as 'trai' | 'gai', o!.id), key).toBe(true);
    }
    for (const o of OUTFITS.slice(1)) expect(Object.values(o.models ?? {}).every((k) => keys.includes(k!)), o.id).toBe(true);
  });

  it('vật phẩm: có bộ đồ, không còn áo, quần, giày; mã không trùng', () => {
    for (const o of OUTFITS) expect(item(o.id)).toBe(o);
    expect(ITEMS.filter((i) => /^(shirt|pants|shoes)/.test(i.cat) || /^(shirt|pants|shoes)_/.test(i.id))).toEqual([]);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
  });
});

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { defineModel, modelRadius, overrideModel } from '../src/models/registry';
import '../src/models/npcs';

/**
 * NPC đẩy bé ra theo kích thước riêng của mô hình (vật cản tròn trong npcs.ts), không dùng chung 0.45 —
 * để bé không lẹm vào nhân vật to như Bác Voi, Chú Gấu.
 */
const SRC = import.meta.glob<string>('../src/**/*.ts', { query: '?raw', import: 'default', eager: true });
const file = (rel: string) => {
  const code = SRC[`../src/${rel}`];
  if (code === undefined) throw new Error(`không thấy src/${rel}`);
  return code;
};
const empty = () => new THREE.Group();

describe('modelRadius', () => {
  it('lấy vật cản tròn ở tâm, kể cả khi vật cản tính theo tùy chọn', () => {
    defineModel('test_r_list', {
      build: empty,
      colliders: [
        { kind: 'box', w: 2, d: 1 },
        { kind: 'circle', r: 0.3, at: [0.8, 0] },
        { kind: 'circle', r: 0.6 },
      ],
    });
    defineModel<{ big?: boolean }>('test_r_fn', {
      build: empty,
      colliders: (o) => [{ kind: 'circle', r: o.big ? 0.9 : 0.5 }],
    });
    expect(modelRadius('test_r_list')).toBe(0.6);
    expect(modelRadius('test_r_fn')).toBe(0.5);
    expect(modelRadius('test_r_fn', { big: true })).toBe(0.9);
  });

  it('không có vật cản tròn thì trả về undefined (Actor dùng mặc định 0.45)', () => {
    defineModel('test_r_box', { build: empty, colliders: [{ kind: 'box', w: 1, d: 1 }] });
    defineModel('test_r_none', { build: empty });
    expect(modelRadius('test_r_box')).toBeUndefined();
    expect(modelRadius('test_r_none')).toBeUndefined();
    expect(modelRadius('test_r_missing')).toBeUndefined();
  });

  it('mô hình AI thay thế không khai báo vật cản vẫn dùng của mô hình gốc', () => {
    defineModel('test_r_base', { build: empty, colliders: [{ kind: 'circle', r: 0.65 }] });
    overrideModel('test_r_base', () => ({ build: empty }));
    expect(modelRadius('test_r_base')).toBe(0.65);
  });

  it('nhân vật trong game có bán kính riêng', () => {
    expect(modelRadius('npc_elephant')).toBe(0.7);
    expect(modelRadius('npc_bear')).toBe(0.65);
    expect(modelRadius('npc_king')).toBe(0.55);
    expect(modelRadius('npc_rabbit')).toBe(0.45);
    expect(modelRadius('npc_deer')).toBe(0.6);
    // Dân làng: theo từng người (v), không ghi v = Bé Na.
    expect(modelRadius('npc_villager')).toBe(0.5);
    expect(modelRadius('npc_villager', { v: 3 })).toBe(0.44);
    expect(modelRadius('npc_villager', { v: 5 })).toBe(0.8);
  });
});

describe('Zone.npc() dùng bán kính của mô hình', () => {
  it('truyền radius (ghi đè theo khu, nếu không thì của mô hình) vào Actor', () => {
    const zone = file('world/zone.ts');
    const start = zone.indexOf('  npc(key: string');
    expect(start).toBeGreaterThan(0);
    const body = zone.slice(start, zone.indexOf('\n  }\n', start));
    expect(body).toMatch(/new Actor\(key,[^)]*radius:\s*o\.radius\s*\?\?\s*modelRadius\(key,\s*o\.opts\)/);
  });

  it('Bác Voi ở Sở Thú đẩy xa hơn để đôi tai rộng không lẹm vào bé', () => {
    const zoo = file('world/zones/zoo.ts');
    const call = zoo.slice(zoo.indexOf('this.npc(CAST.voi.art'));
    expect(call.slice(0, call.indexOf('});'))).toMatch(/radius:\s*0\.95\b/);
  });
});

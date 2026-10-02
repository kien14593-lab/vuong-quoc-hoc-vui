import * as THREE from 'three';
import { box } from '../engine/kit';
import { compactModel } from '../engine/merge';
import type { Rig } from './rig';

/**
 * Sổ đăng ký mô hình 3D. Mỗi mô hình có khóa duy nhất (ví dụ 'tree_round', 'npc_tho', 'house_cottage').
 * Quy ước:
 *  - Mô hình đứng trên mặt đất (y = 0), tâm ở gốc tọa độ, MẶT TRƯỚC hướng +Z.
 *  - 1 đơn vị ≈ 1 mét "đồ chơi"; nhân vật người chơi cao ~1.7.
 *  - Phần chuyển động: gắn `userData.tick = (dt, t) => void` trên đối tượng (sẽ được gọi mỗi khung hình)
 *    và đánh dấu `userData.dynamic = true` để không bị gộp tĩnh.
 *  - Nhân vật/thú có khung xương đơn giản: `userData.rig` (xem rig.ts).
 */
export interface CircleCollider {
  kind: 'circle';
  r: number;
  /** Tâm lệch so với gốc mô hình (x, z) – chưa xoay. */
  at?: [number, number];
  /** Chiều cao; người chơi đứng trên cao hơn mức này có thể đi qua (nhảy lên). */
  top?: number;
}

export interface BoxCollider {
  kind: 'box';
  w: number;
  d: number;
  at?: [number, number];
  /** Góc xoay riêng (độ) – cộng thêm góc của mô hình. */
  rot?: number;
  top?: number;
}

export type Collider = CircleCollider | BoxCollider;

export interface ModelDef<O = Record<string, unknown>> {
  build(opts: O): THREE.Object3D;
  /** Va chạm (trong hệ tọa độ mô hình, đơn vị chưa nhân tỉ lệ). */
  colliders?: Collider[] | ((opts: O) => Collider[]);
  /** Chiều cao (để đặt nhãn tên phía trên). */
  height?: number | ((opts: O) => number);
  /** Nhóm/thẻ cho thư viện xem thử. */
  tags?: string[];
  /** Mô tả ngắn (tiếng Việt). */
  desc?: string;
  /** Các bộ tùy chọn để hiển thị trong thư viện xem thử. */
  variants?: O[];
  /** Khung ảnh chân dung khi nói chuyện (mặc định 'head'); nhân vật tai dài (Thỏ Bông) dùng 'bust' để thấy cả khuôn mặt. */
  portrait?: 'head' | 'bust' | 'full';
}

const defs = new Map<string, ModelDef<any>>();
/** Mô hình dựng bằng code (gốc) – dùng làm dự phòng khi có mô hình GLB thay thế. */
const baseDefs = new Map<string, ModelDef<any>>();
/** Hàm tạo định nghĩa thay thế (mô hình GLB) theo khóa; áp dụng bất kể thứ tự nạp tệp. */
const overrides = new Map<string, (base: ModelDef<any> | undefined) => ModelDef<any>>();

export function defineModel<O = Record<string, unknown>>(key: string, def: ModelDef<O>): void {
  if (baseDefs.has(key)) console.warn(`[models] trùng khóa mô hình: ${key}`);
  baseDefs.set(key, def);
  const ov = overrides.get(key);
  defs.set(key, ov ? ov(def) : def);
}

/**
 * Thay mô hình theo khóa (ví dụ mô hình GLB thay mô hình dựng bằng code). `make(base)` nhận định nghĩa gốc
 * (có thể chưa có, sẽ được gọi lại khi tệp gốc nạp sau) để kế thừa va chạm, chiều cao, dự phòng.
 */
export function overrideModel(key: string, make: (base: ModelDef<any> | undefined) => ModelDef<any>): void {
  overrides.set(key, make);
  defs.set(key, make(baseDefs.get(key)));
}

/** Định nghĩa gốc (dựng bằng code) của một khóa, kể cả khi đã bị thay bằng GLB. */
export function baseModelDef(key: string): ModelDef<any> | undefined {
  return baseDefs.get(key);
}

export function hasModel(key: string): boolean {
  return defs.has(key);
}

export function modelDef(key: string): ModelDef<any> | undefined {
  return defs.get(key);
}

export function modelKeys(prefix = ''): string[] {
  return [...defs.keys()].filter((k) => k.startsWith(prefix)).sort();
}

/** Dựng mô hình theo khóa; nếu thiếu, trả về khối hồng báo lỗi (để dễ phát hiện). */
export function buildModel<O = Record<string, unknown>>(key: string, opts?: O): THREE.Object3D {
  const def = defs.get(key);
  if (!def) {
    console.warn(`[models] thiếu mô hình: ${key}`);
    const m = box(1, 1, 1, '#ff00ff', { base: true });
    m.userData.key = key;
    m.userData.missing = true;
    return m;
  }
  const o = (opts ?? {}) as O;
  const obj = def.build(o);
  obj.userData.key = key;
  const col = typeof def.colliders === 'function' ? def.colliders(o) : def.colliders;
  if (col) obj.userData.colliders = col;
  const h = typeof def.height === 'function' ? def.height(o) : def.height;
  if (h !== undefined) obj.userData.height = h;
  if (!(o as { raw?: boolean }).raw && !rawModels && !obj.userData.compacted) {
    const rig = obj.userData.rig as Rig | undefined;
    compactModel(obj, rig ? rigNodes(rig) : []);
    obj.userData.compacted = true;
  }
  return obj;
}

/** Tắt gộp lưới (để gỡ lỗi mô hình). */
let rawModels = false;
export function setRawModels(v: boolean): void {
  rawModels = v;
}
export function isRawModels(): boolean {
  return rawModels;
}

export function rigNodes(rig: Rig): (THREE.Object3D | undefined)[] {
  return [
    rig.root,
    rig.body,
    rig.head,
    rig.armL,
    rig.armR,
    rig.legL,
    rig.legR,
    rig.tail,
    rig.mouth,
    ...(rig.legs ?? []),
    ...(rig.ears ?? []),
    ...(rig.eyes ?? []),
    ...(rig.wings ?? []),
  ];
}

/** Chiều cao thực tế của mô hình (từ khai báo hoặc khung bao). */
export function modelHeight(obj: THREE.Object3D): number {
  if (typeof obj.userData.height === 'number') return obj.userData.height * obj.scale.y;
  const b = new THREE.Box3().setFromObject(obj);
  return b.max.y - obj.position.y;
}

/** Gom tất cả hàm `tick` trong cây đối tượng. */
export function collectTicks(root: THREE.Object3D): ((dt: number, t: number) => void)[] {
  const out: ((dt: number, t: number) => void)[] = [];
  root.traverse((o) => {
    if (typeof o.userData.tick === 'function') out.push(o.userData.tick);
  });
  return out;
}

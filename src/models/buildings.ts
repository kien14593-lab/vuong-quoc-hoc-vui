import * as THREE from 'three';
import { ball, box, cyl, group, prism, rbox, seeded } from '../engine/kit';
import { PAL, tint } from '../engine/materials';
import { defineModel } from './registry';

/**
 * Công trình: nhà cửa, cửa hàng... (mặt tiền hướng +Z).
 */
export const ROOF_COLORS = ['#f2a65a', '#ef8c7a', '#6fb7b7', '#7aa7e0', '#b39ddb', '#e8746a'];
const FLOWERS = ['#ff8fab', '#ffd166', '#ffffff', '#ff6b6b', '#b197fc'];

/** Cửa sổ có khung trắng, kính xanh, (tùy chọn) hộp hoa. Đặt trên mặt tường hướng +Z. */
export function windowPart(w: number, h: number, o: { flowers?: boolean; seed?: number; shutter?: string } = {}): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(w + 0.14, h + 0.14, 0.1, 0.04, PAL.frame, { p: [0, 0, 0.02] }));
  g.add(box(w, h, 0.06, '#8fd3f4', { p: [0, 0, 0.05], shiny: 60, cast: false }));
  g.add(box(0.05, h, 0.04, PAL.frame, { p: [0, 0, 0.09], cast: false }));
  g.add(box(w, 0.05, 0.04, PAL.frame, { p: [0, 0, 0.09], cast: false }));
  g.add(box(w * 0.32, h * 0.16, 0.02, '#d6f2ff', { p: [-w * 0.22, h * 0.26, 0.085], r: [0, 0, 0], cast: false }));
  g.add(box(w + 0.26, 0.07, 0.18, PAL.frame, { p: [0, -h / 2 - 0.08, 0.08] }));
  if (o.shutter) {
    for (const s of [1, -1]) g.add(box(w * 0.42, h + 0.1, 0.05, o.shutter, { p: [s * (w / 2 + w * 0.26), 0, 0.05] }));
  }
  if (o.flowers) {
    const rnd = seeded(o.seed ?? 3);
    g.add(box(w + 0.1, 0.18, 0.2, PAL.woodLight, { p: [0, -h / 2 - 0.22, 0.14] }));
    const n = Math.max(3, Math.round(w / 0.16));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 0.06 + (i * (w - 0.12)) / (n - 1);
      g.add(ball(0.075, i % 2 ? PAL.leaf2 : PAL.leaf1, { p: [x, -h / 2 - 0.1, 0.16], seg: 6 }));
      if (i % 2 === 0) g.add(ball(0.055, FLOWERS[Math.floor(rnd() * FLOWERS.length)], { p: [x, -h / 2 - 0.03, 0.2], seg: 6, cast: false }));
    }
  }
  return g;
}

/** Cửa ra vào gỗ, đỉnh bo tròn, có tay nắm. Gốc ở chân cửa. */
export function doorPart(w = 0.85, h = 1.35, color: string = PAL.door): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(w + 0.16, h + 0.1, 0.1, 0.06, PAL.frame, { p: [0, (h + 0.1) / 2, 0.01] }));
  g.add(rbox(w, h, 0.1, 0.05, color, { p: [0, h / 2, 0.05] }));
  for (const y of [0.3, 0.7, 1.05]) if (y < h - 0.15) g.add(box(w - 0.12, 0.03, 0.02, tint(color, -0.06), { p: [0, y, 0.105], cast: false }));
  g.add(ball(0.05, PAL.gold, { p: [w * 0.32, h * 0.48, 0.13], seg: 8, shiny: 60 }));
  g.add(box(w + 0.5, 0.1, 0.5, '#d8d0c2', { p: [0, 0.05, 0.3] }));
  return g;
}

export interface HouseOpts {
  roof?: string;
  wall?: string;
  w?: number;
  d?: number;
  h?: number;
  v?: number;
  chimney?: boolean;
  /** Hộp hoa dưới cửa sổ. */
  flowers?: boolean;
}

/** Thân nhà + mái hai dốc có độ dày và mái hiên. */
export function houseBody(o: HouseOpts): THREE.Group {
  const W = o.w ?? 3.2;
  const D = o.d ?? 2.6;
  const H = o.h ?? 2.0;
  const RH = D * 0.5;
  const roof = o.roof ?? ROOF_COLORS[0];
  const wall = o.wall ?? '#fbf3e4';
  const g = new THREE.Group();
  // móng đá
  g.add(box(W + 0.16, 0.24, D + 0.16, '#d6cfc2', { base: true }));
  // tường
  g.add(box(W, H, D, wall, { p: [0, 0.24, 0], base: true }));
  // viền chân tường
  g.add(box(W + 0.04, 0.12, D + 0.04, tint(wall, -0.06), { p: [0, 0.3, 0] }));
  // đầu hồi
  g.add(prism(W - 0.02, RH, D, wall, { p: [0, H + 0.24, 0] }));
  // dầm gỗ góc nhà
  for (const sx of [1, -1]) for (const sz of [1, -1]) g.add(box(0.14, H, 0.14, PAL.woodLight, { p: [sx * (W / 2 - 0.02), 0.24 + H / 2, sz * (D / 2 - 0.02)] }));
  g.add(box(W + 0.06, 0.12, 0.14, PAL.woodLight, { p: [0, H + 0.2, D / 2 - 0.02] }));
  g.add(box(W + 0.06, 0.12, 0.14, PAL.woodLight, { p: [0, H + 0.2, -D / 2 + 0.02] }));
  // mái (2 tấm nghiêng + nóc)
  const ang = Math.atan2(RH, D / 2);
  const slope = Math.hypot(RH, D / 2);
  const over = 0.38;
  const th = 0.16;
  const len = slope + over;
  for (const s of [1, -1]) {
    const cz = s * (D / 4) + s * Math.cos(ang) * (over / 2) - s * Math.sin(ang) * 0;
    const cy = H + 0.24 + RH / 2 - Math.sin(ang) * (over / 2);
    const nz = s * Math.sin(ang) * (th / 2);
    const ny = Math.cos(ang) * (th / 2);
    const slab = box(W + 0.5, th, len, roof, { p: [0, cy + ny + 0.02, cz + nz], r: [(s * ang * 180) / Math.PI, 0, 0] });
    g.add(slab);
    // viền sáng mép mái
    g.add(box(W + 0.52, 0.05, 0.08, tint(roof, 0.1), { p: [0, cy + ny + 0.02 - Math.sin(ang) * (len / 2) + 0.02, cz + nz + s * Math.cos(ang) * (len / 2)], r: [(s * ang * 180) / Math.PI, 0, 0], cast: false }));
  }
  g.add(cyl(0.12, 0.12, W + 0.56, tint(roof, -0.08), { p: [0, H + 0.24 + RH + 0.08, 0], r: [0, 0, 90], seg: 8 }));
  if (o.chimney !== false) {
    g.add(box(0.45, 1.1, 0.45, '#c9a58a', { p: [W * 0.28, H + 0.24 + RH * 0.55, -D * 0.2], base: true }));
    g.add(box(0.55, 0.14, 0.55, '#b48c70', { p: [W * 0.28, H + 0.24 + RH * 0.55 + 1.1, -D * 0.2] }));
  }
  return g;
}

defineModel<HouseOpts>('house_cottage', {
  build: (o) => {
    const rnd = seeded((o.v ?? 1) * 5 + 1);
    const roof = o.roof ?? ROOF_COLORS[Math.floor(rnd() * ROOF_COLORS.length)];
    const W = o.w ?? 3.2;
    const D = o.d ?? 2.6;
    const g = houseBody({ ...o, roof });
    const door = doorPart(0.85, 1.35, rnd() > 0.5 ? PAL.door : tint(roof, -0.2));
    door.position.set(-W * 0.18, 0.24, D / 2);
    g.add(door);
    const win = windowPart(0.62, 0.62, { flowers: o.flowers !== false, seed: (o.v ?? 1) * 3 });
    win.position.set(W * 0.24, 1.35, D / 2);
    g.add(win);
    for (const s of [1, -1]) {
      const sw = windowPart(0.55, 0.55, {});
      sw.position.set(s * W / 2, 1.4, 0);
      sw.rotation.y = (s * Math.PI) / 2;
      g.add(sw);
    }
    // đèn treo cạnh cửa
    g.add(group([box(0.06, 0.25, 0.06, '#5c4a3d'), box(0.16, 0.2, 0.16, '#ffe9a8', { p: [0, -0.2, 0], emissive: '#ffd36b', glow: 0.35 })], { p: [-W * 0.18 + 0.62, 2.0, D / 2 + 0.12] }));
    return g;
  },
  colliders: (o: HouseOpts) => [{ kind: 'box', w: (o.w ?? 3.2) + 0.2, d: (o.d ?? 2.6) + 0.2 }],
  height: 3.6,
  tags: ['building'],
  desc: 'Ngôi nhà nhỏ',
  variants: ROOF_COLORS.map((roof, i) => ({ roof, v: i + 1 })),
});

import * as THREE from 'three';
import { ball, cone, cyl, disc, dodeca, group, ico, seeded, torus, box, capsule } from '../engine/kit';
import { PAL, tint } from '../engine/materials';
import { defineModel } from './registry';

/**
 * Thiên nhiên low-poly: cây, bụi, hoa, cỏ, đá, nấm...
 * Tùy chọn chung: `v` (số biến thể/hạt giống ngẫu nhiên), `s` (tỉ lệ).
 */
type NatOpts = { v?: number; s?: number; color?: string };

const LEAVES = [PAL.leaf1, PAL.leaf2, PAL.leaf3, PAL.leaf4, PAL.leaf5];
const FLOWER_COLORS = ['#ff8fab', '#ffd166', '#ffffff', '#b197fc', '#ff6b6b', '#74c0fc', '#ffa94d'];

function scaled(g: THREE.Object3D, s?: number): THREE.Object3D {
  if (s && s !== 1) g.scale.setScalar(s);
  return g;
}

/* ---------------------------------- Cây --------------------------------- */
function roundTree(o: NatOpts, leafColors: string[], extra?: (g: THREE.Group, rnd: () => number, top: number) => void): THREE.Group {
  const rnd = seeded((o.v ?? 1) * 7 + 3);
  const g = new THREE.Group();
  const h = 1.1 + rnd() * 0.5;
  g.add(cyl(0.13, 0.2, h, PAL.trunk, { base: true, seg: 7 }));
  // rễ nhỏ
  g.add(cone(0.26, 0.25, tint(PAL.trunk, -0.04), { base: true, seg: 7 }));
  const c0 = o.color ?? leafColors[Math.floor(rnd() * leafColors.length)];
  const big = 0.95 + rnd() * 0.3;
  g.add(ico(big, c0, { p: [0, h + big * 0.55, 0], r: [rnd() * 40, rnd() * 360, 0], tint: true }));
  const n = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd();
    const r = big * (0.55 + rnd() * 0.15);
    const c = o.color ? tint(o.color, (rnd() - 0.5) * 0.08) : leafColors[Math.floor(rnd() * leafColors.length)];
    g.add(ico(big * (0.55 + rnd() * 0.15), c, { p: [Math.cos(a) * r, h + big * (0.35 + rnd() * 0.5), Math.sin(a) * r], r: [rnd() * 60, rnd() * 360, 0], tint: true }));
  }
  extra?.(g, rnd, h + big * 0.55);
  g.rotation.y = rnd() * Math.PI * 2;
  return g;
}

defineModel<NatOpts>('tree_round', {
  build: (o) => scaled(roundTree(o, LEAVES), o.s),
  colliders: [{ kind: 'circle', r: 0.35 }],
  height: 3.2,
  tags: ['nature', 'tree'],
  desc: 'Cây tán tròn',
  variants: [{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }],
});

defineModel<NatOpts>('tree_blossom', {
  build: (o) => scaled(roundTree(o, ['#ffb3cf', '#ffc6dc', '#ff9ec4', '#ffd6e6']), o.s),
  colliders: [{ kind: 'circle', r: 0.35 }],
  height: 3.2,
  tags: ['nature', 'tree'],
  desc: 'Cây hoa anh đào',
  variants: [{ v: 1 }, { v: 2 }],
});

defineModel<NatOpts>('tree_apple', {
  build: (o) =>
    scaled(
      roundTree(o, [PAL.leaf1, PAL.leaf2, PAL.leaf5], (g, rnd, top) => {
        for (let i = 0; i < 9; i++) {
          const a = rnd() * Math.PI * 2;
          const y = top + (rnd() - 0.35) * 1.1;
          const r = 0.9 + rnd() * 0.25;
          g.add(ball(0.12, '#ff5a5a', { p: [Math.cos(a) * r, y, Math.sin(a) * r], seg: 8, flat: false, shiny: 40 }));
        }
      }),
      o.s,
    ),
  colliders: [{ kind: 'circle', r: 0.35 }],
  height: 3.2,
  tags: ['nature', 'tree'],
  desc: 'Cây táo',
  variants: [{ v: 1 }, { v: 2 }],
});

defineModel<NatOpts>('tree_autumn', {
  build: (o) => scaled(roundTree(o, ['#f4a259', '#f6bd60', '#e76f51', '#f7c873']), o.s),
  colliders: [{ kind: 'circle', r: 0.35 }],
  height: 3.2,
  tags: ['nature', 'tree'],
  desc: 'Cây lá vàng',
  variants: [{ v: 1 }, { v: 2 }],
});

defineModel<NatOpts>('tree_pine', {
  build: (o) => {
    const rnd = seeded((o.v ?? 1) * 13 + 5);
    const g = new THREE.Group();
    const h = 0.6 + rnd() * 0.3;
    g.add(cyl(0.12, 0.17, h, PAL.trunk, { base: true, seg: 6 }));
    const c = o.color ?? [PAL.pine, '#4caf7d', '#3d8f63'][Math.floor(rnd() * 3)];
    const tiers = 3;
    let y = h - 0.1;
    let r = 1.0 + rnd() * 0.2;
    for (let i = 0; i < tiers; i++) {
      const th = 1.15 - i * 0.12;
      g.add(cone(r, th, i % 2 ? tint(c, 0.04) : c, { p: [0, y + th / 2, 0], r: [0, rnd() * 60, 0], seg: 7, tint: true }));
      y += th * 0.55;
      r *= 0.74;
    }
    g.rotation.y = rnd() * Math.PI * 2;
    return scaled(g, o.s);
  },
  colliders: [{ kind: 'circle', r: 0.35 }],
  height: 3.4,
  tags: ['nature', 'tree'],
  desc: 'Cây thông',
  variants: [{ v: 1 }, { v: 2 }, { v: 3 }],
});

defineModel<NatOpts>('tree_tall', {
  build: (o) => {
    const rnd = seeded((o.v ?? 1) * 17 + 11);
    const g = new THREE.Group();
    g.add(cyl(0.1, 0.15, 1.0, PAL.trunk, { base: true, seg: 6 }));
    const c = o.color ?? LEAVES[Math.floor(rnd() * LEAVES.length)];
    g.add(ico(0.75, c, { p: [0, 2.0, 0], s: [1, 1.7, 1], r: [0, rnd() * 360, 0], tint: true }));
    g.add(ico(0.5, tint(c, 0.04), { p: [0.15, 3.0, 0.05], s: [1, 1.4, 1], r: [0, rnd() * 360, 0], tint: true }));
    return scaled(g, o.s);
  },
  colliders: [{ kind: 'circle', r: 0.3 }],
  height: 3.6,
  tags: ['nature', 'tree'],
  desc: 'Cây dáng cao',
  variants: [{ v: 1 }, { v: 2 }],
});

defineModel<NatOpts>('tree_palm', {
  build: (o) => {
    const rnd = seeded((o.v ?? 1) * 23 + 7);
    const g = new THREE.Group();
    const lean = (rnd() - 0.5) * 0.3;
    for (let i = 0; i < 6; i++) {
      g.add(cyl(0.14 - i * 0.008, 0.16 - i * 0.008, 0.45, i % 2 ? '#b48a5a' : '#a47a4c', { p: [lean * i * 0.4, 0.22 + i * 0.42, 0], r: [0, 0, -lean * 20], seg: 7 }));
    }
    const top = new THREE.Vector3(lean * 2.4, 2.65, 0);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rnd() * 0.3;
      const leaf = new THREE.Group();
      leaf.add(box(1.5, 0.04, 0.42, i % 2 ? PAL.leaf1 : PAL.leaf2, { p: [0.75, 0, 0], r: [0, 0, -18] }));
      leaf.position.copy(top);
      leaf.rotation.set(0, a, -0.25);
      g.add(leaf);
    }
    for (let i = 0; i < 3; i++) g.add(ball(0.13, '#8b5e3c', { p: [top.x + Math.cos(i * 2.1) * 0.15, top.y - 0.15, Math.sin(i * 2.1) * 0.15], seg: 8 }));
    return scaled(g, o.s);
  },
  colliders: [{ kind: 'circle', r: 0.3 }],
  height: 3.0,
  tags: ['nature', 'tree'],
  desc: 'Cây dừa',
  variants: [{ v: 1 }, { v: 2 }],
});

/* ---------------------------------- Bụi --------------------------------- */
defineModel<NatOpts & { flowers?: boolean }>('bush', {
  build: (o) => {
    const rnd = seeded((o.v ?? 1) * 31 + 1);
    const g = new THREE.Group();
    const c = o.color ?? LEAVES[Math.floor(rnd() * LEAVES.length)];
    const n = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) {
      const r = 0.38 + rnd() * 0.18;
      const a = rnd() * Math.PI * 2;
      g.add(ico(r, i ? tint(c, (rnd() - 0.5) * 0.08) : c, { p: [Math.cos(a) * 0.25 * i, r * 0.75, Math.sin(a) * 0.25 * i], r: [rnd() * 50, rnd() * 360, 0], tint: true }));
    }
    if (o.flowers) {
      const fc = FLOWER_COLORS[Math.floor(rnd() * FLOWER_COLORS.length)];
      for (let i = 0; i < 6; i++) {
        const a = rnd() * Math.PI * 2;
        const y = 0.35 + rnd() * 0.45;
        g.add(ball(0.07, fc, { p: [Math.cos(a) * 0.45, y, Math.sin(a) * 0.45], seg: 6, cast: false }));
      }
    }
    return scaled(g, o.s);
  },
  colliders: [{ kind: 'circle', r: 0.4, top: 0.8 }],
  height: 1.0,
  tags: ['nature'],
  desc: 'Bụi cây',
  variants: [{ v: 1 }, { v: 2, flowers: true }, { v: 3 }],
});

/* ---------------------------------- Hoa, cỏ --------------------------------- */
defineModel<NatOpts>('flower', {
  build: (o) => {
    const rnd = seeded((o.v ?? 1) * 37 + 9);
    const c = o.color ?? FLOWER_COLORS[Math.floor(rnd() * FLOWER_COLORS.length)];
    const g = new THREE.Group();
    const h = 0.28 + rnd() * 0.12;
    g.add(cyl(0.015, 0.02, h, '#5aa65a', { base: true, seg: 4, cast: false }));
    g.add(box(0.1, 0.012, 0.05, '#6cbf5f', { p: [0.05, h * 0.4, 0], r: [0, 0, 25], cast: false }));
    const head = new THREE.Group();
    head.position.y = h;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      head.add(ball(0.055, c, { p: [Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06], s: [1, 0.5, 1], seg: 6, cast: false }));
    }
    head.add(ball(0.04, c === '#ffd166' ? '#ff9f43' : '#ffd166', { p: [0, 0.02, 0], seg: 6, cast: false }));
    head.rotation.x = 0.3;
    g.add(head);
    g.rotation.y = rnd() * Math.PI * 2;
    return scaled(g, o.s);
  },
  height: 0.4,
  tags: ['nature', 'small'],
  desc: 'Bông hoa',
  variants: [{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }],
});

defineModel<NatOpts>('tulip', {
  build: (o) => {
    const rnd = seeded((o.v ?? 1) * 41 + 2);
    const c = o.color ?? ['#ff6b6b', '#ffd166', '#ff8fab', '#b197fc'][Math.floor(rnd() * 4)];
    const g = new THREE.Group();
    g.add(cyl(0.015, 0.02, 0.32, '#5aa65a', { base: true, seg: 4, cast: false }));
    g.add(cone(0.09, 0.14, c, { p: [0, 0.38, 0], r: [180, 0, 0], seg: 6 }));
    g.add(cone(0.08, 0.08, c, { p: [0, 0.48, 0], seg: 6 }));
    g.add(box(0.05, 0.2, 0.012, '#6cbf5f', { p: [0.04, 0.12, 0], r: [0, 0, -15], cast: false }));
    return scaled(g, o.s);
  },
  height: 0.5,
  tags: ['nature', 'small'],
  desc: 'Hoa tulip',
  variants: [{ v: 1 }, { v: 2 }],
});

defineModel<NatOpts>('grass', {
  build: (o) => {
    const rnd = seeded((o.v ?? 1) * 43 + 5);
    const g = new THREE.Group();
    const c = o.color ?? [PAL.grassDark, '#86bf55', '#9ccf63'][Math.floor(rnd() * 3)];
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * 0.12;
      const h = 0.18 + rnd() * 0.16;
      g.add(cone(0.035, h, c, { p: [Math.cos(a) * d, h / 2, Math.sin(a) * d], r: [(rnd() - 0.5) * 30, 0, (rnd() - 0.5) * 30], seg: 3, cast: false }));
    }
    return scaled(g, o.s);
  },
  height: 0.3,
  tags: ['nature', 'small'],
  desc: 'Khóm cỏ',
  variants: [{ v: 1 }, { v: 2 }],
});

defineModel<NatOpts>('reeds', {
  build: (o) => {
    const rnd = seeded((o.v ?? 1) * 47 + 3);
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * 0.18;
      const h = 0.6 + rnd() * 0.4;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      g.add(cyl(0.015, 0.02, h, '#6aa84f', { p: [x, h / 2, z], seg: 4, cast: false }));
      if (i % 2 === 0) g.add(capsule(0.04, 0.12, '#8b5e3c', { p: [x, h + 0.02, z], seg: 6, cast: false }));
    }
    return scaled(g, o.s);
  },
  height: 1.0,
  tags: ['nature', 'small'],
  desc: 'Cỏ lau ven nước',
  variants: [{ v: 1 }],
});

defineModel<NatOpts>('lilypad', {
  build: (o) => {
    const rnd = seeded((o.v ?? 1) * 53 + 1);
    const g = new THREE.Group();
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(0.35, 14, 0.3, Math.PI * 2 - 0.6).rotateX(-Math.PI / 2),
      disc(0.35, '#6cbf5f').material as THREE.Material,
    );
    pad.position.y = 0.02;
    pad.receiveShadow = true;
    g.add(pad);
    if (rnd() > 0.5) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.add(ball(0.05, '#ffc2d6', { p: [0.08 + Math.cos(a) * 0.05, 0.07, Math.sin(a) * 0.05], s: [1, 0.6, 1], seg: 6, cast: false }));
      }
      g.add(ball(0.03, '#ffd166', { p: [0.08, 0.1, 0], seg: 6, cast: false }));
    }
    g.rotation.y = rnd() * Math.PI * 2;
    return scaled(g, o.s);
  },
  height: 0.1,
  tags: ['nature', 'small', 'water'],
  desc: 'Lá sen',
  variants: [{ v: 1 }, { v: 2 }],
});

/* ---------------------------------- Đá, nấm, gỗ --------------------------------- */
defineModel<NatOpts>('rock', {
  build: (o) => {
    const rnd = seeded((o.v ?? 1) * 59 + 4);
    const g = new THREE.Group();
    const c = o.color ?? [PAL.rock, '#bfbab2', '#d1ccc4'][Math.floor(rnd() * 3)];
    g.add(dodeca(0.4, c, { p: [0, 0.22, 0], s: [1.2, 0.75, 1], r: [rnd() * 40, rnd() * 360, rnd() * 20] }));
    if (rnd() > 0.4) g.add(dodeca(0.22, tint(c, -0.04), { p: [0.38, 0.12, 0.12], r: [rnd() * 40, rnd() * 360, 0] }));
    return scaled(g, o.s);
  },
  colliders: [{ kind: 'circle', r: 0.45, top: 0.5 }],
  height: 0.6,
  tags: ['nature'],
  desc: 'Hòn đá',
  variants: [{ v: 1 }, { v: 2 }, { v: 3 }],
});

defineModel<NatOpts>('rock_big', {
  build: (o) => {
    const rnd = seeded((o.v ?? 1) * 61 + 8);
    const g = new THREE.Group();
    const c = o.color ?? PAL.rock;
    g.add(dodeca(1.0, c, { p: [0, 0.6, 0], s: [1.25, 0.8, 1], r: [rnd() * 30, rnd() * 360, 0] }));
    g.add(dodeca(0.6, tint(c, -0.05), { p: [0.8, 0.35, 0.3], r: [rnd() * 30, rnd() * 360, 0] }));
    g.add(dodeca(0.45, tint(c, 0.03), { p: [-0.7, 0.3, 0.5], r: [rnd() * 30, rnd() * 360, 0] }));
    return scaled(g, o.s);
  },
  colliders: [{ kind: 'circle', r: 1.25, top: 1.2 }],
  height: 1.4,
  tags: ['nature'],
  desc: 'Tảng đá lớn',
  variants: [{ v: 1 }],
});

defineModel<NatOpts>('mushroom', {
  build: (o) => {
    const rnd = seeded((o.v ?? 1) * 67 + 2);
    const g = new THREE.Group();
    const c = o.color ?? ['#ff6b6b', '#ffa94d', '#b197fc'][Math.floor(rnd() * 3)];
    const n = 1 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) {
      const s = i ? 0.6 : 1;
      const x = i ? 0.22 : 0;
      g.add(cyl(0.07 * s, 0.09 * s, 0.24 * s, '#fff3e0', { p: [x, 0.12 * s, i * 0.1], seg: 8, flat: false }));
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), ball(1, c).material as THREE.Material);
      cap.position.set(x, 0.22 * s, i * 0.1);
      cap.castShadow = true;
      g.add(cap);
      for (let k = 0; k < 3; k++) {
        const a = k * 2.1 + rnd();
        g.add(ball(0.03 * s, '#ffffff', { p: [x + Math.cos(a) * 0.12 * s, 0.22 * s + 0.13 * s, i * 0.1 + Math.sin(a) * 0.12 * s], seg: 5, cast: false }));
      }
    }
    return scaled(g, o.s);
  },
  height: 0.4,
  tags: ['nature', 'small'],
  desc: 'Cây nấm',
  variants: [{ v: 1 }, { v: 2 }],
});

defineModel<NatOpts>('stump', {
  build: (o) => {
    const g = group([
      cyl(0.35, 0.42, 0.4, PAL.trunk, { base: true, seg: 9 }),
      cyl(0.33, 0.33, 0.02, '#e2b07a', { p: [0, 0.41, 0], seg: 9 }),
      torus(0.18, 0.012, '#c08a55', { p: [0, 0.425, 0], r: [90, 0, 0], ts: 14, seg: 3, cast: false }),
    ]);
    return scaled(g, o.s);
  },
  colliders: [{ kind: 'circle', r: 0.4, top: 0.42 }],
  height: 0.45,
  tags: ['nature'],
  desc: 'Gốc cây',
  variants: [{}],
});

defineModel<NatOpts>('log', {
  build: (o) => {
    const g = group([
      cyl(0.25, 0.25, 1.6, PAL.trunk, { p: [0, 0.25, 0], r: [0, 0, 90], seg: 9 }),
      cyl(0.23, 0.23, 0.02, '#e2b07a', { p: [0.81, 0.25, 0], r: [0, 0, 90], seg: 9 }),
      cyl(0.23, 0.23, 0.02, '#e2b07a', { p: [-0.81, 0.25, 0], r: [0, 0, 90], seg: 9 }),
      ico(0.12, PAL.leaf2, { p: [0.2, 0.5, 0.05] }),
    ]);
    return scaled(g, o.s);
  },
  colliders: [{ kind: 'box', w: 1.7, d: 0.5, top: 0.5 }],
  height: 0.5,
  tags: ['nature'],
  desc: 'Khúc gỗ',
  variants: [{}],
});

defineModel<NatOpts>('stepstone', {
  build: (o) => {
    const rnd = seeded((o.v ?? 1) * 71 + 6);
    const g = group([cyl(0.42, 0.46, 0.12, o.color ?? '#e9e2d4', { base: true, seg: 9, r: [0, rnd() * 360, 0], s: [1, 1, 0.8 + rnd() * 0.2] })]);
    return scaled(g, o.s);
  },
  height: 0.12,
  tags: ['nature', 'small'],
  desc: 'Đá kê bước',
  variants: [{}],
});

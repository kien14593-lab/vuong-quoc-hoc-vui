import * as THREE from 'three';
import { ball, box, cone, cyl, group, ico, lathe, plane, pivot, rbox, torus } from '../engine/kit';
import { PAL, tint } from '../engine/materials';
import { textPlate } from '../engine/text';
import { defineModel } from './registry';

type FenceOpts = { len?: number; style?: 'picket' | 'rail'; color?: string };
type HedgeOpts = { len?: number; h?: number };
type ColorOpt = { color?: string };

const WOOD = PAL.wood;
const WOOD_DARK = PAL.woodDark;
const WOOD_LIGHT = PAL.woodLight;
const FLOWERS = ['#ff6b6b', '#ffd166', '#b197fc', '#ff9ec7', '#ffffff'];

function apple(p: [number, number, number], s = 1): THREE.Object3D {
  return group([ball(0.075 * s, '#ff5a5f', { seg: 8, flat: false }), cyl(0.01 * s, 0.014 * s, 0.06 * s, WOOD_DARK, { p: [0, 0.075 * s, 0], seg: 5, cast: false })], { p });
}

function banana(p: [number, number, number], s = 1, r = 0): THREE.Object3D {
  return torus(0.1 * s, 0.026 * s, '#ffd166', { p, r: [80, r, 0], arc: 150, seg: 5, ts: 10, cast: false });
}

function flower(color: string, p: [number, number, number]): THREE.Object3D {
  return group([
    cyl(0.012, 0.016, 0.28, '#5aa65a', { p: [0, 0.14, 0], seg: 4, cast: false }),
    ball(0.055, color, { p: [0, 0.31, 0], seg: 6, cast: false }),
    ball(0.032, '#ffd166', { p: [0, 0.335, 0.01], seg: 6, cast: false }),
  ], { p });
}

function labelPlate(text: string, h = 0.22): THREE.Mesh {
  return textPlate(text, h, { bg: '#fff4d8', color: PAL.ink, border: '#8a5a3b', pad: 14, radius: 12, weight: 900 });
}

defineModel<FenceOpts>('fence', {
  build: (o) => {
    const len = o.len ?? 4;
    const color = o.color ?? '#ffffff';
    const g = new THREE.Group();
    if (o.style === 'rail') {
      const n = Math.max(2, Math.round(len / 1.1) + 1);
      for (let i = 0; i < n; i++) {
        const x = -len / 2 + (i * len) / (n - 1);
        g.add(cyl(0.06, 0.075, 0.9, color, { p: [x, 0.45, 0], seg: 6 }));
      }
      for (const y of [0.38, 0.68]) g.add(box(len, 0.08, 0.08, color, { p: [0, y, 0] }));
    } else {
      const n = Math.max(3, Math.round(len / 0.35) + 1);
      for (let i = 0; i < n; i++) {
        const x = -len / 2 + (i * len) / (n - 1);
        g.add(group([box(0.13, 0.72, 0.08, color, { p: [0, 0.36, 0] }), cone(0.085, 0.2, color, { p: [0, 0.82, 0], r: [0, 0, 45], seg: 4 })], { p: [x, 0, 0] }));
      }
      for (const y of [0.28, 0.56]) g.add(box(len, 0.065, 0.07, tint(color, -0.05), { p: [0, y, -0.04], cast: false }));
    }
    return g;
  },
  colliders: (o) => [{ kind: 'box', w: o.len ?? 4, d: 0.25 }],
  height: 1.0,
  tags: ['prop'],
  desc: 'Hàng rào ghép đoạn',
  variants: [{ len: 4, style: 'picket' }, { len: 4, style: 'rail', color: '#d7a56d' }],
});

defineModel<HedgeOpts>('hedge', {
  build: (o) => {
    const len = o.len ?? 2;
    const h = o.h ?? 1;
    const g = new THREE.Group();
    g.add(rbox(len, h, 0.65, 0.16, '#70c268', { p: [0, h / 2, 0], seg: 2 }));
    const n = Math.max(2, Math.round(len));
    for (let i = 0; i <= n; i++) {
      const x = -len / 2 + (i * len) / n;
      g.add(ico(0.22, i % 2 ? '#5faf61' : '#82cf6d', { p: [x, h + 0.04, 0.12], s: [1.2, 0.65, 0.8], tint: true }));
    }
    return g;
  },
  colliders: (o) => [{ kind: 'box', w: o.len ?? 2, d: 0.7, top: o.h ?? 1 }],
  height: (o) => (o.h ?? 1) + 0.25,
  tags: ['prop'],
  desc: 'Bụi hàng rào thấp',
  variants: [{ len: 2, h: 1 }, { len: 3, h: 1.2 }],
});

defineModel('lamp_post', {
  build: () => group([
    cyl(0.09, 0.12, 0.18, '#6b5d56', { p: [0, 0.09, 0], seg: 8 }),
    cyl(0.045, 0.055, 1.85, '#5c4a3d', { p: [0, 1.05, 0], seg: 8 }),
    box(0.55, 0.07, 0.07, '#5c4a3d', { p: [0.25, 1.85, 0] }),
    rbox(0.38, 0.42, 0.38, 0.07, '#ffe9a8', { p: [0.55, 1.62, 0], emissive: '#ffd36b', glow: 0.55, opacity: 0.86, shiny: 50 }),
    cone(0.26, 0.18, '#5c4a3d', { p: [0.55, 1.92, 0], seg: 4 }),
  ]),
  colliders: [{ kind: 'circle', r: 0.22 }],
  height: 2.05,
  tags: ['prop'],
  desc: 'Đèn đường ánh vàng',
  variants: [{}],
});

defineModel('bench', {
  build: () => group([
    box(1.8, 0.16, 0.45, WOOD_LIGHT, { p: [0, 0.55, 0] }),
    box(1.8, 0.16, 0.18, WOOD, { p: [0, 0.85, -0.25], r: [-10, 0, 0] }),
    box(0.12, 0.5, 0.12, WOOD_DARK, { p: [-0.65, 0.25, -0.15] }),
    box(0.12, 0.5, 0.12, WOOD_DARK, { p: [0.65, 0.25, -0.15] }),
    box(0.12, 0.5, 0.12, WOOD_DARK, { p: [-0.65, 0.25, 0.18] }),
    box(0.12, 0.5, 0.12, WOOD_DARK, { p: [0.65, 0.25, 0.18] }),
  ]),
  colliders: [{ kind: 'box', w: 1.9, d: 0.7, top: 0.65 }],
  height: 1.0,
  tags: ['prop'],
  desc: 'Ghế băng gỗ',
  variants: [{}],
});

defineModel('mailbox', {
  build: () => group([
    box(0.1, 0.75, 0.1, WOOD_DARK, { p: [0, 0.38, 0] }),
    rbox(0.58, 0.34, 0.34, 0.12, '#ff9ec7', { p: [0, 0.88, 0], seg: 3 }),
    box(0.62, 0.04, 0.38, '#ffffff', { p: [0, 1.05, 0], cast: false }),
    box(0.04, 0.26, 0.2, '#ffd166', { p: [0.34, 1.0, 0], r: [0, 0, -25], cast: false }),
  ]),
  colliders: [{ kind: 'circle', r: 0.25 }],
  height: 1.1,
  tags: ['prop'],
  desc: 'Hộp thư hồng',
  variants: [{}],
});

defineModel<ColorOpt>('crate', {
  build: (o) => {
    const c = o.color ?? WOOD_LIGHT;
    return group([
      box(0.75, 0.7, 0.75, c, { p: [0, 0.35, 0] }),
      box(0.82, 0.08, 0.82, WOOD_DARK, { p: [0, 0.12, 0], cast: false }),
      box(0.82, 0.08, 0.82, WOOD_DARK, { p: [0, 0.58, 0], cast: false }),
      box(0.08, 0.76, 0.08, WOOD_DARK, { p: [-0.37, 0.35, -0.37], cast: false }),
      box(0.08, 0.76, 0.08, WOOD_DARK, { p: [0.37, 0.35, 0.37], cast: false }),
    ]);
  },
  colliders: [{ kind: 'box', w: 0.8, d: 0.8, top: 0.7 }],
  height: 0.75,
  tags: ['prop'],
  desc: 'Thùng gỗ',
  variants: [{}],
});

defineModel<{ fruit?: 'apple' | 'banana' }>('crate_fruit', {
  build: (o) => {
    const fruit = o.fruit ?? 'apple';
    const g = group([
      box(0.85, 0.44, 0.65, WOOD_LIGHT, { p: [0, 0.22, 0] }),
      box(0.92, 0.08, 0.7, WOOD_DARK, { p: [0, 0.12, 0], cast: false }),
      box(0.92, 0.08, 0.7, WOOD_DARK, { p: [0, 0.38, 0], cast: false }),
    ]);
    for (let i = 0; i < 10; i++) {
      const x = -0.3 + (i % 5) * 0.15;
      const z = -0.18 + Math.floor(i / 5) * 0.24;
      g.add(fruit === 'apple' ? apple([x, 0.55, z], 1) : banana([x, 0.54, z], 1, i * 18));
    }
    return g;
  },
  colliders: [{ kind: 'box', w: 0.9, d: 0.7, top: 0.55 }],
  height: 0.75,
  tags: ['prop'],
  desc: 'Thùng trái cây',
  variants: [{ fruit: 'apple' }, { fruit: 'banana' }],
});

defineModel('barrel', {
  build: () => group([
    cyl(0.38, 0.38, 0.82, WOOD, { p: [0, 0.41, 0], seg: 12, s: [1, 1, 1] }),
    torus(0.38, 0.025, '#6b5d56', { p: [0, 0.18, 0], r: [90, 0, 0], ts: 16, cast: false }),
    torus(0.38, 0.025, '#6b5d56', { p: [0, 0.64, 0], r: [90, 0, 0], ts: 16, cast: false }),
  ]),
  colliders: [{ kind: 'circle', r: 0.42, top: 0.82 }],
  height: 0.85,
  tags: ['prop'],
  desc: 'Thùng tròn',
  variants: [{}],
});

defineModel<ColorOpt>('flower_pot', {
  build: (o) => {
    const c = o.color ?? '#ff6b6b';
    const g = new THREE.Group();
    g.add(lathe([[0.18, 0], [0.26, 0.08], [0.23, 0.36], [0.3, 0.42]], '#c8915a', { seg: 10 }));
    for (let i = 0; i < 5; i++) g.add(flower(i % 2 ? c : FLOWERS[i % FLOWERS.length], [Math.cos(i * 1.26) * 0.16, 0.35, Math.sin(i * 1.26) * 0.16]));
    return g;
  },
  colliders: [{ kind: 'circle', r: 0.32, top: 0.45 }],
  height: 0.75,
  tags: ['prop'],
  desc: 'Chậu hoa',
  variants: [{ color: '#ff6b6b' }, { color: '#b197fc' }],
});

defineModel<{ len?: number }>('flower_bed', {
  build: (o) => {
    const len = o.len ?? 2;
    const g = new THREE.Group();
    // Viền sáng + lá xanh dày + hoa to: nhìn từ camera cao vẫn ra luống hoa, không thành "thanh gỗ".
    g.add(rbox(len, 0.16, 0.62, 0.06, WOOD_LIGHT, { p: [0, 0.08, 0] }));
    g.add(box(len - 0.12, 0.03, 0.5, '#6e4b32', { p: [0, 0.165, 0], cast: false }));
    const leaves = Math.max(3, Math.round(len * 1.8));
    for (let i = 0; i < leaves; i++) {
      const x = -len / 2 + 0.24 + (i * (len - 0.48)) / Math.max(1, leaves - 1);
      g.add(ico(0.21, i % 2 ? '#62b955' : '#74c95e', { p: [x, 0.25, i % 2 ? -0.06 : 0.06], s: [1.25, 0.75, 1.1], cast: false }));
    }
    const n = Math.max(5, Math.round(len * 3.5));
    for (let i = 0; i < n; i++) {
      const x = -len / 2 + 0.16 + (i * (len - 0.32)) / (n - 1);
      const y = 0.4 + (i % 3) * 0.035;
      const z = i % 2 ? -0.14 : 0.14;
      const c = FLOWERS[i % FLOWERS.length];
      g.add(ball(0.09, c, { p: [x, y, z], s: [1, 0.72, 1], seg: 7, cast: false }));
      g.add(ball(0.04, c === '#ffd166' ? '#ff9f43' : '#ffd166', { p: [x, y + 0.05, z], seg: 6, cast: false }));
    }
    return g;
  },
  colliders: (o) => [{ kind: 'box', w: o.len ?? 2, d: 0.6, top: 0.25 }],
  height: 0.55,
  tags: ['prop'],
  desc: 'Luống hoa',
  variants: [{ len: 2 }, { len: 3 }],
});

defineModel<{ labels?: string[] }>('signpost', {
  build: (o) => {
    const labels = (o.labels ?? ['Làng', 'Rừng', 'Sở thú']).slice(0, 3);
    const g = new THREE.Group();
    g.add(cyl(0.06, 0.08, 1.65, WOOD_DARK, { p: [0, 0.82, 0], seg: 6 }));
    labels.forEach((txt, i) => {
      const y = 1.45 - i * 0.34;
      const dir = i % 2 ? -1 : 1;
      g.add(box(0.9, 0.22, 0.08, WOOD_LIGHT, { p: [dir * 0.22, y, 0] }));
      const t = labelPlate(txt, 0.16);
      t.position.set(dir * 0.22, y, 0.055);
      g.add(t);
    });
    return g;
  },
  colliders: [{ kind: 'circle', r: 0.18 }],
  height: 1.75,
  tags: ['prop'],
  desc: 'Cột biển chỉ đường',
  variants: [{ labels: ['Làng', 'Rừng', 'Zoo'] }],
});

defineModel('wheelbarrow', {
  build: () => group([
    box(1.0, 0.35, 0.65, '#7bd389', { p: [0, 0.48, 0], r: [0, 0, -8] }),
    cyl(0.18, 0.18, 0.12, '#5c4a3d', { p: [0.58, 0.24, 0], r: [90, 0, 0], seg: 12 }),
    box(1.15, 0.06, 0.06, WOOD_DARK, { p: [-0.15, 0.38, -0.42], r: [0, 0, -8] }),
    box(1.15, 0.06, 0.06, WOOD_DARK, { p: [-0.15, 0.38, 0.42], r: [0, 0, -8] }),
    ball(0.16, '#93c75f', { p: [-0.15, 0.75, 0.05], seg: 8 }),
  ]),
  colliders: [{ kind: 'box', w: 1.3, d: 0.85, top: 0.7 }],
  height: 0.9,
  tags: ['prop'],
  desc: 'Xe cút kít',
  variants: [{}],
});

defineModel('picnic', {
  build: () => group([
    plane(1.8, 1.35, '#ff6b6b', { p: [0, 0.015, 0] }),
    box(1.8, 0.01, 0.09, '#ffffff', { p: [0, 0.025, -0.34], cast: false }),
    box(0.09, 0.01, 1.35, '#ffffff', { p: [-0.45, 0.03, 0], cast: false }),
    group([box(0.55, 0.32, 0.38, WOOD_LIGHT, { p: [0, 0.16, 0] }), torus(0.24, 0.02, WOOD_DARK, { p: [0, 0.36, 0], r: [90, 0, 0], arc: 180 })], { p: [0.35, 0.02, 0.1] }),
    apple([-0.35, 0.08, 0.2], 1.2), banana([-0.55, 0.08, -0.22], 1.2),
  ]),
  height: 0.45,
  tags: ['prop'],
  desc: 'Khăn picnic và giỏ',
  variants: [{}],
});

defineModel('hay_bale', {
  build: () => group([
    rbox(1.0, 0.55, 0.62, 0.11, '#f0c96a', { p: [0, 0.28, 0], seg: 2 }),
    box(1.04, 0.035, 0.66, '#d9a93d', { p: [0, 0.28, 0], r: [0, 0, 0], cast: false }),
    box(0.05, 0.58, 0.66, '#d9a93d', { p: [-0.28, 0.28, 0], cast: false }),
    box(0.05, 0.58, 0.66, '#d9a93d', { p: [0.28, 0.28, 0], cast: false }),
  ]),
  colliders: [{ kind: 'box', w: 1.05, d: 0.7, top: 0.55 }],
  height: 0.6,
  tags: ['prop'],
  desc: 'Kiện rơm',
  variants: [{}],
});

defineModel('trough', {
  build: () => group([
    box(1.55, 0.45, 0.65, WOOD, { p: [0, 0.33, 0] }),
    box(1.35, 0.28, 0.48, '#8fd8e6', { p: [0, 0.48, 0], opacity: 0.55, shiny: 60, cast: false }),
    box(0.12, 0.25, 0.12, WOOD_DARK, { p: [-0.58, 0.12, -0.2] }),
    box(0.12, 0.25, 0.12, WOOD_DARK, { p: [0.58, 0.12, 0.2] }),
  ]),
  colliders: [{ kind: 'box', w: 1.6, d: 0.7, top: 0.55 }],
  height: 0.6,
  tags: ['prop'],
  desc: 'Máng nước',
  variants: [{}],
});

defineModel('bucket', {
  build: () => group([
    cyl(0.22, 0.28, 0.42, '#c8915a', { p: [0, 0.21, 0], seg: 10 }),
    torus(0.23, 0.018, '#5f564f', { p: [0, 0.42, 0], r: [90, 0, 0], arc: 180, cast: false }),
    torus(0.23, 0.014, WOOD_DARK, { p: [0, 0.12, 0], r: [90, 0, 0], ts: 14, cast: false }),
  ]),
  colliders: [{ kind: 'circle', r: 0.28, top: 0.45 }],
  height: 0.65,
  tags: ['prop'],
  desc: 'Xô gỗ',
  variants: [{}],
});

defineModel('umbrella_table', {
  build: () => group([
    cyl(0.08, 0.08, 1.85, '#6b5d56', { p: [0, 0.92, 0], seg: 8 }),
    cyl(0.62, 0.62, 0.09, WOOD_LIGHT, { p: [0, 0.72, 0], seg: 16 }),
    cone(1.25, 0.48, '#74c0fc', { p: [0, 2.0, 0], seg: 12 }),
    ...[0, 1, 2, 3].map((i) => box(0.65, 0.1, 0.35, '#fff4d8', { p: [Math.cos(i * Math.PI / 2) * 0.9, 0.46, Math.sin(i * Math.PI / 2) * 0.9], r: [0, -i * 90, 0] })),
  ]),
  colliders: [{ kind: 'circle', r: 0.75, top: 0.75 }],
  height: 2.25,
  tags: ['prop'],
  desc: 'Bàn có dù',
  variants: [{}],
});

defineModel('trash_bin', {
  build: () => group([
    cyl(0.32, 0.36, 0.72, '#74c0fc', { p: [0, 0.36, 0], seg: 12 }),
    cyl(0.38, 0.38, 0.08, '#5aa9e6', { p: [0, 0.76, 0], seg: 12 }),
    ball(0.035, PAL.ink, { p: [-0.12, 0.5, 0.32], seg: 8, cast: false }),
    ball(0.035, PAL.ink, { p: [0.12, 0.5, 0.32], seg: 8, cast: false }),
    torus(0.12, 0.012, '#ff9ec7', { p: [0, 0.4, 0.33], r: [0, 0, 0], arc: 180, ts: 12, cast: false }),
  ]),
  colliders: [{ kind: 'circle', r: 0.38, top: 0.8 }],
  height: 0.85,
  tags: ['prop'],
  desc: 'Thùng rác đáng yêu',
  variants: [{}],
});

defineModel<{ colors?: string[] }>('balloon_bunch', {
  build: (o) => {
    const colors = (o.colors && o.colors.length ? o.colors : ['#ff6b6b', '#ffd166']).slice(0, 2);
    const bunch = pivot([0, 0, 0], [], 'balloons');
    bunch.userData.dynamic = true;
    bunch.userData.tick = (_dt: number, t: number) => { bunch.position.y = Math.sin(t * 1.8) * 0.08; bunch.rotation.y = Math.sin(t * 0.9) * 0.08; };
    colors.forEach((c, i) => {
      const a = i * 1.25;
      const x = Math.cos(a) * (i ? 0.18 : 0.02);
      const z = Math.sin(a) * (i ? 0.18 : 0.02);
      const y = 1.45 + (i % 3) * 0.22;
      bunch.add(cyl(0.008, 0.008, y - 0.18, '#f7f0e8', { p: [x * 0.5, (y - 0.18) / 2, z * 0.5], seg: 4, cast: false }));
      bunch.add(ball(0.23, c, { p: [x, y, z], s: [0.9, 1.15, 0.9], seg: 12, flat: false, shiny: 40 }));
    });
    return bunch;
  },
  colliders: [{ kind: 'circle', r: 0.18 }],
  height: 2.0,
  tags: ['prop'],
  desc: 'Chùm bóng bay (balloons)',
  variants: [{}],
});



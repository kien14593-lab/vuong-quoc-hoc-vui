import * as THREE from 'three';
import { ball, box, cone, cyl, dodeca, extrude, group, ico, lathe, panel, pivot, prism, rbox, ring, starShape, torus, tube } from '../engine/kit';
import { PAL, tint } from '../engine/materials';
import { numberBadge, textPlate } from '../engine/text';
import { defineModel } from './registry';
import { doorPart, houseBody, ROOF_COLORS, windowPart } from './buildings';

type RoofOpt = { roof?: string };
/** `n`: số hoặc nhãn ngắn ("3/4", "0,5", "12 xu"...) hiện trên bảng tròn. */
type NumOpt = { n?: number | string; color?: string };

const WOOD = PAL.wood;
const WOOD_DARK = PAL.woodDark;
const WOOD_LIGHT = PAL.woodLight;
const STONE = '#e2d3b0';
const CREAM = '#fff4d8';
const LEAF = '#65b96a';
const FLOWERS = ['#ff6b6b', '#ffd166', '#b197fc', '#ff9ec7'];

function clonePlate(mesh: THREE.Mesh): THREE.Mesh {
  const m = mesh.clone();
  m.material = mesh.material;
  return m;
}

function signText(text: string, h: number, bg = '#fff4d8', color: string = PAL.ink): THREE.Mesh {
  return textPlate(text, h, { bg, color, border: '#8a5a3b', pad: 18, radius: 18, weight: 900 });
}

function addWindow(g: THREE.Group, x: number, y: number, z: number, w = 0.65, h = 0.6, flowers = false): void {
  const win = windowPart(w, h, { flowers, shutter: '#9bd4c9', seed: Math.round((x + y + z) * 10) });
  win.position.set(x, y, z);
  g.add(win);
}

function apple(p: [number, number, number], s = 1): THREE.Object3D {
  return group([
    ball(0.09 * s, '#ff5a5f', { seg: 8, flat: false }),
    cyl(0.012 * s, 0.018 * s, 0.08 * s, WOOD_DARK, { p: [0, 0.09 * s, 0], seg: 5, cast: false }),
  ], { p });
}

function banana(p: [number, number, number], s = 1, r = 0): THREE.Object3D {
  return torus(0.12 * s, 0.032 * s, '#ffd166', { p, r: [80, r, 0], arc: 150, seg: 5, ts: 12, cast: false });
}

function crateWithFruit(kind: 'apple' | 'banana', p: [number, number, number]): THREE.Object3D {
  const kids: THREE.Object3D[] = [
    box(0.75, 0.36, 0.55, WOOD_LIGHT, { p: [0, 0.18, 0] }),
    box(0.82, 0.08, 0.6, WOOD_DARK, { p: [0, 0.33, 0], cast: false }),
    box(0.82, 0.08, 0.6, WOOD_DARK, { p: [0, 0.1, 0], cast: false }),
  ];
  for (let i = 0; i < 8; i++) {
    const x = -0.25 + (i % 4) * 0.17;
    const z = -0.14 + Math.floor(i / 4) * 0.22;
    kids.push(kind === 'apple' ? apple([x, 0.45, z], 0.9) : banana([x, 0.44, z], 0.9, i * 20));
  }
  return group(kids, { p });
}

function flowerBox(p: [number, number, number], w = 0.8): THREE.Object3D {
  const kids: THREE.Object3D[] = [box(w, 0.18, 0.22, WOOD_LIGHT, { p: [0, 0, 0] })];
  for (let i = 0; i < 5; i++) {
    const x = -w * 0.4 + (i * w * 0.8) / 4;
    kids.push(ball(0.08, i % 2 ? PAL.leaf2 : PAL.leaf1, { p: [x, 0.13, 0.02], seg: 6, cast: false }));
    kids.push(ball(0.055, FLOWERS[i % FLOWERS.length], { p: [x, 0.21, 0.04], seg: 6, cast: false }));
  }
  return group(kids, { p });
}

function coinEmblem(d = 0.55): THREE.Group {
  return group([
    numberBadge('₫', d, { bg: '#ffd166', color: '#8a5a3b', border: '#fff4b8' }),
    torus(d * 0.36, 0.025, '#fff4b8', { p: [0, 0, 0.01], seg: 6, ts: 18, cast: false }),
  ]);
}

function plaqueNumber(n: number | string | undefined, d: number, color: string): THREE.Mesh {
  return numberBadge(n ?? 1, d, { bg: color, color: PAL.ink, border: '#ffffff' });
}

function leafyBump(x: number, y: number, z: number, color = LEAF): THREE.Object3D {
  return ico(0.28, color, { p: [x, y, z], s: [1.1, 0.75, 0.8], r: [15, x * 73, 0], tint: true });
}

function makeHedge(len: number, h: number, flowers: boolean): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(len, h - 0.12, 0.78, 0.2, '#5fac5f', { p: [0, (h - 0.12) / 2, 0], seg: 2 }));
  g.add(box(len + 0.02, 0.22, 0.88, '#3f8f54', { p: [0, 0.14, 0], cast: false }));
  g.add(rbox(len, 0.46, 0.94, 0.23, '#82cf6d', { p: [0, h + 0.02, 0], seg: 3 }));
  g.add(rbox(len, 0.18, 0.7, 0.09, '#9adf7a', { p: [0, h + 0.28, 0], seg: 2, cast: false }));
  const count = Math.max(5, Math.round(len * 1.5));
  for (let i = 0; i <= count; i++) {
    const x = -len / 2 + (i * len) / count;
    const c1 = i % 3 === 0 ? '#4fae68' : i % 3 === 1 ? '#70c866' : '#8bd66d';
    g.add(ico(0.22, c1, { p: [x, h * 0.72, 0.42], s: [1.0, 0.65, 0.75], r: [20, i * 37, 0], tint: true }));
    g.add(ico(0.24, tint(c1, 0.03), { p: [x, h + 0.18, i % 2 ? 0.27 : -0.27], s: [1.12, 0.65, 0.85], r: [15, i * 51, 0], tint: true }));
    if (flowers && i % 2 === 0) {
      g.add(ball(0.065, FLOWERS[i % FLOWERS.length], { p: [x, h * 0.62, 0.49], seg: 6, cast: false }));
      g.add(ball(0.055, FLOWERS[(i + 1) % FLOWERS.length], { p: [x + 0.12, h + 0.18, -0.36], seg: 6, cast: false }));
    }
  }
  return g;
}

function animalEarPair(color: string): THREE.Object3D {
  return group([
    cone(0.26, 0.55, color, { p: [-0.38, 0.05, 0], r: [0, 0, -18], seg: 6 }),
    cone(0.26, 0.55, color, { p: [0.38, 0.05, 0], r: [0, 0, 18], seg: 6 }),
  ]);
}

defineModel<RoofOpt>('house_player', {
  build: (o) => {
    const roof = o.roof ?? '#7aa7e0';
    const g = new THREE.Group();
    g.add(houseBody({ w: 4.2, d: 3.25, h: 2.25, roof, wall: '#fff0cf', flowers: true }));
    g.add(box(1.55, 1.55, 2.25, '#ffe3b0', { p: [2.35, 1.0, 0.28] }));
    g.add(prism(1.9, 0.72, 2.55, tint(roof, -0.02), { p: [2.35, 1.78, 0.28] }));
    g.add(rbox(1.38, 1.25, 1.18, 0.08, '#fff6df', { p: [-1.15, 3.03, 0.1], seg: 2 }));
    g.add(prism(1.62, 0.62, 1.45, tint(roof, 0.05), { p: [-1.15, 3.65, 0.1] }));
    const attic = cyl(0.28, 0.28, 0.06, '#8fd3f4', { p: [-1.15, 3.18, 1.72], r: [90, 0, 0], seg: 18, shiny: 60 });
    g.add(attic);
    g.add(torus(0.3, 0.035, PAL.frame, { p: [-1.15, 3.18, 1.755], seg: 6, ts: 18, cast: false }));
    const door = doorPart(1.02, 1.58, '#7b4a2e');
    door.name = 'door';
    door.position.set(-0.55, 0.24, 1.63);
    g.add(door);
    addWindow(g, 0.82, 1.58, 1.63, 0.78, 0.68, true);
    addWindow(g, 2.35, 1.18, 1.43, 0.55, 0.52, true);
    addWindow(g, 2.35, 1.18, -0.86, 0.5, 0.48, false);
    g.children[g.children.length - 1].rotation.y = Math.PI;
    g.add(box(2.55, 0.18, 1.18, '#d9c2a2', { p: [-0.35, 0.09, 2.15] }));
    g.add(box(2.95, 0.14, 1.35, tint(roof, 0.08), { p: [-0.35, 2.46, 2.05] }));
    g.add(prism(2.95, 0.35, 1.35, tint(roof, 0.03), { p: [-0.35, 2.52, 2.05], r: [0, 0, 0] }));
    for (const x of [-1.55, 0.88]) {
      g.add(cyl(0.09, 0.11, 2.3, '#fff7e8', { p: [x, 1.16, 2.46], seg: 10 }));
      g.add(cyl(0.14, 0.14, 0.12, '#d9c2a2', { p: [x, 0.18, 2.46], seg: 10 }));
    }
    g.add(box(1.2, 0.12, 0.55, '#d6c5a8', { p: [-0.55, 0.05, 2.78] }));
    g.add(box(0.95, 0.1, 0.45, '#cbb997', { p: [-0.55, -0.03, 3.08] }));
    const star = extrude('player-home-star-big', () => starShape(0.42, 0.18, 5), 0.055, PAL.gold, { p: [-0.55, 2.34, 1.72], cast: false });
    g.add(star);
    g.add(flowerBox([0.82, 1.08, 1.86], 0.85));
    g.add(flowerBox([2.35, 0.75, 1.57], 0.65));
    const flag = group([
      cyl(0.025, 0.025, 0.9, WOOD_DARK, { p: [0, 0.45, 0], seg: 6, cast: false }),
      panel(0.55, 0.32, '#ff6b6b', { p: [0.28, 0.75, 0.02], cast: false }),
    ], { p: [0.9, 3.95, 0.0], r: [0, 20, 0] });
    g.add(flag);
    g.add(group([box(0.14, 0.52, 0.14, WOOD_DARK, { base: true }), rbox(0.58, 0.34, 0.3, 0.08, '#ff9ec7', { p: [0, 0.66, 0], seg: 2 }), box(0.6, 0.08, 0.34, '#ffffff', { p: [0, 0.84, 0] })], { p: [-2.55, 0, 2.45] }));
    for (const x of [-2.7, -2.15, 1.55, 2.1]) g.add(group([box(0.09, 0.58, 0.09, '#ffffff', { p: [0, 0.29, 0] }), cone(0.075, 0.12, '#ffffff', { p: [0, 0.64, 0], seg: 4 }), box(0.5, 0.08, 0.08, '#ffffff', { p: [0.16, 0.38, 0] })], { p: [x, 0, 2.55] }));
    return g;
  },
  colliders: [{ kind: 'box', w: 4.6, d: 3.55 }, { kind: 'box', w: 1.7, d: 2.3, at: [2.35, 0.28] }],
  height: 4.35,
  tags: ['building', 'village'],
  desc: 'Nhà của bạn đặc biệt (door)',
  variants: ROOF_COLORS.slice(0, 4).map((roof) => ({ roof })),
});

defineModel<RoofOpt>('shop_math', {
  build: (o) => {
    const roof = o.roof ?? '#ef8c7a';
    const g = houseBody({ w: 4.7, d: 3.15, h: 2.25, roof, wall: '#fff2cc', chimney: false });
    const door = doorPart(0.9, 1.55, '#9b6b43');
    door.name = 'door';
    door.position.set(-1.55, 0.24, 1.58);
    g.add(door);
    g.add(rbox(2.18, 1.18, 0.14, 0.08, PAL.frame, { p: [0.72, 1.42, 1.66] }));
    g.add(box(1.96, 0.96, 0.07, '#9be7ff', { p: [0.72, 1.42, 1.74], shiny: 80, cast: false }));
    g.add(box(0.06, 0.96, 0.08, PAL.frame, { p: [0.72, 1.42, 1.79], cast: false }));
    g.add(box(1.96, 0.06, 0.08, PAL.frame, { p: [0.72, 1.42, 1.79], cast: false }));
    for (const [x, c] of [[0.25, '#ff6b6b'], [0.62, '#ffd166'], [1.0, '#7bd389']] as [number, string][]) g.add(ball(0.13, c, { p: [x, 1.05, 1.84], seg: 8, cast: false }));
    g.add(box(0.6, 0.18, 0.16, '#b197fc', { p: [1.1, 1.88, 1.84], cast: false }));
    for (let i = 0; i < 8; i++) g.add(box(0.43, 0.2, 1.05, i % 2 ? '#ffffff' : '#ff6b6b', { p: [-0.62 + i * 0.36, 2.3, 2.02], cast: false }));
    g.add(box(3.55, 0.55, 0.18, WOOD_DARK, { p: [0.25, 3.05, 1.82] }));
    const sign = signText('CỬA HÀNG', 0.48, '#ffd166');
    sign.position.set(0.25, 3.07, 1.93);
    g.add(sign);
    const coin = coinEmblem(0.62);
    coin.position.set(2.12, 2.45, 1.68);
    g.add(coin);
    const board = signText('5 + 3 = ?', 0.28, '#2f4f3b', '#fff4d8');
    board.position.set(-2.28, 0.95, 2.0);
    board.rotation.y = -0.25;
    g.add(board);
    g.add(cyl(0.04, 0.05, 0.8, WOOD_DARK, { p: [-2.55, 0.4, 1.85], seg: 6 }));
    g.add(crateWithFruit('apple', [-2.45, 0, 2.18]));
    g.add(crateWithFruit('banana', [2.25, 0, 2.18]));
    return g;
  },
  colliders: [{ kind: 'box', w: 4.9, d: 3.35 }],
  height: 4.05,
  tags: ['building', 'village'],
  desc: 'Cửa hàng Cô Mèo (door)',
  variants: [{ roof: '#ef8c7a' }, { roof: '#6fb7b7' }],
});

defineModel('fruit_stand', {
  build: () => {
    const g = new THREE.Group();
    g.add(box(2.6, 0.18, 0.9, WOOD_LIGHT, { p: [0, 0.78, 0.25] }));
    g.add(box(2.8, 0.72, 0.2, WOOD, { p: [0, 0.36, 0.63] }));
    for (const x of [-1.15, 1.15]) for (const z of [-0.35, 0.85]) g.add(cyl(0.06, 0.07, 2.25, WOOD_DARK, { p: [x, 1.12, z], seg: 6 }));
    for (let i = 0; i < 6; i++) g.add(box(0.52, 0.16, 1.45, i % 2 ? '#ffffff' : '#4ecdc4', { p: [-1.3 + i * 0.52, 2.25, 0.25], r: [0, 0, i < 3 ? 6 : -6] }));
    g.add(crateWithFruit('apple', [-0.65, 0.78, 0.15]));
    g.add(crateWithFruit('banana', [0.65, 0.78, 0.15]));
    const p5 = plaqueNumber(5, 0.34, '#fff4d8');
    p5.position.set(-0.65, 1.15, 0.72);
    g.add(p5);
    const p3 = plaqueNumber(3, 0.34, '#fff4d8');
    p3.position.set(0.65, 1.15, 0.72);
    g.add(p3);
    return g;
  },
  colliders: [{ kind: 'box', w: 2.8, d: 1.3, top: 0.85 }],
  height: 2.45,
  tags: ['building', 'market'],
  desc: 'Quầy trái cây',
  variants: [{}],
});

defineModel('question_board', {
  build: () => {
    const g = new THREE.Group();
    for (const x of [-1.05, 1.05]) g.add(cyl(0.08, 0.1, 1.55, WOOD_DARK, { p: [x, 0.78, -0.04], seg: 6 }));
    g.add(rbox(2.75, 1.65, 0.18, 0.08, WOOD, { p: [0, 1.7, 0] }));
    const face = panel(2.4, 1.3, CREAM, { p: [0, 1.7, 0.105] });
    face.name = 'face';
    face.userData.faceSize = [2.4, 1.3];
    g.add(face);
    g.add(panel(2.25, 1.15, '#d9b98a', { p: [0, 1.7, -0.105], r: [0, 180, 0] }));
    g.add(box(2.9, 0.12, 0.25, WOOD_DARK, { p: [0, 2.58, 0] }));
    return g;
  },
  colliders: [{ kind: 'box', w: 2.8, d: 0.35 }],
  height: 2.7,
  tags: ['sign', 'structure'],
  desc: 'Bảng câu hỏi (face)',
  variants: [{}],
});

defineModel<{ raised?: boolean }>('bridge_draw', {
  build: (o) => {
    const g = new THREE.Group();
    for (const z of [-3.45, 3.45]) {
      g.add(box(3.7, 0.34, 0.82, STONE, { p: [0, 0.17, z] }));
      for (const x of [-1.35, 1.35]) {
        g.add(rbox(0.86, 1.95, 0.78, 0.12, '#d8d0c2', { p: [x, 0.98, z], seg: 2 }));
        g.add(box(0.28, 0.28, 0.84, '#bfb8ac', { p: [x - 0.29, 2.07, z] }));
        g.add(box(0.28, 0.28, 0.84, '#bfb8ac', { p: [x + 0.29, 2.07, z] }));
        g.add(box(0.88, 0.18, 0.86, '#bfb8ac', { p: [x, 2.02, z] }));
        g.add(prism(1.08, 0.42, 0.95, z > 0 ? '#7aa7e0' : '#6fb7b7', { p: [x, 2.22, z], r: [0, 90, 0] }));
        g.add(group([box(0.06, 0.32, 0.06, WOOD_DARK), rbox(0.22, 0.24, 0.22, 0.04, '#ffe9a8', { p: [0, -0.22, 0], emissive: '#ffd36b', glow: 0.45, opacity: 0.88 })], { p: [x * 0.92, 1.38, z + (z > 0 ? -0.43 : 0.43)] }));
      }
    }
    const deck = pivot([0, 0.08, 3.2], [], 'deck');
    deck.rotation.order = 'YXZ';
    deck.rotation.y = Math.PI;
    deck.rotation.x = o.raised ? -1.25 : 0;
    deck.userData.dynamic = true;
    deck.add(box(2.6, 0.14, 6.4, WOOD, { p: [0, 0, 3.2] }));
    for (let i = 0; i < 9; i++) deck.add(box(2.72, 0.045, 0.08, tint(WOOD_DARK, i % 2 ? 0.04 : 0), { p: [0, 0.09, 0.3 + i * 0.72], cast: false }));
    for (const x of [-1.2, 1.2]) {
      deck.add(box(0.14, 0.18, 6.35, WOOD_DARK, { p: [x, 0.18, 3.2] }));
      deck.add(box(0.12, 0.58, 0.12, WOOD_DARK, { p: [x, 0.45, 1.1] }));
      deck.add(box(0.12, 0.58, 0.12, WOOD_DARK, { p: [x, 0.45, 3.2] }));
      deck.add(box(0.12, 0.58, 0.12, WOOD_DARK, { p: [x, 0.45, 5.3] }));
      deck.add(box(0.1, 0.08, 5.0, WOOD_LIGHT, { p: [x, 0.76, 3.2], cast: false }));
      deck.add(tube([[x, 1.95, 0.1], [x, 1.25, 2.7], [x, 0.35, 6.15]], 0.025, '#5f6268', { radial: 5, seg: 10 }));
    }
    g.add(deck);
    return g;
  },
  colliders: [
    { kind: 'box', w: 3.7, d: 1.0, at: [0, -3.45] },
    { kind: 'box', w: 3.7, d: 1.0, at: [0, 3.45] },
  ],
  height: 2.85,
  tags: ['forest', 'bridge'],
  desc: 'Cầu kéo rừng (deck có ray và xích)',
  variants: [{ raised: false }, { raised: true }],
});

defineModel('boulder', {
  build: () => {
    const g = new THREE.Group();
    g.add(dodeca(1.15, PAL.rock, { p: [0, 0.95, 0], s: [1.25, 0.9, 1.05], r: [12, 25, -8] }));
    g.add(dodeca(0.65, tint(PAL.rock, -0.05), { p: [0.75, 0.65, 0.15], r: [25, 80, 5] }));
    g.add(dodeca(0.55, tint(PAL.rock, 0.04), { p: [-0.65, 0.55, 0.35], r: [-15, 30, 20] }));
    for (const [x, y, z, rr] of [[0.1, 1.1, 0.96, 20], [-0.42, 0.86, 1.0, -35], [0.58, 0.72, 0.92, 50]] as [number, number, number, number][]) {
      g.add(box(0.06, 0.7, 0.035, '#5e5960', { p: [x, y, z], r: [0, 0, rr], cast: false }));
    }
    for (const [x, z] of [[-0.65, -0.45], [0.5, 0.55], [0.2, -0.7]] as [number, number][]) g.add(ico(0.18, '#70ad67', { p: [x, 0.28, z], s: [1.4, 0.35, 1], tint: true }));
    return g;
  },
  colliders: [{ kind: 'circle', r: 1.3 }],
  height: 2.05,
  tags: ['forest', 'obstacle'],
  desc: 'Tảng đá nứt chắn đường',
  variants: [{}],
});

defineModel<NumOpt>('number_stone', {
  build: (o) => {
    const c = o.color ?? '#4ecdc4';
    const g = new THREE.Group();
    g.add(cyl(0.68, 0.78, 0.5, tint(c, -0.02), { p: [0, 0.25, 0], seg: 14, s: [1, 1, 0.88] }));
    g.add(cyl(0.6, 0.62, 0.08, tint(c, 0.16), { p: [0, 0.52, 0], seg: 14, s: [1.12, 1, 0.92], cast: false }));
    g.add(dodeca(0.22, tint(c, -0.08), { p: [0.42, 0.36, -0.18], s: [1.2, 0.35, 0.8] }));
    const top = plaqueNumber(o.n, 0.92, '#fffbe8');
    top.rotation.x = -Math.PI / 2;
    top.position.set(0, 0.575, 0);
    g.add(top);
    const front = plaqueNumber(o.n, 0.58, '#fffbe8');
    front.position.set(0, 0.36, 0.61);
    g.add(front);
    return g;
  },
  colliders: [{ kind: 'circle', r: 0.7, top: 0.5 }],
  height: 0.85,
  tags: ['maze', 'choice'],
  desc: 'Đá đáp án có số lớn trên mặt tròn',
  variants: [{ n: 1, color: '#4ecdc4' }, { n: 5, color: '#ffd166' }, { n: 9, color: '#b197fc' }],
});

defineModel<{ len?: number; h?: number; flowers?: boolean }>('maze_wall', {
  build: (o) => makeHedge(o.len ?? 4, o.h ?? 2.2, !!o.flowers),
  colliders: (o) => [{ kind: 'box', w: o.len ?? 4, d: 0.9 }],
  height: (o) => (o.h ?? 2.2) + 0.35,
  tags: ['maze', 'wall'],
  desc: 'Tường mê cung bằng hàng rào cây',
  variants: [{ len: 4 }, { len: 2, flowers: true }, { len: 6, h: 2.4 }],
});

defineModel<NumOpt>('maze_door', {
  build: (o) => {
    const g = new THREE.Group();
    for (const x of [-1.05, 1.05]) {
      g.add(rbox(0.4, 2.35, 0.58, 0.09, STONE, { p: [x, 1.18, 0], seg: 2 }));
      g.add(box(0.52, 0.22, 0.66, '#c8bda6', { p: [x, 0.22, 0] }));
      g.add(box(0.52, 0.22, 0.66, '#c8bda6', { p: [x, 2.18, 0] }));
    }
    g.add(torus(1.05, 0.13, '#d8d0c2', { p: [0, 1.82, 0.02], arc: 180, seg: 8, ts: 18 }));
    g.add(rbox(2.35, 0.36, 0.58, 0.08, '#d8d0c2', { p: [0, 2.33, 0], seg: 2 }));
    g.add(box(0.38, 0.42, 0.66, '#efe3c8', { p: [0, 2.52, 0] }));
    const leaf = pivot([-0.78, 0, 0], [
      rbox(1.58, 1.82, 0.2, 0.06, o.color ?? '#d7a56d', { p: [0.79, 0.96, 0] }),
      box(1.46, 0.08, 0.22, WOOD_DARK, { p: [0.79, 1.5, 0.12], cast: false }),
      box(1.46, 0.08, 0.22, WOOD_DARK, { p: [0.79, 0.58, 0.12], cast: false }),
    ], 'door');
    leaf.userData.dynamic = true;
    const b1 = plaqueNumber(o.n, 0.82, '#fffbe8');
    b1.position.set(0.79, 1.25, 0.115);
    leaf.add(b1);
    const top = plaqueNumber(o.n, 0.68, '#fffbe8');
    top.rotation.x = -Math.PI / 2;
    top.position.set(0.79, 1.88, 0);
    leaf.add(top);
    const b2 = plaqueNumber(o.n, 0.82, '#fffbe8');
    b2.position.set(0.79, 1.25, -0.115);
    b2.rotation.y = Math.PI;
    leaf.add(b2);
    g.add(leaf);
    return g;
  },
  colliders: [
    { kind: 'box', w: 0.46, d: 0.7, at: [-1.05, 0] },
    { kind: 'box', w: 0.46, d: 0.7, at: [1.05, 0] },
    { kind: 'box', w: 1.65, d: 0.28, at: [0, 0] },
  ],
  height: 2.78,
  tags: ['maze', 'door'],
  desc: 'Cửa số trong mê cung với vòm đá (door)',
  variants: [{ n: 3, color: '#d7a56d' }, { n: 7, color: '#7aa7e0' }],
});

defineModel<{ text?: string; color?: string; w?: number }>('gate_arch', {
  build: (o) => {
    const w = o.w ?? 5;
    const c = o.color ?? '#7aa7e0';
    const g = new THREE.Group();
    for (const x of [-w / 2, w / 2]) {
      g.add(rbox(0.72, 2.95, 0.82, 0.12, STONE, { p: [x, 1.48, 0], seg: 2 }));
      g.add(cyl(0.42, 0.42, 0.18, '#c8bda6', { p: [x, 2.98, 0], seg: 10 }));
      g.add(prism(1.05, 0.5, 0.95, c, { p: [x, 3.08, 0], r: [0, 90, 0] }));
      g.add(group([box(0.06, 0.3, 0.06, WOOD_DARK), rbox(0.22, 0.22, 0.22, 0.04, '#ffe9a8', { p: [0, -0.2, 0], emissive: '#ffd36b', glow: 0.42, opacity: 0.9 })], { p: [x * 0.84, 2.1, 0.48] }));
    }
    g.add(rbox(w + 0.55, 0.45, 0.72, 0.13, WOOD_LIGHT, { p: [0, 2.78, 0], seg: 2 }));
    g.add(prism(w + 0.95, 0.72, 1.05, c, { p: [0, 3.0, 0] }));
    g.add(torus(w * 0.32, 0.055, '#7bd389', { p: [0, 2.58, 0.46], arc: 180, seg: 6, ts: 22, cast: false }));
    for (let i = 0; i < 9; i++) {
      const x = -w * 0.32 + (i * w * 0.64) / 8;
      g.add(ball(0.09, i % 2 ? '#ff9ec7' : '#ffd166', { p: [x, 2.55 + Math.sin(i) * 0.12, 0.49], seg: 6, cast: false }));
    }
    const front = signText(o.text ?? 'Rừng Thông Thái', 0.55, '#fff4d8');
    front.position.set(0, 2.78, 0.5);
    g.add(front);
    const back = clonePlate(front);
    back.rotation.y = Math.PI;
    back.position.set(0, 2.78, -0.5);
    g.add(back);
    return g;
  },
  colliders: (o) => {
    const w = o.w ?? 5;
    return [{ kind: 'box', w: 0.85, d: 1.0, at: [-w / 2, 0] }, { kind: 'box', w: 0.85, d: 1.0, at: [w / 2, 0] }];
  },
  height: 3.75,
  tags: ['gate', 'structure'],
  desc: 'Cổng vòm thân thiện có biển và đèn',
  variants: [{ text: 'Rừng Thông Thái', color: '#7aa7e0', w: 5 }, { text: 'Mê Cung Kỳ Bí', color: '#b197fc', w: 5.5 }],
});

defineModel('windmill', {
  build: () => {
    const g = new THREE.Group();
    g.add(cyl(0.85, 1.25, 4.8, '#fff3df', { p: [0, 2.4, 0], seg: 8 }));
    g.add(prism(2.7, 1.0, 2.2, '#ef8c7a', { p: [0, 4.55, 0] }));
    addWindow(g, 0, 2.8, 1.05, 0.45, 0.55, false);
    const hub = pivot([0, 4.2, 1.22], [], 'blades');
    hub.userData.dynamic = true;
    hub.userData.tick = (_dt: number, t: number) => { hub.rotation.z = t * 0.8; };
    hub.add(cyl(0.16, 0.16, 0.18, WOOD_DARK, { r: [90, 0, 0], seg: 10 }));
    for (let i = 0; i < 4; i++) hub.add(group([box(0.22, 1.65, 0.08, WOOD_LIGHT, { p: [0, 0.86, 0] }), box(0.55, 0.28, 0.06, '#fff4d8', { p: [0.18, 1.45, 0.01], cast: false })], { r: [0, 0, i * 90] }));
    g.add(hub);
    return g;
  },
  colliders: [{ kind: 'circle', r: 1.25 }],
  height: 5.6,
  tags: ['building', 'landmark'],
  desc: 'Cối xay gió (blades)',
  variants: [{}],
});

defineModel('fountain', {
  build: () => {
    const g = new THREE.Group();
    g.add(cyl(1.9, 2.05, 0.45, '#d8d0c2', { p: [0, 0.22, 0], seg: 24 }));
    g.add(ring(1.45, 1.98, '#eee5d3', { p: [0, 0.48, 0], seg: 28 }));
    g.add(cyl(1.35, 1.35, 0.03, PAL.water, { p: [0, 0.52, 0], seg: 28, opacity: 0.55, shiny: 70 }));
    g.add(cyl(0.65, 0.75, 0.85, '#e2d3b0', { p: [0, 0.88, 0], seg: 18 }));
    g.add(cyl(0.92, 0.98, 0.18, '#eee5d3', { p: [0, 1.36, 0], seg: 20 }));
    g.add(cyl(0.72, 0.72, 0.025, PAL.water, { p: [0, 1.47, 0], seg: 20, opacity: 0.55, shiny: 70 }));
    const water = pivot([0, 1.45, 0], [
      tube([[0, 0, 0], [0, 0.9, 0], [0, 1.15, 0]], 0.035, '#bff4ff', { opacity: 0.65, radial: 6 }),
      ball(0.12, '#d8fbff', { p: [0, 1.15, 0], opacity: 0.65, seg: 8, cast: false }),
    ], 'water');
    water.userData.dynamic = true;
    water.userData.tick = (_dt: number, t: number) => { water.scale.y = 0.88 + Math.sin(t * 4) * 0.12; };
    g.add(water);
    return g;
  },
  colliders: [{ kind: 'circle', r: 2.05 }],
  height: 2.75,
  tags: ['village', 'water'],
  desc: 'Đài phun nước (water)',
  variants: [{}],
});

defineModel('well', {
  build: () => {
    const g = new THREE.Group();
    g.add(cyl(0.85, 0.95, 0.85, STONE, { p: [0, 0.42, 0], seg: 14, open: true }));
    g.add(ring(0.62, 0.96, '#efe3c8', { p: [0, 0.9, 0], seg: 16 }));
    for (const x of [-0.7, 0.7]) g.add(cyl(0.07, 0.08, 1.8, WOOD_DARK, { p: [x, 1.55, 0], seg: 6 }));
    g.add(prism(1.9, 0.65, 1.35, '#ef8c7a', { p: [0, 2.25, 0] }));
    const bucket = group([cyl(0.18, 0.22, 0.3, '#b98552', { p: [0, 0, 0], seg: 8 }), torus(0.18, 0.015, '#5f564f', { p: [0, 0.2, 0], r: [90, 0, 0], arc: 180, cast: false })], { p: [0, 1.05, 0.2], name: 'bucket' });
    g.add(bucket);
    return g;
  },
  colliders: [{ kind: 'circle', r: 1.0 }],
  height: 2.65,
  tags: ['village', 'structure'],
  desc: 'Giếng nước (bucket)',
  variants: [{}],
});

defineModel('notice_board', {
  build: () => {
    const g = new THREE.Group();
    for (const x of [-1.0, 1.0]) g.add(cyl(0.08, 0.1, 1.5, WOOD_DARK, { p: [x, 0.75, -0.05], seg: 6 }));
    g.add(rbox(2.5, 1.45, 0.18, 0.07, WOOD, { p: [0, 1.55, 0] }));
    const colors = ['#fff4d8', '#c5f6fa', '#ffd6e7', '#d8f5a2'];
    for (let i = 0; i < 4; i++) g.add(box(0.62, 0.48, 0.025, colors[i], { p: [-0.72 + (i % 2) * 1.25, 1.72 - Math.floor(i / 2) * 0.58, 0.11], r: [0, 0, i % 2 ? 4 : -5], cast: false }));
    const bang = textPlate('!', 0.62, { bg: '#ffd166', color: '#8a5a3b', border: '#ffffff', w: 160, h: 180 });
    bang.position.set(0, 2.18, 0.13);
    g.add(bang);
    return g;
  },
  colliders: [{ kind: 'box', w: 2.6, d: 0.35 }],
  height: 2.45,
  tags: ['sign', 'quest'],
  desc: 'Bảng thông báo nhiệm vụ',
  variants: [{}],
});

defineModel('zoo_gate', {
  build: () => {
    const g = new THREE.Group();
    for (const x of [-2.35, 2.35]) {
      g.add(rbox(0.72, 3.0, 0.82, 0.12, '#efe3c8', { p: [x, 1.5, 0] }));
      const ears = animalEarPair(x < 0 ? '#ffd166' : '#ff9ec7');
      ears.position.set(x, 3.15, 0.1);
      g.add(ears);
    }
    g.add(rbox(5.3, 0.58, 0.8, 0.13, '#7bd389', { p: [0, 3.0, 0] }));
    const sign = signText('SỞ THÚ', 0.52, '#ffd166');
    sign.position.set(0, 3.05, 0.44);
    g.add(sign);
    const gateL = pivot([-2.0, 0, 0.04], [rbox(1.95, 1.45, 0.16, 0.05, '#d7a56d', { p: [0.98, 0.82, 0] }), box(0.09, 1.35, 0.18, WOOD_DARK, { p: [0.35, 0.82, 0.08] }), box(0.09, 1.35, 0.18, WOOD_DARK, { p: [1.6, 0.82, 0.08] })], 'gateL');
    const gateR = pivot([2.0, 0, 0.04], [rbox(1.95, 1.45, 0.16, 0.05, '#d7a56d', { p: [-0.98, 0.82, 0] }), box(0.09, 1.35, 0.18, WOOD_DARK, { p: [-0.35, 0.82, 0.08] }), box(0.09, 1.35, 0.18, WOOD_DARK, { p: [-1.6, 0.82, 0.08] })], 'gateR');
    gateL.userData.dynamic = true;
    gateR.userData.dynamic = true;
    g.add(gateL, gateR);
    g.add(group([cyl(0.1, 0.1, 0.8, '#8a5a3b', { p: [0, 0.4, 0.55], seg: 8 }), box(1.0, 0.08, 0.08, '#8a5a3b', { p: [0, 0.8, 0.55] }), box(0.08, 0.08, 1.0, '#8a5a3b', { p: [0, 0.8, 0.55] })], { p: [0, 0, 0] }));
    return g;
  },
  colliders: [
    { kind: 'box', w: 0.85, d: 1.0, at: [-2.35, 0] },
    { kind: 'box', w: 0.85, d: 1.0, at: [2.35, 0] },
    { kind: 'box', w: 1.95, d: 0.25, at: [-1.02, 0] },
    { kind: 'box', w: 1.95, d: 0.25, at: [1.02, 0] },
  ],
  height: 3.7,
  tags: ['zoo', 'gate'],
  desc: 'Cổng Sở Thú Kỳ Diệu (gateL, gateR)',
  variants: [{}],
});

defineModel<{ w?: number; d?: number }>('enclosure', {
  build: (o) => {
    const w = o.w ?? 8;
    const d = o.d ?? 6;
    const g = new THREE.Group();
    const post = (x: number, z: number) => g.add(cyl(0.08, 0.1, 1.1, WOOD_DARK, { p: [x, 0.55, z], seg: 6 }));
    for (const x of [-w / 2, w / 2]) for (let i = 0; i <= 4; i++) post(x, -d / 2 + (i * d) / 4);
    for (const z of [-d / 2, d / 2]) for (let i = 1; i < 4; i++) post(-w / 2 + (i * w) / 4, z);
    for (const z of [-d / 2, d / 2]) for (const y of [0.45, 0.85]) g.add(box(w, 0.09, 0.12, WOOD, { p: [0, y, z] }));
    for (const x of [-w / 2, w / 2]) for (const y of [0.45, 0.85]) g.add(box(0.12, 0.09, d, WOOD, { p: [x, y, 0] }));
    const sign = group([cyl(0.05, 0.06, 0.8, WOOD_DARK, { p: [0, 0.4, 0], seg: 6 }), signText('?', 0.32, '#fff4d8')], { p: [0, 0, d / 2 + 0.35], name: 'sign' });
    sign.children[1].position.set(0, 1.0, 0.05);
    g.add(sign);
    return g;
  },
  colliders: (o) => {
    const w = o.w ?? 8, d = o.d ?? 6;
    return [
      { kind: 'box', w, d: 0.25, at: [0, d / 2] },
      { kind: 'box', w, d: 0.25, at: [0, -d / 2] },
      { kind: 'box', w: 0.25, d, at: [w / 2, 0] },
      { kind: 'box', w: 0.25, d, at: [-w / 2, 0] },
    ];
  },
  height: 1.4,
  tags: ['zoo', 'fence'],
  desc: 'Chuồng thú hàng rào (sign)',
  variants: [{ w: 8, d: 6 }, { w: 6, d: 5 }],
});

defineModel('ticket_booth', {
  build: () => {
    const g = new THREE.Group();
    g.add(rbox(1.8, 2.0, 1.5, 0.08, '#fff4d8', { p: [0, 1.0, 0] }));
    g.add(rbox(1.15, 0.75, 0.1, 0.06, '#9be7ff', { p: [0, 1.25, 0.78], shiny: 70 }));
    g.add(prism(2.25, 0.65, 1.85, '#ff6b6b', { p: [0, 2.0, 0] }));
    for (let i = 0; i < 5; i++) g.add(box(0.42, 0.06, 1.95, i % 2 ? '#ffffff' : '#ffd166', { p: [-0.84 + i * 0.42, 2.1, 0], r: [0, 0, 0], cast: false }));
    const s = signText('VÉ', 0.34, '#ffd166');
    s.position.set(0, 2.35, 0.96);
    g.add(s);
    return g;
  },
  colliders: [{ kind: 'box', w: 2.0, d: 1.7 }],
  height: 2.7,
  tags: ['zoo', 'building'],
  desc: 'Quầy vé sở thú',
  variants: [{}],
});

defineModel('penguin_pool', {
  build: () => {
    const g = new THREE.Group();
    g.add(cyl(2.05, 2.2, 0.35, '#d8f5ff', { p: [0, 0.18, 0], seg: 24, s: [1.45, 1, 0.95] }));
    g.add(cyl(1.75, 1.75, 0.03, '#8fd8e6', { p: [0, 0.38, 0], seg: 24, s: [1.48, 1, 0.95], opacity: 0.55, shiny: 70 }));
    for (const [x, z, s] of [[-1.0, 0.25, 0.55], [0.8, -0.5, 0.42], [0.3, 0.8, 0.36]] as [number, number, number][]) g.add(cyl(s, s * 0.95, 0.06, '#ffffff', { p: [x, 0.43, z], seg: 9, s: [1.2, 1, 0.75] }));
    g.add(group([box(0.7, 0.12, 1.7, '#74c0fc', { p: [0, 0.55, 0] }), box(0.82, 0.12, 0.12, '#ffffff', { p: [0, 0.64, 0.7] })], { p: [-2.1, 0.15, -0.25], r: [0, 0, -25] }));
    return g;
  },
  colliders: [
    { kind: 'box', w: 6.1, d: 0.35, at: [0, 2.0] },
    { kind: 'box', w: 6.1, d: 0.35, at: [0, -2.0] },
    { kind: 'box', w: 0.35, d: 4.1, at: [3.0, 0] },
    { kind: 'box', w: 0.35, d: 4.1, at: [-3.0, 0] },
  ],
  height: 1.15,
  tags: ['zoo', 'water'],
  desc: 'Hồ chim cánh cụt',
  variants: [{}],
});

defineModel('tent_camp', {
  build: () => {
    const g = new THREE.Group();
    g.add(prism(2.8, 1.65, 2.35, '#4ecdc4', { p: [0, 0, 0], r: [0, 90, 0] }));
    for (const x of [-0.8, 0, 0.8]) g.add(box(0.18, 0.06, 2.42, x ? '#8ee6dd' : '#fff4d8', { p: [x, 1.02, 0], r: [0, 0, x < 0 ? -32 : 32], cast: false }));
    g.add(panel(1.8, 1.3, '#35aaa6', { p: [0, 0.68, 1.2] }));
    g.add(panel(0.55, 1.0, '#fff4d8', { p: [-0.28, 0.48, 1.22], r: [0, -18, 8] }));
    g.add(panel(0.55, 1.0, '#ffe2a8', { p: [0.28, 0.48, 1.23], r: [0, 18, -8] }));
    g.add(box(3.1, 0.08, 0.12, '#8a5a3b', { p: [0, 0.06, 1.28] }));
    for (const x of [-1.6, 1.6]) {
      g.add(tube([[x * 0.55, 1.25, 0.9], [x, 0.12, 1.75]], 0.015, '#f7f0e8', { radial: 4, cast: false }));
      g.add(box(0.12, 0.08, 0.28, WOOD_DARK, { p: [x, 0.04, 1.8], r: [0, 25, 0] }));
      g.add(tube([[x * 0.55, 1.25, -0.9], [x, 0.12, -1.75]], 0.015, '#f7f0e8', { radial: 4, cast: false }));
      g.add(box(0.12, 0.08, 0.28, WOOD_DARK, { p: [x, 0.04, -1.8], r: [0, -25, 0] }));
    }
    g.add(group([box(0.06, 0.75, 0.06, WOOD_DARK, { p: [0, 0.38, 0] }), rbox(0.25, 0.28, 0.25, 0.04, '#ffe9a8', { p: [0, 0.82, 0], emissive: '#ffd36b', glow: 0.45, opacity: 0.9 })], { p: [-1.45, 0, 1.05] }));
    const flame = pivot([1.85, 0.22, 1.15], [
      ...[0, 1, 2, 3, 4, 5].map((i) => dodeca(0.13, '#bfbab2', { p: [Math.cos(i * 1.05) * 0.38, -0.08, Math.sin(i * 1.05) * 0.38], s: [1, 0.55, 1], r: [0, i * 20, 0] })),
      ...[0, 1, 2].map((i) => cyl(0.055, 0.055, 0.68, WOOD_DARK, { p: [Math.cos(i * 2.1) * 0.16, -0.03, Math.sin(i * 2.1) * 0.16], r: [80, i * 60, 0], seg: 6 })),
      cone(0.24, 0.58, '#ff9f43', { p: [0, 0.28, 0], seg: 7, emissive: '#ff7a2f', glow: 0.6 }),
      cone(0.14, 0.44, '#ffd166', { p: [0, 0.33, 0.02], seg: 7, emissive: '#ffd166', glow: 0.8 }),
    ], 'flame');
    flame.userData.dynamic = true;
    flame.userData.tick = (_dt: number, t: number) => { const s = 1 + Math.sin(t * 9) * 0.08; flame.scale.set(s, 1 + Math.sin(t * 11) * 0.12, s); };
    g.add(flame);
    return g;
  },
  colliders: [{ kind: 'box', w: 2.9, d: 2.55 }],
  height: 1.85,
  tags: ['forest', 'camp'],
  desc: 'Lều trại rừng có dây neo, đèn và lửa (flame)',
  variants: [{}],
});

import * as THREE from 'three';
import { around, ball, box, capsule, cone, cyl, DEG, disc, extrude, group, heartShape, ico, lathe, panel, pivot, rbox, ring, starShape, torus, tube } from '../engine/kit';
import { PAL, tint } from '../engine/materials';
import { numberBadge, textPlate } from '../engine/text';
import { PLANTS } from '../core/items';
import { defineModel } from './registry';

type ColorOpts = { color?: string };
type ChestOpts = { color?: string; open?: boolean };
type BallOpts = { n?: number | string; color?: string };
type PlantOpts = { stage?: number };

const GOLD = '#ffcf3f';
const GOLD_DARK = '#c98a2c';
const INK = '#2b2233';
const WOOD = '#b98552';
const WOOD_DARK = '#8a5a3b';
const SOIL = '#5b3b2e';

function named<T extends THREE.Object3D>(o: T, name: string): T { o.name = name; return o; }
function makeTextPlate(text: string, h: number, p: [number, number, number], r: [number, number, number] = [0, 0, 0]): THREE.Mesh {
  const m = textPlate(text, h, { bg: '#fff8ee', color: INK, border: GOLD, size: 90, pad: 16 });
  m.position.set(...p);
  m.rotation.set(r[0] * DEG, r[1] * DEG, r[2] * DEG);
  return m;
}

function bananaShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-0.36, -0.11);
  s.bezierCurveTo(-0.12, -0.35, 0.28, -0.26, 0.43, 0.05);
  s.bezierCurveTo(0.25, -0.04, -0.08, 0.02, -0.26, 0.21);
  s.bezierCurveTo(-0.34, 0.13, -0.39, 0.02, -0.36, -0.11);
  return s;
}

function pickupStar(): THREE.Group {
  return group([
    extrude('pickupStarBigV2', () => starShape(0.46, 0.2), 0.24, GOLD, { bevel: 0.055, emissive: GOLD, glow: 0.42, shiny: 100 }),
    extrude('pickupStarInnerV2', () => starShape(0.27, 0.11), 0.27, '#fff2a8', { p: [0, 0.01, 0.035], bevel: 0.018, emissive: '#fff2a8', glow: 0.55, shiny: 100 }),
    extrude('pickupStarInnerBackV2', () => starShape(0.22, 0.09), 0.03, '#fff8cf', { p: [0, 0, -0.14], bevel: 0.01, emissive: '#fff8cf', glow: 0.3, shiny: 80 }),
  ]);
}
function pickupCoin(): THREE.Group {
  return group([
    cyl(0.39, 0.39, 0.18, GOLD, { r: [90, 0, 0], seg: 32, shiny: 95, emissive: GOLD, glow: 0.22 }),
    torus(0.33, 0.035, '#fff2a8', { ts: 32, seg: 7, p: [0, 0, 0.105], shiny: 95, emissive: '#fff2a8', glow: 0.25 }),
    torus(0.33, 0.025, GOLD_DARK, { ts: 32, seg: 6, p: [0, 0, -0.102], shiny: 80 }),
    extrude('coinStarV2', () => starShape(0.2, 0.085), 0.045, '#fff2a8', { p: [0, 0, 0.12], bevel: 0.01, emissive: '#fff2a8', glow: 0.35, shiny: 90 }),
  ]);
}
function pickupKey(): THREE.Group {
  return group([
    torus(0.19, 0.055, GOLD, { p: [-0.25, 0.1, 0], ts: 28, seg: 8, shiny: 95, emissive: GOLD, glow: 0.2 }),
    torus(0.09, 0.025, '#fff2a8', { p: [-0.25, 0.1, 0.065], ts: 20, seg: 6, shiny: 90 }),
    rbox(0.62, 0.11, 0.14, 0.04, GOLD, { p: [0.12, 0.1, 0], shiny: 95, emissive: GOLD, glow: 0.16 }),
    rbox(0.11, 0.22, 0.14, 0.025, GOLD, { p: [0.43, -0.02, 0], shiny: 95 }),
    rbox(0.12, 0.15, 0.14, 0.025, GOLD, { p: [0.56, 0.015, 0], shiny: 95 }),
  ]);
}
function pickupTicket(): THREE.Group {
  return group([
    rbox(0.78, 0.44, 0.13, 0.08, '#ff9ec7', { shiny: 45, emissive: '#ff9ec7', glow: 0.18 }),
    rbox(0.48, 0.3, 0.035, 0.04, '#ffd166', { p: [0, 0, 0.083], shiny: 45, emissive: '#ffd166', glow: 0.06 }),
    ...[-0.38, 0.38].map((x) => cyl(0.09, 0.09, 0.145, '#fff8ee', { p: [x, 0, 0.06], r: [90, 0, 0], seg: 16, cast: false })),
    ball(0.07, INK, { p: [0, 0.055, 0.115], seg: 8, cast: false }),
    ...[-0.095, 0.095, -0.055, 0.055].map((v, i) => ball(0.043, INK, { p: [i < 2 ? v : 0, i < 2 ? -0.055 : v - 0.035, 0.116], seg: 7, cast: false })),
  ]);
}
function pickupGift(o: ColorOpts): THREE.Group {
  const c = o.color ?? '#6cb8ff';
  return group([
    rbox(0.48, 0.46, 0.48, 0.055, c, { shiny: 45, emissive: c, glow: 0.08 }),
    box(0.11, 0.5, 0.53, '#ffd166', { shiny: 60 }),
    box(0.53, 0.5, 0.11, '#ffd166', { shiny: 60 }),
    box(0.56, 0.08, 0.56, tint(c, 0.06), { p: [0, 0.27, 0] }),
    torus(0.12, 0.035, '#ffd166', { p: [-0.1, 0.38, 0], r: [0, 90, 0], ts: 18, shiny: 70 }),
    torus(0.12, 0.035, '#ffd166', { p: [0.1, 0.38, 0], r: [0, 90, 0], ts: 18, shiny: 70 }),
    rbox(0.16, 0.09, 0.16, 0.04, '#fff2a8', { p: [0, 0.39, 0], shiny: 80 }),
    capsule(0.035, 0.18, '#ffd166', { p: [-0.18, 0.36, 0.05], r: [0, 0, 45], seg: 8, shiny: 80 }),
    capsule(0.035, 0.18, '#ffd166', { p: [0.18, 0.36, 0.05], r: [0, 0, -45], seg: 8, shiny: 80 }),
  ]);
}
function apple(): THREE.Group {
  return group([ball(0.28, '#ff5a5f', { seg: 16, flat: false, shiny: 50, emissive: '#ff5a5f', glow: 0.08 }), ball(0.16, '#ff6b6b', { p: [-0.12, 0.06, 0], seg: 12, flat: false }), cyl(0.025, 0.035, 0.18, WOOD_DARK, { p: [0.04, 0.31, 0], r: [0, 0, -25], seg: 6 }), box(0.18, 0.045, 0.09, PAL.leaf2, { p: [0.16, 0.31, 0], r: [0, 20, -20] })]);
}
function banana(): THREE.Group {
  return group([
    extrude('pickupBananaCrescent', bananaShape, 0.13, '#ffd166', { bevel: 0.025, emissive: '#ffd166', glow: 0.12, shiny: 45 }),
    extrude('pickupBananaLight', () => {
      const s = bananaShape();
      return s;
    }, 0.03, '#fff0a3', { p: [0.02, 0.03, 0.08], s: 0.72, bevel: 0.006, emissive: '#fff0a3', glow: 0.08 }),
    ball(0.055, '#8a5a3b', { p: [-0.34, -0.08, 0.075], s: [1, 0.7, 0.6], seg: 7 }),
    ball(0.05, '#8a5a3b', { p: [0.39, 0.05, 0.075], s: [1, 0.7, 0.6], seg: 7 }),
  ]);
}
function fish(): THREE.Group {
  return group([
    ball(0.27, '#4ecdc4', { s: [1.45, 0.82, 0.72], seg: 16, flat: false, shiny: 55, emissive: '#4ecdc4', glow: 0.12 }),
    cone(0.18, 0.28, '#ff9f43', { p: [-0.36, 0, 0], r: [0, 0, 90], seg: 3, shiny: 35 }),
    cone(0.1, 0.18, '#ffd166', { p: [0.02, 0.22, 0], r: [0, 0, 20], seg: 3, shiny: 35 }),
    cone(0.09, 0.16, '#ffd166', { p: [0.02, -0.2, 0], r: [180, 0, -20], seg: 3, shiny: 35 }),
    ball(0.052, INK, { p: [0.27, 0.08, 0.16], seg: 8, shiny: 80 }),
    ball(0.018, '#ffffff', { p: [0.29, 0.095, 0.19], seg: 6, shiny: 80 }),
    ball(0.035, '#ff9ec7', { p: [0.31, -0.07, 0.16], seg: 7 }),
  ]);
}
function heart(): THREE.Group {
  return group([
    extrude('pickupHeartV2', () => heartShape(0.76), 0.22, '#ff5c9a', { bevel: 0.05, emissive: '#ff5c9a', glow: 0.32, shiny: 100 }),
    extrude('pickupHeartHi', () => heartShape(0.34), 0.03, '#ffc1d8', { p: [-0.1, 0.12, 0.13], bevel: 0.01, emissive: '#ffc1d8', glow: 0.28, shiny: 90 }),
  ]);
}

const pickupBuilders: Record<string, (o: ColorOpts) => THREE.Group> = { star: () => pickupStar(), coin: () => pickupCoin(), key: () => pickupKey(), ticket: () => pickupTicket(), gift: pickupGift, apple: () => apple(), banana: () => banana(), fish: () => fish(), heart: () => heart() };
for (const [key, build] of Object.entries(pickupBuilders)) {
  defineModel<ColorOpts>(`pickup_${key}`, {
    build,
    height: 0.8,
    tags: ['pickup'],
    desc: `Vật phẩm nhặt được ${key}, tâm thị giác ở y=0 để hệ thống nổi/quay/bob`,
    variants: key === 'gift' ? [{ color: '#6cb8ff' }, { color: '#ff9ec7' }, { color: '#7bd389' }] : [{}],
  });
}

function chest(o: ChestOpts): THREE.Group {
  const c = o.color ?? '#b98552';
  const g = new THREE.Group();
  g.add(rbox(0.9, 0.48, 0.62, 0.06, c, { p: [0, 0.24, 0] }));
  g.add(box(0.96, 0.1, 0.68, GOLD, { p: [0, 0.22, 0], shiny: 80 }));
  g.add(box(0.1, 0.52, 0.68, GOLD, { p: [-0.32, 0.28, 0], shiny: 80 }));
  g.add(box(0.1, 0.52, 0.68, GOLD, { p: [0.32, 0.28, 0], shiny: 80 }));
  const lid = pivot([0, 0.56, -0.31], [
    rbox(0.94, 0.34, 0.62, 0.08, tint(c, 0.05), { p: [0, 0.08, 0.31] }),
    box(0.99, 0.07, 0.68, GOLD, { p: [0, 0.17, 0.31], shiny: 80 }),
  ], 'lid');
  lid.rotation.x = (o.open ? -58 : 0) * DEG;
  g.add(lid);
  g.add(rbox(0.18, 0.22, 0.08, 0.025, GOLD, { p: [0, 0.42, 0.35], shiny: 90 }));
  return g;
}
defineModel<ChestOpts>('chest', { build: chest, colliders: [{ kind: 'box', w: 0.95, d: 0.7, top: 0.75 }], height: 0.9, tags: ['pickup'], desc: 'Rương kho báu; node lid xoay quanh mép sau trên, option open:true', variants: [{ color: '#b98552' }, { color: '#7ec8e3', open: true }] });

function countBox(o: ColorOpts): THREE.Group {
  const c = o.color ?? '#ff9ec7';
  return group([rbox(0.7, 0.66, 0.7, 0.06, c, { p: [0, 0.33, 0] }), box(0.76, 0.1, 0.76, tint(c, 0.07), { p: [0, 0.69, 0] }), box(0.12, 0.72, 0.78, '#ffd166', { p: [0, 0.36, 0] }), box(0.78, 0.72, 0.12, '#ffd166', { p: [0, 0.36, 0] })]);
}
defineModel<ColorOpts>('count_box', { build: countBox, colliders: [{ kind: 'box', w: 0.72, d: 0.72, top: 0.7 }], height: 0.75, tags: ['pickup'], desc: 'Hộp đếm đầu game, option color', variants: [{ color: '#ff9ec7' }, { color: '#6cb8ff' }, { color: '#7bd389' }] });

function mathBall(o: BallOpts): THREE.Group {
  const n = o.n ?? 12;
  const c = o.color ?? '#6cb8ff';
  const b1 = numberBadge(n, 0.43, { bg: '#fff8ee', color: INK, border: GOLD }); b1.position.set(0, 0, 0.323);
  const b2 = numberBadge(n, 0.43, { bg: '#fff8ee', color: INK, border: GOLD }); b2.position.set(0, 0, -0.323); b2.rotation.y = Math.PI;
  const b3 = numberBadge(n, 0.37, { bg: '#fff8ee', color: INK, border: '#4ecdc4' }); b3.position.set(0.323, 0, 0); b3.rotation.y = Math.PI / 2;
  const b4 = numberBadge(n, 0.37, { bg: '#fff8ee', color: INK, border: '#4ecdc4' }); b4.position.set(-0.323, 0, 0); b4.rotation.y = -Math.PI / 2;
  return group([ball(0.33, c, { seg: 18, flat: false, shiny: 55 }), torus(0.33, 0.018, '#fff8ee', { r: [90, 0, 0], ts: 32 }), torus(0.33, 0.014, tint(c, -0.12), { r: [0, 90, 0], ts: 32 }), b1, b2, b3, b4]);
}
defineModel<BallOpts>('math_ball', { build: mathBall, colliders: [{ kind: 'circle', r: 0.32, top: 0.6 }], height: 0.7, tags: ['pickup'], desc: 'Bóng số; numberBadge ở trước/sau/trái/phải để đọc từ mọi hướng', variants: [12, 15, 18, 20, 25].map((n, i) => ({ n, color: ['#6cb8ff', '#ff9ec7', '#ffd166', '#7bd389', '#b197fc'][i] })) });

function planter(): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(1.65, 0.28, 1.65, 0.06, WOOD, { p: [0, 0.14, 0] }));
  g.add(rbox(1.25, 0.08, 1.25, 0.03, SOIL, { p: [0, 0.31, 0] }));
  for (const s of [-1, 1]) {
    g.add(box(1.7, 0.18, 0.18, WOOD_DARK, { p: [0, 0.22, s * 0.78] }));
    g.add(box(0.18, 0.18, 1.7, WOOD_DARK, { p: [s * 0.78, 0.22, 0] }));
  }
  g.userData.plantY = 0.25;
  return g;
}
defineModel('planter', { build: planter, colliders: [{ kind: 'box', w: 1.65, d: 1.65, top: 0.32 }], height: 0.35, tags: ['pickup'], desc: 'Ô vườn gỗ; userData.plantY=0.25 là cao độ đặt cây' });

function seedMound(): THREE.Group {
  return group([ball(0.28, SOIL, { p: [0, 0.06, 0], s: [1.2, 0.35, 1], seg: 10 }), cyl(0.018, 0.025, 0.18, PAL.leaf2, { p: [0, 0.18, 0], seg: 5 }), box(0.12, 0.04, 0.055, PAL.leaf1, { p: [0.06, 0.27, 0], r: [0, 0, -25] })]);
}
function leaves(height: number, count: number): THREE.Object3D[] {
  return Array.from({ length: count }, (_, i) => {
    const y = 0.16 + (height - 0.2) * (i / Math.max(1, count - 1));
    const a = i * 137.5 * DEG;
    return box(0.28, 0.055, 0.09, i % 2 ? PAL.leaf2 : PAL.leaf1, { p: [Math.cos(a) * 0.1, y, Math.sin(a) * 0.1], r: [0, a / DEG, i % 2 ? 22 : -22] });
  });
}
function plantSunflower(stage: number, max: number): THREE.Group {
  if (stage <= 0) return seedMound();
  const t = stage / max;
  const h = 0.35 + t * 0.95;
  const kids: THREE.Object3D[] = [
    cyl(0.04, 0.055, h, PAL.leaf2, { p: [0, h / 2, 0], seg: 6 }),
    ...leaves(h, Math.min(5, 3 + stage)),
    box(0.38, 0.09, 0.08, PAL.leaf1, { p: [-0.22, h * 0.42, 0.02], r: [0, 0, 22] }),
    box(0.42, 0.1, 0.08, PAL.leaf2, { p: [0.24, h * 0.58, 0.02], r: [0, 0, -24] }),
  ];
  if (stage >= max) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      kids.push(ball(0.105, '#ffd166', { p: [Math.cos(a) * 0.22, h + Math.sin(a) * 0.22, 0.08], s: [1.45, 0.72, 0.5], r: [0, 0, a / DEG], seg: 8, emissive: '#ffd166', glow: 0.12 }));
    }
    kids.push(ball(0.17, '#6b4226', { p: [0, h, 0.14], s: [1, 1, 0.45], seg: 12, shiny: 25 }));
  }
  return group(kids);
}
function plantTomato(stage: number, max: number): THREE.Group {
  if (stage <= 0) return seedMound();
  const t = stage / max;
  const h = 0.35 + t * 0.75;
  const kids: THREE.Object3D[] = [
    cyl(0.035, 0.045, h, PAL.leaf3, { p: [0, h / 2, 0], seg: 6 }),
    cyl(0.025, 0.03, h + 0.25, WOOD_DARK, { p: [0.15, (h + 0.25) / 2, -0.05], seg: 5 }),
    ...leaves(h, 8 + stage * 2),
  ];
  for (let i = 0; i < 5 + stage; i++) {
    const a = (i / (5 + stage)) * Math.PI * 2;
    kids.push(ico(0.14 + t * 0.04, i % 2 ? PAL.leaf1 : PAL.leaf3, { p: [Math.cos(a) * (0.16 + t * 0.12), 0.3 + t * 0.38 + Math.sin(i) * 0.08, Math.sin(a) * (0.12 + t * 0.08)], s: [1.2, 0.7, 1], r: [20, a / DEG, 0] }));
  }
  if (stage >= max) for (const [x, y, z] of [[-0.15, h * 0.75, 0.12], [0.12, h * 0.55, 0.14], [0.02, h * 0.9, -0.12]] as const) kids.push(ball(0.105, '#ff5a5f', { p: [x, y, z], seg: 10, flat: false, shiny: 35 }));
  return group(kids);
}
function plantStrawberry(stage: number, max: number): THREE.Group {
  if (stage <= 0) return seedMound();
  const t = stage / max;
  const kids: THREE.Object3D[] = [];
  const leafCount = Math.min(7, 4 + stage);
  for (let i = 0; i < leafCount; i++) {
    const a = (i / leafCount) * Math.PI * 2;
    kids.push(ico(0.16 + t * 0.04, i % 2 ? PAL.leaf1 : PAL.leaf2, { p: [Math.cos(a) * (0.18 + t * 0.18), 0.16 + t * 0.08, Math.sin(a) * (0.16 + t * 0.15)], s: [1.35, 0.45, 0.9], r: [10, a / DEG, 0] }));
  }
  if (stage >= 2) {
    for (const [x, z] of [[-0.18, 0.18], [0.2, 0.08]] as const) {
      kids.push(ball(0.055, '#ffffff', { p: [x, 0.32, z + 0.01], s: [1.25, 0.45, 1], seg: 6, cast: false }));
      kids.push(ball(0.025, GOLD, { p: [x, 0.32, z + 0.015], seg: 6, cast: false }));
    }
  }
  if (stage >= max) for (const [x, z] of [[-0.22, 0.16], [0.18, 0.2], [0.08, -0.24]] as const) {
    kids.push(cone(0.085, 0.16, '#ff4d6d', { p: [x, 0.28, z], r: [180, 0, 0], seg: 10, shiny: 35 }));
    kids.push(ball(0.012, '#fff2a8', { p: [x, 0.28, z + 0.07], seg: 5, cast: false }));
  }
  return group(kids);
}
function plantMagic(stage: number, max: number): THREE.Group {
  if (stage <= 0) return seedMound();
  const t = stage / max;
  const h = 0.36 + t * 0.95;
  const kids: THREE.Object3D[] = [
    tube([[0, 0, 0], [0.08, h * 0.32, 0.02], [-0.06, h * 0.68, -0.02], [0.02, h, 0]], 0.055 + t * 0.035, '#8a5a3b', { radial: 7, seg: 14 }),
    box(0.28, 0.07, 0.1, PAL.leaf3, { p: [-0.12, h * 0.45, 0.03], r: [0, 0, 25] }),
  ];
  const scale = 0.55 + t * 0.55;
  const blobs: [number, number, number, string, number][] = [
    [0, h + 0.2 * scale, 0, '#b197fc', 0.28 * scale],
    [-0.24 * scale, h + 0.04 * scale, 0.04, '#ff9ec7', 0.23 * scale],
    [0.25 * scale, h + 0.02 * scale, -0.02, '#4ecdc4', 0.22 * scale],
    [0.05, h + 0.34 * scale, 0.05, '#d0c4f7', 0.2 * scale],
  ];
  for (const [x, y, z, c, r] of blobs.slice(0, Math.min(3, 1 + stage))) kids.push(ball(r, c, { p: [x, y, z], seg: 14, flat: false, emissive: c, glow: 0.16, shiny: 35 }));
  if (stage >= max) {
    for (const [x, y, z] of [[0.22, h + 0.25, 0.22], [-0.23, h + 0.05, 0.2], [0.04, h + 0.42, -0.2]] as const) {
      kids.push(extrude('magicFruitStarV2', () => starShape(0.1, 0.042), 0.035, '#fff2a8', { p: [x, y, z], bevel: 0.008, emissive: '#fff2a8', glow: 0.75 }));
    }
    kids.push(ball(0.035, '#fff8cf', { p: [-0.45, h + 0.38, 0.08], seg: 6, emissive: '#fff8cf', glow: 0.9 }));
  }
  return group(kids);
}
const plantBuilders: Record<string, (stage: number, max: number) => THREE.Group> = { sunflower: plantSunflower, tomato: plantTomato, strawberry: plantStrawberry, magic: plantMagic };
for (const [kind, spec] of Object.entries(PLANTS)) {
  defineModel<PlantOpts>(`plant_${kind}`, {
    build: (o) => plantBuilders[kind](Math.max(0, Math.min(spec.stages, o.stage ?? spec.stages)), spec.stages),
    colliders: [{ kind: 'circle', r: 0.42 }],
    height: (o) => 0.45 + (Math.max(0, Math.min(spec.stages, o.stage ?? spec.stages)) / spec.stages) * (kind === 'magic' ? 1.6 : 1.0),
    tags: ['pickup'],
    desc: `${spec.name}: stage 0..${spec.stages}, trưởng thành có sản phẩm thu hoạch`,
    variants: Array.from({ length: spec.stages + 1 }, (_, stage) => ({ stage })),
  });
}

function foodBowl(): THREE.Group {
  return group([cyl(0.34, 0.26, 0.15, '#ff6b6b', { p: [0, 0.08, 0], seg: 16 }), cyl(0.22, 0.24, 0.04, '#fff8ee', { p: [0, 0.18, 0], seg: 16 }), ...Array.from({ length: 9 }, (_, i) => ball(0.045, '#8a5a3b', { p: [Math.cos(i) * 0.13, 0.23, Math.sin(i) * 0.1], seg: 6 }))]);
}
defineModel('food_bowl', { build: foodBowl, colliders: [{ kind: 'circle', r: 0.35, top: 0.2 }], height: 0.3, tags: ['pickup'], desc: 'Bát thức ăn thú cưng có hạt kibble' });
function bananaBunch(): THREE.Group { return group([banana(), group([banana()], { r: [0, 0, 18], p: [0.1, 0.03, 0] }), group([banana()], { r: [0, 0, -18], p: [-0.1, 0.03, 0] })], { p: [0, 0.25, 0] }); }
defineModel('banana_bunch', { build: bananaBunch, colliders: [{ kind: 'circle', r: 0.45, top: 0.35 }], height: 0.65, tags: ['pickup'], desc: 'Nải chuối cho nhiệm vụ cho khỉ ăn' });
function appleBasket(): THREE.Group { return group([cyl(0.38, 0.3, 0.22, WOOD, { p: [0, 0.11, 0], seg: 14 }), torus(0.34, 0.025, WOOD_DARK, { p: [0, 0.33, 0], r: [70, 0, 0], arc: 180, ts: 18 }), ...[-0.16, 0, 0.16].map((x, i) => group([apple()], { p: [x, 0.36 + (i % 2) * 0.05, i === 1 ? -0.08 : 0.08], s: 0.55 }))]); }
defineModel('apple_basket', { build: appleBasket, colliders: [{ kind: 'circle', r: 0.4, top: 0.45 }], height: 0.65, tags: ['pickup'], desc: 'Giỏ táo nhiệm vụ' });
function fishBucket(): THREE.Group { return group([cyl(0.34, 0.28, 0.45, '#8fd3f4', { p: [0, 0.22, 0], seg: 16, shiny: 60 }), torus(0.32, 0.025, '#dfefff', { p: [0, 0.48, 0], ts: 24 }), torus(0.36, 0.025, '#dfefff', { p: [0, 0.62, 0], r: [65, 0, 0], arc: 190, ts: 18 }), group([fish()], { p: [0, 0.55, 0], s: 0.65, r: [0, 20, 0] })]); }
defineModel('fish_bucket', { build: fishBucket, colliders: [{ kind: 'circle', r: 0.38, top: 0.55 }], height: 0.85, tags: ['pickup'], desc: 'Xô cá nhiệm vụ' });

function exitMarker(): THREE.Group {
  const chevron = (z: number) => group([
    rbox(0.14, 0.05, 0.52, 0.025, '#fff2a8', { p: [-0.16, 0.09, z], r: [0, -34, 0], unlit: true, emissive: '#fff2a8', glow: 1 }),
    rbox(0.14, 0.05, 0.52, 0.025, '#fff2a8', { p: [0.16, 0.09, z], r: [0, 34, 0], unlit: true, emissive: '#fff2a8', glow: 1 }),
  ]);
  const arrow = named(group([
    chevron(0.16),
    chevron(-0.22),
    cone(0.16, 0.28, '#fff8cf', { p: [0, 0.2, 0.48], r: [90, 0, 0], seg: 3, unlit: true, emissive: '#fff8cf', glow: 1 }),
  ]), 'arrow');
  arrow.userData.tick = (_dt: number, t: number) => { arrow.position.y = 0.08 + Math.sin(t * 3) * 0.07; arrow.rotation.y = Math.sin(t * 1.4) * 0.12; };
  return group([
    cyl(0.34, 0.55, 1.8, '#9bf6ff', { p: [0, 0.9, 0], seg: 28, opacity: 0.22, unlit: true, depthWrite: false, emissive: '#9bf6ff', glow: 0.9 }),
    disc(0.86, '#4ecdc4', { p: [0, 0.01, 0], seg: 48, unlit: true, emissive: '#4ecdc4', glow: 0.65, opacity: 0.55 }),
    ring(0.58, 0.9, '#fff2a8', { p: [0, 0.03, 0], seg: 48, unlit: true, emissive: '#fff2a8', glow: 1 }),
    ring(0.24, 0.34, '#9bf6ff', { p: [0, 0.04, 0], seg: 32, unlit: true, emissive: '#9bf6ff', glow: 1 }),
    arrow,
  ]);
}
defineModel('exit_marker', { build: exitMarker, height: 1.9, tags: ['pickup'], desc: 'Vòng thoát vùng phát sáng; node arrow/chevron bob bằng tick, cột sáng trong suốt, không collider' });

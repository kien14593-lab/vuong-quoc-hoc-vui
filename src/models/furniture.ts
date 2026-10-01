import * as THREE from 'three';
import { around, ball, box, capsule, cone, cyl, DEG, disc, extrude, group, lathe, panel, pivot, prism, rbox, ring, starShape, torus, tube } from '../engine/kit';
import { PAL, tint } from '../engine/materials';
import { textPlate } from '../engine/text';
import { defineModel } from './registry';

type ColorOpts = { color?: string };
type RoomOpts = { wall?: string };
type BadgeOpts = { icon?: 'plus' | 'maze' | 'times' | 'scholar' | 'explorer'; color?: string };

const WOOD = '#c8915a';
const WOOD_DARK = '#8a5a3b';
const WOOD_LIGHT = '#d7a56d';
const CREAM = '#fff4df';
const INK = '#2b2233';
const GOLD = '#ffd166';
const WALL_DEFAULT = '#ffe9f2';
const SLOT_POS = {
  rug: { p: [0, 0.03, 0.7], rotY: 0 },
  lamp: { p: [-4.25, 0, 2.8], rotY: 25 },
  corner: { p: [-4.15, 0, -3.15], rotY: 45 },
  sofa: { p: [1.3, 0, -3.25], rotY: 0 },
  shelf: { p: [4.35, 0, -1.9], rotY: -90 },
  wall1: { p: [-2.8, 1.7, -3.96], rotY: 0 },
  wall2: { p: [0, 1.7, -3.96], rotY: 0 },
  wall3: { p: [2.8, 1.7, -3.96], rotY: 0 },
  table: { p: [0.7, 0.78, 1.45], rotY: 20 },
  bedside: { p: [-2.95, 0, 2.75], rotY: 35 },
  corner2: { p: [4.0, 0, 2.75], rotY: -45 },
} as const;

function setName<T extends THREE.Object3D>(o: T, name: string): T {
  o.name = name;
  return o;
}

function wallpaperMat(base: string): THREE.MeshStandardMaterial {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = tint(base, 0.08);
  for (let x = 0; x < 128; x += 32) ctx.fillRect(x, 0, 11, 128);
  ctx.fillStyle = 'rgba(255,255,255,0.34)';
  for (let y = 16; y < 128; y += 32)
    for (let x = 14; x < 128; x += 32) {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  return new THREE.MeshStandardMaterial({ color: '#ffffff', map: tex, roughness: 0.85 });
}

function plankFloor(w = 10, d = 8): THREE.Group {
  const g = new THREE.Group();
  const base = '#dca96d';
  g.add(box(w, 0.08, d, base, { p: [0, 0.04, 0], receive: true }));
  for (let i = 1; i < 10; i += 2) {
    const x = -w / 2 + (i + 0.5) * (w / 10);
    g.add(box(0.025, 0.014, d - 0.12, i % 2 ? '#9f6a3b' : '#ad7645', { p: [x, 0.09, 0], cast: false }));
  }
  for (let j = 1; j < 5; j += 2) {
    const z = -d / 2 + (j + 1) * (d / 6);
    g.add(box(w - 0.16, 0.012, 0.022, '#b37a46', { p: [0, 0.095, z], cast: false }));
  }
  return g;
}

function windowLocal(w = 1.25, h = 0.9): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(w + 0.18, h + 0.18, 0.08, 0.03, '#ffffff', { p: [0, 0, 0.035] }));
  g.add(box(w, h, 0.045, '#8fd3f4', { p: [0, 0, 0.075], shiny: 50, emissive: '#6cb8ff', glow: 0.08 }));
  g.add(box(0.05, h, 0.04, '#ffffff', { p: [0, 0, 0.105], cast: false }));
  g.add(box(w, 0.05, 0.04, '#ffffff', { p: [0, 0, 0.105], cast: false }));
  g.add(box(w + 0.35, 0.09, 0.18, WOOD_LIGHT, { p: [0, -h / 2 - 0.11, 0.08] }));
  g.add(box(0.18, h + 0.22, 0.045, '#ffb3cf', { p: [-w / 2 - 0.18, 0, 0.14], cast: false }));
  g.add(box(0.18, h + 0.22, 0.045, '#ffb3cf', { p: [w / 2 + 0.18, 0, 0.14], cast: false }));
  return g;
}

function addBaseboards(g: THREE.Group, wall: string, w = 10, d = 8): void {
  const c = tint(wall, -0.12);
  g.add(box(w, 0.16, 0.08, c, { p: [0, 0.2, -d / 2 + 0.05] }));
  g.add(box((w - 1.4) / 2, 0.16, 0.08, c, { p: [-(w + 1.4) / 4, 0.2, d / 2 - 0.05] }));
  g.add(box((w - 1.4) / 2, 0.16, 0.08, c, { p: [(w + 1.4) / 4, 0.2, d / 2 - 0.05] }));
  g.add(box(0.08, 0.16, d, c, { p: [-w / 2 + 0.05, 0.2, 0] }));
  g.add(box(0.08, 0.16, d, c, { p: [w / 2 - 0.05, 0.2, 0] }));
  const top = tint(wall, 0.08);
  g.add(box(w, 0.12, 0.08, top, { p: [0, 2.92, -d / 2 + 0.055], cast: false }));
  g.add(box(w, 0.12, 0.08, top, { p: [0, 2.92, d / 2 - 0.055], cast: false }));
  g.add(box(0.08, 0.12, d, top, { p: [-w / 2 + 0.055, 2.92, 0], cast: false }));
  g.add(box(0.08, 0.12, d, top, { p: [w / 2 - 0.055, 2.92, 0], cast: false }));
}

function wallFrame(text: string, w = 0.8, h = 0.56, color = '#fff8ee'): THREE.Group {
  const g = new THREE.Group();
  const t = textPlate(text, h * 0.72, { bg: color, color: INK, border: '#d7a56d', size: 42, pad: 5 });
  t.position.set(0, 0, 0.07);
  g.add(t);
  return g;
}

function wallClock(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.25, 0.25, 0.05, '#fff8ee', { r: [90, 0, 0], seg: 24 }));
  return g;
}

function lowBookshelf(): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(1.35, 0.58, 0.34, 0.04, WOOD_DARK, { p: [0, 0.29, 0] }));
  g.add(rbox(1.22, 0.42, 0.28, 0.03, WOOD_LIGHT, { p: [0, 0.34, 0.02] }));
  const colors = ['#ff6b6b', '#6cb8ff', '#ffd166', '#7bd389', '#b197fc', '#ff9ec7'];
  for (let i = 0; i < 3; i++) g.add(box(0.16, 0.32 + (i % 3) * 0.035, 0.19, colors[i % colors.length], { p: [-0.26 + i * 0.25, 0.42, 0.18], r: [0, 0, (i % 2 ? 5 : -4)], cast: false }));
  return g;
}

function toyBox(): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(1.0, 0.42, 0.55, 0.06, '#7ec8e3', { p: [0, 0.21, 0] }));
  g.add(rbox(1.08, 0.1, 0.6, 0.05, '#ffd166', { p: [0, 0.47, -0.02] }));
  return g;
}

function doormat(): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(1.35, 0.035, 0.72, 0.05, '#b98552', { p: [0, 0.025, 0] }));
  return g;
}

function hangingLamp(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.018, 0.018, 0.65, '#8a5a3b', { p: [0, 2.55, 0], seg: 6 }));
  g.add(cone(0.38, 0.34, '#ffd166', { p: [0, 2.15, 0], r: [180, 0, 0], seg: 20, emissive: '#ffd166', glow: 0.18 }));
  return g;
}

function catCushion(): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(0.78, 0.16, 0.58, 0.12, '#ffc8dd', { p: [0, 0.08, 0], shiny: 20 }));
  g.add(ball(0.08, '#fff8ee', { p: [-0.22, 0.19, 0.05], s: [1.2, 0.5, 1], seg: 8 }));
  g.add(ball(0.08, '#fff8ee', { p: [0.22, 0.19, 0.05], s: [1.2, 0.5, 1], seg: 8 }));
  return g;
}

function buildRoom(o: RoomOpts): THREE.Group {
  const W = 10;
  const D = 8;
  const H = 3;
  const wallColor = o.wall ?? WALL_DEFAULT;
  const wallMat = wallpaperMat(wallColor);
  const g = new THREE.Group();
  g.add(plankFloor(W, D));

  const wallN = setName(new THREE.Group(), 'wallN');
  wallN.add(box(W, H, 0.16, wallColor, { p: [0, H / 2, -D / 2], receive: true, m: wallMat }));
  const nWin = windowLocal(1.35, 0.9);
  nWin.position.set(-3.0, 1.65, -D / 2 + 0.09);
  wallN.add(nWin);
  const nWin2 = windowLocal(1.35, 0.9);
  nWin2.position.set(3.0, 1.65, -D / 2 + 0.09);
  wallN.add(nWin2);
  const art1 = wallFrame('1 2 3\n＋ −', 0.84, 0.58, '#fff8ee');
  art1.position.set(0, 1.8, -D / 2 + 0.105);
  wallN.add(art1);
  const clock = wallClock();
  clock.position.set(4.15, 2.0, -D / 2 + 0.12);
  wallN.add(clock);
  g.add(wallN);

  const wallS = setName(new THREE.Group(), 'wallS');
  wallS.add(box(4.15, H, 0.16, wallColor, { p: [-2.925, H / 2, D / 2], receive: true, m: wallMat }));
  wallS.add(box(4.15, H, 0.16, wallColor, { p: [2.925, H / 2, D / 2], receive: true, m: wallMat }));
  wallS.add(box(1.6, 0.85, 0.16, wallColor, { p: [0, 2.575, D / 2], receive: true, m: wallMat }));
  const door = setName(new THREE.Group(), 'door');
  door.add(box(0.12, 2.16, 0.16, WOOD_DARK, { p: [-0.67, 1.08, D / 2 + 0.08] }));
  door.add(box(0.12, 2.16, 0.16, WOOD_DARK, { p: [0.67, 1.08, D / 2 + 0.08] }));
  door.add(box(1.45, 0.14, 0.16, WOOD_DARK, { p: [0, 2.12, D / 2 + 0.08] }));
  wallS.add(door);
  g.add(wallS);

  for (const [name, sx] of [['wallW', -1], ['wallE', 1]] as const) {
    const wgrp = setName(new THREE.Group(), name);
    wgrp.add(box(0.16, H, D, wallColor, { p: [sx * W / 2, H / 2, 0], receive: true, m: wallMat }));
    const win = windowLocal(1.2, 0.85);
    win.position.set(sx * W / 2 - sx * 0.09, 1.65, -0.7);
    win.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
    wgrp.add(win);
    const art = sx < 0 ? wallFrame('☀\nNhà vui', 0.66, 0.5, '#fff0d2') : wallFrame('△ ○ □', 0.72, 0.48, '#e7f7ff');
    art.position.set(sx * W / 2 - sx * 0.11, 2.05, 1.65);
    art.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
    wgrp.add(art);
    g.add(wgrp);
  }
  addBaseboards(g, wallColor, W, D);
  const shelf = lowBookshelf();
  shelf.position.set(-4.32, 0, -0.65);
  shelf.rotation.y = Math.PI / 2;
  g.add(shelf);
  const toys = toyBox();
  toys.position.set(3.45, 0, 0.92);
  toys.rotation.y = -0.35;
  g.add(toys);
  const mat = doormat();
  mat.position.set(0, 0, 3.32);
  g.add(mat);
  const lamp = hangingLamp();
  lamp.position.set(0.1, 0, 0.1);
  g.add(lamp);
  const cushion = catCushion();
  cushion.position.set(3.6, 0, 2.05);
  cushion.rotation.y = -0.2;
  g.add(cushion);
  g.userData.slots = SLOT_POS;
  return g;
}

defineModel<RoomOpts>('room_home', {
  build: buildRoom,
  colliders: [
    { kind: 'box', w: 10, d: 0.18, at: [0, -4] },
    { kind: 'box', w: 4.2, d: 0.18, at: [-2.9, 4] },
    { kind: 'box', w: 4.2, d: 0.18, at: [2.9, 4] },
    { kind: 'box', w: 0.18, d: 8, at: [-5, 0] },
    { kind: 'box', w: 0.18, d: 8, at: [5, 0] },
  ],
  height: 3.1,
  tags: ['home'],
  desc: 'Phòng nhà người chơi: wallN/wallS/wallW/wallE để ẩn theo camera, door ở tường trước, userData.slots cho DecorSlot.',
  variants: [{ wall: '#ffe9f2' }, { wall: '#e7f7ff' }, { wall: '#fff0d2' }],
});

function bed(o: ColorOpts): THREE.Group {
  const c = o.color ?? '#7ec8e3';
  return group([
    rbox(2.1, 0.35, 1.35, 0.08, WOOD_LIGHT, { p: [0, 0.28, 0], base: true }),
    rbox(1.9, 0.25, 1.1, 0.12, '#fff8ee', { p: [0, 0.62, 0.06] }),
    rbox(1.95, 0.18, 0.8, 0.08, c, { p: [0, 0.78, 0.22] }),
    rbox(1.9, 1.0, 0.18, 0.08, WOOD_DARK, { p: [0, 0.65, -0.63] }),
    rbox(1.75, 0.28, 0.42, 0.08, '#ffffff', { p: [0, 0.92, -0.26] }),
    ...[-0.85, 0.85].map((x) => cyl(0.09, 0.1, 0.55, WOOD_DARK, { p: [x, 0.27, 0.58], seg: 8 })),
  ]);
}
defineModel<ColorOpts>('furn_bed', { build: bed, colliders: [{ kind: 'box', w: 2.1, d: 1.35 }], height: 1.2, tags: ['home'], desc: 'Giường gỗ ấm áp', variants: [{ color: '#7ec8e3' }, { color: '#ff9ec7' }, { color: '#b197fc' }] });

function table(): THREE.Group {
  const kids: THREE.Object3D[] = [rbox(1.45, 0.16, 1.0, 0.07, WOOD_LIGHT, { p: [0, 0.74, 0] })];
  for (const x of [-0.55, 0.55]) for (const z of [-0.35, 0.35]) kids.push(cyl(0.06, 0.08, 0.72, WOOD_DARK, { p: [x, 0.36, z], seg: 7 }));
  kids.push(box(1.25, 0.05, 0.08, tint(WOOD_LIGHT, -0.1), { p: [0, 0.62, -0.44] }));
  return group(kids);
}
defineModel('furn_table', { build: table, colliders: [{ kind: 'box', w: 1.45, d: 1.0, top: 0.78 }], height: 0.85, tags: ['home'], desc: 'Bàn gỗ nhỏ' });

function chair(o: ColorOpts): THREE.Group {
  const c = o.color ?? '#ff9ec7';
  return group([
    rbox(0.78, 0.14, 0.72, 0.06, c, { p: [0, 0.55, 0] }),
    rbox(0.8, 0.82, 0.12, 0.06, tint(c, -0.04), { p: [0, 0.9, -0.32] }),
    ...[-0.28, 0.28].flatMap((x) => [-0.25, 0.25].map((z) => cyl(0.04, 0.055, 0.55, WOOD_DARK, { p: [x, 0.27, z], seg: 7 }))),
  ]);
}
defineModel<ColorOpts>('furn_chair', { build: chair, colliders: [{ kind: 'box', w: 0.82, d: 0.78 }], height: 1.35, tags: ['home'], desc: 'Ghế tựa', variants: [{ color: '#ff9ec7' }, { color: '#7ec8e3' }, { color: '#ffd166' }] });

function desk(): THREE.Group {
  const sign = textPlate('1+1=2', 0.25, { bg: '#fff8ee', color: PAL.ink, border: '#ffd166', pad: 12, size: 58 });
  sign.position.set(-0.35, 0.82, 0.38);
  sign.rotation.x = -65 * DEG;
  return group([
    rbox(1.8, 0.16, 0.72, 0.05, WOOD_LIGHT, { p: [0, 0.76, 0] }),
    ...[-0.72, 0.72].flatMap((x) => [-0.25, 0.25].map((z) => cyl(0.05, 0.065, 0.76, WOOD_DARK, { p: [x, 0.38, z], seg: 7 }))),
    rbox(0.55, 0.32, 0.5, 0.04, '#6cb8ff', { p: [0.55, 0.54, -0.02] }),
    box(0.46, 0.04, 0.04, '#ffffff', { p: [0.55, 0.56, 0.26] }),
    sign,
  ]);
}
defineModel('furn_desk', { build: desk, colliders: [{ kind: 'box', w: 1.8, d: 0.78, top: 0.82 }], height: 0.9, tags: ['home'], desc: 'Bàn học có bảng phép tính' });

function wardrobe(): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(1.45, 2.15, 0.58, 0.08, WOOD_LIGHT, { p: [0, 1.075, 0] }));
  const doorL = setName(group([rbox(0.65, 1.8, 0.08, 0.04, '#c8905a', { p: [-0.33, 0.9, 0.31] }), ball(0.045, GOLD, { p: [-0.08, 0.92, 0.37], seg: 8 })]), 'doorL');
  const doorR = setName(group([rbox(0.65, 1.8, 0.08, 0.04, '#c8905a', { p: [0.33, 0.9, 0.31] }), ball(0.045, GOLD, { p: [0.08, 0.92, 0.37], seg: 8 })]), 'doorR');
  g.add(doorL, doorR);
  g.add(box(1.55, 0.12, 0.68, WOOD_DARK, { p: [0, 2.21, 0] }));
  return g;
}
defineModel('furn_wardrobe', { build: wardrobe, colliders: [{ kind: 'box', w: 1.5, d: 0.65 }], height: 2.3, tags: ['home'], desc: 'Tủ quần áo, doorL/doorR là hai cánh cửa để mở/đổi màu' });

function badgeShelf(): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(2.3, 0.18, 0.45, 0.05, WOOD_LIGHT, { p: [0, 0.95, 0] }));
  g.add(rbox(2.45, 0.16, 0.5, 0.05, WOOD_DARK, { p: [0, 0.12, 0] }));
  for (const x of [-1.05, 1.05]) g.add(cyl(0.06, 0.08, 0.9, WOOD_DARK, { p: [x, 0.52, 0], seg: 7 }));
  const slots: [number, number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const x = -0.8 + i * 0.4;
    slots.push([x, 1.09, 0]);
    g.add(disc(0.1, '#fff3bf', { p: [x, 1.055, 0], seg: 16 }));
  }
  g.userData.slots = slots;
  return g;
}
defineModel('furn_badge_shelf', { build: badgeShelf, colliders: [{ kind: 'box', w: 2.45, d: 0.55 }], height: 1.35, tags: ['home'], desc: 'Kệ trưng bày huy hiệu, userData.slots có 5 vị trí địa phương' });

function wateringCan(): THREE.Group {
  const g = new THREE.Group();
  g.add(capsule(0.22, 0.38, '#7ec8e3', { p: [0, 0.36, 0], r: [0, 0, 90], seg: 12, shiny: 35 }));
  g.add(cyl(0.11, 0.13, 0.22, '#7ec8e3', { p: [-0.12, 0.58, 0], seg: 12, shiny: 35 }));
  g.add(torus(0.25, 0.035, '#5aa6c8', { p: [0.02, 0.52, -0.18], r: [90, 0, 0], ts: 18 }));
  g.add(cone(0.08, 0.55, '#7ec8e3', { p: [0.42, 0.42, 0], r: [0, 0, -75], seg: 10, shiny: 35 }));
  g.add(cyl(0.09, 0.09, 0.035, '#5aa6c8', { p: [0.68, 0.5, 0], r: [0, 0, -75], seg: 12 }));
  return g;
}
defineModel('garden_watering_can', { build: wateringCan, colliders: [{ kind: 'circle', r: 0.45, top: 0.75 }], height: 0.8, tags: ['home'], desc: 'Bình tưới cây nhỏ màu xanh cho vườn nhà' });

function gardenBenchTools(): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(1.7, 0.18, 0.5, 0.05, WOOD_LIGHT, { p: [0, 0.72, 0] }));
  for (const x of [-0.68, 0.68]) g.add(box(0.12, 0.72, 0.12, WOOD_DARK, { p: [x, 0.36, 0] }));
  g.add(box(0.08, 0.72, 0.05, '#8a5a3b', { p: [-0.25, 1.1, 0.12], r: [0, 0, 18] }));
  g.add(box(0.08, 0.72, 0.05, '#8a5a3b', { p: [0.15, 1.1, 0.12], r: [0, 0, -14] }));
  g.add(cone(0.12, 0.22, '#8fd694', { p: [-0.35, 0.96, 0.12], r: [180, 0, 18], seg: 6 }));
  g.add(box(0.26, 0.08, 0.05, '#c0c0c0', { p: [0.27, 0.94, 0.12], r: [0, 0, -14] }));
  g.add(rbox(0.45, 0.34, 0.32, 0.04, '#ffd166', { p: [0.55, 0.93, -0.04] }));
  return g;
}
defineModel('garden_tool_bench', { build: gardenBenchTools, colliders: [{ kind: 'box', w: 1.8, d: 0.6, top: 1.2 }], height: 1.25, tags: ['home'], desc: 'Ghế/kệ dụng cụ nhỏ cho vườn nhà' });

function steppingStone(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.46, 0.52, 0.08, '#d9cfbc', { p: [0, 0.04, 0], seg: 14, shiny: 8 }));
  g.add(cyl(0.37, 0.4, 0.025, '#efe3cf', { p: [0.02, 0.095, -0.02], seg: 14, cast: false }));
  return g;
}
defineModel('garden_stepping_stone', { build: steppingStone, height: 0.12, tags: ['home'], desc: 'Đá bước chân thấp trong vườn' });

function rugRound(o: ColorOpts): THREE.Group {
  const c = o.color ?? '#ffd6e8';
  return group([disc(0.9, c, { p: [0, 0.015, 0], seg: 32 }), ring(0.74, 0.9, tint(c, -0.08), { p: [0, 0.02, 0], seg: 32 }), disc(0.18, '#fff8ee', { p: [0, 0.025, 0], seg: 18 })]);
}
function rugRainbow(): THREE.Group {
  return group([
    disc(1.0, '#fff8ee', { p: [0, 0.01, 0], seg: 32 }),
    ...['#ff6b6b', '#ffd166', '#7bd389', '#6cb8ff', '#b197fc'].map((c, i) => ring(0.16 + i * 0.15, 0.28 + i * 0.15, c, { p: [0, 0.015 + i * 0.002, 0], seg: 32 })),
  ]);
}
function lamp(o: ColorOpts): THREE.Group {
  const c = o.color ?? '#ffd166';
  return group([
    cyl(0.22, 0.3, 0.08, WOOD_DARK, { p: [0, 0.04, 0], seg: 12 }),
    cyl(0.04, 0.05, 0.9, '#7d6175', { p: [0, 0.48, 0], seg: 8 }),
    cone(0.38, 0.42, c, { p: [0, 1.0, 0], r: [180, 0, 0], seg: 16, emissive: c, glow: 0.25 }),
    ball(0.12, '#fff2a8', { p: [0, 0.77, 0], seg: 10, emissive: '#fff2a8', glow: 0.8 }),
  ]);
}
function decorPlant(): THREE.Group {
  return group([
    cyl(0.28, 0.22, 0.36, '#d9825b', { p: [0, 0.18, 0], seg: 12 }),
    cyl(0.22, 0.24, 0.07, '#5b3b2e', { p: [0, 0.39, 0], seg: 12 }),
    ...around(7, 0.2, (i, a) => box(0.08, 0.42, 0.03, i % 2 ? PAL.leaf1 : PAL.leaf2, { p: [0, 0.65, 0], r: [20, (a / DEG), i % 2 ? 25 : -25] }), 10).children,
  ]);
}
function sofa(o: ColorOpts): THREE.Group {
  const c = o.color ?? '#7ec8e3';
  return group([
    rbox(1.95, 0.48, 0.8, 0.14, c, { p: [0, 0.38, 0.12] }),
    rbox(2.05, 0.82, 0.28, 0.12, tint(c, -0.04), { p: [0, 0.75, -0.28] }),
    rbox(0.25, 0.55, 0.85, 0.1, tint(c, -0.05), { p: [-1.1, 0.5, 0.1] }),
    rbox(0.25, 0.55, 0.85, 0.1, tint(c, -0.05), { p: [1.1, 0.5, 0.1] }),
    rbox(0.48, 0.16, 0.38, 0.07, '#fff8ee', { p: [-0.45, 0.72, 0.15] }),
    rbox(0.48, 0.16, 0.38, 0.07, '#ffd6e8', { p: [0.45, 0.72, 0.15] }),
  ]);
}
function bookshelf(): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(1.35, 1.65, 0.35, 0.05, WOOD_LIGHT, { p: [0, 0.825, 0] }));
  for (const y of [0.45, 0.9, 1.35]) g.add(box(1.25, 0.08, 0.4, WOOD_DARK, { p: [0, y, 0.02] }));
  const colors = ['#ff6b6b', '#ffd166', '#6cb8ff', '#7bd389', '#b197fc', '#ff9ec7'];
  for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) g.add(box(0.11, 0.32 + (i % 2) * 0.07, 0.18, colors[(i + r) % colors.length], { p: [-0.52 + i * 0.2, 0.26 + r * 0.45, 0.17] }));
  return g;
}
function aquarium(): THREE.Group {
  const fish = setName(group([ball(0.08, '#ff9f43', { s: [1.4, 0.75, 0.65], seg: 8 }), cone(0.08, 0.16, '#ff9f43', { p: [-0.14, 0, 0], r: [0, 0, 90], seg: 3 })], { p: [0, 0.42, 0.22] }), 'fish');
  fish.userData.dynamic = true;
  fish.userData.tick = (_dt: number, t: number) => { fish.position.x = Math.sin(t * 1.5) * 0.35; fish.rotation.y = Math.sin(t * 1.5) > 0 ? 0 : Math.PI; };
  return group([
    rbox(1.1, 0.7, 0.55, 0.04, '#8fd8e6', { p: [0, 0.42, 0], opacity: 0.42, shiny: 80 }),
    box(1.18, 0.08, 0.62, '#4ecdc4', { p: [0, 0.79, 0] }),
    box(1.18, 0.08, 0.62, '#7b5b44', { p: [0, 0.08, 0] }),
    disc(0.09, '#ffd166', { p: [-0.32, 0.12, 0.12], seg: 10 }),
    fish,
  ]);
}
function posterStar(): THREE.Group {
  return group([rbox(1.05, 1.05, 0.06, 0.05, '#fff8ee', { p: [0, 0, 0.01] }), extrude('decorPosterStar', () => starShape(0.34, 0.14), 0.04, GOLD, { p: [0, 0.02, 0.08], emissive: GOLD, glow: 0.15 })]);
}
function posterMath(): THREE.Group {
  const plate = textPlate('×  1 2 3\n1  1 2 3\n2  2 4 6\n3  3 6 9', 0.92, { bg: '#fff8ee', border: '#4ecdc4', color: PAL.ink, size: 42, pad: 18, font: '"Nunito", sans-serif' });
  plate.position.z = 0.05;
  return group([rbox(1.18, 1.08, 0.05, 0.04, '#4ecdc4', { p: [0, 0, 0] }), plate]);
}
function clock(): THREE.Group {
  const hourHand = setName(group([box(0.05, 0.25, 0.035, INK, { p: [0, 0.12, 0.04] })]), 'hourHand');
  const minHand = setName(group([box(0.035, 0.34, 0.04, '#ff6b6b', { p: [0, 0.17, 0.06] })]), 'minHand');
  const tick = () => {
    const d = new Date();
    const m = d.getMinutes() + d.getSeconds() / 60;
    const h = (d.getHours() % 12) + m / 60;
    hourHand.rotation.z = -h * 30 * DEG;
    minHand.rotation.z = -m * 6 * DEG;
  };
  hourHand.userData.tick = tick;
  minHand.userData.tick = tick;
  tick();
  return group([cyl(0.48, 0.48, 0.08, '#fff8ee', { r: [90, 0, 0], seg: 24 }), ring(0.42, 0.5, GOLD, { r: [90, 0, 0], p: [0, 0, 0.055], seg: 32 }), hourHand, minHand, ball(0.045, GOLD, { p: [0, 0, 0.1], seg: 8 })]);
}
function teddy(): THREE.Group {
  return group([
    ball(0.32, '#c08552', { p: [0, 0.45, 0], s: [1, 1.15, 0.9], seg: 12, flat: false }),
    ball(0.28, '#c08552', { p: [0, 0.92, 0], seg: 12, flat: false }),
    ball(0.1, '#8a5a3b', { p: [-0.16, 1.13, 0], seg: 8 }), ball(0.1, '#8a5a3b', { p: [0.16, 1.13, 0], seg: 8 }),
    ball(0.055, INK, { p: [-0.09, 0.96, 0.24], seg: 8, shiny: 70 }), ball(0.055, INK, { p: [0.09, 0.96, 0.24], seg: 8, shiny: 70 }),
    ball(0.08, '#f0c7a1', { p: [0, 0.86, 0.25], s: [1.25, 0.8, 0.55], seg: 8 }),
    ...[-0.3, 0.3].map((x) => capsule(0.11, 0.22, '#c08552', { p: [x, 0.48, 0.02], r: [0, 0, x > 0 ? -35 : 35], seg: 8 })),
    ...[-0.17, 0.17].map((x) => capsule(0.12, 0.2, '#c08552', { p: [x, 0.13, 0.05], r: [90, 0, 0], seg: 8 })),
  ]);
}
function globe(): THREE.Group {
  const globeBall = setName(group([ball(0.32, '#4ecdc4', { seg: 18, flat: false, shiny: 50 }), tube([[0, -0.24, 0.2], [0.18, -0.08, 0.24], [0.1, 0.15, 0.25], [-0.12, 0.23, 0.22]], 0.018, '#7bd389', { radial: 5 }), tube([[-0.18, -0.05, 0.25], [0.05, 0.02, 0.27], [0.22, -0.12, 0.24]], 0.018, '#7bd389', { radial: 5 })]), 'globeBall');
  globeBall.userData.tick = (_dt: number, t: number) => { globeBall.rotation.y = t * 0.5; };
  return group([torus(0.36, 0.018, GOLD, { r: [15, 0, 0], ts: 32 }), globeBall, cyl(0.05, 0.08, 0.32, WOOD_DARK, { p: [0, -0.38, 0], seg: 8 }), cyl(0.28, 0.32, 0.06, WOOD_DARK, { p: [0, -0.56, 0], seg: 16 })], { p: [0, 0.6, 0] });
}
function rocketModel(): THREE.Group {
  return group([cyl(0.18, 0.18, 0.65, '#ffffff', { p: [0, 0.45, 0], seg: 12 }), cone(0.18, 0.28, '#ff6b6b', { p: [0, 0.92, 0], seg: 12 }), ...[-1, 1].map((s) => box(0.1, 0.25, 0.05, '#6cb8ff', { p: [s * 0.18, 0.2, 0], r: [0, 0, s * 25] })), ball(0.07, '#8fd3f4', { p: [0, 0.55, 0.18], seg: 10, shiny: 80 }), cone(0.12, 0.24, '#ffd166', { p: [0, 0.02, 0], r: [180, 0, 0], seg: 10, emissive: '#ff9f43', glow: 0.3 })]);
}
function piano(): THREE.Group {
  const keys = Array.from({ length: 8 }, (_, i) => box(0.1, 0.025, 0.32, i % 2 ? '#e9ecef' : '#ffffff', { p: [-0.35 + i * 0.1, 0.62, 0.33], cast: false }));
  return group([rbox(1.25, 0.75, 0.62, 0.08, '#5b4a6e', { p: [0, 0.42, 0] }), box(1.16, 0.08, 0.42, '#2b2233', { p: [0, 0.64, 0.24] }), ...keys, rbox(1.12, 0.45, 0.1, 0.04, '#6d5a80', { p: [0, 0.9, -0.26] }), ...[-0.45, 0.45].map((x) => cyl(0.045, 0.055, 0.38, '#2b2233', { p: [x, 0.19, 0.18], seg: 7 }))]);
}
function trophy(): THREE.Group {
  return group([cyl(0.24, 0.34, 0.42, GOLD, { p: [0, 0.72, 0], seg: 16, shiny: 90 }), torus(0.28, 0.035, GOLD, { p: [-0.24, 0.78, 0], r: [90, 0, 0], arc: 180, ts: 14, shiny: 90 }), torus(0.28, 0.035, GOLD, { p: [0.24, 0.78, 0], r: [90, 0, 180], arc: 180, ts: 14, shiny: 90 }), cyl(0.08, 0.1, 0.25, GOLD, { p: [0, 0.34, 0], seg: 12, shiny: 90 }), cyl(0.28, 0.34, 0.12, WOOD_DARK, { p: [0, 0.09, 0], seg: 16 }), extrude('trophyStar', () => starShape(0.11, 0.045), 0.025, '#fff2a8', { p: [0, 0.8, 0.25], s: 1, emissive: '#fff2a8', glow: 0.25 })]);
}

const decorBuilders: Record<string, (o: ColorOpts) => THREE.Group> = { rugRound, rugRainbow: () => rugRainbow(), lamp, plant: () => decorPlant(), sofa, bookshelf: () => bookshelf(), aquarium: () => aquarium(), posterStar: () => posterStar(), posterMath: () => posterMath(), clock: () => clock(), teddy: () => teddy(), globe: () => globe(), rocketModel: () => rocketModel(), piano: () => piano(), trophy: () => trophy() };
for (const [style, build] of Object.entries(decorBuilders)) {
  defineModel<ColorOpts>(`decor_${style}`, {
    build,
    colliders: style.startsWith('rug') || ['posterStar', 'posterMath', 'clock'].includes(style) ? [] : [{ kind: 'box', w: ['sofa', 'piano', 'bookshelf'].includes(style) ? 1.4 : 0.8, d: ['sofa', 'piano'].includes(style) ? 0.8 : 0.6 }],
    height: ['posterStar', 'posterMath', 'clock'].includes(style) ? 1.1 : style === 'bookshelf' ? 1.7 : style === 'sofa' ? 1.2 : 1.1,
    tags: ['home'],
    desc: `Đồ trang trí ${style}${style === 'clock' ? '; hourHand/minHand cập nhật giờ thật' : style === 'aquarium' ? '; fish bơi bằng tick' : style === 'globe' ? '; globeBall quay bằng tick' : ''}`,
    variants: style === 'lamp' || style === 'sofa' || style === 'rugRound' ? [{ color: '#ffd166' }, { color: '#7ec8e3' }, { color: '#ff9ec7' }] : [{}],
  });
}

function badge(o: BadgeOpts): THREE.Group {
  const icon = o.icon ?? 'plus';
  const color = o.color ?? '#ffd166';
  const symbols: Record<NonNullable<BadgeOpts['icon']>, string> = { plus: '+', maze: '▣', times: '×', scholar: '★', explorer: '⌂' };
  const symbol = textPlate(symbols[icon], 0.32, { color: INK, stroke: '#ffffff', strokeW: 12, size: 110, pad: 4 });
  symbol.position.set(0, 0.48, 0.08);
  return group([
    cyl(0.22, 0.28, 0.08, WOOD_DARK, { p: [0, 0.04, 0], seg: 12 }),
    cyl(0.035, 0.045, 0.34, GOLD, { p: [0, 0.24, -0.03], seg: 8, shiny: 80 }),
    cyl(0.28, 0.28, 0.08, color, { p: [0, 0.48, 0], r: [90, 0, 0], seg: 24, shiny: 90, emissive: color, glow: 0.08 }),
    torus(0.28, 0.025, '#fff2a8', { p: [0, 0.48, 0.045], seg: 6, ts: 24, shiny: 80 }),
    symbol,
  ]);
}
defineModel<BadgeOpts>('badge', { build: badge, height: 0.85, tags: ['home'], desc: 'Huy hiệu trên chân đế; icon plus/maze/times/scholar/explorer', variants: [{ icon: 'plus', color: '#ffd166' }, { icon: 'maze', color: '#6cb8ff' }, { icon: 'times', color: '#ff6b6b' }, { icon: 'scholar', color: '#b197fc' }, { icon: 'explorer', color: '#7bd389' }] });

import * as THREE from 'three';
import { ball, box, cone, cyl, disc, extrude, group, ico, lathe, panel, pivot, prism, rbox, starShape, torus, tube, type V3 } from '../engine/kit';
import { mat, PAL, tint } from '../engine/materials';
import { textPlate } from '../engine/text';
import { defineModel, type Collider } from './registry';

/** Công trình lớn: khu vui chơi (vòng quay, tàu lượn...), lâu đài, cổng khu vực. */

type DemoOpt = { demo?: boolean };
type ColorOpt = { color?: string };
type ParkTextOpt = { text?: string; color?: string; kind?: string };
type CastleStyleOpt = { stone?: string; trim?: string; roof?: string; flag?: string; accent?: string; floor?: string; carpet?: string };

const CANDY = ['#ff6b6b', '#ffd166', '#4ecdc4', '#6cb8ff', '#b197fc', '#ff9ec7', '#95e1a7', '#ffa94d'];
const STONE = '#efe3c8';
const STONE_DARK = '#e2d3b0';
const INK = '#2b2233';
const RED = '#ff6b6b';
const YELLOW = '#ffd166';
const TEAL = '#4ecdc4';
const BLUE = '#6cb8ff';
const LILAC = '#b197fc';
const PINK = '#ff9ec7';
const GOLD = '#ffcf4a';

function setTick(o: THREE.Object3D, tick: (dt: number, t: number) => void): void {
  o.userData.dynamic = true;
  o.userData.tick = tick;
}

function sign(text: string, h: number, p: V3, r: V3 = [0, 0, 0], bg = '#fff8ee'): THREE.Mesh {
  const m = textPlate(text, h, { bg, color: '#195b4a', stroke: '#ffffff', strokeW: 8, border: YELLOW, radius: 30, pad: 22, weight: 900, doubleSided: true });
  m.position.set(...p);
  m.rotation.set(THREE.MathUtils.degToRad(r[0]), THREE.MathUtils.degToRad(r[1]), THREE.MathUtils.degToRad(r[2]));
  return m;
}

function simpleFlag(name: string, color: string, p: V3, phase = 0): THREE.Group {
  const g = pivot(p, [
    cyl(0.035, 0.045, 0.95, PAL.woodLight, { p: [0, 0.42, 0], seg: 6 }),
    box(0.58, 0.28, 0.035, color, { p: [0.28, 0.78, 0], cast: false }),
    box(0.16, 0.28, 0.04, tint(color, 0.08), { p: [0.62, 0.78, 0.01], r: [0, 0, -10], cast: false }),
  ], name);
  setTick(g, (_dt, t) => {
    g.rotation.z = Math.sin(t * 2.4 + phase) * 0.08;
  });
  return g;
}

function starMesh(size: number, color: string, depth = 0.12): THREE.Mesh {
  return extrude(`star-${size}-${depth}`, () => starShape(size, size * 0.45, 5), depth, color, { bevel: depth * 0.18, shiny: 50 });
}

function bulb(p: V3, color: string): THREE.Object3D {
  return ball(0.11, color, { p, seg: 8, emissive: color, glow: 0.45, cast: false });
}

function cylXY(len: number, radius: number, color: string, angle: number, p: V3, z = 0, extra: Partial<Parameters<typeof cyl>[4]> = {}): THREE.Mesh {
  return cyl(radius, radius, len, color, { p: [p[0], p[1], z], r: [0, 0, -THREE.MathUtils.radToDeg(angle)], seg: 6, ...extra });
}

function triPennant(w: number, h: number, color: string, p: V3, r: V3 = [0, 0, 0]): THREE.Mesh {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-w / 2, 0, 0, w / 2, 0, 0, 0, -h, 0], 3));
  g.setIndex([0, 1, 2]);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat(color, { side: THREE.DoubleSide }));
  m.position.set(...p);
  m.rotation.set(r[0] * Math.PI / 180, r[1] * Math.PI / 180, r[2] * Math.PI / 180);
  m.castShadow = false;
  return m;
}

function canopyPanel(a0: number, a1: number, r: number, y: number, apexY: number, color: string): THREE.Mesh {
  const g = new THREE.BufferGeometry();
  const p0 = [Math.sin(a0) * r, y, Math.cos(a0) * r];
  const p1 = [Math.sin(a1) * r, y, Math.cos(a1) * r];
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, apexY, 0, ...p0, ...p1], 3));
  g.setIndex([0, 1, 2]);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat(color, { side: THREE.DoubleSide }));
  m.castShadow = true;
  return m;
}

function scallop(a: number, r: number, y: number, color: string): THREE.Mesh {
  const m = ball(0.28, color, { p: [Math.sin(a) * r, y, Math.cos(a) * r], s: [1.15, 0.28, 0.5], seg: 8, cast: false });
  m.rotation.y = a;
  return m;
}

function battlements(w: number, d: number, y: number, color = STONE_DARK): THREE.Group {
  const g = new THREE.Group();
  const nx = Math.max(3, Math.floor(w / 1.1));
  const nz = Math.max(3, Math.floor(d / 1.1));
  for (let i = 0; i < nx; i++) {
    const x = -w / 2 + 0.45 + (i * (w - 0.9)) / Math.max(1, nx - 1);
    g.add(box(0.48, 0.45, 0.42, color, { p: [x, y, d / 2 - 0.18] }));
    g.add(box(0.48, 0.45, 0.42, color, { p: [x, y, -d / 2 + 0.18] }));
  }
  for (let i = 1; i < nz - 1; i++) {
    const z = -d / 2 + 0.45 + (i * (d - 0.9)) / Math.max(1, nz - 1);
    g.add(box(0.42, 0.45, 0.48, color, { p: [w / 2 - 0.18, y, z] }));
    g.add(box(0.42, 0.45, 0.48, color, { p: [-w / 2 + 0.18, y, z] }));
  }
  return g;
}

function stainedWindow(p: V3, r: V3 = [0, 0, 0], c = BLUE): THREE.Group {
  return group([
    rbox(0.78, 1.25, 0.08, 0.05, '#ffffff', { p: [0, 0, 0.01] }),
    rbox(0.62, 1.05, 0.06, 0.05, c, { p: [0, 0, 0.06], shiny: 50, emissive: tint(c, -0.08), glow: 0.1, cast: false }),
    box(0.05, 1.0, 0.05, '#ffffff', { p: [0, 0, 0.1], cast: false }),
    box(0.58, 0.05, 0.05, '#ffffff', { p: [0, 0.17, 0.1], cast: false }),
  ], { p, r });
}

function mathBanner(sym: string, color: string, p: V3, r: V3 = [0, 0, 0]): THREE.Group {
  const g = group([
    cyl(0.04, 0.04, 0.82, PAL.woodLight, { p: [0, 0.75, 0.01], r: [0, 0, 90], seg: 6 }),
    box(0.72, 1.05, 0.05, color, { p: [0, 0.15, 0] }),
    box(0.72, 0.16, 0.06, tint(color, 0.08), { p: [0, 0.6, 0.02], cast: false }),
  ], { p, r });
  const t = textPlate(sym, 0.55, { color: '#ffffff', stroke: INK, strokeW: 10, pad: 4, doubleSided: true });
  t.position.set(0, 0.12, 0.04);
  g.add(t);
  return g;
}

function pony(color: string, p: V3): THREE.Group {
  const mane = tint(color, -0.18);
  return group([
    ball(0.34, color, { p: [0, 0.62, 0], s: [1.38, 0.82, 0.66], seg: 10, flat: false, shiny: 30 }),
    cyl(0.12, 0.15, 0.42, color, { p: [0.42, 0.78, 0], r: [0, 0, -35], seg: 8 }),
    ball(0.22, color, { p: [0.64, 0.94, 0], seg: 10, flat: false, shiny: 30 }),
    cone(0.09, 0.2, color, { p: [0.71, 1.15, 0.08], r: [0, 0, -25], seg: 6 }),
    cone(0.09, 0.2, color, { p: [0.71, 1.15, -0.08], r: [0, 0, -25], seg: 6 }),
    ball(0.035, INK, { p: [0.83, 0.97, 0.15], seg: 6, cast: false }),
    ball(0.018, '#ffffff', { p: [0.845, 0.985, 0.165], seg: 5, cast: false }),
    box(0.12, 0.42, 0.1, color, { p: [-0.24, 0.28, 0.18] }),
    box(0.12, 0.42, 0.1, color, { p: [0.22, 0.28, 0.18] }),
    box(0.12, 0.42, 0.1, color, { p: [-0.24, 0.28, -0.18] }),
    box(0.12, 0.42, 0.1, color, { p: [0.22, 0.28, -0.18] }),
    box(0.1, 0.5, 0.08, mane, { p: [0.45, 0.9, 0], r: [0, 0, -25], cast: false }),
    cone(0.1, 0.5, mane, { p: [-0.55, 0.7, 0], r: [0, 0, 75], seg: 7 }),
  ], { p });
}

/* -------------------------------- Khu vui chơi -------------------------------- */

defineModel<DemoOpt>('ferris_wheel', {
  build: () => {
    const root = new THREE.Group();
    root.add(rbox(6.2, 0.35, 3.1, 0.12, '#d8d0c2', { p: [0, 0.18, 0], receive: true }));
    root.add(box(4.8, 0.18, 1.15, '#f6e6b8', { p: [0, 0.45, 1.12] }));
    for (let i = 0; i < 4; i++) root.add(box(1.25 - i * 0.13, 0.14, 0.86, i % 2 ? '#ffe8a3' : '#ffffff', { p: [0, 0.52 + i * 0.12, 2.0 + i * 0.27] }));
    for (const sx of [-1, 1]) {
      root.add(cyl(0.12, 0.16, 6.25, BLUE, { p: [sx * 1.46, 3.08, 0.38], r: [0, 0, sx * 24], seg: 8 }));
      root.add(cyl(0.12, 0.16, 6.25, LILAC, { p: [sx * 1.46, 3.08, -0.38], r: [0, 0, sx * 24], seg: 8 }));
      root.add(rbox(0.76, 0.28, 0.72, 0.08, '#bcae9c', { p: [sx * 2.75, 0.62, 0.38] }));
      root.add(rbox(0.76, 0.28, 0.72, 0.08, '#bcae9c', { p: [sx * 2.75, 0.62, -0.38] }));
    }
    root.add(cyl(0.22, 0.22, 1.2, GOLD, { p: [0, 5.45, 0], r: [90, 0, 0], seg: 12, shiny: 50 }));

    const wheel = pivot([0, 5.45, 0], [], 'wheel');
    for (const z of [-0.23, 0.23]) {
      wheel.add(torus(2.5, 0.1, z < 0 ? PINK : TEAL, { p: [0, 0, z], seg: 8, ts: 56, cast: false }));
      wheel.add(torus(2.1, 0.045, YELLOW, { p: [0, 0, z], seg: 6, ts: 48, cast: false }));
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const x = Math.sin(a);
      const y = Math.cos(a);
      wheel.add(cylXY(2.3, 0.035, i % 2 ? YELLOW : BLUE, a, [x * 1.15, y * 1.15, 0], -0.23, { cast: false }));
      wheel.add(cylXY(2.3, 0.035, i % 2 ? BLUE : LILAC, a, [x * 1.15, y * 1.15, 0], 0.23, { cast: false }));
      wheel.add(cyl(0.025, 0.025, 0.52, TEAL, { p: [x * 2.48, y * 2.48, 0], r: [90, 0, 0], seg: 5, cast: false }));
      if (i % 2 === 0) {
        wheel.add(bulb([x * 2.55, y * 2.55, 0.28], i % 4 ? YELLOW : PINK));
        wheel.add(bulb([x * 2.55, y * 2.55, -0.28], i % 4 ? BLUE : TEAL));
      }
    }
    const hub = pivot([0, 0, 0.32], [starMesh(0.42, GOLD, 0.12), ball(0.2, GOLD, { p: [0, 0, 0.08], seg: 10, shiny: 70 })]);
    hub.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = false; });
    wheel.add(hub);
    const cabs: THREE.Group[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const col = CANDY[i % CANDY.length];
      const cab = pivot([Math.sin(a) * 2.35, Math.cos(a) * 2.35, 0.1], [
        rbox(0.78, 0.44, 0.58, 0.1, col, { p: [0, -0.58, 0], shiny: 35, cast: false }),
        prism(0.86, 0.28, 0.66, col, { p: [0, -0.29, 0], cast: false }),
      ], `cab${i}`);
      cabs.push(cab);
      wheel.add(cab);
    }
    setTick(wheel, (dt) => {
      wheel.rotation.z += dt * 0.22;
      for (const cab of cabs) cab.rotation.z = -wheel.rotation.z;
    });
    root.add(wheel);
    root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = false; });
    return root;
  },
  colliders: [{ kind: 'box', w: 5.9, d: 2.9 }],
  height: 8.2,
  tags: ['park', 'ride'],
  desc: 'Vòng quay pastel; node wheel quay, cab0…cab7 luôn treo thẳng.',
  variants: [{}],
});

defineModel<DemoOpt>('roller_coaster', {
  build: (o) => {
    const root = new THREE.Group();
    const pts: V3[] = [
      [-7.4, 1.0, 2.7], [-4.8, 1.0, 3.8], [-1.3, 4.9, 3.2], [1.9, 5.9, 0.7], [3.3, 3.0, -1.6], [1.2, 1.55, -3.7], [-2.0, 3.4, -3.1], [-4.0, 1.25, -1.4], [-6.7, 1.0, 0.7],
    ];
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), true, 'catmullrom', 0.45);
    root.userData.track = curve;
    const rail = (off: number): V3[] => {
      const out: V3[] = [];
      const p = new THREE.Vector3();
      const t = new THREE.Vector3();
      for (let i = 0; i < 36; i++) {
        const u = i / 36;
        curve.getPointAt(u, p);
        curve.getTangentAt(u, t);
        const nx = t.z;
        const nz = -t.x;
        const l = Math.hypot(nx, nz) || 1;
        out.push([p.x + (nx / l) * off, p.y, p.z + (nz / l) * off]);
      }
      return out;
    };
    root.add(tube(rail(-0.38), 0.11, RED, { closed: true, seg: 72, radial: 6 }));
    root.add(tube(rail(0.38), 0.11, BLUE, { closed: true, seg: 72, radial: 6 }));
    root.add(tube(rail(0), 0.055, YELLOW, { closed: true, seg: 72, radial: 5, cast: false }));
    const pos = new THREE.Vector3();
    const tan = new THREE.Vector3();
    for (let i = 0; i < 34; i++) {
      const u = i / 34;
      curve.getPointAt(u, pos);
      curve.getTangentAt(u, tan);
      const yaw = Math.atan2(tan.x, tan.z) * 180 / Math.PI;
      root.add(rbox(1.1, 0.1, 0.26, 0.04, '#fff8ee', { p: [pos.x, pos.y - 0.13, pos.z], r: [0, yaw, 0], cast: false }));
      if (i % 3 === 0 && pos.y > 1.25) {
        root.add(cyl(0.11, 0.15, pos.y - 0.24, PAL.woodDark, { p: [pos.x, (pos.y - 0.24) / 2, pos.z], seg: 7 }));
        root.add(cyl(0.34, 0.4, 0.18, '#d8d0c2', { p: [pos.x, 0.09, pos.z], seg: 10 }));
      }
    }
    root.add(rbox(4.2, 0.42, 2.2, 0.1, '#d8d0c2', { p: [-6.25, 0.21, 2.15] }));
    root.add(box(4.4, 0.16, 2.4, '#ffe8a3', { p: [-6.25, 0.62, 2.15] }));
    root.add(prism(4.7, 0.9, 2.75, TEAL, { p: [-6.25, 2.08, 2.15], r: [0, 0, 0] }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) root.add(cyl(0.08, 0.1, 1.55, PAL.woodLight, { p: [-6.25 + sx * 1.8, 1.28, 2.15 + sz * 0.9], seg: 6 }));
    root.add(sign('TÀU LƯỢN', 0.42, [-6.25, 1.55, 3.38], [0, 0, 0], '#fff8ee'));
    const train = pivot([0, 0, 0], [], 'train');
    for (let i = 0; i < 3; i++) {
      train.add(group([
        rbox(0.78, 0.42, 0.86, 0.12, CANDY[i], { p: [0, 0.25, -i * 0.78], shiny: 45 }),
        rbox(0.52, 0.18, 0.48, 0.08, '#ffffff', { p: [0, 0.52, -i * 0.78], cast: false }),
        ball(0.08, INK, { p: [-0.2, 0.3, -i * 0.78 + 0.44], seg: 6, cast: false }),
        ball(0.08, INK, { p: [0.2, 0.3, -i * 0.78 + 0.44], seg: 6, cast: false }),
        i === 0 ? box(0.28, 0.035, 0.035, '#ffffff', { p: [0, 0.15, 0.47], cast: false }) : null,
      ]));
    }
    curve.getPointAt(0.03, pos);
    train.position.copy(pos);
    root.add(train);
    if (o.demo) {
      const p = new THREE.Vector3();
      const q = new THREE.Vector3();
      const target = new THREE.Vector3();
      setTick(train, (_dt, t) => {
        const u = (t * 0.075) % 1;
        curve.getPointAt(u, p);
        curve.getTangentAt(u, q);
        train.position.copy(p);
        target.copy(p).add(q);
        train.lookAt(target);
      });
    }
    return root;
  },
  colliders: [
    { kind: 'box', w: 4.6, d: 2.6, at: [-6.25, 2.15] },
    { kind: 'circle', r: 0.35, at: [-1.3, 3.2] },
    { kind: 'circle', r: 0.35, at: [1.9, 0.7] },
    { kind: 'circle', r: 0.35, at: [-2.0, -3.1] },
  ],
  height: 6.4,
  tags: ['park', 'ride'],
  desc: 'Tàu lượn nhỏ; root.userData.track là CatmullRomCurve3, train chạy khi demo=true.',
  variants: [{ demo: true }, {}],
});

defineModel('ball_booth', {
  build: () => {
    const root = new THREE.Group();
    root.add(rbox(4.2, 0.18, 2.0, 0.08, '#d8d0c2', { p: [0, 0.09, 0] }));
    root.add(rbox(4.0, 1.05, 0.75, 0.1, '#c8915a', { p: [0, 0.7, 0.65] }));
    root.add(box(4.25, 0.18, 0.95, '#fff2c7', { p: [0, 1.28, 0.72] }));
    root.add(box(4.1, 2.15, 0.18, '#fff8ee', { p: [0, 1.45, -0.55] }));
    for (const x of [-1.9, 1.9]) root.add(cyl(0.07, 0.09, 2.6, PAL.woodLight, { p: [x, 1.42, 0.42], seg: 6 }));
    for (let i = 0; i < 8; i++) root.add(box(0.55, 0.16, 2.3, i % 2 ? '#ffffff' : RED, { p: [-1.95 + i * 0.56, 2.75, 0.18], r: [0, 0, i % 2 ? 8 : -8] }));
    root.add(box(4.5, 0.12, 2.35, '#ff6b6b', { p: [0, 2.63, 0.18] }));
    const slots: [number, number, number][] = [];
    const slotData = [[-1.35, 1.55], [-0.65, 2.05], [0, 1.55], [0.65, 2.05], [1.35, 1.55]];
    slotData.forEach(([x, y], i) => {
      slots.push([x, y, -0.38]);
      root.add(torus(0.22, 0.035, CANDY[i], { p: [x, y, -0.42], r: [0, 0, 0], seg: 6, ts: 18 }));
      root.add(cyl(0.045, 0.055, 0.32, PAL.woodLight, { p: [x, y - 0.22, -0.43], seg: 6 }));
    });
    root.userData.slots = slots;
    root.add(group([
      cyl(0.42, 0.32, 0.26, '#d7a56d', { p: [0, 0, 0], seg: 10 }),
      ball(0.14, RED, { p: [-0.18, 0.2, 0.05], seg: 8 }),
      ball(0.14, BLUE, { p: [0.08, 0.23, 0.0], seg: 8 }),
      ball(0.14, YELLOW, { p: [0.23, 0.18, 0.12], seg: 8 }),
    ], { p: [1.35, 1.45, 0.94] }));
    root.add(sign('NÉM BÓNG', 0.42, [0, 2.38, 0.64], [0, 0, 0], '#fff8ee'));
    return root;
  },
  colliders: [{ kind: 'box', w: 4.35, d: 2.1 }],
  height: 3.05,
  tags: ['park'],
  desc: 'Quầy Ném bóng; root.userData.slots có 5 vị trí bóng.',
  variants: [{}],
});

defineModel('park_gate', {
  build: () => {
    const root = new THREE.Group();
    for (const sx of [-1, 1]) {
      root.add(rbox(0.85, 3.25, 0.85, 0.12, '#ffe8a3', { p: [sx * 2.7, 1.63, 0] }));
      root.add(cone(0.62, 0.9, sx < 0 ? LILAC : TEAL, { p: [sx * 2.7, 3.7, 0], seg: 8 }));
      root.add(ball(0.2, GOLD, { p: [sx * 2.7, 4.25, 0], seg: 8, emissive: GOLD, glow: 0.25 }));
      root.add(balloonCluster(sx * 3.25, 2.5, -0.6, sx));
    }
    root.add(torus(2.7, 0.18, '#ff9ec7', { p: [0, 2.95, 0], seg: 8, ts: 28, arc: 180, r: [0, 0, 0] }));
    root.add(box(5.55, 0.35, 0.55, '#ff9ec7', { p: [0, 2.95, 0] }));
    root.add(sign('KHU VUI CHƠI', 0.55, [0, 3.32, 0.32]));
    root.add(sign('KHU VUI CHƠI', 0.55, [0, 3.32, -0.32], [0, 180, 0]));
    const star = starMesh(0.68, GOLD, 0.16);
    star.position.set(0, 4.33, 0.04);
    root.add(star);
    const gateL = pivot([-0.18, 0.95, 0], [rbox(2.1, 1.75, 0.18, 0.06, '#8fd3f4', { p: [-1.05, 0, 0] })], 'gateL');
    const gateR = pivot([0.18, 0.95, 0], [rbox(2.1, 1.75, 0.18, 0.06, '#b197fc', { p: [1.05, 0, 0] })], 'gateR');
    root.add(gateL, gateR);
    const lock = pivot([0, 1.58, 0.18], [starMesh(0.34, GOLD, 0.08)], 'lock');
    root.add(lock);
    return root;
  },
  colliders: [
    { kind: 'box', w: 0.95, d: 0.95, at: [-2.7, 0] },
    { kind: 'box', w: 0.95, d: 0.95, at: [2.7, 0] },
    { kind: 'box', w: 4.5, d: 0.28, at: [0, 0] },
  ],
  height: 4.9,
  tags: ['park'],
  desc: 'Cổng Khu Vui Chơi; gateL/gateR mở bằng rotate.y, lock là huy hiệu khóa.',
  variants: [{}],
});

defineModel<ParkTextOpt>('park_food_stall', {
  build: (o) => {
    const color = o.color ?? (o.kind === 'popcorn' ? '#ffd166' : o.kind === 'cotton' ? PINK : TEAL);
    const label = o.text ?? (o.kind === 'popcorn' ? 'BẮP RANG' : o.kind === 'cotton' ? 'KẸO BÔNG' : 'QUẦY KẸO');
    const root = new THREE.Group();
    root.add(rbox(2.7, 0.35, 1.85, 0.1, '#d8d0c2', { p: [0, 0.18, 0] }));
    root.add(rbox(2.5, 1.15, 0.9, 0.1, '#fff8ee', { p: [0, 0.92, 0.32] }));
    root.add(rbox(2.8, 0.22, 1.05, 0.08, tint(color, 0.12), { p: [0, 1.62, 0.36] }));
    for (const x of [-1.18, 1.18]) root.add(cyl(0.045, 0.055, 2.05, PAL.woodLight, { p: [x, 1.15, 0.16], seg: 6 }));
    for (let i = 0; i < 6; i++) root.add(box(0.48, 0.12, 1.18, i % 2 ? '#ffffff' : color, { p: [-1.2 + i * 0.48, 2.22, 0.16], r: [0, 0, i % 2 ? 8 : -8], cast: false }));
    root.add(box(2.95, 0.1, 1.24, color, { p: [0, 2.1, 0.16], cast: false }));
    root.add(sign(label, 0.26, [0, 1.64, 0.84], [0, 0, 0], '#fff8ee'));
    if (o.kind === 'popcorn') {
      for (let i = 0; i < 8; i++) root.add(ball(0.07, i % 2 ? '#fff8ee' : YELLOW, { p: [-0.55 + (i % 4) * 0.28, 1.78 + Math.floor(i / 4) * 0.12, 0.84], seg: 6, cast: false }));
    } else if (o.kind === 'cotton') {
      root.add(ball(0.28, PINK, { p: [-0.55, 1.9, 0.84], s: [1, 1.25, 0.8], seg: 10, flat: false, shiny: 35 }));
      root.add(ball(0.28, BLUE, { p: [0.1, 1.9, 0.84], s: [1, 1.25, 0.8], seg: 10, flat: false, shiny: 35 }));
    } else {
      root.add(ball(0.12, RED, { p: [-0.36, 1.82, 0.84], seg: 8 }));
      root.add(ball(0.12, BLUE, { p: [0, 1.82, 0.84], seg: 8 }));
      root.add(ball(0.12, YELLOW, { p: [0.36, 1.82, 0.84], seg: 8 }));
    }
    return root;
  },
  colliders: [{ kind: 'box', w: 2.85, d: 1.95 }],
  height: 2.35,
  tags: ['park'],
  desc: 'Quầy đồ ăn công viên: kind popcorn/cotton/ice, text/color.',
  variants: [{ kind: 'popcorn' }, { kind: 'cotton' }, { text: 'KEM', color: '#4ecdc4' }],
});

defineModel<ParkTextOpt>('clown_stage', {
  build: () => {
    const root = new THREE.Group();
    root.add(rbox(4.4, 0.45, 2.4, 0.12, '#d8d0c2', { p: [0, 0.23, 0] }));
    root.add(rbox(4.1, 0.18, 2.1, 0.08, '#ffe8a3', { p: [0, 0.6, 0] }));
    root.add(box(4.4, 2.0, 0.14, '#fff8ee', { p: [0, 1.62, -0.95] }));
    for (const x of [-1.55, 1.55]) {
      root.add(box(0.8, 1.75, 0.16, RED, { p: [x, 1.52, -0.84], r: [0, 0, x < 0 ? -4 : 4] }));
      root.add(cyl(0.045, 0.05, 2.25, GOLD, { p: [x * 1.1, 1.65, -0.73], seg: 6 }));
    }
    root.add(prism(4.8, 0.85, 2.7, PINK, { p: [0, 3.02, 0], r: [0, 0, 0] }));
    root.add(sign('SÂN KHẤU BIBO', 0.34, [0, 2.08, -0.78], [0, 0, 0], '#fff8ee'));
    root.add(starMesh(0.34, GOLD, 0.08));
    root.children[root.children.length - 1].position.set(0, 3.44, -0.05);
    for (let i = 0; i < 5; i++) root.add(bulb([-1.55 + i * 0.78, 2.52, -0.62], i % 2 ? BLUE : YELLOW));
    return root;
  },
  colliders: [{ kind: 'box', w: 4.5, d: 2.5 }],
  height: 3.55,
  tags: ['park'],
  desc: 'Sân khấu nhỏ có rèm cho Chú Hề Bibo.',
  variants: [{}],
});

defineModel('park_ticket_board', {
  build: () => {
    const root = new THREE.Group();
    root.add(rbox(4.2, 2.4, 0.25, 0.1, '#fff8ee', { p: [0, 1.6, 0] }));
    root.add(rbox(4.45, 0.28, 0.35, 0.08, PINK, { p: [0, 2.92, 0.02] }));
    root.add(sign('BẢNG VÉ', 0.36, [0, 2.95, 0.24], [0, 0, 0], '#fff8ee'));
    const names = ['TÀU', 'BÓNG', 'QUAY', 'BIBO'];
    for (let i = 0; i < 4; i++) {
      const x = -1.55 + i * 1.03;
      root.add(rbox(0.82, 0.62, 0.08, 0.08, '#f0e9dc', { p: [x, 1.72, 0.18], cast: false }));
      root.add(sign(names[i], 0.18, [x, 1.22, 0.22], [0, 0, 0], '#fff8ee'));
    }
    for (const x of [-1.9, 1.9]) root.add(cyl(0.07, 0.09, 2.8, PAL.woodLight, { p: [x, 1.4, -0.06], seg: 6 }));
    return root;
  },
  colliders: [{ kind: 'box', w: 4.4, d: 0.45 }],
  height: 3.1,
  tags: ['park'],
  desc: 'Bảng tiến độ vé ở cổng khu vui chơi; zone đặt icon vé lên các ô.',
  variants: [{}],
});

defineModel<ParkTextOpt>('string_lights', {
  build: (o) => {
    const len = Number(o.text ?? 6) || 6;
    const root = new THREE.Group();
    root.add(tube([[-len / 2, 2.35, 0], [-len / 4, 2.12, 0], [0, 2.02, 0], [len / 4, 2.12, 0], [len / 2, 2.35, 0]], 0.025, '#4a3a2a', { seg: 18, radial: 4, cast: false }));
    for (let i = 0; i <= 8; i++) {
      const x = -len / 2 + (i / 8) * len;
      const sag = Math.sin((i / 8) * Math.PI) * -0.28;
      root.add(bulb([x, 2.28 + sag, 0], CANDY[i % CANDY.length]));
    }
    return root;
  },
  colliders: [],
  height: 2.45,
  tags: ['park'],
  desc: 'Dây đèn lễ hội treo giữa hai cột; tùy chọn text=len.',
  variants: [{ text: '6' }, { text: '8' }],
});

defineModel('carousel', {
  build: () => {
    const root = new THREE.Group();
    root.add(cyl(3.05, 3.25, 0.45, '#ffe8a3', { base: true, seg: 24 }));
    root.add(cyl(2.65, 2.75, 0.18, '#fff4c8', { p: [0, 0.55, 0], seg: 24 }));
    for (let i = 0; i < 3; i++) root.add(box(1.1 - i * 0.1, 0.12, 0.7, i % 2 ? '#ffffff' : '#f6e6b8', { p: [0, 0.5 + i * 0.12, 3.0 + i * 0.28] }));
    const spin = pivot([0, 0.35, 0], [], 'spin');
    spin.add(cyl(0.22, 0.28, 3.45, GOLD, { p: [0, 1.72, 0], seg: 12, shiny: 60 }));
    spin.add(torus(0.34, 0.055, PINK, { p: [0, 1.2, 0], r: [90, 0, 0], seg: 6, ts: 18, cast: false }));
    spin.add(torus(0.34, 0.055, TEAL, { p: [0, 2.1, 0], r: [90, 0, 0], seg: 6, ts: 18, cast: false }));
    const panels = 16;
    for (let i = 0; i < panels; i++) {
      const a0 = (i / panels) * Math.PI * 2;
      const a1 = ((i + 1) / panels) * Math.PI * 2;
      spin.add(canopyPanel(a0, a1, 3.05, 3.03, 4.28, i % 2 ? '#ffffff' : PINK));
      if (i % 2 === 0) spin.add(scallop((a0 + a1) / 2, 2.95, 2.9, i % 4 ? PINK : RED));
    }
    spin.add(ball(0.22, GOLD, { p: [0, 4.32, 0], seg: 10, shiny: 70 }));
    spin.add(cyl(0.03, 0.035, 0.72, PAL.woodLight, { p: [0, 4.64, 0], seg: 6 }));
    spin.add(box(0.42, 0.22, 0.035, RED, { p: [0.2, 4.88, 0], cast: false }));
    const ponies = pivot([0, 0, 0], [], 'ponies');
    ponies.userData.dynamic = true;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      spin.add(cyl(0.04, 0.05, 2.65, GOLD, { p: [Math.sin(a) * 1.85, 1.7, Math.cos(a) * 1.85], seg: 8, shiny: 70 }));
      const pg = pony([PINK, LILAC, BLUE, TEAL, YELLOW, RED][i], [Math.sin(a) * 1.85, 0.82, Math.cos(a) * 1.85]);
      pg.rotation.y = a + Math.PI / 2;
      ponies.add(pg);
    }
    spin.add(ponies);
    setTick(spin, (_dt, t) => {
      spin.rotation.y = t * 0.45;
      ponies.position.y = Math.sin(t * 2.3) * 0.18;
    });
    spin.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = false; });
    root.add(spin);
    return root;
  },
  colliders: [{ kind: 'circle', r: 3.25 }],
  height: 4.45,
  tags: ['park', 'ride'],
  desc: 'Đu quay ngựa; node spin quay, ngựa nhún lên xuống.',
  variants: [{}],
});

function balloonCluster(x: number, y: number, z: number, sx = 1): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = i * 1.7;
    const bx = Math.cos(a) * 0.22;
    const bz = Math.sin(a) * 0.15;
    g.add(cyl(0.012, 0.012, 1.0 + i * 0.12, '#ffffff', { p: [bx * sx, -0.25, bz], r: [8 * sx, 0, (i - 1.5) * 8], seg: 4, cast: false }));
    g.add(ball(0.23, [RED, YELLOW, BLUE][i], { p: [bx * sx, 0.25 + i * 0.12, bz], s: [0.9, 1.18, 0.9], seg: 10, flat: false, shiny: 35 }));
  }
  g.position.set(x, y, z);
  return g;
}

/* -------------------------------- Lâu đài -------------------------------- */

function castleTower(name: string | undefined, x: number, z: number, h = 8, r = 1.45, style: CastleStyleOpt = {}): THREE.Group {
  const stone = style.stone ?? STONE;
  const trim = style.trim ?? STONE_DARK;
  const roof = style.roof ?? (x < 0 ? BLUE : LILAC);
  const g = group([], name ? { name } : {});
  g.position.set(x, 0, z);
  g.add(cyl(r, r * 1.05, h, stone, { p: [0, h / 2, 0], seg: 14 }));
  g.add(cyl(r * 1.12, r * 1.12, 0.35, trim, { p: [0, h + 0.1, 0], seg: 14 }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(box(0.36, 0.42, 0.32, trim, { p: [Math.sin(a) * r * 0.92, h + 0.46, Math.cos(a) * r * 0.92], r: [0, THREE.MathUtils.radToDeg(a), 0] }));
  }
  g.add(cone(r * 1.15, 2.2, roof, { p: [0, h + 1.65, 0], seg: 14 }));
  g.add(stainedWindow([0, h * 0.56, r + 0.02], [0, 0, 0], x < 0 ? PINK : TEAL));
  return g;
}

defineModel<CastleStyleOpt>('castle', {
  build: (o) => {
    const stone = o.stone ?? STONE;
    const trim = o.trim ?? STONE_DARK;
    const accent = o.accent ?? GOLD;
    const root = new THREE.Group();
    root.add(rbox(10.2, 0.35, 8.2, 0.1, '#d8d0c2', { p: [0, 0.18, 0] }));
    root.add(box(10, 7.0, 8, stone, { p: [0, 3.7, 0] }));
    root.add(box(3.2, 3.2, 0.22, '#6b4a35', { p: [0, 2.15, 4.12] }));
    root.add(torus(1.6, 0.13, trim, { p: [0, 3.82, 4.23], arc: 180, seg: 8, ts: 22 }));
    const gate = pivot([0, 0, 4.29], [
      box(2.75, 3.45, 0.18, '#8a6f56', { p: [0, 2.0, 0] }),
      ...[-1.0, -0.5, 0, 0.5, 1.0].map((x) => cyl(0.035, 0.04, 3.5, '#3d3550', { p: [x, 2.0, 0.13], seg: 5 })),
      box(2.7, 0.12, 0.16, '#3d3550', { p: [0, 2.9, 0.14] }),
    ], 'gate');
    root.add(gate);
    root.add(battlements(10.3, 8.3, 7.45, trim));
    root.add(castleTower(undefined, -4.4, 3.45, 9.0, 1.35, o));
    root.add(castleTower(undefined, 4.4, 3.45, 9.0, 1.35, o.roof ? { ...o, roof: tint(o.roof, -0.08) } : o));
    root.add(simpleFlag('flag0', o.flag ?? RED, [-4.4, 11.45, 3.45], 0));
    root.add(simpleFlag('flag1', accent, [4.4, 11.45, 3.45], 1.4));
    for (const x of [-2.8, 2.8]) root.add(stainedWindow([x, 5.25, 4.12], [0, 0, 0], x < 0 ? PINK : TEAL));
    for (const x of [-3.2, 0, 3.2]) root.add(stainedWindow([x, 4.8, -4.12], [0, 180, 0], BLUE));
    root.add(mathBanner('+', RED, [-4.85, 4.2, 1.0], [0, -90, 0]));
    root.add(mathBanner('×', LILAC, [4.85, 4.2, 1.0], [0, 90, 0]));
    for (let i = 0; i < 4; i++) root.add(box(3.8 - i * 0.35, 0.18, 0.72, i % 2 ? '#fff8ee' : '#e2d3b0', { p: [0, 0.43 + i * 0.15, 4.85 + i * 0.35] }));
    root.add(sign('LÂU ĐÀI\nTOÁN HỌC', 0.72, [0, 6.65, 4.16], [0, 0, 0], '#fff8ee'));
    return root;
  },
  colliders: [
    { kind: 'box', w: 10.2, d: 0.45, at: [0, -4.0] },
    { kind: 'box', w: 1.0, d: 8.0, at: [-4.65, 0] },
    { kind: 'box', w: 1.0, d: 8.0, at: [4.65, 0] },
    { kind: 'box', w: 3.0, d: 0.45, at: [-3.5, 4.0] },
    { kind: 'box', w: 3.0, d: 0.45, at: [3.5, 4.0] },
    { kind: 'circle', r: 1.45, at: [-4.4, 3.45] },
    { kind: 'circle', r: 1.45, at: [4.4, 3.45] },
  ],
  height: 12.8,
  tags: ['castle'],
  desc: 'Lâu Đài Toán Học; gate là lưới nâng position.y, flag0/flag1 vẫy.',
  variants: [{}],
});

defineModel<CastleStyleOpt>('castle_tower', {
  build: (o) => {
    const root = new THREE.Group();
    root.add(castleTower(undefined, 0, 0, 8, 1.5, o));
    root.add(simpleFlag('flag0', o.flag ?? RED, [0, 10.55, 0], 0.3));
    return root;
  },
  colliders: [{ kind: 'circle', r: 1.55 }],
  height: 11.0,
  tags: ['castle'],
  desc: 'Tháp tròn độc lập có flag0 vẫy.',
  variants: [{}],
});

defineModel<{ len?: number } & CastleStyleOpt>('castle_wall', {
  build: (o) => {
    const len = o.len ?? 6;
    const stone = o.stone ?? STONE;
    const trim = o.trim ?? STONE_DARK;
    const root = new THREE.Group();
    root.add(box(len, 3.15, 0.65, stone, { p: [0, 1.6, 0] }));
    root.add(box(len + 0.15, 0.26, 0.78, trim, { p: [0, 3.18, 0] }));
    const n = Math.max(3, Math.floor(len / 0.9));
    for (let i = 0; i < n; i++) root.add(box(0.45, 0.45, 0.78, trim, { p: [-len / 2 + 0.35 + (i * (len - 0.7)) / Math.max(1, n - 1), 3.55, 0] }));
    return root;
  },
  colliders: (o) => [{ kind: 'box', w: o.len ?? 6, d: 0.75 }],
  height: 3.85,
  tags: ['castle'],
  desc: 'Đoạn tường răng cưa, tùy chọn len.',
  variants: [{ len: 4 }, { len: 6 }, { len: 8 }],
});

defineModel<CastleStyleOpt>('hall_throne', {
  build: (o) => {
    const stone = o.stone ?? STONE;
    const trim = o.trim ?? '#d0c4f7';
    const floor = o.floor ?? '#efe9df';
    const carpet = o.carpet ?? RED;
    const root = new THREE.Group();
    root.add(box(16, 0.12, 12, floor, { p: [0, 0.06, 0], receive: true }));
    for (let x = -7; x <= 7; x += 2) for (let z = -5; z <= 5; z += 2) root.add(box(1.9, 0.025, 1.9, (x + z) % 4 ? '#f7f0df' : '#e6e0d6', { p: [x, 0.13, z], cast: false }));
    root.add(box(2.1, 0.04, 10.8, carpet, { p: [0, 0.16, 0.7], cast: false }));
    const wallN = pivot([0, 2.0, -6.05], [box(16, 4.0, 0.32, stone, { p: [0, 0, 0] })], 'wallN');
    const wallW = pivot([-8.05, 2.0, 0], [box(0.32, 4.0, 12, stone, { p: [0, 0, 0] })], 'wallW');
    const wallE = pivot([8.05, 2.0, 0], [box(0.32, 4.0, 12, stone, { p: [0, 0, 0] })], 'wallE');
    root.add(wallN, wallW, wallE);
    for (const x of [-5.2, 0, 5.2]) root.add(stainedWindow([x, 2.6, -5.86], [0, 0, 0], x === 0 ? YELLOW : BLUE));
    root.add(mathBanner('+', RED, [-2.5, 2.35, -5.82]));
    root.add(mathBanner('÷', LILAC, [2.5, 2.35, -5.82]));
    const pillarPos: [number, number][] = [[-6.5, -3.5], [6.5, -3.5], [-6.5, 2.8], [6.5, 2.8]];
    for (const [x, z] of pillarPos) root.add(group([cyl(0.38, 0.45, 3.8, '#e2d3b0', { p: [0, 1.9, 0], seg: 10 }), cyl(0.55, 0.55, 0.22, trim, { p: [0, 0.2, 0], seg: 10 }), cyl(0.55, 0.55, 0.22, trim, { p: [0, 3.65, 0], seg: 10 })], { p: [x, 0, z] }));
    root.add(rbox(4.0, 0.55, 2.8, 0.12, '#d8d0c2', { p: [0, 0.42, -4.15] }));
    root.add(group([
      rbox(1.55, 0.35, 1.2, 0.08, GOLD, { p: [0, 0.18, 0.2], shiny: 50 }),
      rbox(1.3, 2.1, 0.35, 0.1, '#d6425a', { p: [0, 1.2, -0.25] }),
      rbox(1.75, 2.35, 0.42, 0.12, GOLD, { p: [0, 1.32, -0.34], shiny: 60 }),
      rbox(1.05, 1.65, 0.28, 0.08, RED, { p: [0, 1.22, -0.16] }),
      ball(0.18, GOLD, { p: [-0.8, 2.55, -0.34], seg: 8, shiny: 70 }),
      ball(0.18, GOLD, { p: [0.8, 2.55, -0.34], seg: 8, shiny: 70 }),
    ], { p: [0, 0.7, -4.2] }));
    return root;
  },
  colliders: [
    { kind: 'box', w: 16.2, d: 0.4, at: [0, -6.05] },
    { kind: 'box', w: 0.4, d: 12, at: [-8.05, 0] },
    { kind: 'box', w: 0.4, d: 12, at: [8.05, 0] },
    { kind: 'box', w: 4.0, d: 2.8, at: [0, -4.15], top: 0.7 },
    { kind: 'circle', r: 0.55, at: [-6.5, -3.5] },
    { kind: 'circle', r: 0.55, at: [6.5, -3.5] },
    { kind: 'circle', r: 0.55, at: [-6.5, 2.8] },
    { kind: 'circle', r: 0.55, at: [6.5, 2.8] },
  ],
  height: 4.4,
  tags: ['castle'],
  desc: 'Phòng ngai; wallN/wallW/wallE để game fade theo camera.',
  variants: [{}],
});

/* -------------------------------- Props -------------------------------- */

defineModel<{ standing?: boolean }>('torch', {
  build: (o) => {
    const standing = o.standing !== false;
    const root = new THREE.Group();
    if (standing) root.add(cyl(0.06, 0.08, 1.6, PAL.woodDark, { p: [0, 0.8, 0], seg: 6 }));
    else root.add(cyl(0.05, 0.06, 0.9, PAL.woodDark, { p: [0, 0.45, 0], r: [25, 0, 0], seg: 6 }));
    root.add(cyl(0.18, 0.13, 0.24, '#6b4a35', { p: [0, standing ? 1.68 : 0.94, 0], seg: 8 }));
    const flame = pivot([0, standing ? 1.92 : 1.18, 0], [cone(0.18, 0.42, '#ff9f1c', { p: [0, 0.12, 0], seg: 8, emissive: '#ff7b00', glow: 0.75, cast: false }), ball(0.12, '#ffe66d', { p: [0, 0.13, 0], seg: 8, emissive: '#ffd166', glow: 1.1, cast: false })], 'flame');
    setTick(flame, (_dt, t) => {
      const s = 1 + Math.sin(t * 11.0) * 0.08;
      flame.scale.set(0.92 + Math.sin(t * 7.3) * 0.06, s, 0.92);
    });
    root.add(flame);
    return root;
  },
  colliders: (o) => (o.standing === false ? [] : [{ kind: 'circle', r: 0.18 } as Collider]),
  height: (o) => (o.standing === false ? 1.45 : 2.25),
  tags: ['castle'],
  desc: 'Đuốc; flame nhấp nháy emissive, standing=false là đuốc tường.',
  variants: [{ standing: true }, { standing: false }],
});

defineModel<{ sym?: string; color?: string }>('banner', {
  build: (o) => mathBanner(o.sym ?? '+', o.color ?? RED, [0, 0.75, 0]),
  height: 1.6,
  tags: ['castle'],
  desc: 'Cờ treo ký hiệu toán học, tùy chọn sym/color.',
  variants: [{ sym: '+', color: RED }, { sym: '−', color: TEAL }, { sym: '×', color: LILAC }, { sym: '÷', color: BLUE }],
});

defineModel<{ len?: number; colors?: string[] }>('bunting', {
  build: (o) => {
    const len = o.len ?? 6;
    const cols = o.colors ?? CANDY;
    const root = new THREE.Group();
    root.add(cyl(0.055, 0.075, 2.0, PAL.woodLight, { p: [-len / 2, 1.0, 0], seg: 6 }));
    root.add(cyl(0.055, 0.075, 2.0, PAL.woodLight, { p: [len / 2, 1.0, 0], seg: 6 }));
    root.add(tube([[-len / 2, 1.9, 0], [0, 1.62, 0], [len / 2, 1.9, 0]], 0.025, '#ffffff', { seg: 18, radial: 5, cast: false }));
    const flags = pivot([0, 0, 0], [], 'flags');
    flags.userData.dynamic = true;
    const n = Math.max(4, Math.floor(len / 0.55));
    for (let i = 0; i < n; i++) {
      const x = -len / 2 + 0.35 + (i * (len - 0.7)) / Math.max(1, n - 1);
      const u = (x + len / 2) / len;
      const sagY = 1.9 - Math.sin(u * Math.PI) * 0.28;
      flags.add(triPennant(0.38, 0.52, cols[i % Math.min(cols.length, 6)], [x, sagY - 0.02, 0.02], [0, 0, Math.sin(u * Math.PI) * 6 - 3]));
    }
    root.add(flags);
    setTick(root, (_dt, t) => {
      flags.rotation.z = Math.sin(t * 2.5) * 0.06;
    });
    return root;
  },
  colliders: (o) => [{ kind: 'circle', r: 0.12, at: [-(o.len ?? 6) / 2, 0] }, { kind: 'circle', r: 0.12, at: [(o.len ?? 6) / 2, 0] }],
  height: 2.1,
  tags: ['park'],
  desc: 'Dây cờ tam giác; flags lắc nhẹ qua tick trên root.',
  variants: [{ len: 4 }, { len: 6 }, { len: 8 }],
});

defineModel('ice_cream_cart', {
  build: () => {
    const root = new THREE.Group();
    root.add(rbox(2.2, 0.95, 1.15, 0.12, '#fff8ee', { p: [0, 0.8, 0] }));
    root.add(box(2.25, 0.18, 1.2, PINK, { p: [0, 1.36, 0] }));
    root.add(prism(2.55, 0.7, 1.45, TEAL, { p: [0, 1.65, 0] }));
    root.add(cyl(0.24, 0.24, 0.18, INK, { p: [-0.8, 0.25, 0.62], r: [90, 0, 0], seg: 12 }));
    root.add(cyl(0.24, 0.24, 0.18, INK, { p: [0.8, 0.25, 0.62], r: [90, 0, 0], seg: 12 }));
    root.add(cyl(0.03, 0.03, 1.0, PAL.woodLight, { p: [1.35, 0.85, -0.2], r: [0, 0, 25], seg: 5 }));
    for (let i = 0; i < 3; i++) root.add(group([cone(0.15, 0.38, '#d7a56d', { p: [0, 0, 0], r: [180, 0, 0], seg: 8 }), ball(0.17, CANDY[i], { p: [0, 0.24, 0], seg: 10, flat: false })], { p: [-0.55 + i * 0.5, 1.58, 0.48] }));
    root.add(sign('KEM', 0.38, [0, 0.92, 0.61], [0, 0, 0], '#ffffff'));
    return root;
  },
  colliders: [{ kind: 'box', w: 2.4, d: 1.3 }],
  height: 2.45,
  tags: ['park'],
  desc: 'Xe kem trang trí khu vui chơi.',
  variants: [{}],
});

defineModel('balloon_stand', {
  build: () => {
    const root = new THREE.Group();
    root.add(cyl(0.09, 0.12, 2.0, PAL.woodLight, { p: [0, 1.0, 0], seg: 7 }));
    root.add(cyl(0.6, 0.7, 0.18, PAL.woodLight, { p: [0, 0.09, 0], seg: 12 }));
    const balloons = pivot([0, 1.55, 0], [], 'balloons');
    const bcols = [RED, YELLOW, BLUE, TEAL, LILAC];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const rr = 0.45 + (i % 2) * 0.35;
      const bx = Math.sin(a) * rr;
      const bz = Math.cos(a) * rr;
      const by = 0.4 + (i % 3) * 0.16;
      const col = bcols[i % bcols.length];
      balloons.add(cyl(0.012, 0.012, 1.0 + i * 0.05, '#ffffff', { p: [bx * 0.5, -0.18, bz * 0.5], r: [10 * Math.cos(a), 0, -10 * Math.sin(a)], seg: 4, cast: false }));
      balloons.add(cone(0.055, 0.12, col, { p: [bx, by + 0.02, bz], r: [180, 0, 0], seg: 6, cast: false }));
      balloons.add(ball(0.25, col, { p: [bx, by + 0.25, bz], s: [0.88, 1.22, 0.88], seg: 12, flat: false, shiny: 70, cast: false }));
    }
    setTick(balloons, (_dt, t) => {
      balloons.position.y = 1.55 + Math.sin(t * 1.8) * 0.12;
      balloons.rotation.y = Math.sin(t * 0.7) * 0.12;
    });
    root.add(balloons);
    root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = false; });
    return root;
  },
  colliders: [{ kind: 'circle', r: 0.65 }],
  height: 3.0,
  tags: ['park'],
  desc: 'Quầy bóng bay; node balloons nhấp nhô.',
  variants: [{}],
});

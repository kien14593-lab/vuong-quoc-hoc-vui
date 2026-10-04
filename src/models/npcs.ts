import * as THREE from 'three';
import { ball, box, capsule, cone, cyl, DEG, extrude, lathe, panel, pivot, rbox, sphPart, starShape, torus, tube } from '../engine/kit';
import { tint } from '../engine/materials';
import { defineModel, type ModelDef } from './registry';
import type { Rig } from './rig';
import { buildCharacter, type CharSpec } from './character';

const ss = { flat: false } as const;
const ink = '#2b2233';
const white = '#fffaf2';

type Side = 1 | -1;
type BipedSpec = {
  height: number;
  body: string;
  belly?: string;
  head: string;
  bodyScale?: [number, number, number];
  headScale?: [number, number, number];
  legColor?: string;
  armColor?: string;
  footColor?: string;
  eye?: string;
  nose?: string;
  mouth?: string;
  cheek?: string;
  bodyY?: number;
  bodyR?: number;
  headR?: number;
  cadence?: number;
  stride?: number;
  kind?: Rig['kind'];
  named?: string;
};

function finishRoot(root: THREE.Group, rig: Rig, height: number): THREE.Group {
  root.userData.rig = rig;
  root.userData.height = height;
  root.userData.dynamic = true;
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false;
  });
  return root;
}

function eye(side: Side, x: number, y: number, z: number, color = ink, big = 1): THREE.Group {
  const g = new THREE.Group();
  g.name = side > 0 ? 'eyeL' : 'eyeR';
  g.position.set(side * x, y, z);
  g.rotation.y = side * 10 * DEG;
  g.add(ball(0.098 * big, color, { ...ss, s: [0.78, 1.12, 0.36], seg: 18, shiny: 80, cast: false }));
  g.add(ball(0.034 * big, '#ffffff', { p: [0.024 * side * big, 0.036 * big, 0.036 * big], s: [1, 1, 0.45], seg: 8, unlit: true, cast: false }));
  g.add(ball(0.015 * big, '#ffffff', { p: [-0.03 * side * big, -0.028 * big, 0.04 * big], s: [1, 1, 0.45], seg: 6, unlit: true, cast: false }));
  return g;
}

function face(head: THREE.Group, rig: Rig, o: { z?: number; y?: number; x?: number; big?: number; eye?: string; nose?: string; cheek?: string; mouth?: string } = {}) {
  const z = o.z ?? 0.35;
  const y = o.y ?? 0.0;
  const x = o.x ?? 0.15;
  const big = o.big ?? 1;
  const eyes: THREE.Object3D[] = [];
  for (const s of [1, -1] as const) {
    const e = eye(s, x, y + 0.04 * big, z, o.eye ?? ink, big);
    head.add(e);
    eyes.push(e);
    head.add(ball(0.045 * big, o.cheek ?? '#ff9fb5', { ...ss, p: [s * (x + 0.13 * big), y - 0.075 * big, z + 0.01], s: [1.1, 0.55, 0.22], seg: 10, opacity: 0.72, cast: false }));
  }
  rig.eyes = eyes;
  head.add(ball(0.032 * big, o.nose ?? '#ff8aa8', { ...ss, p: [0, y - 0.035 * big, z + 0.055 * big], s: [1.15, 0.8, 0.85], seg: 8, cast: false }));
  const m = new THREE.Group();
  m.name = 'mouth';
  m.position.set(0, y - 0.13 * big, z + 0.045 * big);
  m.rotation.x = -10 * DEG;
  m.add(torus(0.052 * big, 0.012 * big, o.mouth ?? '#a8465c', { ...ss, arc: 180, r: [0, 0, 180], ts: 12, seg: 5, cast: false }));
  head.add(m);
  rig.mouth = m;
}

function solidBelly(body: THREE.Group, bodyR: number, color: string, y = bodyR * 0.78, z = bodyR * 0.91, sx = 1.05, sy = 1.18): void {
  body.add(ball(bodyR * 0.58, color, { ...ss, p: [0, y, z], s: [sx, sy, 0.11], seg: 16, cast: false }));
}

function arm(side: Side, color: string, hand: string, shoulderY: number, x = 0.36, name?: string): THREE.Group {
  const parts: THREE.Object3D[] = [
    capsule(0.07, 0.25, color, { ...ss, p: [0, -0.17, 0], seg: 12 }),
    ball(0.082, hand, { ...ss, p: [0, -0.36, 0.02], seg: 12 }),
  ];
  const a = pivot([side * x, shoulderY, 0.02], parts, name ?? (side > 0 ? 'armL' : 'armR'));
  a.rotation.z = side * 0.18;
  return a;
}

function leg(side: Side, color: string, foot: string, hipY: number, x = 0.16, name?: string): THREE.Group {
  const parts: THREE.Object3D[] = [
    capsule(0.075, Math.max(0.12, hipY - 0.18), color, { ...ss, p: [0, -hipY * 0.48, 0], seg: 12 }),
    ball(0.105, foot, { ...ss, p: [0, -hipY + 0.045, 0.06], s: [1, 0.55, 1.35], seg: 12 }),
  ];
  return pivot([side * x, hipY, 0], parts, name ?? (side > 0 ? 'legL' : 'legR'));
}

function makeBiped(sp: BipedSpec): { root: THREE.Group; rig: Rig; body: THREE.Group; head: THREE.Group; headG: THREE.Group; height: number } {
  const root = new THREE.Group();
  root.name = sp.named ?? 'npc';
  const height = sp.height;
  const bodyY = sp.bodyY ?? height * 0.24;
  const bodyR = sp.bodyR ?? height * 0.2;
  const headR = sp.headR ?? height * 0.24;
  const rig: Rig = { root, kind: sp.kind ?? 'biped', height, stride: sp.stride ?? 0.65, cadence: sp.cadence ?? 2.0 };
  const body = new THREE.Group();
  body.name = 'body';
  body.position.y = bodyY;
  body.add(ball(bodyR, sp.body, { ...ss, p: [0, bodyR * 0.9, 0], s: sp.bodyScale ?? [1.05, 1.18, 0.92], seg: 18 }));
  if (sp.belly) solidBelly(body, bodyR, sp.belly);
  const head = new THREE.Group();
  head.name = 'head';
  head.position.y = bodyR * 1.63;
  const headG = new THREE.Group();
  headG.position.y = headR * 0.72;
  headG.add(ball(headR, sp.head, { ...ss, s: sp.headScale ?? [1.04, 0.98, 1], seg: 24 }));
  face(headG, rig, { z: headR * 0.99, x: headR * 0.34, y: -headR * 0.03, big: headR / 0.34, eye: sp.eye, nose: sp.nose, cheek: sp.cheek, mouth: sp.mouth });
  head.add(headG);
  body.add(head);
  const armL = arm(1, sp.armColor ?? sp.head, sp.head, bodyR * 1.05, bodyR * 1.05);
  const armR = arm(-1, sp.armColor ?? sp.head, sp.head, bodyR * 1.05, bodyR * 1.05);
  body.add(armL, armR);
  const legL = leg(1, sp.legColor ?? sp.head, sp.footColor ?? sp.head, bodyY, bodyR * 0.42);
  const legR = leg(-1, sp.legColor ?? sp.head, sp.footColor ?? sp.head, bodyY, bodyR * 0.42);
  root.add(legL, legR, body);
  rig.body = body; rig.head = head; rig.armL = armL; rig.armR = armR; rig.legL = legL; rig.legR = legR;
  return { root, rig, body, head, headG, height };
}

function bunnyEar(side: Side, fur: string, inner: string, y = 0.26, name = 'ear'): THREE.Group {
  const e = pivot([side * 0.17, y, -0.03], [
    capsule(0.07, 0.42, fur, { ...ss, p: [0, 0.22, 0], s: [0.8, 1, 0.45], seg: 14 }),
    capsule(0.042, 0.33, inner, { ...ss, p: [0, 0.22, 0.028], s: [0.75, 1, 0.35], seg: 10, cast: false }),
  ], `${name}${side > 0 ? 'L' : 'R'}`);
  e.rotation.z = -side * 0.16;
  return e;
}

function roundEar(side: Side, color: string, inner: string, x: number, y: number, r = 0.13): THREE.Group {
  const e = pivot([side * x, y, -0.02], [
    ball(r, color, { ...ss, s: [0.78, 1, 0.55], seg: 14 }),
    ball(r * 0.58, inner, { ...ss, p: [0, 0, 0.035], s: [0.8, 0.9, 0.35], seg: 10, cast: false }),
  ], `ear${side > 0 ? 'L' : 'R'}`);
  e.rotation.z = side * 0.18;
  return e;
}

function pointEar(side: Side, color: string, inner: string, x: number, y: number, size = 0.18): THREE.Group {
  const e = pivot([side * x, y, -0.02], [
    cone(size * 0.45, size, color, { ...ss, p: [0, size * 0.25, 0], r: [0, 0, side * -14], s: [1, 1, 0.55], seg: 12 }),
    cone(size * 0.25, size * 0.58, inner, { ...ss, p: [0, size * 0.22, 0.035], r: [0, 0, side * -14], s: [1, 1, 0.4], seg: 10, cast: false }),
  ], `ear${side > 0 ? 'L' : 'R'}`);
  e.rotation.z = side * 0.35;
  return e;
}

function addVest(body: THREE.Group, color: string, y: number, z: number, w = 0.24) {
  body.add(ball(w, color, { ...ss, p: [0, y, z], s: [1.15, 1.18, 0.16], seg: 14, cast: false }));
  body.add(box(w * 0.22, w * 1.28, 0.035, tint(color, -0.12), { ...ss, p: [0, y, z + 0.04], cast: false }));
}

function bow(group: THREE.Group, color: string, p: [number, number, number], s = 1) {
  for (const side of [1, -1] as const) group.add(cone(0.07 * s, 0.13 * s, color, { ...ss, p: [p[0] + side * 0.055 * s, p[1], p[2]], r: [0, 0, side * 90], seg: 8 }));
  group.add(ball(0.035 * s, tint(color, -0.1), { ...ss, p, seg: 8 }));
}

function star(color: string, p: [number, number, number], s = 1): THREE.Mesh {
  return extrude('npc_star5', () => starShape(0.07 * s, 0.032 * s), 0.025 * s, color, { ...ss, p, seg: 8, cast: false });
}

function buildRabbit(armor = false): THREE.Group {
  const fur = armor ? '#f1d6aa' : '#fff9f3';
  const inner = armor ? '#f3b8bd' : '#ffb6cd';
  const b = makeBiped({ height: armor ? 1.5 : 1.35, body: armor ? '#cfd8dc' : '#4ecdc4', belly: armor ? '#e9edf0' : undefined, head: fur, legColor: fur, armColor: armor ? '#d7c7b0' : fur, footColor: fur, nose: '#ff8fb3', cheek: '#ff9ec7', bodyY: armor ? 0.34 : 0.28, bodyR: armor ? 0.28 : 0.25, headR: armor ? 0.34 : 0.32, cadence: 2.4, named: armor ? 'npc_knight' : 'npc_rabbit' });
  const ears = [bunnyEar(1, fur, inner, b.height * 0.22), bunnyEar(-1, fur, inner, b.height * 0.22)];
  b.headG.add(...ears);
  b.rig.ears = ears;
  b.body.add(ball(0.13, fur, { ...ss, p: [0, 0.25, -0.27], seg: 12 }));
  if (armor) {
    b.body.add(rbox(0.48, 0.42, 0.32, 0.06, '#cfd8dc', { ...ss, p: [0, 0.29, 0.02], shiny: 70 }));
    b.body.add(torus(0.25, 0.025, '#ffd166', { ...ss, p: [0, 0.5, 0.02], r: [90, 0, 0], ts: 22, seg: 5 }));
    b.body.add(box(0.05, 0.38, 0.035, '#ffd166', { ...ss, p: [0, 0.29, 0.205], cast: false }));
    b.headG.add(sphPart(0.32, '#b0bec5', 0, 360, 0, 58, { ...ss, p: [0, 0.15, -0.03], seg: 20, shiny: 80 }));
    b.headG.add(torus(0.28, 0.025, '#90a4ae', { ...ss, p: [0, 0.18, -0.02], r: [90, 0, 0], ts: 22, seg: 5 }));
    b.headG.add(cone(0.08, 0.34, '#4dabf7', { ...ss, p: [0, 0.55, -0.08], r: [-12, 0, 0], s: [0.75, 1, 1], seg: 8 }));
    b.headG.add(cone(0.055, 0.25, '#74c0fc', { ...ss, p: [0.08, 0.5, -0.06], r: [-12, 0, -12], s: [0.65, 1, 1], seg: 8 }));
    const sword = pivot([0, -0.36, 0.02], [cyl(0.018, 0.018, 0.42, '#a9744a', { p: [0, -0.14, 0], r: [15, 0, 0], seg: 8 }), box(0.13, 0.025, 0.035, '#ffd166', { p: [0, 0.08, 0] })], 'sword');
    b.rig.armR!.add(sword);
    const shield = pivot([0, -0.2, 0.09], [cyl(0.16, 0.16, 0.045, '#6cb8ff', { ...ss, r: [90, 0, 0], seg: 18 }), star('#ffd166', [0, 0, 0.035], 0.9)], 'shield');
    b.rig.armL!.add(shield);
    b.body.add(panel(0.42, 0.42, '#3f63b5', { ...ss, p: [0, 0.25, -0.31], r: [8, 180, 0], side: THREE.DoubleSide }));
  } else {
    addVest(b.body, '#43c7bd', 0.31, 0.23, 0.22);
    bow(b.body, '#ff8fba', [0, 0.52, 0.23], 0.95);
  }
  return finishRoot(b.root, b.rig, b.height);
}

function buildBear(): THREE.Group {
  const b = makeBiped({ height: 2.0, body: '#9b6338', belly: '#f0d0a5', head: '#9b6338', legColor: '#8a552f', armColor: '#9b6338', footColor: '#8a552f', nose: '#4a3025', cheek: '#ffb0a0', bodyY: 0.43, bodyR: 0.4, headR: 0.43, cadence: 1.75, named: 'npc_bear' });
  const ears = [roundEar(1, '#9b6338', '#d9a979', 0.34, 0.25, 0.13), roundEar(-1, '#9b6338', '#d9a979', 0.34, 0.25, 0.13)];
  b.headG.add(...ears); b.rig.ears = ears;
  b.headG.add(ball(0.18, '#f6ddb8', { ...ss, p: [0, -0.09, 0.42], s: [1.25, 0.78, 0.32], seg: 14, cast: false }));
  b.headG.add(sphPart(0.46, '#d6b16f', 0, 360, 0, 72, { ...ss, p: [0, 0.12, 0], seg: 20 }));
  b.headG.add(cyl(0.56, 0.56, 0.035, '#c89b5f', { ...ss, p: [0, 0.21, 0.02], seg: 28 }));
  b.headG.add(torus(0.35, 0.025, '#7a5230', { ...ss, p: [0, 0.29, 0.02], r: [90, 0, 0], ts: 24, seg: 5 }));
  b.body.add(torus(0.25, 0.045, '#4ecdc4', { ...ss, p: [0, 0.69, 0.03], r: [90, 0, 0], ts: 22, seg: 6 }));
  b.body.add(rbox(0.13, 0.28, 0.045, 0.025, '#4ecdc4', { ...ss, p: [-0.08, 0.53, 0.33], r: [-12, 0, -8] }));
  b.body.add(rbox(0.54, 0.52, 0.22, 0.07, '#5aa469', { ...ss, p: [0, 0.43, -0.4] }));
  for (const s of [1, -1] as const) b.body.add(box(0.06, 0.44, 0.04, '#4c8b59', { ...ss, p: [s * 0.22, 0.48, 0.26], r: [-12, 0, s * 8], cast: false }));
  const map = pivot([0, -0.34, 0.03], [cyl(0.045, 0.045, 0.28, '#efe3c8', { ...ss, r: [90, 0, 0], seg: 12 }), torus(0.047, 0.008, '#c8915a', { ...ss, p: [0, 0, 0.09], r: [90, 0, 0], ts: 10, seg: 4 })], 'mapRoll');
  b.rig.armR!.add(map);
  return finishRoot(b.root, b.rig, 2.0);
}

/** Vòng đẩy phát sáng dưới thân Robot Bíp (dùng chung cho mô hình AI cùng khóa). */
export function hoverJet(): THREE.Group {
  return pivot([0, -0.12, 0], [torus(0.34, 0.025, '#68e8ff', { r: [90, 0, 0], emissive: '#5ff3ff', glow: 0.9, opacity: 0.72, ts: 28, seg: 6 }), cone(0.13, 0.28, '#68e8ff', { p: [0, -0.12, 0], r: [180, 0, 0], emissive: '#5ff3ff', glow: 0.6, opacity: 0.55, seg: 16 })], 'hoverJet');
}

function buildRobot(): THREE.Group {
  const root = new THREE.Group(); root.name = 'npc_robot';
  const rig: Rig = { root, kind: 'float', height: 1.45, stride: 0.35, cadence: 2.0 };
  const body = new THREE.Group(); body.name = 'body'; body.position.y = 0.48;
  body.add(rbox(0.62, 0.62, 0.46, 0.16, '#f4fbff', { ...ss, p: [0, 0.25, 0], shiny: 70 }));
  body.add(rbox(0.42, 0.25, 0.04, 0.05, '#26364a', { ...ss, p: [0, 0.33, 0.245], shiny: 90 }));
  const eyes: THREE.Object3D[] = [];
  for (const s of [1, -1] as const) { const e = eye(s, 0.11, 0.36, 0.275, '#5ff3ff', 0.75); e.children.forEach((c) => { if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).material = (c as THREE.Mesh).material; }); body.add(e); eyes.push(e); }
  const mouth = new THREE.Group(); mouth.name = 'mouth'; mouth.position.set(0, 0.22, 0.272); mouth.add(torus(0.07, 0.012, '#5ff3ff', { arc: 180, r: [0, 0, 180], emissive: '#5ff3ff', glow: 1.3, ts: 12, seg: 5, cast: false })); body.add(mouth);
  body.add(rbox(0.46, 0.12, 0.035, 0.03, '#4ecdc4', { ...ss, p: [0, 0.05, 0.245], emissive: '#2ccbc3', glow: 0.25 }));
  const armL = arm(1, '#dfeef5', '#4ecdc4', 0.34, 0.41); const armR = arm(-1, '#dfeef5', '#4ecdc4', 0.34, 0.41); body.add(armL, armR);
  const antenna = pivot([0, 0.62, 0], [cyl(0.018, 0.018, 0.22, '#6b7c93', { ...ss, p: [0, 0.09, 0], seg: 8 }), ball(0.07, '#70f4ff', { p: [0, 0.22, 0], emissive: '#5ff3ff', glow: 1.2, seg: 12 })], 'antenna');
  antenna.userData.tick = (_dt: number, t: number) => { antenna.scale.setScalar(1 + Math.sin(t * 5) * 0.04); };
  body.add(antenna);
  const hover = hoverJet();
  body.add(hover); root.add(body);
  rig.body = body; rig.armL = armL; rig.armR = armR; rig.eyes = eyes; rig.mouth = mouth;
  rig.custom = (r, s) => {
    const t = s.t;
    if (r.armR) { r.armR.rotation.z = -0.2 + (s.wave ? -2.2 + Math.sin(t * 10) * 0.35 : Math.sin(t * 2) * 0.08); r.armR.rotation.x = s.talk ? Math.sin(t * 8) * 0.25 : 0; }
    if (r.armL) { r.armL.rotation.z = 0.2 + (s.talk ? Math.sin(t * 7) * 0.25 : Math.sin(t * 2.2) * 0.08); }
    antenna.rotation.z = Math.sin(t * 3) * 0.1;
    hover.rotation.y = t * 1.6;
  };
  return finishRoot(root, rig, 1.45);
}

function buildCat(): THREE.Group {
  const b = makeBiped({ height: 1.45, body: '#f6b05f', belly: undefined, head: '#f6b05f', legColor: '#f6b05f', armColor: '#f6b05f', footColor: '#e88b45', nose: '#ff8fb3', bodyY: 0.31, bodyR: 0.27, headR: 0.34, named: 'npc_cat' });
  const ears = [pointEar(1, '#f6b05f', '#ffc1d1', 0.25, 0.21, 0.22), pointEar(-1, '#f6b05f', '#ffc1d1', 0.25, 0.21, 0.22)]; b.headG.add(...ears); b.rig.ears = ears;
  for (const x of [-0.12, 0, 0.12]) b.headG.add(capsule(0.018, 0.18, '#cf7834', { ...ss, p: [x, 0.18, 0.28], r: [35, 0, x * 120], cast: false }));
  for (const s of [1, -1] as const) for (const yy of [-0.04, -0.1]) b.headG.add(capsule(0.008, 0.22, '#fff6e6', { ...ss, p: [s * 0.2, yy, 0.37], r: [0, s * 75, 90], cast: false }));
  b.body.add(torus(0.16, 0.018, '#ffd84d', { ...ss, p: [0, 0.52, 0.1], r: [70, 0, 0], arc: 210, ts: 14, seg: 5, cast: false }));
  b.body.add(rbox(0.38, 0.32, 0.055, 0.04, '#ffd84d', { ...ss, p: [0, 0.25, 0.275] }));
  b.body.add(rbox(0.16, 0.09, 0.025, 0.018, '#fff5b0', { ...ss, p: [0, 0.19, 0.315], cast: false }));
  for (const s of [1, -1] as const) b.body.add(box(0.035, 0.25, 0.025, '#f0bc2f', { ...ss, p: [s * 0.15, 0.38, 0.3], r: [-8, 0, s * 8], cast: false }));
  const tail = pivot([0, 0.24, -0.22], [tube([[0, 0, 0], [0.16, 0.13, -0.05], [0.2, 0.34, -0.02]], 0.055, '#f6b05f', { ...ss, radial: 10 })], 'tail'); b.body.add(tail); b.rig.tail = tail;
  return finishRoot(b.root, b.rig, 1.45);
}

function buildSquirrel(): THREE.Group {
  const b = makeBiped({ height: 1.55, body: '#b66a35', belly: '#ffe2b5', head: '#c7773a', legColor: '#b66a35', armColor: '#c7773a', footColor: '#955226', nose: '#704124', bodyY: 0.32, bodyR: 0.27, headR: 0.34, named: 'npc_squirrel' });
  const ears = [roundEar(1, '#c7773a', '#f2c19a', 0.25, 0.22, 0.09), roundEar(-1, '#c7773a', '#f2c19a', 0.25, 0.22, 0.09)]; b.headG.add(...ears); b.rig.ears = ears;
  b.headG.add(ball(0.13, '#ffe2b5', { ...ss, p: [0, -0.1, 0.34], s: [1.25, 0.75, 0.32], seg: 12, cast: false }));
  b.body.add(torus(0.19, 0.022, '#7bd389', { ...ss, p: [0, 0.47, 0.05], r: [90, 0, 0], ts: 18, seg: 5 }));
  const tail = pivot([0, 0.21, -0.24], [tube([[0, 0, 0], [0.35, 0.15, -0.1], [0.32, 0.58, -0.02], [0.0, 0.63, 0.0], [0.1, 0.36, 0.02]], 0.12, '#c7773a', { ...ss, radial: 12, seg: 28 }), tube([[0.02, 0.04, 0.02], [0.26, 0.18, -0.06], [0.22, 0.5, 0.0]], 0.055, '#ffe0ad', { ...ss, radial: 8, seg: 18 })], 'tail'); b.body.add(tail); b.rig.tail = tail;
  const acorn = pivot([0, -0.35, 0.04], [ball(0.09, '#b98552', { ...ss, p: [0, -0.02, 0], s: [1, 1.15, 1], seg: 10 }), sphPart(0.095, '#7a4a2b', 0, 360, 0, 70, { ...ss, p: [0, 0.055, 0], seg: 12 }), cone(0.018, 0.06, '#6b4428', { p: [0, 0.13, 0], seg: 6 })], 'acorn'); b.rig.armR!.add(acorn);
  b.headG.add(ball(0.055, '#7bd389', { ...ss, p: [0.18, 0.25, 0.18], s: [1.6, 0.5, 0.8], r: [0, 0, 28], seg: 10 }));
  return finishRoot(b.root, b.rig, 1.55);
}

function buildTurtle(): THREE.Group {
  const b = makeBiped({ height: 1.45, body: '#6aa84f', belly: '#b7d98b', head: '#7dbf63', legColor: '#6aa84f', armColor: '#7dbf63', footColor: '#5a9845', nose: '#5a9845', bodyY: 0.29, bodyR: 0.3, headR: 0.31, cadence: 1.5, stride: 0.42, named: 'npc_turtle' });
  const shell = pivot([0, 0.36, -0.22], [sphPart(0.42, '#8a5a3b', 0, 360, 0, 110, { ...ss, p: [0, 0, 0], r: [-10, 0, 0], s: [1.0, 0.9, 0.6], seg: 18 }), torus(0.23, 0.015, '#d6a45f', { ...ss, p: [0, 0.02, -0.12], r: [78, 0, 0], s: [1.25, 1, 1], ts: 6, seg: 4 })], 'shell'); b.body.add(shell);
  for (const s of [1, -1] as const) b.headG.add(torus(0.095, 0.012, '#b9c3cc', { ...ss, p: [s * 0.12, 0.03, 0.285], r: [0, s * 12, 0], ts: 18, seg: 5, cast: false }));
  b.headG.add(box(0.07, 0.012, 0.018, '#b9c3cc', { ...ss, p: [0, 0.03, 0.315], cast: false }));
  for (const s of [1, -1] as const) b.headG.add(capsule(0.025, 0.13, '#ffffff', { ...ss, p: [s * 0.11, 0.14, 0.28], r: [0, s * 8, 82 + s * 4], cast: false }));
  b.headG.add(ball(0.07, '#ffffff', { ...ss, p: [0, -0.22, 0.2], s: [1.15, 0.8, 0.7], seg: 10 }));
  const stick = pivot([0, -0.32, 0.04], [cyl(0.018, 0.02, 0.78, '#8a5a3b', { ...ss, p: [0.02, -0.22, 0.04], r: [10, 0, 8], seg: 8 }), torus(0.06, 0.014, '#8a5a3b', { ...ss, p: [0.0, 0.2, 0.02], r: [80, 0, 0], arc: 250, ts: 12, seg: 4 })], 'walkingStick'); b.rig.armR!.add(stick);
  return finishRoot(b.root, b.rig, 1.45);
}

function buildDeer(): THREE.Group {
  const b = makeBiped({ height: 1.55, body: '#c99a62', belly: '#fff0d2', head: '#c99a62', legColor: '#b8834f', armColor: '#c99a62', footColor: '#744c2f', nose: '#3b2a24', bodyY: 0.42, bodyR: 0.25, headR: 0.33, stride: 0.72, named: 'npc_deer' });
  const ears = [pointEar(1, '#c99a62', '#ffd1bd', 0.28, 0.16, 0.22), pointEar(-1, '#c99a62', '#ffd1bd', 0.28, 0.16, 0.22)]; b.headG.add(...ears); b.rig.ears = ears;
  b.headG.add(ball(0.16, '#fff0d2', { ...ss, p: [0, -0.08, 0.31], s: [1.15, 0.75, 0.5], seg: 12, cast: false }));
  for (const s of [1, -1] as const) { b.headG.add(cyl(0.018, 0.022, 0.16, '#8a5a3b', { ...ss, p: [s * 0.12, 0.28, 0.01], r: [0, 0, -s * 18], seg: 8 })); b.headG.add(ball(0.04, '#8a5a3b', { ...ss, p: [s * 0.15, 0.36, 0.0], s: [0.8, 1, 0.8], seg: 8 })); }
  for (const s of [1, -1] as const) for (const y of [0.24, 0.35]) b.body.add(ball(0.035, '#fff6e6', { ...ss, p: [s * 0.16, y, 0.2], s: [1, 0.8, 0.35], seg: 8, cast: false }));
  const tail = pivot([0, 0.25, -0.22], [ball(0.08, '#fff6e6', { ...ss, p: [0, 0.02, -0.04], s: [0.8, 1, 1.2], seg: 10 })], 'tail'); b.body.add(tail); b.rig.tail = tail;
  return finishRoot(b.root, b.rig, 1.55);
}

function addHumanExtra(root: THREE.Group, height = 1.8): Rig {
  const rig = root.userData.rig as Rig;
  root.userData.compacted = false;
  root.userData.height = height;
  rig.height = height;
  return rig;
}

function buildClown(): THREE.Group {
  const sp: CharSpec = { skin: '#f6c8a8', hair: '#ff7a2f', hairStyle: 0, eye: '#3b5dd6', shirt: { style: 'rainbow', color: '#ff6b6b' }, pants: { style: 'shorts', color: '#6cb8ff' }, shoes: { style: 'sneaker', color: '#ff6b6b' }, hat: { style: 'party', color: '#b197fc' }, blush: true };
  const root = buildCharacter(sp); root.name = 'npc_clown'; const rig = addHumanExtra(root);
  rig.head?.add(ball(0.08, '#e52b36', { ...ss, p: [0, 0.28, 0.45], seg: 12, shiny: 80 }));
  for (const s of [1, -1] as const) for (let i = 0; i < 4; i++) rig.head?.add(ball(0.12, ['#ff6b6b', '#ffd166', '#4ecdc4', '#b197fc'][i], { ...ss, p: [s * (0.42 + 0.04 * (i % 2)), 0.42 - i * 0.08, -0.03 + i * 0.02], seg: 10 }));
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; rig.body?.add(ball(0.055, '#ffffff', { ...ss, p: [Math.sin(a) * 0.19, 0.53 + Math.cos(a) * 0.03, Math.cos(a) * 0.19], seg: 8 })); }
  rig.armR?.add(ball(0.07, '#ffd166', { ...ss, p: [0, -0.44, 0.06], seg: 12, name: 'jugglingBall' }));
  return root;
}

function buildElephant(): THREE.Group {
  const b = makeBiped({ height: 2.2, body: '#879eb0', belly: '#b7c6d3', head: '#91aabd', legColor: '#879eb0', armColor: '#91aabd', footColor: '#73899b', nose: '#7a8fa0', bodyY: 0.48, bodyR: 0.43, headR: 0.47, cadence: 1.75, named: 'npc_elephant' });
  const ears = [pivot([0.45, 0.03, 0.02], [ball(0.29, '#91aabd', { ...ss, s: [0.55, 1.22, 0.16], seg: 18 }), ball(0.22, '#b7c6d3', { ...ss, p: [0, -0.02, 0.035], s: [0.48, 1.05, 0.11], seg: 12, cast: false })], 'earL'), pivot([-0.45, 0.03, 0.02], [ball(0.29, '#91aabd', { ...ss, s: [0.55, 1.22, 0.16], seg: 18 }), ball(0.22, '#b7c6d3', { ...ss, p: [0, -0.02, 0.035], s: [0.48, 1.05, 0.11], seg: 12, cast: false })], 'earR')]; b.headG.add(...ears); b.rig.ears = ears;
  const trunk = pivot([0, -0.05, 0.44], [tube([[0, 0, 0], [0, -0.16, 0.08], [0.03, -0.34, 0.08], [0.0, -0.5, 0.02]], 0.078, '#91aabd', { ...ss, radial: 12, seg: 24 })], 'trunk'); b.headG.add(trunk);
  for (const s of [1, -1] as const) b.headG.add(cone(0.028, 0.18, '#fff8e8', { ...ss, p: [s * 0.12, -0.2, 0.38], r: [105, 0, s * 10], seg: 10 }));
  b.headG.add(sphPart(0.27, '#c6b37a', 0, 360, 0, 78, { ...ss, p: [0, 0.43, -0.02], s: [1.15, 0.55, 1], seg: 18 }));
  b.headG.add(cyl(0.2, 0.2, 0.026, '#b59d62', { ...ss, p: [0, 0.43, 0.2], r: [84, 0, 0], s: [1.25, 1, 0.65], seg: 18 }));
  for (const s of [1, -1] as const) b.body.add(rbox(0.25, 0.5, 0.08, 0.035, '#d7b56d', { ...ss, p: [s * 0.15, 0.43, 0.33], r: [-4, 0, s * 4] }));
  b.body.add(star('#ffd166', [0.21, 0.55, 0.39], 0.65));
  b.body.add(box(0.035, 0.42, 0.025, '#8a5a3b', { ...ss, p: [0, 0.42, 0.38], cast: false }));
  const prev = b.rig.custom; b.rig.custom = (r, s) => { prev?.(r, s); trunk.rotation.z = Math.sin(s.t * 2.2) * 0.12; trunk.rotation.x = Math.sin(s.t * 1.3) * 0.08; };
  return finishRoot(b.root, b.rig, 2.2);
}

function buildOwl(): THREE.Group {
  const b = makeBiped({ height: 1.55, body: '#8b5a3c', belly: '#f5ddb8', head: '#8b5a3c', legColor: '#ffa94d', armColor: '#7b4a2e', footColor: '#ffa94d', nose: '#ffd166', bodyY: 0.24, bodyR: 0.36, headR: 0.34, kind: 'biped', named: 'npc_owl' });
  b.headG.add(cone(0.08, 0.2, '#6f432b', { ...ss, p: [0.18, 0.27, -0.03], r: [0, 0, -24], seg: 8 }));
  b.headG.add(cone(0.08, 0.2, '#6f432b', { ...ss, p: [-0.18, 0.27, -0.03], r: [0, 0, 24], seg: 8 }));
  for (const s of [1, -1] as const) { b.headG.add(torus(0.115, 0.018, '#ffa94d', { ...ss, p: [s * 0.13, 0.04, 0.31], r: [0, s * 10, 0], ts: 20, seg: 5 })); b.headG.add(torus(0.13, 0.01, '#b9a27c', { ...ss, p: [s * 0.13, 0.04, 0.325], r: [0, s * 10, 0], ts: 20, seg: 4, cast: false })); }
  b.headG.add(box(0.07, 0.012, 0.015, '#b9a27c', { ...ss, p: [0, 0.04, 0.34], cast: false }));
  b.headG.add(cone(0.045, 0.1, '#ffd166', { ...ss, p: [0, -0.05, 0.34], r: [90, 0, 0], seg: 8 }));
  for (let i = 0; i < 4; i++) b.body.add(ball(0.05, '#fff1cf', { ...ss, p: [(-0.15 + i * 0.1), 0.27 - (i % 2) * 0.07, 0.29], s: [1, 0.65, 0.28], seg: 8, cast: false }));
  b.rig.armL!.name = 'armL'; b.rig.armR!.name = 'armR';
  b.rig.armL!.add(ball(0.17, '#7b4a2e', { ...ss, p: [0, -0.16, 0.04], s: [0.6, 1.35, 0.22], seg: 14 }));
  b.rig.armR!.add(ball(0.17, '#7b4a2e', { ...ss, p: [0, -0.16, 0.04], s: [0.6, 1.35, 0.22], seg: 14 }));
  b.headG.add(cyl(0.26, 0.26, 0.035, '#26364a', { ...ss, p: [0, 0.33, 0], seg: 24 }));
  b.headG.add(box(0.38, 0.08, 0.38, '#26364a', { ...ss, p: [0, 0.41, 0] }));
  b.headG.add(capsule(0.012, 0.22, '#ffd166', { ...ss, p: [0.18, 0.36, 0.18], r: [0, 0, 16], cast: false }));
  return finishRoot(b.root, b.rig, 1.55);
}

function buildKing(): THREE.Group {
  const sp: CharSpec = { skin: '#f2bf96', hair: '#8a5a3b', hairStyle: 0, eye: '#3b8c5a', shirt: { style: 'robe', color: '#7b4fd6', color2: '#ffd166' }, pants: { style: 'pants', color: '#7b4fd6' }, shoes: { style: 'boot', color: '#6b3e2e' }, hat: { style: 'crown', color: '#ffcf4a' }, acc: { style: 'cape', color: '#d94b5f' } };
  const root = buildCharacter(sp); root.name = 'npc_king'; const rig = addHumanExtra(root, 1.9);
  rig.head?.add(capsule(0.024, 0.1, '#ffffff', { ...ss, p: [0.055, 0.18, 0.455], r: [0, 0, 70], cast: false }));
  rig.head?.add(capsule(0.024, 0.1, '#ffffff', { ...ss, p: [-0.055, 0.18, 0.455], r: [0, 0, -70], cast: false }));
  rig.head?.add(ball(0.06, '#ffffff', { ...ss, p: [0, 0.03, 0.31], s: [1.1, 0.75, 0.65], seg: 10 }));
  rig.body?.add(torus(0.35, 0.035, '#ffffff', { ...ss, p: [0, 0.0, 0], r: [90, 0, 0], ts: 26, seg: 6 }));
  const scept = pivot([0, -0.37, 0.02], [cyl(0.018, 0.018, 0.55, '#ffd166', { p: [0, -0.18, 0], r: [8, 0, 0], shiny: 80, seg: 8 }), star('#fff176', [0, 0.12, 0.04], 0.9)], 'scepter'); rig.armR?.add(scept);
  return root;
}

function buildVillager(o: { v?: number } = {}): THREE.Group {
  const v = o.v ?? 0;
  const keys = ['pig', 'duck', 'puppy', 'hamster', 'frog', 'chick'];
  const kind = keys[((v % keys.length) + keys.length) % keys.length];
  const colors: Record<string, [string, string, string]> = { pig: ['#ffb6c8', '#ffd6df', '#ff8ca8'], duck: ['#ffe680', '#fff4b0', '#ffa94d'], puppy: ['#c58b5a', '#f0d0a5', '#6b4428'], hamster: ['#d9a066', '#ffe0b5', '#c47a3e'], frog: ['#69c46b', '#b9e889', '#3f9e56'], chick: ['#ffd84d', '#fff0a8', '#ffa94d'] };
  const [fur, belly, foot] = colors[kind];
  const b = makeBiped({ height: 1.35, body: ['#6cb8ff', '#ff9ec7', '#7bd389', '#ffd166', '#b197fc', '#ff8a65'][v % 6], belly, head: fur, legColor: fur, armColor: fur, footColor: foot, nose: kind === 'frog' ? '#69c46b' : '#ff9aa9', bodyY: 0.29, bodyR: 0.24, headR: 0.31, named: 'npc_villager' });
  if (kind === 'pig') { b.headG.add(ball(0.1, '#ff8ca8', { ...ss, p: [0, -0.06, 0.28], s: [1.2, 0.7, 0.5], seg: 10 })); b.headG.add(...[pointEar(1, fur, belly, 0.23, 0.18, 0.18), pointEar(-1, fur, belly, 0.23, 0.18, 0.18)]); }
  if (kind === 'duck' || kind === 'chick') b.headG.add(cone(0.075, 0.16, '#ffa94d', { ...ss, p: [0, -0.06, 0.33], r: [90, 0, 0], s: [1.3, 0.7, 1], seg: 10 }));
  if (kind === 'puppy') { const ears = [capsule(0.06, 0.2, '#6b4428', { ...ss, p: [0.28, 0.05, 0.0], r: [0, 0, -25] }), capsule(0.06, 0.2, '#6b4428', { ...ss, p: [-0.28, 0.05, 0.0], r: [0, 0, 25] })]; b.headG.add(...ears); }
  if (kind === 'hamster') b.headG.add(...[roundEar(1, fur, belly, 0.24, 0.16, 0.09), roundEar(-1, fur, belly, 0.24, 0.16, 0.09)]);
  if (kind === 'frog') for (const s of [1, -1] as const) b.headG.add(ball(0.095, fur, { ...ss, p: [s * 0.19, 0.2, 0.12], seg: 12 }));
  return finishRoot(b.root, b.rig, 1.35);
}

const reg = (key: string, build: (o?: any) => THREE.Object3D, height: number, r: number, desc: string, variants?: any[], extra: Partial<ModelDef<any>> = {}) =>
  defineModel<any>(key, { build: (o = {}) => build(o), height, colliders: [{ kind: 'circle', r }], tags: ['npc'], desc, variants, ...extra });

reg('npc_rabbit', () => buildRabbit(false), 1.35, 0.45, 'Thỏ Bông: tai earL/earR, mắt eyeL/eyeR, miệng mouth, đuôi tail.', undefined, { portrait: 'bust' });
reg('npc_bear', buildBear, 2.0, 0.65, 'Chú Gấu: mũ thám hiểm, balo, mapRoll cầm tay.');
reg('npc_robot', buildRobot, 1.45, 0.5, 'Robot Bíp: antenna và hoverJet có tick/custom, mắt phát sáng eyeL/eyeR.', undefined, { hover: { gap: 0.42, fx: hoverJet, spin: 1.6 }, portrait: 'bust' });
reg('npc_cat', buildCat, 1.45, 0.45, 'Cô Mèo: earL/earR, tail, tạp dề shop.');
reg('npc_squirrel', buildSquirrel, 1.55, 0.5, 'Cô Sóc: tail lớn cuộn, acorn cầm tay, kẹp lá.');
reg('npc_turtle', buildTurtle, 1.45, 0.52, 'Ông Rùa: shell, glasses, walkingStick; cadence chậm.');
reg('npc_deer', buildDeer, 1.55, 0.45, 'Bạn Nai: tai earL/earR, nụ sừng, đốm trắng, tail.');
reg('npc_clown', buildClown, 1.8, 0.48, 'Chú Hề Bibo: buildCharacter + red nose, wig tufts, ruffle, jugglingBall.', undefined, { portrait: 'bust' });
reg('npc_elephant', buildElephant, 2.2, 0.7, 'Bác Voi: tai earL/earR, trunk custom sway, mũ/áo keeper.', undefined, { portrait: 'bust' });
reg('npc_owl', buildOwl, 1.55, 0.5, 'Bác Cú: wings as armL/armR, glasses, mortarboard.');
reg('npc_king', buildKing, 1.9, 0.55, 'Nhà Vua: buildCharacter crown/cape/beard, scepter.', undefined, { portrait: 'bust' });
reg('npc_knight', () => buildRabbit(true), 1.5, 0.48, 'Hiệp Sĩ Thỏ: earL/earR, sword, shield, cape, armor.');
reg('npc_villager', buildVillager, 1.35, 0.44, 'Dân làng thú dễ thương; variants v=0..5: pig, duck, puppy, hamster, frog, chick.', [{ v: 0 }, { v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }, { v: 5 }]);

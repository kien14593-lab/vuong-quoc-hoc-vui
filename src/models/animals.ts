import * as THREE from 'three';
import { ball, box, capsule, cone, cyl, DEG, extrude, group, lathe, panel, pivot, rbox, starShape, torus, tube } from '../engine/kit';
import { PAL, tint } from '../engine/materials';
import { defineModel } from './registry';
import type { Rig, AnimState } from './rig';

/** Thú, sinh vật nhỏ, thú cưng và ván trượt procedural – chân đặt y=0, mặt nhìn +Z. */
type ColorOpt = { color?: string; v?: number };

const ss = { flat: false } as const;
const INK = '#2b2233';
const WHITE = '#fff8ee';
const BLUSH = '#ff9ec7';

const C = (c: string, amt: number) => tint(c, amt);

function finalize(root: THREE.Group, rig?: Rig): THREE.Group {
  if (rig) root.userData.rig = rig;
  return root;
}

function glossyEye(name: string, x: number, y: number, z: number, r = 0.045): THREE.Group {
  const R = r * 1.55;
  return pivot(
    [x, y, z],
    [
      ball(R, INK, { ...ss, s: [1.12, 1.28, 0.45], shiny: 90, seg: 14 }),
      ball(R * 0.36, '#ffffff', { ...ss, p: [-R * 0.3, R * 0.34, R * 0.42], shiny: 100, seg: 8, cast: false }),
      ball(R * 0.16, '#ffffff', { ...ss, p: [R * 0.22, R * 0.02, R * 0.5], shiny: 100, seg: 6, cast: false }),
    ],
    name,
  );
}

function tinyEye(x: number, y: number, z: number, r = 0.014): THREE.Group {
  return group([
    ball(r, INK, { ...ss, p: [x, y, z], shiny: 60, seg: 6, cast: false }),
    ball(r * 0.32, '#ffffff', { ...ss, p: [x - r * 0.25, y + r * 0.3, z + r * 0.55], shiny: 80, seg: 5, cast: false }),
  ]);
}

function blushPair(y: number, z: number, x = 0.18, r = 0.045): THREE.Object3D[] {
  return [
    ball(r, BLUSH, { ...ss, p: [x, y, z], s: [1.4, 0.45, 0.28], seg: 10, cast: false }),
    ball(r, BLUSH, { ...ss, p: [-x, y, z], s: [1.4, 0.45, 0.28], seg: 10, cast: false }),
  ];
}

function quadLeg(name: string, x: number, z: number, hipY: number, color: string, _foot = color, r = 0.075): THREE.Group {
  const straight = Math.max(0.04, hipY - r * 2);
  const footColor = _foot;
  return pivot(
    [x, hipY, z],
    [
      capsule(r, straight, color, { ...ss, p: [0, -hipY / 2, 0], seg: 12 }),
      ball(r * 1.18, footColor, { ...ss, p: [0, -hipY + r * 0.62, 0.055], s: [1.05, 0.62, 1.35], seg: 12 }),
    ],
    name,
  );
}

function bipedLeg(name: string, x: number, hipY: number, color: string, foot: string, h = 0.32, r = 0.055): THREE.Group {
  return pivot(
    [x, hipY, 0],
    [
      capsule(r, Math.max(0.04, h - r * 2), color, { ...ss, p: [0, -h / 2, 0], seg: 12 }),
      ball(r * 1.35, foot, { ...ss, p: [0, -h + r * 0.55, 0.045], s: [1.05, 0.6, 1.45], seg: 12 }),
    ],
    name,
  );
}

function floppyEar(name: string, x: number, y: number, z: number, color: string, inner?: string): THREE.Group {
  return pivot(
    [x, y, z],
    [
      capsule(0.055, 0.22, color, { ...ss, p: [0, -0.11, 0], r: [0, 0, x > 0 ? -16 : 16], s: [0.9, 1, 0.55], seg: 12 }),
      inner ? capsule(0.032, 0.14, inner, { ...ss, p: [0, -0.11, 0.012], r: [0, 0, x > 0 ? -16 : 16], s: [0.8, 1, 0.35], seg: 8, cast: false }) : null,
    ],
    name,
  );
}

function pointEar(name: string, x: number, y: number, z: number, color: string, inner = '#ffd6e6', s = 1): THREE.Group {
  return pivot(
    [x, y, z],
    [
      cone(0.09 * s, 0.24 * s, color, { ...ss, p: [0, 0.1 * s, 0], r: [0, 0, x > 0 ? -18 : 18], seg: 14 }),
      cone(0.048 * s, 0.13 * s, inner, { ...ss, p: [0, 0.09 * s, 0.035 * s], r: [0, 0, x > 0 ? -18 : 18], seg: 10, cast: false }),
    ],
    name,
  );
}

function simpleTail(name: string, p: [number, number, number], color: string, pts: [number, number, number][], radius = 0.035): THREE.Group {
  return pivot(p, [tube(pts, radius, color, { ...ss, radial: 8 })], name);
}

function registerAnimal<O extends object>(
  key: string,
  build: (o: O) => THREE.Object3D,
  height: number,
  colliderR: number,
  desc: string,
  variants?: O[],
  tags = ['zoo', 'animal'],
) {
  defineModel<O>(key, {
    build,
    colliders: [{ kind: 'circle', r: colliderR }],
    height,
    tags,
    desc,
    variants,
  });
}

/* ------------------------------------------------------------------ */
/* Zoo animals                                                         */
/* ------------------------------------------------------------------ */

registerAnimal<Record<string, never>>(
  'animal_giraffe',
  () => {
    const bodyC = '#e7b85f';
    const spotC = '#9b6431';
    const root = new THREE.Group();
    const body = pivot(
      [0, 0, 0],
      [
        ball(0.48, bodyC, { ...ss, p: [0, 1.02, 0], s: [0.95, 0.72, 1.35], seg: 18 }),
        ...[
          [-0.34, 1.12, 0.34, 0.13, [0.35, 1.05, 0.5]],
          [0.36, 1.05, 0.02, 0.16, [0.35, 1.0, 0.5]],
          [-0.26, 0.86, -0.42, 0.14, [0.4, 0.7, 0.18]],
          [0.24, 1.23, -0.28, 0.12, [0.4, 0.65, 0.2]],
          [0, 1.18, 0.61, 0.1, [1, 0.55, 0.16]],
        ].map(([x, y, z, r, s]) => ball(r as number, spotC, { ...ss, p: [x as number, y as number, z as number], s: s as [number, number, number], seg: 8, cast: false })),
      ],
      'body',
    );
    const neck = group([
      capsule(0.13, 1.42, bodyC, { ...ss, p: [0, 1.85, 0.35], r: [-8, 0, 0], s: [0.95, 1, 1.05], seg: 14 }),
      ...[
        [0.09, 1.55, 0.46],
        [-0.09, 1.83, 0.39],
        [0.08, 2.12, 0.31],
        [-0.06, 2.4, 0.23],
      ].map(([x, y, z]) => ball(0.09, spotC, { ...ss, p: [x, y, z], s: [0.38, 0.8, 0.28], seg: 8, cast: false })),
      ...Array.from({ length: 8 }, (_, i) => cone(0.045, 0.13, '#7b4a2e', { ...ss, p: [0, 1.24 + i * 0.17, 0.18 - i * 0.018], r: [18, 0, 0], seg: 6 })),
    ]);
    const eyeL = glossyEye('eyeL', 0.13, 0.07, 0.26, 0.035);
    const eyeR = glossyEye('eyeR', -0.13, 0.07, 0.26, 0.035);
    const head = pivot(
      [0, 2.72, 0.12],
      [
        ball(0.32, bodyC, { ...ss, p: [0, 0, 0.08], s: [0.88, 0.95, 1.05], seg: 18 }),
        ball(0.17, C(bodyC, 0.08), { ...ss, p: [0, -0.05, 0.36], s: [1.15, 0.72, 0.75], seg: 14 }),
        ball(0.025, spotC, { ...ss, p: [0.065, -0.02, 0.43], seg: 8, cast: false }),
        ball(0.025, spotC, { ...ss, p: [-0.065, -0.02, 0.43], seg: 8, cast: false }),
        eyeL,
        eyeR,
        pointEar('earL', 0.19, 0.16, 0.02, bodyC, bodyC, 0.65),
        pointEar('earR', -0.19, 0.16, 0.02, bodyC, bodyC, 0.65),
        cyl(0.025, 0.035, 0.18, bodyC, { ...ss, p: [0.08, 0.22, 0.07], seg: 8 }),
        cyl(0.025, 0.035, 0.18, bodyC, { ...ss, p: [-0.08, 0.22, 0.07], seg: 8 }),
        ball(0.045, spotC, { ...ss, p: [0.08, 0.31, 0.07], seg: 10 }),
        ball(0.045, spotC, { ...ss, p: [-0.08, 0.31, 0.07], seg: 10 }),
        ...blushPair(-0.06, 0.38, 0.14, 0.03),
      ],
      'head',
    );
    const legs = [
      quadLeg('legFL', 0.25, 0.45, 0.86, bodyC, C(bodyC, -0.05), 0.07),
      quadLeg('legFR', -0.25, 0.45, 0.86, bodyC, C(bodyC, -0.05), 0.07),
      quadLeg('legBL', 0.25, -0.48, 0.86, bodyC, C(bodyC, -0.05), 0.07),
      quadLeg('legBR', -0.25, -0.48, 0.86, bodyC, C(bodyC, -0.05), 0.07),
    ];
    const tail = simpleTail('tail', [0, 1.12, -0.65], bodyC, [
      [0, 0, 0],
      [0, -0.18, -0.12],
      [0, -0.36, -0.18],
    ], 0.028);
    tail.add(cone(0.07, 0.16, '#7b4a2e', { ...ss, p: [0, -0.42, -0.2], r: [35, 0, 0], seg: 10 }));
    root.add(body, neck, head, ...legs, tail);
    head.getObjectByName('earL')!.name = '';
    head.getObjectByName('earR')!.name = '';
    const rig: Rig = { root, kind: 'quad', height: 3.4, body, head, legs, tail, eyes: [eyeL, eyeR], stride: 0.42, cadence: 1.9 };
    return finalize(root, rig);
  },
  3.4,
  0.65,
  'Hươu cao cổ chibi: head/legs/tail/eyes/ears có rig; mảng nâu nổi.',
);

registerAnimal<Record<string, never>>(
  'animal_monkey',
  () => {
    const fur = '#8a5a3b';
    const skin = '#f0c18b';
    const root = new THREE.Group();
    const body = pivot([0, 0, 0], [ball(0.25, fur, { ...ss, p: [0, 0.46, 0], s: [0.9, 1.05, 0.78], seg: 18 }), ball(0.16, skin, { ...ss, p: [0, 0.44, 0.19], s: [1.0, 1.15, 0.35], seg: 14 })], 'body');
    const eyeL = glossyEye('eyeL', 0.095, 0.04, 0.25, 0.032);
    const eyeR = glossyEye('eyeR', -0.095, 0.04, 0.25, 0.032);
    const head = pivot(
      [0, 0.88, 0.02],
      [
        ball(0.23, fur, { ...ss, seg: 18 }),
        ball(0.16, skin, { ...ss, p: [0, -0.03, 0.16], s: [1.05, 0.9, 0.55], seg: 14 }),
        ball(0.11, skin, { ...ss, p: [0.22, 0.01, 0], s: [0.48, 0.75, 0.32], seg: 12 }),
        ball(0.11, skin, { ...ss, p: [-0.22, 0.01, 0], s: [0.48, 0.75, 0.32], seg: 12 }),
        eyeL,
        eyeR,
        ball(0.028, INK, { ...ss, p: [0, -0.04, 0.3], seg: 8, cast: false }),
        torus(0.055, 0.009, '#6b3f24', { ...ss, p: [0, -0.1, 0.29], r: [0, 0, 0], arc: 160, ts: 12, seg: 5, cast: false }),
        ...blushPair(-0.08, 0.25, 0.13, 0.03),
      ],
      'head',
    );
    const armL = pivot([0.2, 0.58, 0], [capsule(0.045, 0.32, fur, { ...ss, p: [0, -0.17, 0], r: [0, 0, -8], seg: 12 }), ball(0.05, skin, { ...ss, p: [0, -0.35, 0.02], seg: 10 })], 'armL');
    const armR = pivot([-0.2, 0.58, 0], [capsule(0.045, 0.32, fur, { ...ss, p: [0, -0.17, 0], r: [0, 0, 8], seg: 12 }), ball(0.05, skin, { ...ss, p: [0, -0.35, 0.02], seg: 10 })], 'armR');
    armL.rotation.z = 0.18;
    armR.rotation.z = -0.18;
    const legL = bipedLeg('legL', 0.09, 0.34, fur, skin, 0.34, 0.055);
    const legR = bipedLeg('legR', -0.09, 0.34, fur, skin, 0.34, 0.055);
    const tail = simpleTail('tail', [0, 0.48, -0.2], fur, [
      [0, 0, 0],
      [0.2, 0.1, -0.23],
      [0.22, 0.38, -0.15],
      [0.03, 0.42, -0.02],
    ], 0.035);
    root.add(body, head, armL, armR, legL, legR, tail);
    return finalize(root, { root, kind: 'biped', height: 1.08, body, head, armL, armR, legL, legR, tail, eyes: [eyeL, eyeR], stride: 0.55, cadence: 2.7 });
  },
  1.1,
  0.33,
  'Khỉ nâu tinh nghịch: tail xoăn, arm/leg/head/eyes có rig.',
);

function buildPenguin(scale = 1, baby = false): THREE.Group {
  const root = new THREE.Group();
  root.scale.setScalar(scale);
  const dark = baby ? '#5e6674' : '#2b2d42';
  const belly = baby ? '#eef0f6' : '#fff8ee';
  const body = pivot([0, 0, 0], [ball(0.26, dark, { ...ss, p: [0, 0.42, 0], s: [0.9, 1.22, 0.78], seg: 18 }), ball(0.18, belly, { ...ss, p: [0, 0.4, 0.18], s: [0.9, 1.15, 0.35], seg: 16 })], 'body');
  const eyeL = glossyEye('eyeL', 0.075, 0.04, 0.21, 0.026);
  const eyeR = glossyEye('eyeR', -0.075, 0.04, 0.21, 0.026);
  const head = pivot([0, 0.8, 0.02], [ball(0.22, dark, { ...ss, seg: 18 }), ball(0.14, belly, { ...ss, p: [0, -0.02, 0.13], s: [0.9, 0.75, 0.4], seg: 14 }), cone(0.045, 0.13, '#ff9f43', { ...ss, p: [0, -0.02, 0.27], r: [90, 0, 0], seg: 12 }), eyeL, eyeR, ...blushPair(-0.08, 0.19, 0.11, 0.026)], 'head');
  const armL = pivot([0.22, 0.53, 0], [capsule(0.04, 0.28, dark, { ...ss, p: [0.02, -0.15, 0], r: [0, 0, -28], s: [0.8, 1, 0.45], seg: 10 })], 'armL');
  const armR = pivot([-0.22, 0.53, 0], [capsule(0.04, 0.28, dark, { ...ss, p: [-0.02, -0.15, 0], r: [0, 0, 28], s: [0.8, 1, 0.45], seg: 10 })], 'armR');
  const legL = bipedLeg('legL', 0.09, 0.18, '#ff9f43', '#ff9f43', 0.18, 0.035);
  const legR = bipedLeg('legR', -0.09, 0.18, '#ff9f43', '#ff9f43', 0.18, 0.035);
  root.add(body, head, armL, armR, legL, legR);
  const rig: Rig = {
    root,
    kind: 'biped',
    height: 0.92 * scale,
    body,
    head,
    armL,
    armR,
    legL,
    legR,
    eyes: [eyeL, eyeR],
    stride: 0.28,
    cadence: 3.6,
    custom: (rig: Rig, s: AnimState) => {
      const move = Math.min(1, s.move);
      if (rig.body) rig.body.rotation.z = Math.sin(s.t * 10) * 0.11 * move;
      rig.root.rotation.z = Math.sin(s.t * 10) * 0.055 * move;
    },
  };
  root.userData.rig = rig;
  return root;
}

registerAnimal<Record<string, never>>('animal_penguin', () => buildPenguin(1), 0.92, 0.3, 'Chim cánh cụt lạch bạch: flippers armL/armR, custom waddle.');

registerAnimal<Record<string, never>>(
  'animal_zebra',
  () => {
    const root = new THREE.Group();
    const body = pivot(
      [0, 0, 0],
      [
        ball(0.38, WHITE, { ...ss, p: [0, 0.78, 0], s: [0.9, 0.7, 1.45], seg: 18 }),
        ...[
          [-0.32, 0.82, -0.45, [0.18, 1.2, 0.45]],
          [0.32, 0.86, -0.28, [0.18, 1.1, 0.42]],
          [-0.34, 0.77, -0.05, [0.18, 1.25, 0.45]],
          [0.34, 0.81, 0.16, [0.18, 1.15, 0.42]],
          [-0.3, 0.83, 0.4, [0.16, 1.0, 0.38]],
          [0.3, 0.78, 0.52, [0.16, 1.0, 0.38]],
          [0, 0.96, 0.58, [1.0, 0.22, 0.12]],
          [0, 0.93, 0.24, [0.9, 0.2, 0.12]],
        ].map(([x, y, z, s]) => ball(0.12, INK, { ...ss, p: [x as number, y as number, z as number], s: s as [number, number, number], seg: 8, cast: false })),
      ],
      'body',
    );
    const neck = group([
      capsule(0.15, 0.58, WHITE, { ...ss, p: [0, 1.08, 0.42], r: [-22, 0, 0], seg: 14 }),
      ...[0, 1, 2].map((i) => torus(0.145, 0.014, INK, { ...ss, p: [0, 0.94 + i * 0.15, 0.52 - i * 0.05], r: [-22, 0, 0], s: [1, 0.72, 1], ts: 18, seg: 5 })),
    ]);
    const eyeL = glossyEye('eyeL', 0.09, 0.03, 0.24, 0.034);
    const eyeR = glossyEye('eyeR', -0.09, 0.03, 0.24, 0.034);
    const head = pivot([0, 1.38, 0.62], [ball(0.22, WHITE, { ...ss, s: [0.82, 0.92, 1.12], seg: 16 }), ball(0.12, WHITE, { ...ss, p: [0, -0.04, 0.23], s: [1.1, 0.72, 0.72], seg: 12 }), ball(0.035, INK, { ...ss, p: [0, -0.055, 0.33], s: [1.4, 0.65, 0.45], cast: false }), eyeL, eyeR, pointEar('earL', 0.14, 0.14, -0.02, WHITE, WHITE, 0.7), pointEar('earR', -0.14, 0.14, -0.02, WHITE, WHITE, 0.7), ...blushPair(-0.08, 0.27, 0.13, 0.028)], 'head');
    const legs = [quadLeg('legFL', 0.22, 0.42, 0.62, WHITE, INK, 0.06), quadLeg('legFR', -0.22, 0.42, 0.62, WHITE, INK, 0.06), quadLeg('legBL', 0.22, -0.42, 0.62, WHITE, INK, 0.06), quadLeg('legBR', -0.22, -0.42, 0.62, WHITE, INK, 0.06)];
    legs.forEach((l) => {
      l.add(torus(0.06, 0.009, INK, { ...ss, p: [0, -0.25, 0], r: [90, 0, 0], ts: 14, seg: 4, cast: false }));
      l.add(torus(0.055, 0.009, INK, { ...ss, p: [0, -0.43, 0], r: [90, 0, 0], ts: 14, seg: 4, cast: false }));
    });
    const mane = group(Array.from({ length: 7 }, (_, i) => cone(0.05, 0.14, INK, { ...ss, p: [0, 1.08 + i * 0.065, 0.36 - i * 0.055], r: [-42, 0, 0], seg: 5 })));
    const tail = simpleTail('tail', [0, 0.83, -0.58], WHITE, [[0, 0, 0], [0, -0.22, -0.12], [0, -0.33, -0.2]], 0.025);
    tail.add(cone(0.06, 0.15, INK, { ...ss, p: [0, -0.39, -0.23], r: [35, 0, 0], seg: 10 }));
    root.add(body, neck, head, mane, ...legs, tail);
    head.getObjectByName('earL')!.name = '';
    head.getObjectByName('earR')!.name = '';
    return finalize(root, { root, kind: 'quad', height: 1.62, body, head, legs, tail, eyes: [eyeL, eyeR], stride: 0.48, cadence: 2.2 });
  },
  1.62,
  0.55,
  'Ngựa vằn: sọc đậm, mane, tail và 4 chân rig.',
);

registerAnimal<Record<string, never>>(
  'animal_hippo',
  () => {
    const c = '#a99cc8';
    const root = new THREE.Group();
    const body = pivot([0, 0, 0], [ball(0.48, c, { ...ss, p: [0, 0.58, 0], s: [1.15, 0.78, 1.25], seg: 18 })], 'body');
    const eyeL = glossyEye('eyeL', 0.12, 0.1, 0.23, 0.03);
    const eyeR = glossyEye('eyeR', -0.12, 0.1, 0.23, 0.03);
    const jaw = pivot([0, -0.04, 0.25], [ball(0.19, C(c, 0.08), { ...ss, p: [0, -0.03, 0.08], s: [1.25, 0.45, 0.8], seg: 14 }), ball(0.022, INK, { ...ss, p: [0.09, 0.0, 0.19], cast: false }), ball(0.022, INK, { ...ss, p: [-0.09, 0.0, 0.19], cast: false })], 'jaw');
    const head = pivot([0, 0.98, 0.38], [ball(0.29, c, { ...ss, s: [1.05, 0.92, 0.95], seg: 18 }), jaw, eyeL, eyeR, ball(0.055, c, { ...ss, p: [0.2, 0.17, -0.02], s: [1, 0.65, 0.8], seg: 10 }), ball(0.055, c, { ...ss, p: [-0.2, 0.17, -0.02], s: [1, 0.65, 0.8], seg: 10 }), ...blushPair(-0.08, 0.26, 0.18, 0.035)], 'head');
    const legs = [quadLeg('legFL', 0.27, 0.32, 0.36, c, C(c, -0.05), 0.075), quadLeg('legFR', -0.27, 0.32, 0.36, c, C(c, -0.05), 0.075), quadLeg('legBL', 0.27, -0.36, 0.36, c, C(c, -0.05), 0.075), quadLeg('legBR', -0.27, -0.36, 0.36, c, C(c, -0.05), 0.075)];
    root.add(body, head, ...legs);
    return finalize(root, { root, kind: 'quad', height: 1.32, body, head, legs, mouth: jaw, eyes: [eyeL, eyeR], stride: 0.32, cadence: 1.9, custom: (rig, s) => { if (rig.mouth) rig.mouth.rotation.x = (s.talk ? 0.35 + Math.sin(s.t * 8) * 0.08 : 0); } });
  },
  1.32,
  0.62,
  'Hà mã béo dễ thương: jaw named mở khi talk, eyes blink.',
);

registerAnimal<Record<string, never>>(
  'animal_lion',
  () => {
    const bodyC = '#d99a3d';
    const maneC = '#9a5a2d';
    const root = new THREE.Group();
    const body = pivot([0, 0, 0], [ball(0.36, bodyC, { ...ss, p: [0, 0.68, 0], s: [0.95, 0.72, 1.25], seg: 18 }), ball(0.17, '#fff0c4', { ...ss, p: [0, 0.62, 0.34], s: [1, 0.8, 0.35], seg: 12 })], 'body');
    const eyeL = glossyEye('eyeL', 0.09, 0.035, 0.25, 0.032);
    const eyeR = glossyEye('eyeR', -0.09, 0.035, 0.25, 0.032);
    const maneBalls = Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return ball(0.105, maneC, { ...ss, p: [Math.sin(a) * 0.22, Math.cos(a) * 0.2, -0.015], seg: 8 });
    });
    const head = pivot([0, 1.12, 0.38], [group(maneBalls), ball(0.23, bodyC, { ...ss, p: [0, 0, 0.05], seg: 18 }), ball(0.12, '#fff0c4', { ...ss, p: [0, -0.05, 0.25], s: [1.25, 0.8, 0.6], seg: 12 }), eyeL, eyeR, ball(0.025, INK, { ...ss, p: [0, -0.05, 0.34], cast: false }), pointEar('earL', 0.17, 0.16, 0, bodyC, '#ffd6a8', 0.7), pointEar('earR', -0.17, 0.16, 0, bodyC, '#ffd6a8', 0.7), ...blushPair(-0.1, 0.28, 0.14, 0.028)], 'head');
    const legs = [quadLeg('legFL', 0.22, 0.34, 0.48, bodyC, C(bodyC, -0.05), 0.06), quadLeg('legFR', -0.22, 0.34, 0.48, bodyC, C(bodyC, -0.05), 0.06), quadLeg('legBL', 0.22, -0.38, 0.48, bodyC, C(bodyC, -0.05), 0.06), quadLeg('legBR', -0.22, -0.38, 0.48, bodyC, C(bodyC, -0.05), 0.06)];
    const tail = simpleTail('tail', [0, 0.72, -0.5], bodyC, [[0, 0, 0], [0.08, -0.12, -0.18], [0.02, -0.3, -0.26]], 0.028);
    tail.add(ball(0.09, maneC, { ...ss, p: [0.02, -0.34, -0.28], s: [0.8, 1.1, 0.8], seg: 12 }));
    root.add(body, head, ...legs, tail);
    head.getObjectByName('earL')!.name = '';
    head.getObjectByName('earR')!.name = '';
    return finalize(root, { root, kind: 'quad', height: 1.5, body, head, legs, tail, eyes: [eyeL, eyeR], stride: 0.45, cadence: 2.15 });
  },
  1.5,
  0.52,
  'Sư tử thân thiện: bờm bóng mềm, tail tuft, 4 chân rig.',
);

/* ------------------------------------------------------------------ */
/* Critters with built-in idle ticks                                   */
/* ------------------------------------------------------------------ */

defineModel<ColorOpt>('critter_butterfly', {
  build: (o) => {
    const c = o.color ?? '#b197fc';
    const root = new THREE.Group();
    const body = capsule(0.018, 0.14, INK, { ...ss, p: [0, 0.22, 0], r: [90, 0, 0], seg: 8, name: 'body' });
    const wingL = pivot([0.025, 0.23, 0], [ball(0.12, c, { ...ss, p: [0.08, 0.03, 0], s: [0.9, 0.18, 0.58], seg: 10, opacity: 0.95 })], 'wingL');
    const wingR = pivot([-0.025, 0.23, 0], [ball(0.12, c, { ...ss, p: [-0.08, 0.03, 0], s: [0.9, 0.18, 0.58], seg: 10, opacity: 0.95 })], 'wingR');
    const antennae = group([tube([[0, 0, 0], [0.035, 0.06, 0.035]], 0.005, INK, { radial: 5 }), tube([[0, 0, 0], [-0.035, 0.06, 0.035]], 0.005, INK, { radial: 5 })], { p: [0, 0.28, 0.05], name: 'antennae' });
    root.add(body, wingL, wingR, antennae);
    const phase = (o.v ?? 0) * 0.8;
    wingL.userData.dynamic = wingR.userData.dynamic = true;
    wingL.userData.tick = (_dt: number, t: number) => { wingL.rotation.z = Math.sin(t * 24 + phase) * 0.9 + 0.35; };
    wingR.userData.tick = (_dt: number, t: number) => { wingR.rotation.z = -Math.sin(t * 24 + phase) * 0.9 - 0.35; };
    return root;
  },
  height: 0.38,
  tags: ['critter'],
  desc: 'Bướm pastel: wingL/wingR tick vỗ nhanh, antennae.',
  variants: [{ color: '#b197fc' }, { color: '#ff9ec7' }, { color: '#74c0fc' }],
});

defineModel<ColorOpt>('critter_bird', {
  build: (o) => {
    const c = o.color ?? '#6cb8ff';
    const root = new THREE.Group();
    const body = pivot([0, 0, 0], [ball(0.12, c, { ...ss, p: [0, 0.19, 0], s: [1, 1.05, 0.9], seg: 8 }), ball(0.075, C(c, 0.12), { ...ss, p: [0, 0.18, 0.085], s: [0.95, 0.8, 0.35], seg: 8 })], 'body');
    const eyeL = tinyEye(0.045, 0.025, 0.1, 0.014);
    const eyeR = tinyEye(-0.045, 0.025, 0.1, 0.014);
    const head = pivot([0, 0.32, 0.03], [ball(0.09, c, { ...ss, seg: 8 }), cone(0.025, 0.07, '#ffa94d', { ...ss, p: [0, -0.005, 0.11], r: [90, 0, 0], seg: 7 }), eyeL, eyeR], 'head');
    const wingL = pivot([0.1, 0.21, 0], [ball(0.065, C(c, -0.08), { ...ss, p: [0.035, 0, 0], s: [0.5, 0.85, 0.28], seg: 10 })], 'wingL');
    const wingR = pivot([-0.1, 0.21, 0], [ball(0.065, C(c, -0.08), { ...ss, p: [-0.035, 0, 0], s: [0.5, 0.85, 0.28], seg: 10 })], 'wingR');
    const feet = group([cyl(0.006, 0.008, 0.08, '#8a5a3b', { p: [0.035, 0.06, 0.02], seg: 5 }), cyl(0.006, 0.008, 0.08, '#8a5a3b', { p: [-0.035, 0.06, 0.02], seg: 5 })], { name: 'feet' });
    root.add(body, head, wingL, wingR, feet);
    body.userData.dynamic = true;
    body.userData.tick = (_dt: number, t: number) => { body.rotation.z = Math.sin(t * 2.8) * 0.04; };
    return finalize(root, { root, kind: 'bird', height: 0.42, body, head, wings: [wingL, wingR] });
  },
  height: 0.42,
  tags: ['critter'],
  desc: 'Chim tròn: rig bird wingL/wingR, body tick nghiêng nhẹ.',
  variants: [{ color: '#6cb8ff' }, { color: '#ffd166' }, { color: '#ff9ec7' }],
});

defineModel<ColorOpt>('critter_frog', {
  build: (o) => {
    const c = o.color ?? '#63c77b';
    const root = new THREE.Group();
    const body = pivot([0, 0, 0], [ball(0.15, c, { ...ss, p: [0, 0.16, 0], s: [1.15, 0.72, 0.9], seg: 8 }), ball(0.07, C(c, 0.12), { ...ss, p: [0, 0.14, 0.12], s: [1.3, 0.45, 0.35], seg: 8 })], 'body');
    const throat = ball(0.06, '#f7d7a8', { ...ss, p: [0, 0.15, 0.155], s: [1.1, 0.7, 0.35], seg: 8, name: 'throat' });
    const eyeL = tinyEye(0.07, 0.26, 0.07, 0.016);
    const eyeR = tinyEye(-0.07, 0.26, 0.07, 0.016);
    root.add(body, throat, eyeL, eyeR, ball(0.045, c, { ...ss, p: [0.08, 0.255, 0.045], seg: 8 }), ball(0.045, c, { ...ss, p: [-0.08, 0.255, 0.045], seg: 8 }), ball(0.05, c, { ...ss, p: [0.14, 0.055, 0.08], s: [1.5, 0.38, 1], seg: 8 }), ball(0.05, c, { ...ss, p: [-0.14, 0.055, 0.08], s: [1.5, 0.38, 1], seg: 8 }));
    throat.userData.dynamic = true;
    throat.userData.tick = (_dt: number, t: number) => { const k = 1 + Math.max(0, Math.sin(t * 5)) * 0.38; throat.scale.set(1.1 * k, 0.7 * k, 0.35 * k); };
    return root;
  },
  colliders: [{ kind: 'circle', r: 0.16 }],
  height: 0.35,
  tags: ['critter'],
  desc: 'Ếch ngồi: throat named tick phồng cổ, eyes blink-like glossy.',
  variants: [{ color: '#63c77b' }, { color: '#4ecdc4' }],
});

defineModel<ColorOpt>('critter_fish', {
  build: (o) => {
    const c = o.color ?? '#ffa94d';
    const root = new THREE.Group();
    root.add(
      ball(0.16, c, { ...ss, p: [0, 0.26, 0], s: [0.62, 0.72, 1.75], seg: 12, name: 'body' }),
      ...[-0.08, 0.08].map((z) => torus(0.105, 0.008, C(c, -0.12), { ...ss, p: [0, 0.265, z], s: [0.75, 0.62, 1], ts: 16, seg: 4, cast: false })),
    );
    const tail = pivot([0, 0.26, -0.3], [cone(0.13, 0.16, C(c, -0.08), { ...ss, p: [0, 0, -0.055], r: [-90, 0, 0], s: [1.18, 0.55, 1], seg: 10 })], 'tail');
    const dorsal = cone(0.06, 0.14, C(c, -0.06), { ...ss, p: [0, 0.4, -0.02], r: [18, 0, 0], s: [0.55, 1, 1], seg: 8, name: 'dorsalFin' });
    const finL = panel(0.12, 0.085, C(c, 0.08), { ...ss, p: [0.105, 0.26, 0.05], r: [0, -45, 18], side: THREE.DoubleSide });
    const finR = panel(0.12, 0.085, C(c, 0.08), { ...ss, p: [-0.105, 0.26, 0.05], r: [0, 45, -18], side: THREE.DoubleSide });
    root.add(tail, dorsal, finL, finR, tinyEye(0.07, 0.315, 0.21, 0.022), tinyEye(-0.07, 0.315, 0.21, 0.022));
    tail.userData.dynamic = true;
    tail.userData.tick = (_dt: number, t: number) => { tail.rotation.y = Math.sin(t * 9) * 0.45; };
    return root;
  },
  colliders: [{ kind: 'circle', r: 0.22 }],
  height: 0.46,
  tags: ['critter'],
  desc: 'Cá hướng +Z: tail tick vẫy, finL/finR.',
  variants: [{ color: '#ffa94d' }, { color: '#4dabf7' }, { color: '#ffd166' }],
});

defineModel<ColorOpt>('critter_duck', {
  build: (o) => {
    const c = o.color ?? '#ffd84d';
    const root = new THREE.Group();
    const body = pivot([0, 0, 0], [ball(0.16, c, { ...ss, p: [0, 0.22, 0], s: [1.05, 0.78, 1.2], seg: 8 })], 'body');
    const eyeL = tinyEye(0.045, 0.02, 0.105, 0.017);
    const eyeR = tinyEye(-0.045, 0.02, 0.105, 0.017);
    const head = pivot([0, 0.4, 0.08], [ball(0.1, c, { ...ss, seg: 8 }), ball(0.055, '#ff9f43', { ...ss, p: [0, -0.025, 0.12], s: [1.35, 0.45, 0.82], seg: 8 }), eyeL, eyeR], 'head');
    root.add(body, head);
    body.userData.dynamic = true;
    body.userData.tick = (_dt: number, t: number) => { body.rotation.z = Math.sin(t * 2.5) * 0.05; body.rotation.x = Math.sin(t * 1.7) * 0.035; };
    return root;
  },
  colliders: [{ kind: 'circle', r: 0.18 }],
  height: 0.52,
  tags: ['critter'],
  desc: 'Vịt ao: body tick rocking rotation only; head/eyes.',
  variants: [{ color: '#ffd84d' }, { color: '#ffffff' }],
});

defineModel<Record<string, never>>('critter_chick', {
  build: () => {
    const root = new THREE.Group();
    const head = pivot([0, 0.27, 0.04], [ball(0.075, '#ffe066', { ...ss, seg: 8 }), cone(0.022, 0.055, '#ff9f43', { ...ss, p: [0, -0.005, 0.08], r: [90, 0, 0], seg: 7 }), tinyEye(0.035, 0.02, 0.066, 0.014), tinyEye(-0.035, 0.02, 0.066, 0.014)], 'head');
    root.add(ball(0.09, '#ffd43b', { ...ss, p: [0, 0.14, 0], s: [1, 1, 0.88], seg: 8, name: 'body' }), head, cyl(0.004, 0.006, 0.06, '#a06a2c', { p: [0.03, 0.04, 0.02], seg: 5 }), cyl(0.004, 0.006, 0.06, '#a06a2c', { p: [-0.03, 0.04, 0.02], seg: 5 }));
    head.userData.dynamic = true;
    head.userData.tick = (_dt: number, t: number) => { const peck = Math.max(0, Math.sin(t * 4)); head.rotation.x = peck * 0.42; };
    return root;
  },
  height: 0.34,
  tags: ['critter'],
  desc: 'Gà con tí hon: head tick cúi mổ.',
});

defineModel<Record<string, never>>('giraffe_feeding_deck', {
  build: () => {
    const root = new THREE.Group();
    const wood = '#c8915a';
    const dark = '#8a5a3b';
    root.add(rbox(1.75, 0.18, 1.15, 0.05, wood, { p: [0, 1.0, 0], seg: 2, name: 'deck' }));
    for (const x of [-0.75, 0.75]) for (const z of [-0.48, 0.48]) root.add(cyl(0.055, 0.07, 1.0, dark, { p: [x, 0.5, z], seg: 6 }));
    for (const z of [-0.55, 0.55]) root.add(box(1.95, 0.08, 0.08, dark, { p: [0, 1.25, z] }));
    for (let i = 0; i < 4; i++) root.add(box(0.9, 0.09, 0.38, wood, { p: [0, 0.16 + i * 0.2, 0.88 + i * 0.21], r: [-14, 0, 0] }));
    root.add(group([
      cyl(0.28, 0.23, 0.18, '#b86b4a', { p: [0, 1.19, -0.12], seg: 14 }),
      ...[-0.18, 0, 0.18].map((x) => ball(0.07, '#ff5a5f', { ...ss, p: [x, 1.34, -0.12], seg: 8, cast: false })),
    ], { name: 'appleTray' }));
    return root;
  },
  colliders: [{ kind: 'box', w: 1.9, d: 1.3, top: 1.15 }],
  height: 1.35,
  tags: ['zoo', 'prop'],
  desc: 'Bục gỗ có bậc thang để cho hươu cao cổ ăn.',
});

defineModel<Record<string, never>>('monkey_frame', {
  build: () => {
    const root = new THREE.Group();
    const wood = '#9b6431';
    const rope = '#d8b37a';
    for (const x of [-1.25, 1.25]) for (const z of [-1.0, 1.0]) root.add(cyl(0.065, 0.08, 1.8, wood, { p: [x, 0.9, z], seg: 7 }));
    for (const z of [-1, 1]) {
      root.add(box(2.7, 0.09, 0.09, wood, { p: [0, 1.72, z] }));
      root.add(box(2.55, 0.08, 0.08, wood, { p: [0, 1.18, z] }));
    }
    for (const x of [-1.25, 1.25]) root.add(box(0.09, 0.08, 2.2, wood, { p: [x, 1.55, 0] }));
    root.add(rbox(0.78, 0.12, 0.62, 0.04, '#c8915a', { p: [-0.86, 1.15, -0.98], seg: 2, name: 'platformLow' }));
    root.add(rbox(0.82, 0.12, 0.65, 0.04, '#c8915a', { p: [0.86, 1.72, 0.98], seg: 2, name: 'platformHigh' }));
    for (let i = 0; i < 6; i++) root.add(cyl(0.018, 0.018, 1.55, rope, { p: [-0.68 + i * 0.27, 1.42, 0], r: [0, 0, 90], seg: 5, cast: false }));
    const swing = pivot([0, 1.28, -1.0], [
      cyl(0.018, 0.018, 0.7, rope, { p: [-0.18, 0, 0], seg: 5, cast: false }),
      cyl(0.018, 0.018, 0.7, rope, { p: [0.18, 0, 0], seg: 5, cast: false }),
      torus(0.2, 0.035, '#343044', { p: [0, -0.46, 0], r: [90, 0, 0], ts: 18, seg: 6 }),
    ], 'swing');
    swing.userData.tick = (_dt: number, t: number) => { swing.rotation.z = Math.sin(t * 1.4) * 0.18; };
    root.add(swing);
    return root;
  },
  colliders: [{ kind: 'box', w: 3.0, d: 2.45, top: 1.8 }],
  height: 1.9,
  tags: ['zoo', 'prop'],
  desc: 'Khung leo trèo cho khỉ với bục, dây và xích đu lốp.',
});

defineModel<Record<string, never>>('penguin_ice_floe', {
  build: () => group([
    rbox(1.95, 0.08, 1.25, 0.18, '#f8ffff', { p: [0, 0.04, 0], seg: 3 }),
    rbox(1.42, 0.055, 0.78, 0.16, '#dff7ff', { p: [0.08, 0.1, -0.03], seg: 3, opacity: 0.9 }),
  ]),
  colliders: [{ kind: 'box', w: 1.95, d: 1.25, top: 0.16 }],
  height: 0.16,
  tags: ['zoo', 'water'],
  desc: 'Tảng băng thấp cho nhóm chim cánh cụt.',
});

defineModel<{ style?: 'bunny' | 'elephant' }>('zoo_topiary', {
  build: (o) => {
    const leaf = '#5faf61';
    const light = '#7bd389';
    const parts: THREE.Object3D[] = [
      cyl(0.16, 0.2, 0.28, '#8a5a3b', { p: [0, 0.14, 0], seg: 6 }),
      ball(0.34, leaf, { ...ss, p: [0, 0.55, 0], s: [1.1, 0.82, 1.25], seg: 10 }),
    ];
    if (o.style === 'elephant') {
      parts.push(ball(0.25, light, { ...ss, p: [0, 0.86, 0.28], s: [1.05, 0.9, 0.95], seg: 10 }));
      parts.push(capsule(0.055, 0.36, light, { ...ss, p: [0, 0.68, 0.52], r: [35, 0, 0], seg: 8 }));
      parts.push(ball(0.14, leaf, { ...ss, p: [0.27, 0.84, 0.22], s: [0.45, 0.85, 0.18], seg: 8 }));
      parts.push(ball(0.14, leaf, { ...ss, p: [-0.27, 0.84, 0.22], s: [0.45, 0.85, 0.18], seg: 8 }));
    } else {
      parts.push(ball(0.24, light, { ...ss, p: [0, 0.9, 0.18], seg: 10 }));
      parts.push(capsule(0.055, 0.3, leaf, { ...ss, p: [0.1, 1.15, 0.17], r: [0, 0, -16], seg: 8 }));
      parts.push(capsule(0.055, 0.3, leaf, { ...ss, p: [-0.1, 1.15, 0.17], r: [0, 0, 16], seg: 8 }));
      parts.push(ball(0.08, '#ffffff', { ...ss, p: [0, 0.52, -0.38], seg: 8 }));
    }
    return group(parts);
  },
  colliders: [{ kind: 'circle', r: 0.55, top: 1.25 }],
  height: 1.3,
  tags: ['zoo', 'prop'],
  desc: 'Cây cảnh tỉa hình thú cho lối đi sở thú.',
  variants: [{ style: 'bunny' }, { style: 'elephant' }],
});

defineModel<Record<string, never>>('zoo_hippo_float', {
  build: () => group([
    ball(0.46, '#9a8fb0', { ...ss, p: [0, 0.18, 0], s: [1.25, 0.55, 0.9], seg: 12 }),
    ball(0.3, '#aaa0bf', { ...ss, p: [0, 0.36, 0.34], s: [1.0, 0.65, 0.72], seg: 12 }),
    ball(0.04, '#2b2233', { ...ss, p: [0.12, 0.45, 0.55], seg: 6, cast: false }),
    ball(0.04, '#2b2233', { ...ss, p: [-0.12, 0.45, 0.55], seg: 6, cast: false }),
    ball(0.06, '#8b819f', { ...ss, p: [0.18, 0.56, 0.27], s: [0.75, 1, 0.45], seg: 8 }),
    ball(0.06, '#8b819f', { ...ss, p: [-0.18, 0.56, 0.27], s: [0.75, 1, 0.45], seg: 8 }),
    ball(0.025, '#6d607d', { ...ss, p: [0.08, 0.38, 0.6], seg: 5, cast: false }),
    ball(0.025, '#6d607d', { ...ss, p: [-0.08, 0.38, 0.6], seg: 5, cast: false }),
  ]),
  colliders: [{ kind: 'circle', r: 0.55, top: 0.62 }],
  height: 0.65,
  tags: ['zoo', 'animal'],
  desc: 'Hà mã nổi nửa mình trên mặt nước, ít draw call.',
});

/* ------------------------------------------------------------------ */
/* Pets                                                               */
/* ------------------------------------------------------------------ */

function buildDog(): THREE.Group {
  const fur = '#d8a15f';
  const cream = '#fff0c4';
  const root = new THREE.Group();
  const body = pivot([0, 0, 0], [ball(0.2, fur, { ...ss, p: [0, 0.34, 0], s: [0.9, 0.72, 1.15], seg: 14 }), ball(0.11, cream, { ...ss, p: [0, 0.33, 0.23], s: [1, 0.62, 0.32], seg: 10 })], 'body');
  const eyeL = glossyEye('eyeL', 0.075, 0.035, 0.18, 0.028);
  const eyeR = glossyEye('eyeR', -0.075, 0.035, 0.18, 0.028);
  const earL = floppyEar('earL', 0.2, 0.04, -0.01, C(fur, -0.12), '#f2c49b');
  const earR = floppyEar('earR', -0.2, 0.04, -0.01, C(fur, -0.12), '#f2c49b');
  const head = pivot([0, 0.62, 0.22], [ball(0.2, fur, { ...ss, seg: 14 }), ball(0.115, cream, { ...ss, p: [0, -0.055, 0.2], s: [1.15, 0.78, 0.68], seg: 12 }), eyeL, eyeR, ball(0.024, INK, { ...ss, p: [0, -0.04, 0.29], s: [1.25, 0.7, 0.55], cast: false }), earL, earR, ...blushPair(-0.09, 0.25, 0.12, 0.025)], 'head');
  const legs = [quadLeg('legFL', 0.12, 0.28, 0.26, fur, cream, 0.045), quadLeg('legFR', -0.12, 0.28, 0.26, fur, cream, 0.045), quadLeg('legBL', 0.12, -0.26, 0.26, fur, cream, 0.045), quadLeg('legBR', -0.12, -0.26, 0.26, fur, cream, 0.045)];
  const tail = simpleTail('tail', [0, 0.4, -0.32], fur, [[0, 0, 0], [0.1, 0.2, -0.08], [0.12, 0.36, 0.04]], 0.038);
  const collar = group([torus(0.145, 0.012, '#4dabf7', { ...ss, p: [0, 0.51, 0.2], r: [90, 0, 0], ts: 22, seg: 5 }), ball(0.025, '#ffd166', { ...ss, p: [0, 0.47, 0.34], s: [1, 0.7, 0.45], seg: 8, name: 'tag' })], { name: 'collar' });
  root.add(body, head, ...legs, tail, collar);
  return finalize(root, { root, kind: 'quad', height: 0.82, body, head, legs, tail, ears: [earL, earR], eyes: [eyeL, eyeR], stride: 0.55, cadence: 2.8 });
}

function buildCat(): THREE.Group {
  const fur = '#c58d5b';
  const stripe = '#6e5d54';
  const root = new THREE.Group();
  const body = pivot([0, 0, 0], [ball(0.18, fur, { ...ss, p: [0, 0.33, 0], s: [0.82, 0.7, 1.16], seg: 16 }), ...[-0.2, 0, 0.2].map((z) => torus(0.16, 0.01, stripe, { ...ss, p: [0, 0.34, z], s: [0.85, 0.55, 1], ts: 18, seg: 4, cast: false }))], 'body');
  const eyeL = glossyEye('eyeL', 0.065, 0.032, 0.17, 0.027);
  const eyeR = glossyEye('eyeR', -0.065, 0.032, 0.17, 0.027);
  const earL = pointEar('earL', 0.12, 0.13, 0, fur, '#f0b6b9', 0.68);
  const earR = pointEar('earR', -0.12, 0.13, 0, fur, '#f0b6b9', 0.68);
  const head = pivot([0, 0.61, 0.2], [ball(0.17, fur, { ...ss, seg: 16 }), box(0.055, 0.035, 0.025, stripe, { ...ss, p: [0, 0.11, 0.13], cast: false }), box(0.04, 0.028, 0.022, stripe, { ...ss, p: [0.06, 0.09, 0.13], r: [0, 0, -18], cast: false }), box(0.04, 0.028, 0.022, stripe, { ...ss, p: [-0.06, 0.09, 0.13], r: [0, 0, 18], cast: false }), eyeL, eyeR, earL, earR, ball(0.017, '#ff9ec7', { ...ss, p: [0, -0.025, 0.205], s: [1.15, 0.75, 0.5], cast: false }), ...[-1, 1].flatMap((side) => [tube([[0.03 * side, -0.03, 0.2], [0.16 * side, -0.01, 0.25]], 0.0035, WHITE, { radial: 4 }), tube([[0.03 * side, -0.055, 0.2], [0.15 * side, -0.075, 0.25]], 0.0035, WHITE, { radial: 4 })]), ...blushPair(-0.07, 0.2, 0.105, 0.022)], 'head');
  const legs = [quadLeg('legFL', 0.11, 0.24, 0.25, fur, C(fur, 0.06), 0.04), quadLeg('legFR', -0.11, 0.24, 0.25, fur, C(fur, 0.06), 0.04), quadLeg('legBL', 0.11, -0.24, 0.25, fur, C(fur, 0.06), 0.04), quadLeg('legBR', -0.11, -0.24, 0.25, fur, C(fur, 0.06), 0.04)];
  const tail = simpleTail('tail', [0, 0.36, -0.3], fur, [[0, 0, 0], [0.08, 0.22, -0.08], [0.03, 0.42, 0.03], [-0.06, 0.36, 0.1]], 0.035);
  tail.add(torus(0.038, 0.007, stripe, { ...ss, p: [0.05, 0.26, -0.04], r: [90, 0, 0], ts: 14, seg: 4, cast: false }));
  root.add(body, head, ...legs, tail);
  earL.name = '';
  earR.name = '';
  return finalize(root, { root, kind: 'quad', height: 0.78, body, head, legs, tail, eyes: [eyeL, eyeR], stride: 0.5, cadence: 2.7 });
}

function buildRabbit(): THREE.Group {
  const fur = '#fff8f0';
  const root = new THREE.Group();
  const body = pivot([0, 0, 0], [ball(0.19, fur, { ...ss, p: [0, 0.32, 0], s: [0.9, 0.75, 1.1], seg: 16 })], 'body');
  const eyeL = glossyEye('eyeL', 0.06, 0.025, 0.16, 0.021);
  const eyeR = glossyEye('eyeR', -0.06, 0.025, 0.16, 0.021);
  const earL = pivot([0.075, 0.15, 0], [capsule(0.038, 0.3, fur, { ...ss, p: [0, 0.14, 0], r: [0, 0, -8], s: [0.78, 1, 0.48], seg: 12 }), capsule(0.02, 0.21, '#ffc8dd', { ...ss, p: [0, 0.14, 0.015], r: [0, 0, -8], s: [0.65, 1, 0.32], seg: 8, cast: false })], 'earL');
  const earR = pivot([-0.075, 0.15, 0], [capsule(0.038, 0.3, fur, { ...ss, p: [0, 0.14, 0], r: [0, 0, 8], s: [0.78, 1, 0.48], seg: 12 }), capsule(0.02, 0.21, '#ffc8dd', { ...ss, p: [0, 0.14, 0.015], r: [0, 0, 8], s: [0.65, 1, 0.32], seg: 8, cast: false })], 'earR');
  const head = pivot([0, 0.6, 0.2], [ball(0.17, fur, { ...ss, seg: 16 }), eyeL, eyeR, earL, earR, ball(0.017, '#ff9ec7', { ...ss, p: [0, -0.03, 0.19], cast: false }), ...blushPair(-0.07, 0.19, 0.105, 0.023)], 'head');
  const legs = [quadLeg('legFL', 0.1, 0.24, 0.24, fur, fur, 0.04), quadLeg('legFR', -0.1, 0.24, 0.24, fur, fur, 0.04), quadLeg('legBL', 0.12, -0.24, 0.24, fur, fur, 0.05), quadLeg('legBR', -0.12, -0.24, 0.24, fur, fur, 0.05)];
  root.add(body, head, ...legs, ball(0.065, fur, { ...ss, p: [0, 0.34, -0.31], seg: 12, name: 'tail' }));
  earL.name = '';
  earR.name = '';
  return finalize(root, { root, kind: 'quad', height: 0.86, body, head, legs, eyes: [eyeL, eyeR], stride: 0.12, cadence: 2.4, custom: (rig, s) => { if (s.move > 0.02) { const hop = Math.abs(Math.sin(s.t * (s.run ? 11 : 8))); rig.root.position.y += hop * 0.12 * Math.min(1, s.move); if (rig.body) rig.body.rotation.x = -0.12 + hop * 0.16; } } });
}

function buildPanda(): THREE.Group {
  const root = new THREE.Group();
  const body = pivot([0, 0, 0], [ball(0.21, WHITE, { ...ss, p: [0, 0.33, 0], s: [1, 0.8, 1.08], seg: 16 }), torus(0.2, 0.045, INK, { ...ss, p: [0, 0.37, 0.13], s: [1.02, 0.55, 1], ts: 22, seg: 6, cast: false })], 'body');
  const eyeL = glossyEye('eyeL', 0.067, 0.03, 0.18, 0.024);
  const eyeR = glossyEye('eyeR', -0.067, 0.03, 0.18, 0.024);
  const earL = pivot([0.13, 0.1, -0.015], [ball(0.06, INK, { ...ss, s: [1, 0.82, 0.72], seg: 12 })], 'earL');
  const earR = pivot([-0.13, 0.1, -0.015], [ball(0.06, INK, { ...ss, s: [1, 0.82, 0.72], seg: 12 })], 'earR');
  const head = pivot([0, 0.62, 0.2], [ball(0.18, WHITE, { ...ss, seg: 16 }), ball(0.072, INK, { ...ss, p: [0.068, 0.025, 0.148], s: [1.12, 0.9, 0.32], r: [0, 0, -10], seg: 10 }), ball(0.072, INK, { ...ss, p: [-0.068, 0.025, 0.148], s: [1.12, 0.9, 0.32], r: [0, 0, 10], seg: 10 }), eyeL, eyeR, earL, earR, ball(0.02, INK, { ...ss, p: [0, -0.035, 0.215], s: [1.2, 0.7, 0.5], cast: false }), ...blushPair(-0.075, 0.21, 0.11, 0.022)], 'head');
  const legs = [quadLeg('legFL', 0.12, 0.23, 0.24, INK, INK, 0.047), quadLeg('legFR', -0.12, 0.23, 0.24, INK, INK, 0.047), quadLeg('legBL', 0.12, -0.24, 0.24, INK, INK, 0.047), quadLeg('legBR', -0.12, -0.24, 0.24, INK, INK, 0.047)];
  root.add(body, head, ...legs);
  earL.name = '';
  earR.name = '';
  return finalize(root, { root, kind: 'quad', height: 0.8, body, head, legs, eyes: [eyeL, eyeR], stride: 0.38, cadence: 2.2 });
}

function buildFox(): THREE.Group {
  const orange = '#f08a3c';
  const root = new THREE.Group();
  const body = pivot([0, 0, 0], [ball(0.19, orange, { ...ss, p: [0, 0.34, 0], s: [0.85, 0.72, 1.18], seg: 16 }), ball(0.1, WHITE, { ...ss, p: [0, 0.33, 0.22], s: [0.9, 0.68, 0.3], seg: 12 })], 'body');
  const eyeL = glossyEye('eyeL', 0.06, 0.025, 0.17, 0.021);
  const eyeR = glossyEye('eyeR', -0.06, 0.025, 0.17, 0.021);
  const earL = pointEar('earL', 0.12, 0.13, 0, orange, '#ffd0c2', 0.74);
  const earR = pointEar('earR', -0.12, 0.13, 0, orange, '#ffd0c2', 0.74);
  const head = pivot([0, 0.62, 0.2], [ball(0.17, orange, { ...ss, seg: 16 }), ball(0.09, WHITE, { ...ss, p: [0, -0.04, 0.16], s: [1, 0.75, 0.7], seg: 12 }), eyeL, eyeR, earL, earR, ball(0.017, INK, { ...ss, p: [0, -0.035, 0.235], cast: false })], 'head');
  const legs = [quadLeg('legFL', 0.11, 0.24, 0.25, orange, INK, 0.04), quadLeg('legFR', -0.11, 0.24, 0.25, orange, INK, 0.04), quadLeg('legBL', 0.11, -0.24, 0.25, orange, INK, 0.04), quadLeg('legBR', -0.11, -0.24, 0.25, orange, INK, 0.04)];
  const tail = pivot([0, 0.38, -0.3], [capsule(0.07, 0.36, orange, { ...ss, p: [0.08, 0.08, -0.15], r: [50, 0, -20], s: [1.2, 1, 1.2], seg: 14 }), ball(0.07, WHITE, { ...ss, p: [0.16, 0.22, -0.28], s: [1.1, 0.85, 1.2], seg: 12 })], 'tail');
  root.add(body, head, ...legs, tail);
  earL.name = '';
  earR.name = '';
  return finalize(root, { root, kind: 'quad', height: 0.82, body, head, legs, tail, eyes: [eyeL, eyeR], stride: 0.52, cadence: 2.8 });
}

function buildDino(): THREE.Group {
  const green = '#4ecdc4';
  const root = new THREE.Group();
  const body = pivot([0, 0, 0], [ball(0.2, green, { ...ss, p: [0, 0.36, 0], s: [0.9, 1.0, 1.05], seg: 16 }), ball(0.12, '#b9f3df', { ...ss, p: [0, 0.32, 0.2], s: [0.95, 0.9, 0.35], seg: 12 }), ...[-0.2, 0.0, 0.2].map((z, i) => cone(0.04, 0.09, C(green, -0.12), { ...ss, p: [0, 0.58 + i * 0.015, z - 0.12], r: [-20, 0, 0], seg: 8 }))], 'body');
  const eyeL = glossyEye('eyeL', 0.065, 0.03, 0.17, 0.022);
  const eyeR = glossyEye('eyeR', -0.065, 0.03, 0.17, 0.022);
  const head = pivot([0, 0.72, 0.18], [ball(0.17, green, { ...ss, seg: 16 }), ball(0.09, '#b9f3df', { ...ss, p: [0, -0.04, 0.16], s: [1, 0.72, 0.65], seg: 12 }), eyeL, eyeR, ball(0.014, INK, { ...ss, p: [0.04, -0.035, 0.22], cast: false }), ball(0.014, INK, { ...ss, p: [-0.04, -0.035, 0.22], cast: false })], 'head');
  const armL = pivot([0.15, 0.48, 0.15], [capsule(0.025, 0.12, green, { ...ss, p: [0, -0.07, 0], r: [25, 0, -25], seg: 8 })], 'armL');
  const armR = pivot([-0.15, 0.48, 0.15], [capsule(0.025, 0.12, green, { ...ss, p: [0, -0.07, 0], r: [25, 0, 25], seg: 8 })], 'armR');
  const legL = bipedLeg('legL', 0.09, 0.27, green, C(green, -0.08), 0.27, 0.05);
  const legR = bipedLeg('legR', -0.09, 0.27, green, C(green, -0.08), 0.27, 0.05);
  const tail = simpleTail('tail', [0, 0.35, -0.23], green, [[0, 0, 0], [0, 0.03, -0.18], [0, 0.08, -0.34]], 0.055);
  root.add(body, head, armL, armR, legL, legR, tail);
  return finalize(root, { root, kind: 'biped', height: 0.9, body, head, armL, armR, legL, legR, tail, eyes: [eyeL, eyeR], stride: 0.38, cadence: 2.6 });
}

registerAnimal('pet_dog', () => buildDog(), 0.82, 0.3, 'Cún con: ears/tail/legs/head/eyes rig, đuôi vẫy.', undefined, ['pet']);
registerAnimal('pet_cat', () => buildCat(), 0.78, 0.3, 'Mèo mướp: sọc xám/nâu, tail up, whiskers.', undefined, ['pet']);
registerAnimal('pet_rabbit', () => buildRabbit(), 0.86, 0.3, 'Thỏ trắng: ears twitch, custom hop khi di chuyển.', undefined, ['pet']);
registerAnimal('pet_panda', () => buildPanda(), 0.8, 0.31, 'Gấu trúc con: mắt vá, quad rig chubby.', undefined, ['pet']);
registerAnimal('pet_fox', () => buildFox(), 0.82, 0.31, 'Cáo cam: ngực trắng, tail fluffy, ears.', undefined, ['pet']);
registerAnimal('pet_penguin', () => buildPenguin(0.78, true), 0.72, 0.27, 'Cánh cụt con: dùng waddle custom, flippers armL/armR.', undefined, ['pet']);
registerAnimal('pet_dino', () => buildDino(), 0.9, 0.3, 'Khủng long tí hon thân thiện: biped, tiny arms, spikes, tail.', undefined, ['pet']);

/* ------------------------------------------------------------------ */
/* Board                                                               */
/* ------------------------------------------------------------------ */

defineModel<ColorOpt>('board_skate', {
  build: (o) => {
    const deck = o.color ?? '#ff8fab';
    const root = new THREE.Group();
    root.add(
      rbox(0.28, 0.08, 0.62, 0.06, deck, { ...ss, p: [0, 0.1, 0], seg: 3, name: 'deck' }),
      rbox(0.28, 0.055, 0.18, 0.055, deck, { ...ss, p: [0, 0.12, 0.38], r: [-16, 0, 0], seg: 3, name: 'nose' }),
      rbox(0.28, 0.055, 0.18, 0.055, deck, { ...ss, p: [0, 0.12, -0.38], r: [16, 0, 0], seg: 3, name: 'tail' }),
      rbox(0.22, 0.01, 0.58, 0.025, '#343044', { p: [0, 0.146, 0], seg: 2, cast: false, name: 'grip' }),
      extrude('skate-star', () => starShape(0.08, 0.035), 0.012, '#ffd166', { ...ss, p: [0, 0.055, 0], r: [90, 0, 0], bevel: 0.004, name: 'undersideStar' }),
    );
    for (const z of [-0.24, 0.24]) {
      root.add(cyl(0.018, 0.018, 0.34, '#9aa0a6', { ...ss, p: [0, 0.06, z], r: [0, 0, 90], seg: 8, name: z > 0 ? 'truckFront' : 'truckBack' }));
      for (const x of [-0.21, 0.21]) {
        root.add(cyl(0.055, 0.055, 0.045, '#2b2233', { ...ss, p: [x, 0.055, z], r: [0, 0, 90], seg: 14, name: `wheel_${x > 0 ? 'L' : 'R'}_${z > 0 ? 'F' : 'B'}` }));
        root.add(cyl(0.026, 0.026, 0.048, '#74c0fc', { ...ss, p: [x, 0.055, z], r: [0, 0, 90], seg: 10, cast: false }));
      }
    }
    return root;
  },
  colliders: [{ kind: 'box', w: 0.34, d: 0.85, top: 0.14 }],
  height: 0.2,
  tags: ['board'],
  desc: 'Ván trượt: deck/grip/nose/tail/star/trucks/wheels named; color tùy chọn.',
  variants: [{ color: '#ff8fab' }, { color: '#74c0fc' }, { color: '#ffd166' }],
});

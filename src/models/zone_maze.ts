import * as THREE from 'three';
import { ball, box, cone, cyl, extrude, rbox, starShape, torus } from '../engine/kit';
import { PAL, tint } from '../engine/materials';
import { numberBadge, textPlate } from '../engine/text';
import { defineModel } from './registry';

const ss = { flat: false } as const;

defineModel('maze_key_pedestal', {
  build: () => {
    const g = new THREE.Group();
    g.add(cyl(0.48, 0.58, 0.22, '#d8c7a3', { p: [0, 0.11, 0], seg: 16 }));
    g.add(cyl(0.34, 0.42, 0.78, '#efe3c8', { p: [0, 0.5, 0], seg: 14 }));
    g.add(torus(0.36, 0.045, '#c9ad76', { ...ss, p: [0, 0.91, 0], r: [90, 0, 0], ts: 22, seg: 6 }));
    g.add(cyl(0.38, 0.38, 0.1, '#fff4d8', { p: [0, 0.94, 0], seg: 16 }));
    g.add(extrude('maze-pedestal-star', () => starShape(0.16, 0.07), 0.025, PAL.gold, { p: [0, 0.52, 0.38], cast: false }));
    return g;
  },
  colliders: [{ kind: 'circle', r: 0.48, top: 1.0 }],
  height: 1.05,
  tags: ['maze', 'prop'],
  desc: 'Bệ chìa khóa trong Mê Cung',
});

defineModel('maze_exit_gate', {
  build: () => {
    const g = new THREE.Group();
    for (const x of [-1.45, 1.45]) {
      g.add(rbox(0.56, 3.2, 0.72, 0.12, '#d8d0c2', { p: [x, 1.6, 0], seg: 2 }));
      g.add(box(0.72, 0.28, 0.82, '#bfb8ac', { p: [x, 0.25, 0] }));
      g.add(cone(0.42, 0.55, '#b197fc', { ...ss, p: [x, 3.45, 0], seg: 12 }));
      g.add(ball(0.08, PAL.gold, { p: [x, 3.78, 0], seg: 8, emissive: PAL.gold, glow: 0.25 }));
    }
    g.add(torus(1.45, 0.16, '#d8d0c2', { p: [0, 2.55, 0.02], arc: 180, seg: 8, ts: 22 }));
    g.add(rbox(3.25, 0.42, 0.72, 0.08, '#d8d0c2', { p: [0, 3.18, 0], seg: 2 }));
    const sign = textPlate('SỞ THÚ', 0.34, { bg: '#fff4d8', color: '#2b2233', border: PAL.gold, pad: 16, radius: 16, weight: 900 });
    sign.position.set(0, 3.18, 0.43);
    g.add(sign);
    const left = new THREE.Group();
    left.name = 'doorL';
    left.position.set(-1.08, 0, 0);
    left.add(rbox(1.08, 2.25, 0.22, 0.07, '#7aa7e0', { p: [0.54, 1.18, 0], seg: 2 }));
    left.add(box(0.96, 0.09, 0.24, tint('#7aa7e0', -0.18), { p: [0.54, 1.78, 0.13], cast: false }));
    left.add(box(0.96, 0.09, 0.24, tint('#7aa7e0', -0.18), { p: [0.54, 0.75, 0.13], cast: false }));
    left.add(ball(0.06, PAL.gold, { p: [0.92, 1.22, 0.15], seg: 8 }));
    const right = new THREE.Group();
    right.name = 'doorR';
    right.position.set(1.08, 0, 0);
    right.add(rbox(1.08, 2.25, 0.22, 0.07, '#6fb7b7', { p: [-0.54, 1.18, 0], seg: 2 }));
    right.add(box(0.96, 0.09, 0.24, tint('#6fb7b7', -0.18), { p: [-0.54, 1.78, 0.13], cast: false }));
    right.add(box(0.96, 0.09, 0.24, tint('#6fb7b7', -0.18), { p: [-0.54, 0.75, 0.13], cast: false }));
    right.add(ball(0.06, PAL.gold, { p: [-0.92, 1.22, 0.15], seg: 8 }));
    const badge = numberBadge('17', 0.72, { bg: '#fffbe8', color: '#2b2233', border: PAL.gold });
    badge.position.set(0, 2.16, 0.16);
    g.add(left, right, badge);
    return g;
  },
  colliders: [
    { kind: 'box', w: 0.65, d: 0.85, at: [-1.45, 0] },
    { kind: 'box', w: 0.65, d: 0.85, at: [1.45, 0] },
    { kind: 'box', w: 2.25, d: 0.34, at: [0, 0] },
  ],
  height: 3.9,
  tags: ['maze', 'door'],
  desc: 'Cổng ra Mê Cung, doorL/doorR mở khi hoàn thành',
});

defineModel('maze_bunting', {
  build: () => {
    const g = new THREE.Group();
    g.add(cyl(0.025, 0.025, 3.3, PAL.gold, { p: [0, 0, 0], r: [0, 0, 90], seg: 6, emissive: PAL.gold, glow: 0.18 }));
    const cols = ['#ff6b9e', '#ffd166', '#4ecdc4', '#7aa7e0', '#b197fc'];
    for (let i = 0; i < 9; i++) {
      const x = -1.45 + i * 0.36;
      const flag = cone(0.15, 0.36, cols[i % cols.length], { ...ss, p: [x, -0.2 - Math.sin(i * 0.8) * 0.05, 0], r: [180, 0, 0], seg: 3, cast: false });
      g.add(flag);
      g.add(ball(0.045, cols[(i + 2) % cols.length], { p: [x + 0.16, 0.05, 0.02], seg: 8, emissive: cols[(i + 2) % cols.length], glow: 0.35 }));
    }
    return g;
  },
  height: 0.35,
  tags: ['maze', 'prop'],
  desc: 'Dây cờ và đèn mừng khi mở cổng Mê Cung',
});

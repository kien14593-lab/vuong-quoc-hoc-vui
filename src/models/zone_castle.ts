import * as THREE from 'three';
import { ball, box, cone, cyl, group, prism, rbox } from '../engine/kit';
import { tint } from '../engine/materials';
import { textPlate } from '../engine/text';
import { defineModel } from './registry';

type CastleDecorOpt = { text?: string; color?: string; accent?: string };

defineModel<CastleDecorOpt>('castle_emblem', {
  build: (o) => {
    const color = o.color ?? '#c7b3ff';
    const accent = o.accent ?? '#ffd166';
    const root = new THREE.Group();
    root.add(rbox(2.25, 1.7, 0.16, 0.14, '#fff8ee', { p: [0, 1.1, 0], shiny: 20 }));
    root.add(rbox(2.45, 0.18, 0.2, 0.07, accent, { p: [0, 1.98, 0.02], shiny: 45 }));
    root.add(rbox(2.45, 0.18, 0.2, 0.07, accent, { p: [0, 0.22, 0.02], shiny: 45 }));
    const plate = textPlate(o.text ?? '×', 1.0, { color, stroke: '#4d3d66', strokeW: 10, pad: 8, weight: 900, doubleSided: true });
    plate.position.set(0, 1.1, 0.13);
    root.add(plate);
    return root;
  },
  height: 2.1,
  tags: ['castle'],
  desc: 'Huy hiệu toán học lớn treo trên tường phòng lâu đài.',
  variants: [{ text: '×' }, { text: '½', color: '#6cb8ff' }, { text: '△', color: '#70c268' }],
});

defineModel<CastleDecorOpt>('castle_floor_emblem', {
  build: (o) => {
    const color = o.color ?? '#c7b3ff';
    const root = new THREE.Group();
    root.add(cyl(1.55, 1.55, 0.035, '#fff8ee', { p: [0, 0.02, 0], seg: 36, shiny: 12 }));
    root.add(cyl(1.32, 1.32, 0.04, tint(color, 0.38), { p: [0, 0.05, 0], seg: 36, shiny: 20 }));
    const plate = textPlate(o.text ?? '×', 1.0, { color: '#ffffff', stroke: '#4d3d66', strokeW: 10, pad: 6, weight: 900, doubleSided: true });
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(0, 0.085, 0);
    root.add(plate);
    return root;
  },
  colliders: [],
  height: 0.14,
  tags: ['castle'],
  desc: 'Huy hiệu ký hiệu toán học nằm trên sàn.',
  variants: [{ text: '×' }, { text: '½', color: '#6cb8ff' }, { text: '△', color: '#70c268' }],
});

defineModel<CastleDecorOpt>('castle_pavilion', {
  build: (o) => {
    const color = o.color ?? '#ff9ec7';
    const accent = o.accent ?? '#ffd166';
    const root = new THREE.Group();
    root.add(rbox(3.0, 0.25, 2.45, 0.1, '#fff8ee', { p: [0, 0.13, 0] }));
    for (const [x, z] of [[-1.25, -0.9], [1.25, -0.9], [-1.25, 0.9], [1.25, 0.9]] as [number, number][]) {
      root.add(cyl(0.07, 0.08, 2.0, '#f4d08c', { p: [x, 1.08, z], seg: 6 }));
      root.add(ball(0.12, accent, { p: [x, 2.12, z], seg: 8, shiny: 45 }));
    }
    root.add(prism(3.5, 0.95, 2.8, color, { p: [0, 2.35, 0], r: [0, 90, 0] }));
    root.add(box(3.6, 0.12, 0.18, accent, { p: [0, 2.0, 1.38], cast: false }));
    root.add(box(3.6, 0.12, 0.18, accent, { p: [0, 2.0, -1.38], cast: false }));
    root.add(cone(0.18, 0.38, accent, { p: [0, 2.98, 0], seg: 5 }));
    if (o.text) {
      const label = textPlate(o.text, 0.32, { bg: '#fff8ee', color: '#4d3d66', border: accent, pad: 18, weight: 900, doubleSided: true });
      label.position.set(0, 1.35, 1.46);
      root.add(label);
    }
    return root;
  },
  colliders: [{ kind: 'box', w: 3.1, d: 2.55, top: 0.32 }],
  height: 3.05,
  tags: ['castle', 'prop'],
  desc: 'Gian lều/pavilion hoàng gia cho vườn mini-game.',
  variants: [{ text: 'XÂY', color: '#c7b3ff' }, { text: 'GIỜ', color: '#8fd3ff' }, { text: 'PIZZA', color: '#ff9ec7' }],
});

defineModel<CastleDecorOpt>('castle_statue', {
  build: (o) => group([
    cyl(0.55, 0.68, 0.28, '#fff8ee', { p: [0, 0.14, 0], seg: 14 }),
    cyl(0.42, 0.38, 1.05, '#f1d7ff', { p: [0, 0.8, 0], seg: 12 }),
    ball(0.34, '#fff8ee', { p: [0, 1.52, 0], seg: 12, shiny: 35 }),
    cone(0.18, 0.36, o.color ?? '#ffd166', { p: [0, 1.95, 0], seg: 5, shiny: 55 }),
    box(0.74, 0.12, 0.12, o.accent ?? '#ffd166', { p: [0, 1.74, 0.18], cast: false }),
  ]),
  colliders: [{ kind: 'circle', r: 0.65, top: 0.32 }],
  height: 2.15,
  tags: ['castle', 'prop'],
  desc: 'Tượng vườn hoàng gia nhỏ.',
  variants: [{}],
});

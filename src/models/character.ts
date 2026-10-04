import * as THREE from 'three';
import { EYE_COLORS, HAIR_COLORS, SKIN_TONES, item } from '../core/items';
import type { Kid } from '../core/outfits';
import type { Equipped } from '../core/state';
import { ball, box, capsule, cone, cyl, DEG, extrude, group, lathe, pivot, rbox, sphPart, starShape, torus } from '../engine/kit';
import { mat, smooth, tint } from '../engine/materials';
import { compactModel } from '../engine/merge';
import { textPlate } from '../engine/text';
import { defineModel, isRawModels, rigNodes } from './registry';
import type { Rig } from './rig';

/**
 * Nhân vật chibi (đầu to, thân nhỏ) – dùng cho người chơi và NPC dạng người.
 * Cao ~1.75 đơn vị, chân ở y = 0, nhìn về +Z.
 */
export interface Wear {
  style: string;
  color: string;
  color2?: string;
}

export interface CharSpec {
  skin: string;
  hair: string;
  hairStyle: number;
  eye: string;
  shirt: Wear;
  pants: Wear;
  shoes: Wear;
  hat?: Wear | null;
  bag?: Wear | null;
  acc?: Wear | null;
  /** Thêm má hồng (mặc định có). */
  blush?: boolean;
  /** Râu (cho nhân vật người lớn: nhà vua...). */
  beard?: string;
}

export const HIP_Y = 0.42;
/** Tâm đầu trong hệ tọa độ nhân vật (khi đứng yên). */
export const HEAD_CENTER_Y = HIP_Y + 0.5 + 0.36;
export const HEAD_R = 0.44;

/** Kiểu dáng của một vật phẩm đeo (mũ, balo, phụ kiện) theo mã vật phẩm. */
export const wear = (id: string | null | undefined, fallback?: Wear): Wear | null => {
  if (!id) return fallback ?? null;
  const it = item(id);
  if (!it?.style) return fallback ?? null;
  return { style: it.style, color: it.color ?? '#cccccc', color2: it.color2 };
};

/**
 * Bé dựng bằng code – chỉ dùng dự phòng khi mô hình AI của bé chưa tải được (giống ảnh mẫu của cô):
 * bé trai tóc ngắn đen, áo xanh da trời có ngôi sao vàng, quần jean, giày đỏ;
 * bé gái tóc hai bím, áo hồng, quần soóc tím nhạt, giày hồng.
 */
export function kidSpec(kid: Kid, eq: Partial<Equipped> = {}): CharSpec {
  const girl = kid === 'gai';
  return {
    skin: SKIN_TONES[1],
    hair: HAIR_COLORS[0],
    hairStyle: girl ? 3 : 0,
    eye: EYE_COLORS[0],
    shirt: girl ? { style: 'tee', color: '#ff9ec4', color2: '#f07aa8' } : { style: 'star', color: '#6cc3f0', color2: '#ffe066' },
    pants: girl ? { style: 'shorts', color: '#c3a6f0' } : { style: 'pants', color: '#5b7fc7' },
    shoes: { style: 'sneaker', color: girl ? '#ff8fb8' : '#ff6b6b' },
    hat: wear(eq.hat),
    bag: wear(eq.backpack),
    acc: wear(eq.acc),
  };
}

const S = (c: string, o = {}) => smooth(c, o);
const ss = { flat: false } as const;

/* ------------------------------------------------------------------ */
/* Thân                                                                 */
/* ------------------------------------------------------------------ */
const TORSO: [number, number][] = [
  [0.0, 0.06],
  [0.2, 0.065],
  [0.245, 0.12],
  [0.265, 0.22],
  [0.255, 0.34],
  [0.215, 0.45],
  [0.13, 0.52],
  [0.0, 0.54],
];
const HIPS: [number, number][] = [
  [0.0, -0.08],
  [0.17, -0.075],
  [0.235, -0.02],
  [0.25, 0.06],
  [0.245, 0.13],
  [0.0, 0.13],
];

function torsoRadius(y: number): number {
  for (let i = 1; i < TORSO.length; i++) {
    const [r1, y1] = TORSO[i];
    if (y <= y1) {
      const [r0, y0] = TORSO[i - 1];
      return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    }
  }
  return 0;
}

function band(y: number, color: string, w = 0.028): THREE.Mesh {
  const r = torsoRadius(y) + 0.004;
  return torus(r, w, color, { ...ss, p: [0, y, 0], r: [90, 0, 0], ts: 28, seg: 6 });
}

function buildTorso(sp: CharSpec): THREE.Group {
  const g = new THREE.Group();
  const sh = sp.shirt;
  const c1 = sh.color;
  const c2 = sh.color2 ?? tint(c1, -0.12);
  g.add(lathe(TORSO, c1, { ...ss, seg: 22 }));
  // Phần hông (quần/váy)
  const ps = sp.pants;
  const dressLike = sh.style === 'dress' || sh.style === 'robe';
  if (!dressLike) {
    if (ps.style === 'skirt') {
      g.add(
        lathe(
          [
            [0.0, 0.12],
            [0.24, 0.13],
            [0.27, 0.05],
            [0.34, -0.1],
            [0.35, -0.13],
            [0.0, -0.13],
          ],
          ps.color,
          { ...ss, seg: 18 },
        ),
      );
      g.add(torus(0.345, 0.018, tint(ps.color, 0.12), { ...ss, p: [0, -0.125, 0], r: [90, 0, 0], ts: 26, seg: 5 }));
    } else {
      g.add(lathe(HIPS, ps.color, { ...ss, seg: 20 }));
      g.add(torus(torsoRadius(0.1) + 0.004, 0.022, tint(ps.color, -0.1), { ...ss, p: [0, 0.1, 0], r: [90, 0, 0], ts: 26, seg: 5 }));
    }
  }
  switch (sh.style) {
    case 'stripe':
      for (const y of [0.16, 0.27, 0.38]) g.add(band(y, c2, 0.03));
      break;
    case 'star':
      g.add(extrude('star5', () => starShape(0.11, 0.05), 0.04, c2, { ...ss, p: [0, 0.27, 0.255], cast: false }));
      break;
    case 'math': {
      const t = textPlate('1+1=2', 0.1, { color: c2, size: 90, pad: 10, weight: 900 });
      t.position.set(0, 0.27, 0.268);
      g.add(t);
      break;
    }
    case 'rainbow': {
      const cols = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'];
      cols.forEach((c, i) => g.add(band(0.14 + i * 0.055, c, 0.026)));
      break;
    }
    case 'hoodie':
      g.add(rbox(0.26, 0.1, 0.06, 0.03, c2, { ...ss, p: [0, 0.18, 0.235] }));
      g.add(cyl(0.012, 0.012, 0.14, '#ffffff', { ...ss, p: [-0.05, 0.38, 0.2], r: [12, 0, 0] }));
      g.add(cyl(0.012, 0.012, 0.14, '#ffffff', { ...ss, p: [0.05, 0.38, 0.2], r: [12, 0, 0] }));
      // mũ trùm sau gáy
      g.add(torus(0.17, 0.075, c1, { ...ss, p: [0, 0.52, -0.1], r: [70, 0, 0], ts: 20, seg: 8 }));
      break;
    case 'dress':
      g.add(
        lathe(
          [
            [0.0, 0.2],
            [0.22, 0.21],
            [0.27, 0.1],
            [0.38, -0.12],
            [0.4, -0.17],
            [0.0, -0.17],
          ],
          c1,
          { ...ss, seg: 20 },
        ),
      );
      g.add(torus(0.395, 0.022, c2, { ...ss, p: [0, -0.16, 0], r: [90, 0, 0], ts: 28, seg: 5 }));
      g.add(band(0.21, c2, 0.025));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        g.add(ball(0.03, c2, { ...ss, p: [Math.sin(a) * 0.32, -0.05, Math.cos(a) * 0.32], seg: 8 }));
      }
      break;
    case 'robe':
      g.add(
        lathe(
          [
            [0.0, 0.3],
            [0.25, 0.32],
            [0.3, 0.1],
            [0.36, -0.2],
            [0.38, -0.27],
            [0.0, -0.27],
          ],
          c1,
          { ...ss, seg: 20 },
        ),
      );
      g.add(torus(0.375, 0.025, c2, { ...ss, p: [0, -0.26, 0], r: [90, 0, 0], ts: 28, seg: 5 }));
      g.add(box(0.05, 0.5, 0.02, c2, { ...ss, p: [0, 0.12, 0.27], r: [-6, 0, 0], cast: false }));
      for (const y of [0.0, 0.2]) {
        g.add(extrude('star5s', () => starShape(0.045, 0.02), 0.02, c2, { ...ss, p: [0.16, y + 0.06, 0.26], r: [0, 25, 0], cast: false }));
      }
      break;
    default:
      break;
  }
  // Cổ áo
  g.add(torus(0.12, 0.03, sh.style === 'tee' || sh.style === 'math' ? tint(c1, -0.1) : c2, { ...ss, p: [0, 0.51, 0], r: [90, 0, 0], ts: 18, seg: 6 }));
  return g;
}

/* ------------------------------------------------------------------ */
/* Tay, chân                                                            */
/* ------------------------------------------------------------------ */
function buildArm(sp: CharSpec, side: 1 | -1): THREE.Group {
  const sh = sp.shirt;
  const long = sh.style === 'hoodie' || sh.style === 'robe';
  const sleeve = sh.style === 'dress' ? sh.color : sh.color;
  const parts: THREE.Object3D[] = [];
  if (sh.style === 'dress') {
    parts.push(ball(0.11, sleeve, { ...ss, p: [0, -0.04, 0], s: [1, 0.85, 1] }));
    parts.push(capsule(0.07, 0.2, sp.skin, { ...ss, p: [0, -0.2, 0] }));
  } else {
    parts.push(capsule(0.088, 0.1, sleeve, { ...ss, p: [0, -0.1, 0] }));
    parts.push(torus(0.083, 0.02, sh.style === 'robe' ? sh.color2 ?? sleeve : tint(sleeve, -0.08), { ...ss, p: [0, long ? -0.33 : -0.17, 0], r: [90, 0, 0], ts: 14, seg: 5 }));
    parts.push(capsule(long ? 0.082 : 0.068, 0.14, long ? sleeve : sp.skin, { ...ss, p: [0, -0.24, 0] }));
  }
  parts.push(ball(0.09, sp.skin, { ...ss, p: [0, -0.38, 0.01] }));
  const arm = pivot([side * 0.25, 0.42, 0], parts, side > 0 ? 'armL' : 'armR');
  arm.rotation.z = side * 0.14;
  return arm;
}

function buildLeg(sp: CharSpec, side: 1 | -1): THREE.Group {
  const ps = sp.pants;
  const dressLike = sp.shirt.style === 'dress' || sp.shirt.style === 'robe';
  const legColor = dressLike || ps.style === 'skirt' ? sp.skin : ps.style === 'shorts' ? sp.skin : ps.color;
  const parts: THREE.Object3D[] = [];
  parts.push(capsule(0.095, 0.24, legColor, { ...ss, p: [0, -0.16, 0] }));
  if (!dressLike && ps.style === 'shorts') {
    parts.push(capsule(0.112, 0.06, ps.color, { ...ss, p: [0, -0.04, 0] }));
  }
  if (!dressLike && ps.style === 'pants') {
    parts.push(torus(0.096, 0.02, tint(ps.color, -0.08), { ...ss, p: [0, -0.3, 0], r: [90, 0, 0], ts: 14, seg: 5 }));
  }
  parts.push(...buildShoe(sp.shoes));
  return pivot([side * 0.12, HIP_Y, 0], parts, side > 0 ? 'legL' : 'legR');
}

function buildShoe(w: Wear): THREE.Object3D[] {
  const c = w.color;
  const out: THREE.Object3D[] = [];
  const sole = w.color === '#ffffff' ? '#e9e4f2' : '#ffffff';
  if (w.style === 'boot') {
    out.push(cyl(0.11, 0.115, 0.2, c, { ...ss, p: [0, -0.27, 0], seg: 14 }));
    out.push(torus(0.112, 0.02, tint(c, -0.12), { ...ss, p: [0, -0.17, 0], r: [90, 0, 0], ts: 14, seg: 5 }));
  }
  out.push(ball(0.125, c, { ...ss, p: [0, -0.35, 0.04], s: [1, 0.62, 1.35] }));
  out.push(cyl(0.115, 0.12, 0.04, sole, { ...ss, p: [0, -0.4, 0.04], s: [1, 1, 1.32], seg: 16 }));
  if (w.style === 'sneaker') {
    out.push(box(0.12, 0.018, 0.03, '#ffffff', { ...ss, p: [0, -0.3, 0.1], r: [-30, 0, 0], cast: false }));
  } else if (w.style === 'sparkle') {
    for (const [x, y, z] of [
      [0.08, -0.32, 0.1],
      [-0.07, -0.3, 0.06],
      [0.0, -0.29, 0.15],
    ] as [number, number, number][]) {
      out.push(ball(0.025, '#fff6a8', { p: [x, y, z], seg: 4, emissive: '#fff1a0', glow: 0.8, cast: false }));
    }
  } else if (w.style === 'rocket') {
    out.push(cone(0.06, 0.16, '#ffb347', { p: [0, -0.36, -0.17], r: [-90, 0, 0], emissive: '#ff8c1a', glow: 0.7, cast: false, seg: 8 }));
    out.push(cyl(0.06, 0.07, 0.06, '#adb5bd', { ...ss, p: [0, -0.36, -0.1], r: [90, 0, 0], seg: 10 }));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Đầu, mặt, tóc                                                         */
/* ------------------------------------------------------------------ */
function buildFace(sp: CharSpec, headG: THREE.Group, rig: Rig): void {
  const eyeDark = tint(sp.eye, -0.08);
  const eyes: THREE.Object3D[] = [];
  for (const side of [1, -1] as const) {
    const eg = new THREE.Group();
    eg.position.set(side * 0.16, -0.01, 0.395);
    eg.rotation.y = side * 18 * DEG;
    eg.add(ball(0.078, eyeDark, { ...ss, s: [0.86, 1.18, 0.5], seg: 16, cast: false }));
    eg.add(ball(0.04, '#1f1830', { ...ss, p: [0, -0.01, 0.022], s: [1, 1.15, 0.5], seg: 12, cast: false }));
    eg.add(ball(0.026, '#ffffff', { p: [0.024, 0.035, 0.04], seg: 8, unlit: true, cast: false }));
    eg.add(ball(0.012, '#ffffff', { p: [-0.022, -0.03, 0.038], seg: 6, unlit: true, cast: false }));
    eg.name = side > 0 ? 'eyeL' : 'eyeR';
    headG.add(eg);
    eyes.push(eg);
    // lông mày
    headG.add(capsule(0.014, 0.06, tint(sp.hair, -0.05), { ...ss, p: [side * 0.16, 0.13, 0.405], r: [0, side * 15, 90 + side * 8], cast: false }));
    if (sp.blush !== false) {
      headG.add(ball(0.06, '#ff9fb5', { ...ss, p: [side * 0.27, -0.1, 0.33], s: [1, 0.55, 0.35], r: [0, side * 38, 0], seg: 10, cast: false, opacity: 0.75 }));
    }
    // tai
    headG.add(ball(0.085, sp.skin, { ...ss, p: [side * 0.435, -0.03, 0.0], s: [0.55, 1, 0.85], seg: 12 }));
  }
  rig.eyes = eyes;
  // mũi + miệng
  headG.add(ball(0.03, tint(sp.skin, -0.06), { ...ss, p: [0, -0.06, 0.435], s: [1.2, 0.9, 1], seg: 8, cast: false }));
  const mouth = new THREE.Group();
  mouth.position.set(0, -0.15, 0.405);
  mouth.rotation.x = -14 * DEG;
  mouth.add(torus(0.055, 0.016, '#a24b5c', { ...ss, arc: 180, r: [0, 0, 180], ts: 12, seg: 5, cast: false }));
  headG.add(mouth);
  rig.mouth = mouth;
  if (sp.beard) {
    headG.add(sphPart(0.455, sp.beard, 0, 180, 95, 55, { ...ss, cast: false }));
    headG.add(ball(0.09, sp.beard, { ...ss, p: [0, -0.4, 0.28], s: [1.4, 1, 0.8] }));
    headG.add(capsule(0.035, 0.12, sp.beard, { ...ss, p: [0.08, -0.11, 0.43], r: [0, 0, 75] }));
    headG.add(capsule(0.035, 0.12, sp.beard, { ...ss, p: [-0.08, -0.11, 0.43], r: [0, 0, -75] }));
  }
}

/** Đặt một khối hướng ra ngoài theo phương `dir` (đơn vị) trên mặt cầu bán kính r. */
function onSphere(obj: THREE.Object3D, dir: THREE.Vector3, r: number): THREE.Object3D {
  const d = dir.clone().normalize();
  obj.position.copy(d.clone().multiplyScalar(r));
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  return obj;
}

function hairCap(color: string, thetaLen: number, tiltBack: number, r = 0.47): THREE.Mesh {
  const cap = sphPart(r, color, 0, 360, 0, thetaLen, { ...ss, seg: 26 });
  cap.rotation.x = -tiltBack * DEG;
  return cap;
}

function fringe(color: string, xs: number[], y: number, size = 0.13): THREE.Object3D[] {
  return xs.map((x, i) => {
    const z = Math.sqrt(Math.max(0, 0.47 * 0.47 - x * x - y * y)) - 0.05;
    const b = ball(size, color, { ...ss, p: [x, y - (i % 2) * 0.02, z], s: [1.15, 0.75, 0.6], seg: 12 });
    b.rotation.y = Math.atan2(x, z);
    return b;
  });
}

function buildHair(sp: CharSpec, hatStyle: string | undefined): THREE.Object3D[] {
  const c = sp.hair;
  const out: THREE.Object3D[] = [];
  const style = ((sp.hairStyle % 6) + 6) % 6;
  const covered = hatStyle === 'beanie' || hatStyle === 'wizard' || hatStyle === 'explorer' || hatStyle === 'cap';
  switch (style) {
    case 0: // Ngắn
      out.push(hairCap(c, 100, 31));
      out.push(...fringe(c, [-0.22, -0.08, 0.07, 0.21], 0.21));
      out.push(ball(0.09, c, { ...ss, p: [0.4, 0.02, 0.12], s: [0.6, 1.1, 0.9] }));
      out.push(ball(0.09, c, { ...ss, p: [-0.4, 0.02, 0.12], s: [0.6, 1.1, 0.9] }));
      break;
    case 1: {
      // Tóc dựng
      out.push(hairCap(c, 98, 30));
      out.push(...fringe(c, [-0.18, 0.0, 0.18], 0.22, 0.12));
      if (!covered) {
        const dirs: [number, number, number][] = [
          [0, 1, -0.15],
          [0.45, 0.85, 0.15],
          [-0.45, 0.85, 0.15],
          [0.2, 0.8, -0.6],
          [-0.2, 0.8, -0.6],
          [0.55, 0.6, -0.35],
          [-0.55, 0.6, -0.35],
          [0, 0.75, 0.55],
        ];
        for (const d of dirs) out.push(onSphere(cone(0.11, 0.26, c, { ...ss, seg: 8 }), new THREE.Vector3(...d), 0.48));
      }
      break;
    }
    case 2: // Tóc dài
      out.push(hairCap(c, 102, 30));
      out.push(...fringe(c, [-0.2, -0.06, 0.08, 0.21], 0.2));
      out.push(rbox(0.8, 0.82, 0.22, 0.1, c, { ...ss, p: [0, -0.3, -0.26], r: [8, 0, 0] }));
      out.push(capsule(0.1, 0.38, c, { ...ss, p: [0.38, -0.3, 0.1], r: [0, 0, 4] }));
      out.push(capsule(0.1, 0.38, c, { ...ss, p: [-0.38, -0.3, 0.1], r: [0, 0, -4] }));
      break;
    case 3: {
      // Hai bím
      out.push(hairCap(c, 100, 30));
      out.push(...fringe(c, [-0.2, -0.06, 0.08, 0.21], 0.21));
      for (const s of [1, -1]) {
        out.push(ball(0.15, c, { ...ss, p: [s * 0.5, -0.02, -0.1] }));
        out.push(ball(0.12, c, { ...ss, p: [s * 0.56, -0.24, -0.1] }));
        out.push(ball(0.095, c, { ...ss, p: [s * 0.58, -0.42, -0.08] }));
        out.push(ball(0.06, tint(c, 0.12), { ...ss, p: [s * 0.58, -0.55, -0.07] }));
        out.push(torus(0.075, 0.03, '#ff6b9a', { ...ss, p: [s * 0.47, 0.06, -0.1], r: [0, 90, 20 * s], ts: 12, seg: 6 }));
      }
      break;
    }
    case 4: // Tóc nấm
      out.push(hairCap(c, 96, 12, 0.48));
      out.push(torus(0.45, 0.06, c, { ...ss, p: [0, 0.03, -0.06], r: [90 - 12, 0, 0], ts: 32, seg: 8 }));
      out.push(...fringe(c, [-0.26, -0.13, 0, 0.13, 0.26], 0.16, 0.12));
      break;
    default: {
      // Tóc xoăn
      out.push(hairCap(c, 100, 30, 0.45));
      const n = covered ? 14 : 30;
      const ga = Math.PI * (3 - Math.sqrt(5));
      let placed = 0;
      for (let i = 0; i < 60 && placed < n; i++) {
        const y = 1 - (i / 59) * 1.6;
        const rr = Math.sqrt(Math.max(0, 1 - y * y));
        const a = i * ga;
        const d = new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr);
        if (d.z > 0.35 && d.y < 0.55) continue;
        if (d.y < -0.35) continue;
        if (covered && d.y > 0.3) continue;
        out.push(onSphere(ball(0.13 + (i % 3) * 0.015, i % 4 === 0 ? tint(c, 0.06) : c, { ...ss, seg: 10 }), d, 0.45));
        placed++;
      }
      out.push(...fringe(c, [-0.2, 0, 0.2], 0.24, 0.12));
      break;
    }
  }
  return out;
}

export function buildHat(w: Wear): THREE.Object3D[] {
  const c = w.color;
  const out: THREE.Object3D[] = [];
  switch (w.style) {
    case 'cap':
      out.push(sphPart(0.5, c, 0, 360, 0, 86, { ...ss, p: [0, 0.03, -0.02], r: [-12, 0, 0], seg: 24 }));
      out.push(cyl(0.3, 0.3, 0.035, tint(c, -0.06), { ...ss, p: [0, 0.18, 0.4], r: [-8, 0, 0], s: [1, 1, 0.9], seg: 20 }));
      out.push(ball(0.045, tint(c, 0.15), { ...ss, p: [0, 0.52, -0.08] }));
      break;
    case 'flower': {
      const fg = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        fg.add(ball(0.065, c, { ...ss, p: [Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0], s: [1, 1, 0.5], seg: 10 }));
      }
      fg.add(ball(0.05, '#ffd43b', { ...ss, p: [0, 0, 0.02], seg: 10 }));
      fg.position.set(0.3, 0.3, 0.27);
      fg.rotation.set(-20 * DEG, 35 * DEG, 0);
      out.push(fg);
      break;
    }
    case 'beanie':
      out.push(sphPart(0.51, c, 0, 360, 0, 82, { ...ss, p: [0, 0.03, -0.03], r: [-14, 0, 0], seg: 24 }));
      out.push(torus(0.47, 0.065, tint(c, -0.1), { ...ss, p: [0, 0.1, -0.0], r: [90 - 14, 0, 0], ts: 30, seg: 8 }));
      out.push(ball(0.11, '#ffffff', { ...ss, p: [0, 0.56, -0.1], seg: 12 }));
      break;
    case 'party':
      out.push(cone(0.2, 0.46, c, { ...ss, p: [0.06, 0.62, -0.02], r: [-6, 0, -10], seg: 16 }));
      out.push(torus(0.18, 0.03, '#ffd43b', { ...ss, p: [0.03, 0.43, -0.0], r: [84, 0, -10], ts: 18, seg: 6 }));
      out.push(ball(0.07, '#ffffff', { ...ss, p: [0.1, 0.87, -0.05], seg: 10 }));
      for (const [x, y, z] of [
        [0.07, 0.52, 0.17],
        [-0.04, 0.62, 0.12],
        [0.12, 0.68, 0.07],
      ] as [number, number, number][])
        out.push(ball(0.025, '#ffffff', { ...ss, p: [x, y, z], seg: 6, cast: false }));
      break;
    case 'bunny':
      out.push(torus(0.47, 0.025, '#ff9ec4', { ...ss, p: [0, 0.12, -0.05], r: [0, 0, 0], arc: 180, ts: 20, seg: 6 }));
      for (const s of [1, -1]) {
        const ear = new THREE.Group();
        ear.add(capsule(0.085, 0.36, c, { ...ss, p: [0, 0.26, 0], s: [1, 1, 0.5] }));
        ear.add(capsule(0.05, 0.28, '#ffb3c8', { ...ss, p: [0, 0.26, 0.025], s: [1, 1, 0.4], cast: false }));
        ear.position.set(s * 0.2, 0.4, -0.05);
        ear.rotation.z = -s * 12 * DEG;
        out.push(ear);
      }
      break;
    case 'explorer':
      out.push(sphPart(0.5, c, 0, 360, 0, 80, { ...ss, p: [0, 0.06, 0], seg: 24 }));
      out.push(cyl(0.62, 0.62, 0.035, c, { ...ss, p: [0, 0.16, 0], seg: 26 }));
      out.push(cyl(0.5, 0.5, 0.09, '#7a5230', { ...ss, p: [0, 0.22, 0], seg: 24 }));
      break;
    case 'wizard': {
      out.push(cyl(0.6, 0.6, 0.035, c, { ...ss, p: [0, 0.2, 0], seg: 26 }));
      out.push(cone(0.42, 0.95, c, { ...ss, p: [0, 0.67, -0.05], r: [-10, 0, 6], seg: 18 }));
      out.push(torus(0.4, 0.04, '#ffd166', { ...ss, p: [0, 0.26, 0], r: [90, 0, 0], ts: 26, seg: 6 }));
      out.push(extrude('star5s', () => starShape(0.045, 0.02), 0.02, '#ffd166', { p: [0.1, 0.55, 0.28], r: [-20, 15, 0], emissive: '#ffcc33', glow: 0.4, cast: false }));
      out.push(extrude('star5s', () => starShape(0.045, 0.02), 0.02, '#ffd166', { p: [-0.12, 0.75, 0.18], r: [-20, -15, 0], emissive: '#ffcc33', glow: 0.4, cast: false }));
      break;
    }
    case 'crown': {
      const gold = '#ffcf4a';
      out.push(cyl(0.34, 0.31, 0.16, gold, { p: [0, 0.48, 0], open: true, side: THREE.DoubleSide, seg: 16, shiny: 60 }));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        out.push(cone(0.06, 0.16, gold, { p: [Math.sin(a) * 0.33, 0.62, Math.cos(a) * 0.33], seg: 6, shiny: 60 }));
        out.push(ball(0.028, gold, { p: [Math.sin(a) * 0.33, 0.71, Math.cos(a) * 0.33], seg: 6, shiny: 60 }));
      }
      out.push(ball(0.05, '#ff5c7a', { p: [0, 0.49, 0.34], s: [1, 1, 0.6], seg: 10, shiny: 90 }));
      out.push(ball(0.04, '#4dabf7', { p: [0.24, 0.49, 0.24], s: [1, 1, 0.6], r: [0, 45, 0], seg: 10, shiny: 90 }));
      out.push(ball(0.04, '#4dabf7', { p: [-0.24, 0.49, 0.24], s: [1, 1, 0.6], r: [0, -45, 0], seg: 10, shiny: 90 }));
      break;
    }
    default:
      break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Balo & phụ kiện                                                      */
/* ------------------------------------------------------------------ */
export function buildBag(w: Wear): THREE.Object3D[] {
  const c = w.color;
  const out: THREE.Object3D[] = [];
  // dây đeo trước ngực
  for (const s of [1, -1]) out.push(box(0.05, 0.3, 0.03, tint(c, -0.15), { ...ss, p: [s * 0.13, 0.33, 0.235], r: [-10, 0, 0], cast: false }));
  if (w.style === 'rocket') {
    out.push(capsule(0.15, 0.3, c, { ...ss, p: [0, 0.3, -0.36] }));
    out.push(cone(0.15, 0.2, '#ff6b6b', { ...ss, p: [0, 0.62, -0.36], seg: 14 }));
    out.push(ball(0.06, '#74c0fc', { ...ss, p: [0, 0.38, -0.215], s: [1, 1, 0.4] }));
    for (const s of [1, -1]) out.push(box(0.04, 0.16, 0.12, '#ff6b6b', { ...ss, p: [s * 0.16, 0.12, -0.36] }));
    out.push(cone(0.08, 0.18, '#ffb347', { p: [0, -0.02, -0.36], r: [180, 0, 0], emissive: '#ff8c1a', glow: 0.7, cast: false }));
    return out;
  }
  out.push(rbox(0.44, 0.46, 0.22, 0.09, c, { ...ss, p: [0, 0.28, -0.33] }));
  out.push(rbox(0.32, 0.2, 0.08, 0.05, tint(c, -0.08), { ...ss, p: [0, 0.17, -0.45] }));
  out.push(torus(0.08, 0.018, tint(c, -0.2), { ...ss, p: [0, 0.52, -0.33], r: [0, 90, 0], arc: 180, ts: 10, seg: 5 }));
  if (w.style === 'star') {
    out.push(extrude('star5', () => starShape(0.11, 0.05), 0.04, '#ffffff', { ...ss, p: [0, 0.32, -0.45], r: [0, 180, 0], cast: false }));
  } else if (w.style === 'bear') {
    out.push(ball(0.09, c, { ...ss, p: [0.17, 0.52, -0.33] }));
    out.push(ball(0.09, c, { ...ss, p: [-0.17, 0.52, -0.33] }));
    out.push(ball(0.06, '#f3d9b1', { ...ss, p: [0, 0.3, -0.48], s: [1.2, 0.9, 0.6] }));
    out.push(ball(0.025, '#3d2b1f', { ...ss, p: [0, 0.33, -0.52] }));
    out.push(ball(0.022, '#3d2b1f', { ...ss, p: [0.09, 0.4, -0.45] }));
    out.push(ball(0.022, '#3d2b1f', { ...ss, p: [-0.09, 0.4, -0.45] }));
  }
  return out;
}

export function buildAcc(w: Wear, headG: THREE.Group, body: THREE.Group, rig: Rig): void {
  const c = w.color;
  switch (w.style) {
    case 'glasses':
      for (const s of [1, -1]) headG.add(torus(0.1, 0.018, c, { ...ss, p: [s * 0.16, -0.01, 0.43], r: [0, s * 14, 0], ts: 20, seg: 6, cast: false }));
      headG.add(box(0.1, 0.02, 0.02, c, { ...ss, p: [0, 0.01, 0.45], cast: false }));
      for (const s of [1, -1]) headG.add(box(0.02, 0.02, 0.32, c, { ...ss, p: [s * 0.29, 0.0, 0.27], r: [0, s * 22, 0], cast: false }));
      break;
    case 'bowtie':
      for (const s of [1, -1]) body.add(cone(0.075, 0.13, c, { ...ss, p: [s * 0.065, 0.47, 0.18], r: [0, 0, s * 90], seg: 8 }));
      body.add(ball(0.035, tint(c, -0.1), { ...ss, p: [0, 0.47, 0.19] }));
      break;
    case 'scarf':
      body.add(torus(0.17, 0.065, c, { ...ss, p: [0, 0.5, 0], r: [90, 0, 0], ts: 22, seg: 8 }));
      body.add(rbox(0.12, 0.26, 0.05, 0.025, c, { ...ss, p: [0.09, 0.36, 0.2], r: [-12, 0, 8] }));
      body.add(box(0.12, 0.03, 0.055, tint(c, 0.15), { ...ss, p: [0.08, 0.25, 0.215], r: [-12, 0, 8], cast: false }));
      break;
    case 'cape': {
      const cape = new THREE.Group();
      cape.position.set(0, 0.5, -0.12);
      const cl = cyl(0.3, 0.42, 0.62, c, { open: true, side: THREE.DoubleSide, seg: 16, p: [0, -0.31, 0] });
      // nửa sau của ống trụ làm áo choàng
      const geo = new THREE.CylinderGeometry(0.3, 0.44, 0.62, 16, 1, true, Math.PI * 0.62, Math.PI * 0.76);
      cl.geometry = geo;
      cape.add(cl);
      cape.add(torus(0.13, 0.03, '#ffd166', { ...ss, p: [0, 0.0, 0.25], r: [90, 0, 0], ts: 12, seg: 5 }));
      cape.name = 'cape';
      cape.userData.dynamic = true;
      body.add(cape);
      const prev = rig.custom;
      rig.custom = (r, s) => {
        prev?.(r, s);
        cape.rotation.x = -(Math.min(1, s.move) * 0.45 + (s.air ? 0.4 : 0)) - Math.sin(s.t * 3) * 0.04;
      };
      break;
    }
    case 'medal':
      body.add(torus(0.15, 0.015, '#4dabf7', { ...ss, p: [0, 0.4, 0.13], r: [60, 0, 0], ts: 18, seg: 4, cast: false }));
      body.add(cyl(0.07, 0.07, 0.02, '#ffcf4a', { p: [0, 0.3, 0.26], r: [90, 0, 0], seg: 16, shiny: 70 }));
      body.add(extrude('star5s', () => starShape(0.045, 0.02), 0.02, '#fff3b0', { p: [0, 0.3, 0.275], cast: false }));
      break;
    default:
      break;
  }
}

/* ------------------------------------------------------------------ */
/* Lắp ráp                                                              */
/* ------------------------------------------------------------------ */
export function buildCharacter(sp: CharSpec): THREE.Group {
  const root = new THREE.Group();
  root.name = 'character';
  const rig: Rig = { root, kind: 'biped', height: 1.8, stride: 0.75, cadence: 2.3 };

  const body = new THREE.Group();
  body.name = 'body';
  body.position.y = HIP_Y;
  body.add(buildTorso(sp));
  const armL = buildArm(sp, 1);
  const armR = buildArm(sp, -1);
  body.add(armL, armR);

  const head = new THREE.Group();
  head.name = 'head';
  head.position.y = 0.5;
  const headG = new THREE.Group();
  headG.position.y = 0.36;
  headG.add(ball(HEAD_R, sp.skin, { ...ss, s: [1.04, 0.95, 1.0], seg: 30 }));
  buildFace(sp, headG, rig);
  const hatStyle = sp.hat?.style;
  for (const h of buildHair(sp, hatStyle)) headG.add(h);
  if (sp.hat) for (const h of buildHat(sp.hat)) headG.add(h);
  head.add(headG);
  body.add(head);

  if (sp.bag) for (const b of buildBag(sp.bag)) body.add(b);
  if (sp.acc) buildAcc(sp.acc, headG, body, rig);

  const legL = buildLeg(sp, 1);
  const legR = buildLeg(sp, -1);
  root.add(legL, legR, body);

  rig.body = body;
  rig.head = head;
  rig.armL = armL;
  rig.armR = armR;
  rig.legL = legL;
  rig.legR = legR;
  root.userData.rig = rig;
  root.userData.height = 1.8;
  root.userData.dynamic = true;
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = o.castShadow && true;
      o.receiveShadow = false;
    }
  });
  if (!isRawModels()) {
    compactModel(root, rigNodes(rig));
    root.userData.compacted = true;
  }
  return root;
}

/* ------------------------------------------------------------------ */
/* Đăng ký                                                              */
/* ------------------------------------------------------------------ */
/** Tùy chọn dựng 'player': bé nào, mặc gì (bộ đồ, mũ, balo, phụ kiện). */
export interface PlayerOpts {
  kid?: Kid;
  eq?: Partial<Equipped>;
  /** Mẫu xem thử thứ i (trang xem mô hình). */
  i?: number;
}

/** Mẫu xem thử: lần lượt bé trai / bé gái với từng mũ, balo, phụ kiện. */
const DEMO_WEAR: Partial<Equipped>[] = [
  {},
  {},
  { backpack: 'bag_blue' },
  { hat: 'hat_flower' },
  { hat: 'hat_cap', acc: 'acc_glasses' },
  { hat: 'hat_bunny', backpack: 'bag_bear' },
  { backpack: 'bag_rocket', acc: 'acc_scarf' },
  { hat: 'hat_party', backpack: 'bag_star', acc: 'acc_bowtie' },
  { hat: 'hat_wizard', acc: 'acc_cape' },
  { hat: 'hat_crown', acc: 'acc_medal' },
  { hat: 'hat_explorer', backpack: 'bag_blue' },
  { hat: 'hat_beanie' },
];
export const PLAYER_DEMOS: { kid: Kid; eq: Partial<Equipped> }[] = DEMO_WEAR.map((eq, i) => ({ kid: i % 2 ? 'gai' : 'trai', eq }));

/** Bé dựng bằng code (dự phòng) – models/kid.ts thay bằng mô hình AI của bé khi đã tải xong. */
defineModel<PlayerOpts>('player', {
  build: (o) => {
    const d = PLAYER_DEMOS[(o.i ?? 0) % PLAYER_DEMOS.length];
    return buildCharacter(kidSpec(o.kid ?? d.kid, o.eq ?? d.eq));
  },
  height: 1.8,
  colliders: [{ kind: 'circle', r: 0.4 }],
  tags: ['character'],
  desc: 'Nhân vật người chơi',
  variants: PLAYER_DEMOS.map((_, i) => ({ i })),
});

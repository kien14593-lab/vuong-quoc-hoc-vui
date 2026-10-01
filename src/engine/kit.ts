import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, type MatOpts } from './materials';

/**
 * Bộ "đồ chơi lắp ghép" để dựng mô hình 3D low-poly từ khối cơ bản.
 * Hình học được lưu đệm theo tham số → nhiều đối tượng dùng chung một hình học.
 * Góc quay trong tùy chọn `r` tính bằng ĐỘ.
 */
export type V3 = [number, number, number];

export interface Placement {
  /** Vị trí. */
  p?: V3;
  /** Góc quay (độ) theo X, Y, Z. */
  r?: V3;
  /** Tỉ lệ. */
  s?: number | V3;
  name?: string;
}

export interface PartOpts extends MatOpts, Placement {
  /** Đổ bóng (mặc định có). */
  cast?: boolean;
  /** Nhận bóng (mặc định có). */
  receive?: boolean;
  /** Đặt đáy hình ở y = 0 (box, rbox, cyl, cone, capsule). */
  base?: boolean;
  /** Dùng vật liệu có sẵn thay vì tạo theo màu. */
  m?: THREE.Material;
  /** Đánh dấu phần có thể đổi màu khi nhân bản (tán lá cây...). */
  tint?: boolean;
  /** Số đoạn chia (độ mịn). */
  seg?: number;
}

export const DEG = Math.PI / 180;
const geos = new Map<string, THREE.BufferGeometry>();

function geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geos.get(key);
  if (!g) {
    g = make();
    g.userData.shared = true;
    geos.set(key, g);
  }
  return g;
}

const n3 = (n: number) => Math.round(n * 1000) / 1000;

export function apply<T extends THREE.Object3D>(obj: T, o: Placement): T {
  if (o.p) obj.position.set(o.p[0], o.p[1], o.p[2]);
  if (o.r) obj.rotation.set(o.r[0] * DEG, o.r[1] * DEG, o.r[2] * DEG);
  if (o.s !== undefined) {
    if (typeof o.s === 'number') obj.scale.setScalar(o.s);
    else obj.scale.set(o.s[0], o.s[1], o.s[2]);
  }
  if (o.name) obj.name = o.name;
  return obj;
}

function finish(g: THREE.BufferGeometry, color: THREE.ColorRepresentation, o: PartOpts): THREE.Mesh {
  const m = new THREE.Mesh(g, o.m ?? mat(color, o));
  apply(m, o);
  m.castShadow = o.cast ?? true;
  m.receiveShadow = o.receive ?? true;
  if (o.tint) m.userData.tint = true;
  return m;
}

function lift(g: THREE.BufferGeometry, h: number, base?: boolean): THREE.BufferGeometry {
  if (base) g.translate(0, h / 2, 0);
  return g;
}

/* ------------------------------------------------------------------ */
/* Khối cơ bản                                                          */
/* ------------------------------------------------------------------ */
export function box(w: number, h: number, d: number, color: THREE.ColorRepresentation, o: PartOpts = {}): THREE.Mesh {
  const g = geo(`box|${n3(w)}|${n3(h)}|${n3(d)}|${o.base ? 1 : 0}`, () => lift(new THREE.BoxGeometry(w, h, d), h, o.base));
  return finish(g, color, o);
}

/** Hộp bo tròn cạnh. */
export function rbox(w: number, h: number, d: number, radius: number, color: THREE.ColorRepresentation, o: PartOpts = {}): THREE.Mesh {
  const seg = o.seg ?? (o.flat === false ? 4 : 2);
  const r = Math.min(radius, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const g = geo(`rbox|${n3(w)}|${n3(h)}|${n3(d)}|${n3(r)}|${seg}|${o.base ? 1 : 0}`, () => lift(new RoundedBoxGeometry(w, h, d, seg, r), h, o.base));
  return finish(g, color, o);
}

/** Hình cầu (mịn hoặc low-poly tùy `flat`). */
export function ball(r: number, color: THREE.ColorRepresentation, o: PartOpts = {}): THREE.Mesh {
  const seg = o.seg ?? (o.flat === false ? 18 : 10);
  const hs = Math.max(5, Math.round(seg * 0.7));
  const g = geo(`ball|${n3(r)}|${seg}`, () => new THREE.SphereGeometry(r, seg, hs));
  return finish(g, color, o);
}

/** Một phần hình cầu (mũ tóc, mái vòm...). Góc tính bằng độ: theta từ đỉnh xuống. */
export function sphPart(r: number, color: THREE.ColorRepresentation, phiStart: number, phiLen: number, thetaStart: number, thetaLen: number, o: PartOpts = {}): THREE.Mesh {
  const seg = o.seg ?? (o.flat === false ? 20 : 10);
  const g = geo(`sph|${n3(r)}|${seg}|${phiStart}|${phiLen}|${thetaStart}|${thetaLen}`, () =>
    new THREE.SphereGeometry(r, seg, Math.max(5, Math.round(seg * 0.7)), phiStart * DEG, phiLen * DEG, thetaStart * DEG, thetaLen * DEG),
  );
  return finish(g, color, { side: THREE.DoubleSide, ...o });
}

/** Khối đa diện 20 mặt – tán cây, đá low-poly. */
export function ico(r: number, color: THREE.ColorRepresentation, o: PartOpts & { detail?: number } = {}): THREE.Mesh {
  const d = o.detail ?? 0;
  const g = geo(`ico|${n3(r)}|${d}`, () => new THREE.IcosahedronGeometry(r, d));
  return finish(g, color, o);
}

export function dodeca(r: number, color: THREE.ColorRepresentation, o: PartOpts & { detail?: number } = {}): THREE.Mesh {
  const d = o.detail ?? 0;
  const g = geo(`dod|${n3(r)}|${d}`, () => new THREE.DodecahedronGeometry(r, d));
  return finish(g, color, o);
}

export function cyl(rTop: number, rBot: number, h: number, color: THREE.ColorRepresentation, o: PartOpts & { open?: boolean } = {}): THREE.Mesh {
  const seg = o.seg ?? 12;
  const g = geo(`cyl|${n3(rTop)}|${n3(rBot)}|${n3(h)}|${seg}|${o.open ? 1 : 0}|${o.base ? 1 : 0}`, () => lift(new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, !!o.open), h, o.base));
  return finish(g, color, o);
}

export function cone(r: number, h: number, color: THREE.ColorRepresentation, o: PartOpts = {}): THREE.Mesh {
  const seg = o.seg ?? 10;
  const g = geo(`cone|${n3(r)}|${n3(h)}|${seg}|${o.base ? 1 : 0}`, () => lift(new THREE.ConeGeometry(r, h, seg), h, o.base));
  return finish(g, color, o);
}

/** Viên nang: `len` là chiều dài phần thân thẳng (không tính hai đầu tròn). */
export function capsule(r: number, len: number, color: THREE.ColorRepresentation, o: PartOpts = {}): THREE.Mesh {
  const seg = o.seg ?? 12;
  const g = geo(`cap|${n3(r)}|${n3(len)}|${seg}|${o.base ? 1 : 0}`, () => lift(new THREE.CapsuleGeometry(r, len, 4, seg), len + r * 2, o.base));
  return finish(g, color, o);
}

/** Hình xuyến; `arc` tính bằng độ (360 = vòng kín). Mặc định nằm trong mặt phẳng XY. */
export function torus(r: number, tube: number, color: THREE.ColorRepresentation, o: PartOpts & { arc?: number; ts?: number } = {}): THREE.Mesh {
  const rs = o.seg ?? 8;
  const ts = o.ts ?? 20;
  const arc = o.arc ?? 360;
  const g = geo(`tor|${n3(r)}|${n3(tube)}|${rs}|${ts}|${arc}`, () => new THREE.TorusGeometry(r, tube, rs, ts, arc * DEG));
  return finish(g, color, o);
}

/** Đĩa tròn nằm ngang (mặt hướng lên). */
export function disc(r: number, color: THREE.ColorRepresentation, o: PartOpts = {}): THREE.Mesh {
  const seg = o.seg ?? 24;
  const g = geo(`disc|${n3(r)}|${seg}`, () => new THREE.CircleGeometry(r, seg).rotateX(-Math.PI / 2));
  return finish(g, color, { cast: false, ...o });
}

/** Vành khuyên nằm ngang. */
export function ring(ri: number, ro: number, color: THREE.ColorRepresentation, o: PartOpts = {}): THREE.Mesh {
  const seg = o.seg ?? 32;
  const g = geo(`ring|${n3(ri)}|${n3(ro)}|${seg}`, () => new THREE.RingGeometry(ri, ro, seg).rotateX(-Math.PI / 2));
  return finish(g, color, { cast: false, ...o });
}

/** Mặt phẳng nằm ngang. */
export function plane(w: number, d: number, color: THREE.ColorRepresentation, o: PartOpts = {}): THREE.Mesh {
  const g = geo(`plane|${n3(w)}|${n3(d)}`, () => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2));
  return finish(g, color, { cast: false, ...o });
}

/** Mặt phẳng đứng (hướng +Z). */
export function panel(w: number, h: number, color: THREE.ColorRepresentation, o: PartOpts = {}): THREE.Mesh {
  const g = geo(`panel|${n3(w)}|${n3(h)}`, () => new THREE.PlaneGeometry(w, h));
  return finish(g, color, { cast: false, ...o });
}

/**
 * Lăng trụ tam giác (mái nhà): đáy rộng `d` theo trục Z, cao `h`, dài `w` theo trục X.
 * Đáy nằm ở y = 0.
 */
export function prism(w: number, h: number, d: number, color: THREE.ColorRepresentation, o: PartOpts = {}): THREE.Mesh {
  const g = geo(`prism|${n3(w)}|${n3(h)}|${n3(d)}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-d / 2, 0);
    s.lineTo(d / 2, 0);
    s.lineTo(0, h);
    s.closePath();
    const eg = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
    eg.translate(0, 0, -w / 2);
    eg.rotateY(Math.PI / 2);
    return eg;
  });
  return finish(g, color, o);
}

/** Khối tròn xoay từ danh sách điểm [bán kính, độ cao]. */
export function lathe(pts: [number, number][], color: THREE.ColorRepresentation, o: PartOpts = {}): THREE.Mesh {
  const seg = o.seg ?? 16;
  const g = geo(`lathe|${seg}|${pts.map((p) => p.map(n3).join(',')).join(';')}`, () =>
    new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg),
  );
  return finish(g, color, o);
}

/** Ống cong đi qua các điểm (đuôi, vòi voi, đường ray...). */
export function tube(pts: V3[], radius: number, color: THREE.ColorRepresentation, o: PartOpts & { radial?: number; closed?: boolean } = {}): THREE.Mesh {
  const seg = o.seg ?? Math.max(8, pts.length * 6);
  const radial = o.radial ?? 8;
  const g = geo(`tube|${seg}|${radial}|${n3(radius)}|${o.closed ? 1 : 0}|${pts.map((p) => p.map(n3).join(',')).join(';')}`, () =>
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), !!o.closed), seg, radius, radial, !!o.closed),
  );
  return finish(g, color, o);
}

/** Đùn một hình 2D thành khối dày `depth` (căn giữa theo Z). Cần `key` duy nhất để lưu đệm. */
export function extrude(key: string, shape: () => THREE.Shape, depth: number, color: THREE.ColorRepresentation, o: PartOpts & { bevel?: number } = {}): THREE.Mesh {
  const bevel = o.bevel ?? 0;
  const g = geo(`ext|${key}|${n3(depth)}|${n3(bevel)}`, () => {
    const eg = new THREE.ExtrudeGeometry(shape(), {
      depth,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: 10,
    });
    eg.translate(0, 0, -depth / 2);
    return eg;
  });
  return finish(g, color, o);
}

export function starShape(ro: number, ri: number, n = 5): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 === 0 ? ro : ri;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

export function heartShape(size: number): THREE.Shape {
  const s = new THREE.Shape();
  const k = size / 2;
  s.moveTo(0, -k * 0.9);
  s.bezierCurveTo(-k * 0.2, -k * 0.55, -k * 1.05, -k * 0.25, -k * 1.0, k * 0.3);
  s.bezierCurveTo(-k * 0.95, k * 0.85, -k * 0.25, k * 1.0, 0, k * 0.5);
  s.bezierCurveTo(k * 0.25, k * 1.0, k * 0.95, k * 0.85, k * 1.0, k * 0.3);
  s.bezierCurveTo(k * 1.05, -k * 0.25, k * 0.2, -k * 0.55, 0, -k * 0.9);
  return s;
}

export function roundRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Nhóm các phần lại; bỏ qua phần tử rỗng. */
export function group(kids: (THREE.Object3D | null | false | undefined)[], o: Placement = {}): THREE.Group {
  const g = new THREE.Group();
  for (const k of kids) if (k) g.add(k);
  return apply(g, o);
}

/** Tạo nhóm "khớp xoay" đặt tại `p`, chứa các phần con (dùng cho tay, chân, nắp rương...). */
export function pivot(p: V3, kids: (THREE.Object3D | null | false | undefined)[], name?: string): THREE.Group {
  return group(kids, { p, name });
}

/** Lặp n lần quanh trục Y (đặt các phần xung quanh tâm). */
export function around(n: number, radius: number, make: (i: number, angle: number) => THREE.Object3D, startDeg = 0): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = startDeg * DEG + (i / n) * Math.PI * 2;
    const o = make(i, a);
    o.position.x += Math.sin(a) * radius;
    o.position.z += Math.cos(a) * radius;
    g.add(o);
  }
  return g;
}

/** Bộ sinh số ngẫu nhiên có hạt giống (để mô hình luôn giống nhau mỗi lần dựng). */
export function seeded(seed: number): () => number {
  let s = (Math.floor(seed) * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/** Đặt toàn bộ lưới trong nhóm: đổ bóng / nhận bóng. */
export function shadows(obj: THREE.Object3D, cast: boolean, receive: boolean): void {
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
}

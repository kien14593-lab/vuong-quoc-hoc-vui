import * as THREE from 'three';
import { engine } from '../engine/core';

/**
 * Mặt đất của một khu vực: vẽ cỏ, đường đi, quảng trường, bờ nước... lên một canvas 2D
 * rồi dán lên một mặt phẳng duy nhất (1 lệnh vẽ, viền mềm). Nước là lưới riêng có shader dòng chảy.
 */
export interface Pt {
  x: number;
  z: number;
}

export type P2 = [number, number];

interface Seg {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  hw: number;
}

export interface PathStyle {
  color?: string;
  edge?: string;
  /** Không làm mượt đường (giữ góc). */
  sharp?: boolean;
  /** Họa tiết: sỏi (mặc định), ván gỗ, đá lát. */
  kind?: 'dirt' | 'stone' | 'plank';
}

export const TERRAIN_COLORS = {
  grass: '#9ed36a',
  path: '#f3e2bd',
  pathEdge: '#d9c193',
  plaza: '#f6ead0',
  plazaLine: '#e3d2ad',
  sand: '#f0dfae',
  water: '#7fd3f0',
  deep: '#4fb6e3',
};

export const waterUniforms = { uTime: { value: 0 } };

function segDist2(px: number, pz: number, s: Seg): number {
  const dx = s.bx - s.ax;
  const dz = s.bz - s.az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - s.ax) * dx + (pz - s.az) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const x = s.ax + dx * t - px;
  const z = s.az + dz * t - pz;
  return x * x + z * z;
}

/** Làm mượt một đường gấp khúc bằng Catmull-Rom, bước ~step mét. */
export function smoothLine(pts: P2[], step = 1, closed = false): P2[] {
  if (pts.length < 3) {
    if (pts.length === 2) {
      const [a, b] = pts;
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
      return Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n] as P2);
    }
    return pts;
  }
  const curve = new THREE.CatmullRomCurve3(
    pts.map((p) => new THREE.Vector3(p[0], 0, p[1])),
    closed,
    'centripetal',
  );
  const n = Math.max(2, Math.ceil(curve.getLength() / step));
  return curve.getSpacedPoints(n).map((v) => [v.x, v.z] as P2);
}

export interface Area {
  /** Nửa chiều rộng / sâu của vùng chơi (hình chữ nhật bo góc, tâm tại gốc). */
  hw: number;
  hd: number;
  r: number;
}

export function inArea(a: Area, x: number, z: number, inset = 0): boolean {
  const hw = a.hw - inset;
  const hd = a.hd - inset;
  const r = Math.max(0, a.r - inset);
  const ax = Math.abs(x);
  const az = Math.abs(z);
  if (ax > hw || az > hd) return false;
  if (ax <= hw - r || az <= hd - r) return true;
  const dx = ax - (hw - r);
  const dz = az - (hd - r);
  return dx * dx + dz * dz <= r * r;
}

export class Terrain {
  readonly minX: number;
  readonly minZ: number;
  readonly W: number;
  readonly D: number;
  readonly ppm: number;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly paths: Seg[] = [];
  readonly plazas: { x: number; z: number; r: number }[] = [];
  readonly rivers: { pts: P2[]; w: number }[] = [];
  readonly ponds: { x: number; z: number; rx: number; rz: number }[] = [];
  readonly reserved: { x: number; z: number; r: number }[] = [];
  /** Các đoạn đường để vẽ bản đồ nhỏ. */
  readonly pathLines: { pts: P2[]; w: number; color: string }[] = [];
  private rnd: () => number;

  constructor(
    readonly area: Area,
    readonly margin: number,
    readonly base: string,
    seed = 1,
  ) {
    this.minX = -area.hw - margin;
    this.minZ = -area.hd - margin;
    this.W = (area.hw + margin) * 2;
    this.D = (area.hd + margin) * 2;
    const low = engine.quality === 'low';
    const maxTex = low ? 2048 : 4096;
    this.ppm = Math.min(low ? 12 : 22, maxTex / Math.max(this.W, this.D));
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(this.W * this.ppm);
    this.canvas.height = Math.round(this.D * this.ppm);
    this.ctx = this.canvas.getContext('2d')!;
    let s = seed * 9301 + 49297;
    this.rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    this.fillBase();
  }

  /** Tọa độ thế giới → điểm ảnh. */
  px(x: number): number {
    return (x - this.minX) * this.ppm;
  }
  pz(z: number): number {
    return (z - this.minZ) * this.ppm;
  }

  private fillBase(): void {
    const c = this.ctx;
    const base = new THREE.Color(this.base);
    c.fillStyle = this.base;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // Mảng màu lớn (sáng/tối nhẹ)
    const blobs = Math.round((this.W * this.D) / 30);
    for (let i = 0; i < blobs; i++) {
      const x = this.rnd() * this.canvas.width;
      const y = this.rnd() * this.canvas.height;
      const r = (2.5 + this.rnd() * 6) * this.ppm;
      const col = base.clone().offsetHSL((this.rnd() - 0.5) * 0.03, (this.rnd() - 0.5) * 0.08, (this.rnd() - 0.5) * 0.07);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `#${col.getHexString()}88`);
      g.addColorStop(1, `#${col.getHexString()}00`);
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
    // Ngọn cỏ nhỏ
    const dark = base.clone().offsetHSL(0, 0.02, -0.08).getStyle();
    const light = base.clone().offsetHSL(0, 0.02, 0.07).getStyle();
    const tufts = Math.round(this.W * this.D * 0.9);
    c.lineCap = 'round';
    c.lineWidth = Math.max(1, this.ppm * 0.05);
    for (let i = 0; i < tufts; i++) {
      const x = this.rnd() * this.canvas.width;
      const y = this.rnd() * this.canvas.height;
      const s = this.ppm * (0.12 + this.rnd() * 0.12);
      c.strokeStyle = this.rnd() < 0.6 ? dark : light;
      c.beginPath();
      c.moveTo(x - s * 0.5, y);
      c.lineTo(x - s * 0.7, y - s);
      c.moveTo(x, y);
      c.lineTo(x, y - s * 1.2);
      c.moveTo(x + s * 0.5, y);
      c.lineTo(x + s * 0.7, y - s);
      c.stroke();
    }
  }

  /** Rải chấm hoa nhỏ trên nền cỏ trong một vùng tròn. */
  meadow(x: number, z: number, r: number, colors = ['#ffffff', '#fff3a6', '#ffc2dc'], density = 3): void {
    const c = this.ctx;
    const n = Math.round(Math.PI * r * r * density);
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * Math.PI * 2;
      const d = Math.sqrt(this.rnd()) * r;
      const px = this.px(x + Math.cos(a) * d);
      const pz = this.pz(z + Math.sin(a) * d);
      c.fillStyle = colors[Math.floor(this.rnd() * colors.length)];
      const s = this.ppm * (0.06 + this.rnd() * 0.05);
      c.beginPath();
      c.arc(px, pz, s, 0, Math.PI * 2);
      c.fill();
    }
  }

  /** Vùng màu mềm (đất, cát, cỏ đậm...). */
  patch(x: number, z: number, r: number, color: string, soft = 0.5): void {
    const c = this.ctx;
    const g = c.createRadialGradient(this.px(x), this.pz(z), r * this.ppm * (1 - soft), this.px(x), this.pz(z), r * this.ppm);
    g.addColorStop(0, color);
    g.addColorStop(1, color + '00');
    c.fillStyle = g;
    c.beginPath();
    c.arc(this.px(x), this.pz(z), r * this.ppm, 0, Math.PI * 2);
    c.fill();
  }

  private strokeLine(pts: P2[], w: number, color: string): void {
    const c = this.ctx;
    c.strokeStyle = color;
    c.lineWidth = w * this.ppm;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(this.px(p[0]), this.pz(p[1])) : c.moveTo(this.px(p[0]), this.pz(p[1]))));
    c.stroke();
  }

  /** Đường đi (mặc định màu kem, viền mềm). */
  path(ctrl: P2[], w = 2.4, st: PathStyle = {}): P2[] {
    const pts = st.sharp ? ctrl : smoothLine(ctrl, 0.8);
    const color = st.color ?? TERRAIN_COLORS.path;
    const edge = st.edge ?? TERRAIN_COLORS.pathEdge;
    this.ctx.globalAlpha = 0.55;
    this.strokeLine(pts, w + 0.55, edge);
    this.ctx.globalAlpha = 1;
    this.strokeLine(pts, w + 0.12, edge);
    this.strokeLine(pts, w - 0.1, color);
    // Họa tiết
    const c = this.ctx;
    const kind = st.kind ?? 'dirt';
    const tone = new THREE.Color(color);
    if (kind === 'dirt') {
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1];
        const [bx, bz] = pts[i];
        const len = Math.hypot(bx - ax, bz - az);
        const n = Math.round(len * w * 1.4);
        for (let k = 0; k < n; k++) {
          const t = this.rnd();
          const off = (this.rnd() - 0.5) * (w - 0.5);
          const nx = -(bz - az) / (len || 1);
          const nz = (bx - ax) / (len || 1);
          const x = ax + (bx - ax) * t + nx * off;
          const z = az + (bz - az) * t + nz * off;
          c.fillStyle = tone
            .clone()
            .offsetHSL(0, 0, (this.rnd() - 0.6) * 0.12)
            .getStyle();
          c.beginPath();
          c.ellipse(this.px(x), this.pz(z), this.ppm * (0.05 + this.rnd() * 0.09), this.ppm * (0.04 + this.rnd() * 0.06), this.rnd() * 3, 0, Math.PI * 2);
          c.fill();
        }
      }
    } else if (kind === 'stone') {
      c.strokeStyle = tone.clone().offsetHSL(0, 0, -0.1).getStyle();
      c.lineWidth = Math.max(1, this.ppm * 0.05);
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1];
        const [bx, bz] = pts[i];
        const len = Math.hypot(bx - ax, bz - az) || 1;
        const nx = -(bz - az) / len;
        const nz = (bx - ax) / len;
        const steps = Math.max(1, Math.round(len / 0.7));
        for (let k = 0; k < steps; k++) {
          const t = k / steps;
          const x = ax + (bx - ax) * t;
          const z = az + (bz - az) * t;
          c.beginPath();
          c.moveTo(this.px(x + nx * (w / 2 - 0.2)), this.pz(z + nz * (w / 2 - 0.2)));
          c.lineTo(this.px(x - nx * (w / 2 - 0.2)), this.pz(z - nz * (w / 2 - 0.2)));
          c.stroke();
        }
      }
    }
    for (let i = 1; i < pts.length; i++) this.paths.push({ ax: pts[i - 1][0], az: pts[i - 1][1], bx: pts[i][0], bz: pts[i][1], hw: w / 2 });
    this.pathLines.push({ pts, w, color });
    return pts;
  }

  /** Quảng trường tròn lát đá. */
  plaza(x: number, z: number, r: number, color = TERRAIN_COLORS.plaza, line = TERRAIN_COLORS.plazaLine): void {
    const c = this.ctx;
    const cx = this.px(x);
    const cz = this.pz(z);
    c.globalAlpha = 0.5;
    c.fillStyle = TERRAIN_COLORS.pathEdge;
    c.beginPath();
    c.arc(cx, cz, (r + 0.3) * this.ppm, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
    c.beginPath();
    c.arc(cx, cz, (r + 0.06) * this.ppm, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = color;
    c.beginPath();
    c.arc(cx, cz, (r - 0.1) * this.ppm, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = line;
    c.lineWidth = Math.max(1, this.ppm * 0.06);
    for (let rr = 1.2; rr < r - 0.3; rr += 1.3) {
      c.beginPath();
      c.arc(cx, cz, rr * this.ppm, 0, Math.PI * 2);
      c.stroke();
      const n = Math.max(6, Math.round((rr * Math.PI * 2) / 1.3));
      const off = this.rnd() * Math.PI;
      for (let k = 0; k < n; k++) {
        const a = off + (k / n) * Math.PI * 2;
        c.beginPath();
        c.moveTo(cx + Math.cos(a) * rr * this.ppm, cz + Math.sin(a) * rr * this.ppm);
        c.lineTo(cx + Math.cos(a) * Math.min(r - 0.1, rr + 1.3) * this.ppm, cz + Math.sin(a) * Math.min(r - 0.1, rr + 1.3) * this.ppm);
        c.stroke();
      }
    }
    this.plazas.push({ x, z, r });
  }

  /** Nền chữ nhật (sân, sàn gỗ...), xoay theo rot (radian). */
  rect(x: number, z: number, w: number, d: number, color: string, o: { rot?: number; edge?: string; radius?: number; tiles?: number; line?: string } = {}): void {
    const c = this.ctx;
    c.save();
    c.translate(this.px(x), this.pz(z));
    c.rotate(-(o.rot ?? 0));
    const rr = (o.radius ?? 0.4) * this.ppm;
    const draw = (ww: number, dd: number) => {
      c.beginPath();
      c.roundRect((-ww / 2) * this.ppm, (-dd / 2) * this.ppm, ww * this.ppm, dd * this.ppm, rr);
      c.fill();
    };
    if (o.edge !== undefined || true) {
      c.globalAlpha = 0.5;
      c.fillStyle = o.edge ?? TERRAIN_COLORS.pathEdge;
      draw(w + 0.5, d + 0.5);
      c.globalAlpha = 1;
      draw(w + 0.12, d + 0.12);
    }
    c.fillStyle = color;
    draw(w - 0.08, d - 0.08);
    if (o.tiles) {
      c.strokeStyle = o.line ?? new THREE.Color(color).offsetHSL(0, 0, -0.08).getStyle();
      c.lineWidth = Math.max(1, this.ppm * 0.05);
      for (let gx = -w / 2 + o.tiles; gx < w / 2 - 0.05; gx += o.tiles) {
        c.beginPath();
        c.moveTo(gx * this.ppm, (-d / 2 + 0.1) * this.ppm);
        c.lineTo(gx * this.ppm, (d / 2 - 0.1) * this.ppm);
        c.stroke();
      }
      for (let gz = -d / 2 + o.tiles; gz < d / 2 - 0.05; gz += o.tiles) {
        c.beginPath();
        c.moveTo((-w / 2 + 0.1) * this.ppm, gz * this.ppm);
        c.lineTo((w / 2 - 0.1) * this.ppm, gz * this.ppm);
        c.stroke();
      }
    }
    c.restore();
    this.plazas.push({ x, z, r: Math.min(w, d) / 2 });
  }

  /** Sông: vẽ bờ cát lên nền, lưới nước dựng riêng trong buildWater(). */
  river(ctrl: P2[], w: number): P2[] {
    const pts = smoothLine(ctrl, 1);
    this.ctx.globalAlpha = 0.6;
    this.strokeLine(pts, w + 2.2, TERRAIN_COLORS.sand);
    this.ctx.globalAlpha = 1;
    this.strokeLine(pts, w + 1.1, TERRAIN_COLORS.sand);
    this.strokeLine(pts, w - 0.2, TERRAIN_COLORS.deep);
    this.rivers.push({ pts, w });
    return pts;
  }

  pond(x: number, z: number, rx: number, rz = rx): void {
    const c = this.ctx;
    c.fillStyle = TERRAIN_COLORS.sand;
    c.globalAlpha = 0.6;
    c.beginPath();
    c.ellipse(this.px(x), this.pz(z), (rx + 1.1) * this.ppm, (rz + 1.1) * this.ppm, 0, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
    c.beginPath();
    c.ellipse(this.px(x), this.pz(z), (rx + 0.55) * this.ppm, (rz + 0.55) * this.ppm, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = TERRAIN_COLORS.deep;
    c.beginPath();
    c.ellipse(this.px(x), this.pz(z), (rx - 0.1) * this.ppm, (rz - 0.1) * this.ppm, 0, 0, Math.PI * 2);
    c.fill();
    this.ponds.push({ x, z, rx, rz });
  }

  /** Giữ chỗ (không rải cây/đá vào). */
  reserve(x: number, z: number, r: number): void {
    this.reserved.push({ x, z, r });
  }

  /* ---------------- Truy vấn ---------------- */
  /** Khoảng cách tới mép nước (âm = đang trong nước). */
  waterDist(x: number, z: number): number {
    let best = Infinity;
    for (const r of this.rivers) {
      for (let i = 1; i < r.pts.length; i++) {
        const d = Math.sqrt(segDist2(x, z, { ax: r.pts[i - 1][0], az: r.pts[i - 1][1], bx: r.pts[i][0], bz: r.pts[i][1], hw: 0 })) - r.w / 2;
        if (d < best) best = d;
      }
    }
    for (const p of this.ponds) {
      const nx = (x - p.x) / p.rx;
      const nz = (z - p.z) / p.rz;
      const k = Math.sqrt(nx * nx + nz * nz);
      const d = (k - 1) * Math.min(p.rx, p.rz);
      if (d < best) best = d;
    }
    return best;
  }

  onPath(x: number, z: number, margin = 0): boolean {
    for (const s of this.paths) if (segDist2(x, z, s) < (s.hw + margin) ** 2) return true;
    for (const p of this.plazas) if ((x - p.x) ** 2 + (z - p.z) ** 2 < (p.r + margin) ** 2) return true;
    return false;
  }

  isReserved(x: number, z: number, margin = 0): boolean {
    for (const r of this.reserved) if ((x - r.x) ** 2 + (z - r.z) ** 2 < (r.r + margin) ** 2) return true;
    return false;
  }

  /* ---------------- Dựng lưới ---------------- */
  buildGround(): THREE.Object3D {
    const g = new THREE.Group();
    const tex = new THREE.CanvasTexture(this.canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, engine.renderer.capabilities.getMaxAnisotropy());
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    const geo = new THREE.PlaneGeometry(this.W, this.D).rotateX(-Math.PI / 2);
    geo.translate(this.minX + this.W / 2, 0, this.minZ + this.D / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex }));
    m.receiveShadow = true;
    m.name = 'ground';
    m.userData.noBake = true;
    g.add(m);
    // Mặt đất xa (tránh mép trống khi thu nhỏ)
    const far = new THREE.Mesh(
      new THREE.RingGeometry(Math.hypot(this.W, this.D) * 0.45, 400, 48, 1).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(this.base).offsetHSL(0, -0.05, -0.12) }),
    );
    far.position.set(this.minX + this.W / 2, -0.02, this.minZ + this.D / 2);
    far.userData.noBake = true;
    g.add(far);
    // Lấp góc giữa hình chữ nhật và vòng xa
    const under = new THREE.Mesh(
      new THREE.PlaneGeometry(this.W * 1.6, this.D * 1.6).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(this.base).offsetHSL(0, -0.05, -0.12) }),
    );
    under.position.set(this.minX + this.W / 2, -0.04, this.minZ + this.D / 2);
    under.userData.noBake = true;
    g.add(under);
    return g;
  }

  buildWater(): THREE.Object3D | null {
    if (!this.rivers.length && !this.ponds.length) return null;
    const g = new THREE.Group();
    g.name = 'water';
    const matRiver = waterMaterial(true);
    const matPond = waterMaterial(false);
    for (const r of this.rivers) {
      const pts = r.pts;
      const pos: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      let along = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const a = pts[Math.max(0, i - 1)];
        const b = pts[Math.min(pts.length - 1, i + 1)];
        let tx = b[0] - a[0];
        let tz = b[1] - a[1];
        const tl = Math.hypot(tx, tz) || 1;
        tx /= tl;
        tz /= tl;
        if (i > 0) along += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
        const nx = -tz;
        const nz = tx;
        const hw = r.w / 2 + 0.25;
        pos.push(p[0] + nx * hw, 0.04, p[1] + nz * hw, p[0] - nx * hw, 0.04, p[1] - nz * hw);
        uv.push(0, along, 1, along);
        if (i > 0) {
          const k = i * 2;
          idx.push(k - 2, k, k - 1, k - 1, k, k + 1);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      // Đảm bảo pháp tuyến hướng lên
      const n = geo.getAttribute('normal') as THREE.BufferAttribute;
      for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
      const m = new THREE.Mesh(geo, matRiver);
      m.receiveShadow = true;
      g.add(m);
    }
    for (const p of this.ponds) {
      const geo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
      // uv.x = khoảng cách tới tâm (0..1), uv.y = góc
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        uv.setXY(i, Math.hypot(x, z), Math.atan2(z, x));
      }
      const m = new THREE.Mesh(geo, matPond);
      m.scale.set(p.rx + 0.3, 1, p.rz + 0.3);
      m.position.set(p.x, 0.04, p.z);
      m.receiveShadow = true;
      g.add(m);
    }
    return g;
  }
}

/** Vật liệu nước: màu theo độ sâu, bọt ở mép, vệt sóng trôi theo dòng. */
function waterMaterial(flow: boolean): THREE.Material {
  const m = new THREE.MeshLambertMaterial({ color: TERRAIN_COLORS.water, emissive: new THREE.Color('#1d6f8f'), emissiveIntensity: 0.18 });
  m.defines = { USE_UV: '' };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = waterUniforms.uTime;
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
float wHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec3 deep = vec3(0.16, 0.52, 0.80);
  vec3 shallow = vec3(0.50, 0.84, 0.95);
  ${
    flow
      ? `float e = abs(vUv.x - 0.5) * 2.0;
  float foam = smoothstep(0.80, 0.97, e);
  vec3 col = mix(deep, shallow, smoothstep(0.15, 0.9, e));
  float lane = floor(vUv.x * 5.0);
  float speed = 0.55 + wHash(vec2(lane, 3.0)) * 0.4;
  float ph = vUv.y * 0.18 - uTime * speed * 0.35 + wHash(vec2(lane, 7.0)) * 10.0;
  float dash = smoothstep(0.82, 0.86, fract(ph)) * (1.0 - smoothstep(0.94, 0.98, fract(ph)));
  float lx = fract(vUv.x * 5.0);
  dash *= smoothstep(0.25, 0.4, lx) * (1.0 - smoothstep(0.6, 0.75, lx));
  col = mix(col, vec3(0.93, 0.98, 1.0), dash * 0.75 * (1.0 - foam));
  col = mix(col, vec3(1.0), foam * 0.85);`
      : `float e = vUv.x;
  float foam = smoothstep(0.86, 0.98, e);
  vec3 col = mix(deep, shallow, smoothstep(0.1, 0.95, e));
  float ring = fract(e * 3.0 - uTime * 0.12);
  float rip = smoothstep(0.0, 0.04, ring) * (1.0 - smoothstep(0.06, 0.12, ring)) * smoothstep(0.2, 0.5, e) * (1.0 - foam);
  float wob = sin(vUv.y * 9.0 + uTime * 0.6) * 0.5 + 0.5;
  col = mix(col, vec3(0.93, 0.98, 1.0), rip * 0.45 * wob);
  col = mix(col, vec3(1.0), foam * 0.85);`
  }
  diffuseColor.rgb = col;
}`,
      );
  };
  m.customProgramCacheKey = () => (flow ? 'water-flow' : 'water-pond');
  return m;
}

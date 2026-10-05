import * as THREE from 'three';
import { FONT_SAMPLE } from '../styles/fonts';
import { mat } from './materials';

/**
 * Chữ và số dạng 3D: vẽ lên canvas rồi dán làm texture (bảng số trên cửa, biển tên...).
 */
let fontsReady: Promise<void> | null = null;

/** Nạp sẵn phông (cả bộ chữ có dấu) trước khi vẽ chữ lên canvas. */
export function loadFonts(): Promise<void> {
  if (!fontsReady) {
    fontsReady = Promise.all([
      document.fonts.load('800 64px "Baloo 2"', FONT_SAMPLE),
      document.fonts.load('700 32px "Nunito"', FONT_SAMPLE),
      document.fonts.load('800 32px "Nunito"', FONT_SAMPLE),
      document.fonts.load('900 32px "Nunito"', FONT_SAMPLE),
    ])
      .then(() => undefined)
      .catch(() => undefined);
  }
  return fontsReady;
}

export interface TextTexOpts {
  font?: string;
  weight?: number;
  size?: number;
  color?: string;
  bg?: string;
  stroke?: string;
  strokeW?: number;
  pad?: number;
  radius?: number;
  border?: string;
  borderW?: number;
  w?: number;
  h?: number;
}

const texCache = new Map<string, THREE.CanvasTexture>();

/** Tạo texture chứa chữ (có thể kèm nền bo góc). */
export function textTexture(text: string, o: TextTexOpts = {}): THREE.CanvasTexture {
  const key = text + '|' + JSON.stringify(o);
  const hit = texCache.get(key);
  if (hit) return hit;
  const size = o.size ?? 96;
  const weight = o.weight ?? 800;
  const family = o.font ?? '"Baloo 2", "Nunito", system-ui, sans-serif';
  const fontStr = `${weight} ${size}px ${family}`;
  const pad = o.pad ?? Math.round(size * 0.3);
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  ctx.font = fontStr;
  const lines = text.split('\n');
  const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const lh = size * 1.12;
  const W = o.w ?? Math.ceil(tw + pad * 2);
  const H = o.h ?? Math.ceil(lh * lines.length + pad * 1.4);
  c.width = Math.max(4, W);
  c.height = Math.max(4, H);
  ctx.font = fontStr;
  if (o.bg) {
    const r = o.radius ?? Math.min(c.height / 2, size * 0.45);
    ctx.fillStyle = o.bg;
    roundRect(ctx, 0, 0, c.width, c.height, r);
    ctx.fill();
    if (o.border) {
      const bw = o.borderW ?? Math.max(4, size * 0.08);
      ctx.lineWidth = bw;
      ctx.strokeStyle = o.border;
      roundRect(ctx, bw / 2, bw / 2, c.width - bw, c.height - bw, Math.max(0, r - bw / 2));
      ctx.stroke();
    }
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const y0 = c.height / 2 - ((lines.length - 1) * lh) / 2 + size * 0.06;
  lines.forEach((l, i) => {
    const y = y0 + i * lh;
    if (o.stroke) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = o.strokeW ?? size * 0.16;
      ctx.strokeStyle = o.stroke;
      ctx.strokeText(l, c.width / 2, y);
    }
    ctx.fillStyle = o.color ?? '#3d3550';
    ctx.fillText(l, c.width / 2, y);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.userData.shared = true;
  texCache.set(key, tex);
  return tex;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Tấm biển phẳng có chữ (đứng, hướng +Z), chiều cao `h` đơn vị thế giới; chiều rộng theo tỉ lệ chữ.
 * Dùng vật liệu không chịu sáng để chữ luôn rõ.
 */
export function textPlate(text: string, h: number, o: TextTexOpts & { lit?: boolean; doubleSided?: boolean } = {}): THREE.Mesh {
  const tex = textTexture(text, o);
  const aspect = tex.image.width / tex.image.height;
  const g = new THREE.PlaneGeometry(h * aspect, h);
  const m = o.lit
    ? new THREE.MeshLambertMaterial({ map: tex, transparent: true, side: o.doubleSided ? THREE.DoubleSide : THREE.FrontSide })
    : new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: o.doubleSided ? THREE.DoubleSide : THREE.FrontSide, toneMapped: false });
  const mesh = new THREE.Mesh(g, m);
  mesh.userData.textPlate = true;
  return mesh;
}

/** Chia chuỗi thành 2 dòng tại dấu cách gần giữa nhất ("ice cream" → "ice\ncream"); không có dấu cách thì giữ nguyên. */
export function wrap2(s: string): string {
  if (s.includes('\n')) return s;
  const mid = (s.length - 1) / 2;
  let best = -1;
  for (let i = 0; i < s.length; i++) if (s[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return best < 0 ? s : `${s.slice(0, best)}\n${s.slice(best + 1)}`;
}

type PlateOpts = TextTexOpts & { lit?: boolean; doubleSided?: boolean };

/** Cỡ chữ hiện ra (đơn vị thế giới) và bề rộng của một tấm chữ. */
function plateMetrics(mesh: THREE.Mesh, size: number): { w: number; glyph: number } {
  const geo = mesh.geometry as THREE.PlaneGeometry;
  const tex = (mesh.material as THREE.MeshBasicMaterial).map;
  const H = (tex?.image as { height?: number } | undefined)?.height ?? 1;
  return { w: geo.parameters.width, glyph: (size * geo.parameters.height) / H };
}

function dropMesh(mesh: THREE.Mesh): void {
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();
}

/**
 * Tấm chữ cao `h`, rộng tối đa `maxW` (đơn vị thế giới) – cho nhãn chữ trên vật thể (từ tiếng Anh, cụm từ).
 * Chữ dài thì xuống 2 dòng hoặc thu nhỏ (chọn cách cho chữ to hơn). Chữ vừa khung hiện đúng như `textPlate`.
 */
export function fitPlate(text: string, maxW: number, h: number, o: PlateOpts = {}): THREE.Mesh {
  const size = o.size ?? 96;
  const one = textPlate(text, h, o);
  const a = plateMetrics(one, size);
  if (a.w <= maxW) return one;
  let best = one;
  let scale = maxW / a.w;
  const wrapped = wrap2(text);
  if (wrapped !== text) {
    const two = textPlate(wrapped, h, o);
    const b = plateMetrics(two, size);
    const s2 = Math.min(1, maxW / b.w);
    if (b.glyph * s2 > a.glyph * scale) {
      dropMesh(one);
      best = two;
      scale = s2;
    } else dropMesh(two);
  }
  if (scale < 1) best.scale.setScalar(scale);
  return best;
}

/** Bảng số tròn (cho cửa mê cung, quả bóng, hòn đá số...). */
export function numberBadge(value: string | number, diameter: number, o: { bg?: string; color?: string; border?: string } = {}): THREE.Mesh {
  const s = String(value);
  const tex = textTexture(s, {
    size: fitSize(s, 120, 150),
    w: 192,
    h: 192,
    bg: o.bg ?? '#ffffff',
    radius: 96,
    color: o.color ?? '#3d3550',
    border: o.border ?? '#ffd166',
    borderW: 14,
  });
  const g = new THREE.CircleGeometry(diameter / 2, 28);
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
  return new THREE.Mesh(g, m);
}

let measureCtx: CanvasRenderingContext2D | null = null;

/** Cỡ chữ lớn nhất (≤ size) để chuỗi vừa trong bề rộng `maxW` px – số dài như "0,25" hay "3/4" vẫn nằm gọn trong bảng tròn. */
function fitSize(text: string, size: number, maxW: number): number {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return size;
  measureCtx.font = `800 ${size}px "Baloo 2", "Nunito", system-ui, sans-serif`;
  const w = measureCtx.measureText(text).width;
  return w <= maxW ? size : Math.max(36, Math.floor((size * maxW) / w));
}

/** Tạo nhãn số dán lên mặt vật thể (chữ trong suốt, không nền) – tiện cho đá/bóng có màu sẵn. */
export function decal(text: string, h: number, color = '#ffffff', stroke = 'rgba(0,0,0,0.25)'): THREE.Mesh {
  return textPlate(text, h, { color, stroke, strokeW: 14, size: 110, pad: 18 });
}

export function plainMat(color: string): THREE.Material {
  return mat(color, { unlit: true });
}

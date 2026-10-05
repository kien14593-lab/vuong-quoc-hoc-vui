import { h } from './dom';

/**
 * Lớp giao diện HTML phủ toàn cửa sổ (trên canvas 3D).
 * Hệ tọa độ "logic" thiết kế cho 1920×1080 rồi co giãn theo cửa sổ:
 *   s0 = min(W/1920, H/1080)  (máy tính, iPad nằm ngang: dùng đúng tỉ lệ này)
 *   s  = max(s0, min(16/30, W/1280, H/640))
 * Màn hình nhỏ (điện thoại, iPad dựng đứng) được phóng to thêm để chữ thường (30px logic) ≥ 16px thật;
 * khi đó vùng logic nhỏ hơn 1920×1080 (nhỏ nhất ~1280×640) và <html> có lớp `ui-compact`
 * (+ `ui-short` khi vùng logic thấp) để compact.css xếp lại bố cục cho vừa.
 * Kích thước logic = W/s × H/s; các thành phần neo theo góc/cạnh bằng CSS.
 */
export type LayerName = 'world' | 'hud' | 'panel' | 'dialog' | 'modal' | 'fx' | 'toast' | 'top';
const ORDER: LayerName[] = ['world', 'hud', 'panel', 'dialog', 'modal', 'fx', 'toast', 'top'];

export const BASE_W = 1920;
export const BASE_H = 1080;
/** Vùng logic nhỏ nhất khi phóng to cho màn hình nhỏ. */
const FIT_W = 1280;
const FIT_H = 640;
/** Tỉ lệ tối đa được phóng thêm: chữ 30px logic → 16px thật. */
const MAX_BOOST = 16 / 30;
/** Vùng logic thấp hơn mức này thì gắn lớp `ui-short` (điện thoại nằm ngang). */
const SHORT_H = 900;

/** Tỉ lệ giao diện cho cửa sổ W×H (CSS px). */
export function scaleFor(W: number, H: number): { s: number; compact: boolean } {
  const s0 = Math.min(W / BASE_W, H / BASE_H);
  const s = Math.max(s0, Math.min(MAX_BOOST, W / FIT_W, H / FIT_H));
  return { s, compact: s > s0 * 1.001 };
}

const layers = new Map<LayerName, HTMLElement>();
let root: HTMLElement;
let scale = 1;
let lw = BASE_W;
let lh = BASE_H;
const resizeFns = new Set<() => void>();

export function uiRoot(): HTMLElement {
  return root;
}

export function layer(name: LayerName): HTMLElement {
  return layers.get(name)!;
}

export function uiScale(): number {
  return scale;
}

/** Kích thước logic hiện tại của giao diện. */
export function uiSize(): { w: number; h: number; s: number } {
  return { w: lw, h: lh, s: scale };
}

/** Đăng ký hàm chạy khi cửa sổ đổi kích thước. Trả về hàm hủy. */
export function onUIResize(fn: () => void): () => void {
  resizeFns.add(fn);
  return () => resizeFns.delete(fn);
}

export function initUI(): void {
  root = document.getElementById('ui-root')!;
  for (const name of ORDER) {
    const el = h(`div.layer.layer-${name}`);
    root.appendChild(el);
    layers.set(name, el);
  }
  window.addEventListener('resize', sync);
  sync();
}

/** Đồng bộ tỉ lệ của lớp giao diện với cửa sổ. */
export function sync(): void {
  if (!root) return;
  const W = Math.max(1, window.innerWidth);
  const H = Math.max(1, window.innerHeight);
  const fit = scaleFor(W, H);
  scale = fit.s;
  lw = W / scale;
  lh = H / scale;
  root.style.width = `${lw}px`;
  root.style.height = `${lh}px`;
  root.style.transform = `scale(${scale})`;
  const de = document.documentElement;
  const ds = de.style;
  ds.setProperty('--ui-scale', String(scale));
  ds.setProperty('--ui-w', `${lw}px`);
  ds.setProperty('--ui-h', `${lh}px`);
  de.classList.toggle('ui-compact', fit.compact);
  de.classList.toggle('ui-short', fit.compact && lh < SHORT_H);
  for (const fn of resizeFns) fn();
}

/* ---------------- Khóa điều khiển nhân vật khi đang mở giao diện ---------------- */
const blockers = new Set<string>();
let blockSeq = 0;

export function pushBlock(tag = 'ui'): string {
  const id = `${tag}:${++blockSeq}`;
  blockers.add(id);
  return id;
}

export function popBlock(id: string): void {
  blockers.delete(id);
}

export function inputBlocked(): boolean {
  return blockers.size > 0;
}

export function clearBlocks(): void {
  blockers.clear();
}

/** Chuyển tọa độ màn hình (clientX/Y) sang tọa độ logic của giao diện. */
export function toLogical(clientX: number, clientY: number): { x: number; y: number } {
  const r = root.getBoundingClientRect();
  return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale };
}

/** Tọa độ điểm ảnh của canvas (CSS px) → tọa độ logic. */
export function pxToLogical(x: number, y: number): { x: number; y: number } {
  return { x: x / scale, y: y / scale };
}
